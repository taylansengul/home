// Margin motif: fills the empty space left and right of the content with a
// faint monospace pattern that runs the full height of the page.
// Change MOTIF to switch every page; ?m=<name> previews another one.
// Available: waves (travelling | standing wave), bifurcation (logistic map),
// ca (cellular automata, rules 30 | 90), pitchfork (pattern appearing).
// Only drawn when the margin is wide enough, so phones never see it.
(function () {
  const MOTIF = "ca";
  const requested = new URLSearchParams(location.search).get("m");
  const mode = requested in generators() ? requested : MOTIF;
  const RAMP = " .·:-=+*";

  const ramp = (v) => RAMP[Math.max(0, Math.min(RAMP.length - 1, Math.floor(v * RAMP.length)))];

  // Each generator returns row(t) -> string of `cols` characters.
  function generators() { return {
    // Elementary cellular automaton, single seed at the inner edge.
    ca(cols, side) {
      const rule = side === "left" ? 30 : 90;
      let cells = new Array(cols).fill(0);
      cells[side === "left" ? cols - 1 : 0] = 1;
      return () => {
        const s = cells.map((c) => (c ? "▪" : " ")).join("");
        cells = cells.map((_, i) => {
          const l = cells[(i - 1 + cols) % cols], c = cells[i], r = cells[(i + 1) % cols];
          return (rule >> ((l << 2) | (c << 1) | r)) & 1;
        });
        return s;
      };
    },
    // Space-time diagram: travelling wave on the left, standing wave on the right.
    waves(cols, side) {
      let t = 0;
      return () => {
        let s = "";
        for (let x = 0; x < cols; x++) {
          const v = side === "left"
            ? 0.5 + 0.5 * Math.cos(0.35 * x - 0.5 * t)
            : 0.5 + 0.5 * Math.cos(0.35 * x) * Math.cos(0.25 * t);
          s += ramp(v * v);
        }
        t++;
        return s;
      };
    },
    // Logistic-map bifurcation tree, parameter increasing down the page.
    bifurcation(cols, side, rows) {
      let row = 0;
      return () => {
        const r = 2.9 + (1.1 * row) / rows;
        const hits = new Array(cols).fill(0);
        let x = 0.5;
        for (let n = 0; n < 400; n++) {
          x = r * x * (1 - x);
          if (n > 200) {
            let c = Math.floor(x * cols);
            if (side === "left") c = cols - 1 - c;
            hits[Math.min(cols - 1, c)]++;
          }
        }
        row++;
        return hits.map((h) => (h === 0 ? " " : h > 30 ? "•" : h > 4 ? "·" : ".")).join("");
      };
    },
    // Dynamic transition: amplitude sqrt(lambda) grows down the page, the
    // pattern appears out of the homogeneous state.
    pitchfork(cols, side, rows) {
      let row = 0;
      return () => {
        const lam = row / rows - 0.15;
        const a = lam > 0 ? Math.min(1, Math.sqrt(lam) * 1.4) : 0;
        let s = "";
        for (let x = 0; x < cols; x++) s += ramp(a * (0.5 + 0.5 * Math.cos(0.45 * x + (side === "left" ? Math.PI : 0))));
        row++;
        return s;
      };
    },
  }; }

  function measure(fs) {
    const probe = document.createElement("span");
    probe.style.cssText = `font:${fs}px var(--mono);position:absolute;visibility:hidden;white-space:pre`;
    probe.textContent = "0".repeat(100);
    document.body.appendChild(probe);
    const w = probe.getBoundingClientRect().width / 100;
    probe.remove();
    return w;
  }

  function build() {
    document.querySelectorAll(".motif").forEach((e) => e.remove());
    const main = document.querySelector("main");
    if (!main) return;
    // Content edges: the widest child of <main>, since the homepage stops at the bio measure.
    let left = Infinity, right = 0;
    for (const el of main.children) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      left = Math.min(left, r.left);
      right = Math.max(right, r.right);
    }
    const fs = 11, lh = 13, gap = 48, edge = 16;
    const cw = measure(fs);
    const viewport = document.documentElement.clientWidth; // excludes the scrollbar
    const height = document.documentElement.scrollHeight;
    const rows = Math.ceil(height / lh);
    const leftW = left - gap - edge;
    const rightX = right + gap;
    const rightW = viewport - rightX - edge;
    const gens = generators();
    for (const [side, x, w] of [["left", edge, leftW], ["right", rightX, rightW]]) {
      const cols = Math.floor(w / cw);
      if (cols < 12) continue;
      const next = gens[mode](cols, side, rows);
      const lines = [];
      for (let i = 0; i < rows; i++) lines.push(next(i));
      const pre = document.createElement("pre");
      pre.className = "motif";
      pre.setAttribute("aria-hidden", "true");
      pre.style.cssText = `position:absolute;top:0;left:${x}px;width:${cols * cw}px;margin:0;font:${fs}px/${lh}px var(--mono);color:var(--muted);opacity:.28;pointer-events:none;user-select:none;z-index:0;height:${height}px;overflow:hidden`;
      pre.textContent = lines.join("\n");
      document.body.appendChild(pre);
      {
        // The margin takes clicks; the pre itself stays inert.
        const hit = document.createElement("div");
        hit.className = "motif";
        hit.setAttribute("aria-hidden", "true");
        hit.style.cssText = `position:absolute;top:0;left:${x}px;width:${cols * cw}px;height:${height}px;z-index:0`;
        hit.addEventListener("click", (ev) => drop({ x, lines, cols, cw, lh, fs, startCol: Math.floor((ev.pageX - x) / cw), startRow: Math.floor(ev.pageY / lh) }));
        document.body.appendChild(hit);
      }
    }
  }

  // A red character wanders along the pattern from where the margin was
  // clicked: each step it moves to a neighbouring non-blank cell, keeping its
  // heading when it can and otherwise turning at random. It stays inside the
  // visible part of the margin, and after a while it fades out. Every walker
  // draws its own bias for left/right and up/down, so no two move alike.
  const MAX_WALKERS = 5, LIFETIME = 30000, STEP = 70;
  let walkers = 0;

  function drop({ x, lines, cols, cw, lh, fs, startCol, startRow }) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || walkers >= MAX_WALKERS) return;
    const live = (r, c) => c >= 0 && c < cols && r >= 0 && r < lines.length && lines[r][c] !== " " && lines[r][c] !== undefined;
    const bounds = () => {
      const top = Math.floor(window.scrollY / lh) + 5; // below the sticky menu
      return [top, Math.min(lines.length - 1, Math.floor((window.scrollY + window.innerHeight) / lh) - 1)];
    };
    let row = Math.max(0, startRow), col = Math.max(0, Math.min(cols - 1, startCol));
    // Start on the nearest non-blank cell.
    search: for (let d = 0; d < 12; d++) {
      for (const [dr, dc] of [[0, -d], [0, d], [-d, 0], [d, 0], [d, d], [-d, -d], [d, -d], [-d, d]]) {
        if (live(row + dr, col + dc)) { row += dr; col += dc; break search; }
      }
    }
    const pRight = 0.2 + 0.6 * Math.random(), pDown = 0.2 + 0.6 * Math.random();
    const MOVES = [[1, -1], [1, 1], [-1, -1], [-1, 1], [0, -2], [0, 2], [1, 0], [-1, 0], [0, -1], [0, 1]];
    const weight = ([dr, dc]) => (dc > 0 ? pRight : dc < 0 ? 1 - pRight : 0.5) * (dr > 0 ? pDown : dr < 0 ? 1 - pDown : 0.5);
    let heading = MOVES[0];
    const born = performance.now();

    walkers++;
    const dot = document.createElement("span");
    dot.className = "motif";
    dot.setAttribute("aria-hidden", "true");
    dot.textContent = "●";
    dot.style.cssText = `position:absolute;font:${fs}px/${lh}px var(--mono);color:var(--accent);pointer-events:none;z-index:1;transition:opacity 1.5s linear`;
    document.body.appendChild(dot);
    const place = () => { dot.style.left = `${x + col * cw}px`; dot.style.top = `${row * lh}px`; };
    const finish = () => { walkers--; dot.style.opacity = "0"; setTimeout(() => dot.remove(), 1600); };

    const step = () => {
      if (!dot.isConnected) return walkers--;
      if (performance.now() - born > LIFETIME) return finish();
      const trail = dot.cloneNode(true);
      trail.style.opacity = "0.45";
      trail.style.transition = "opacity 1.2s linear";
      document.body.appendChild(trail);
      requestAnimationFrame(() => { trail.style.opacity = "0"; });
      setTimeout(() => trail.remove(), 1300);

      const [top, bottom] = bounds();
      const inside = (r) => r >= top && r <= bottom;
      if (!inside(row)) {
        // The page scrolled away: drift back towards the visible part.
        row += row < top ? 1 : -1;
      } else {
        const options = MOVES.filter(([dr, dc]) => inside(row + dr) && live(row + dr, col + dc));
        let move;
        if (options.length === 0) move = null;
        else if (options.includes(heading) && Math.random() < 0.75) move = heading;
        else {
          let total = options.reduce((t, m) => t + weight(m), 0), pick = Math.random() * total;
          move = options.find((m) => (pick -= weight(m)) <= 0) || options[0];
        }
        if (move) { heading = move; row += move[0]; col += move[1]; }
      }
      place();
      setTimeout(step, STEP);
    };
    place();
    step();
  }

  let pending;
  const schedule = () => { clearTimeout(pending); pending = setTimeout(build, 150); };
  // Fonts change both the character width and the page height, so wait for them.
  window.addEventListener("load", () => (document.fonts ? document.fonts.ready : Promise.resolve()).then(build));
  window.addEventListener("resize", schedule);
})();
