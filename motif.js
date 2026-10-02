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
      if (side === "right") {
        // The right margin takes clicks; the pre itself stays inert.
        const hit = document.createElement("div");
        hit.className = "motif";
        hit.setAttribute("aria-hidden", "true");
        hit.style.cssText = `position:absolute;top:0;left:${x}px;width:${cols * cw}px;height:${height}px;z-index:0`;
        hit.addEventListener("click", (ev) => drop({ x, lines, cols, cw, lh, fs, startCol: Math.floor((ev.pageX - x) / cw) }));
        document.body.appendChild(hit);
      }
    }
  }

  // A red character falls from the top of the visible window along the
  // pattern: each row it steps to a neighbouring non-blank cell, keeping its
  // direction while it can, so it slides down the lines of the motif.
  function drop({ x, lines, cols, cw, lh, fs, startCol }) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const live = (r, c) => c >= 0 && c < cols && lines[r] && lines[r][c] !== " " && lines[r][c] !== undefined;
    let row = Math.max(0, Math.floor(window.scrollY / lh) + 1);
    let col = Math.max(0, Math.min(cols - 1, startCol));
    for (let d = 0; d < cols && !live(row, col); d++) {
      if (live(row, col - d)) { col -= d; break; }
      if (live(row, col + d)) { col += d; break; }
    }
    let dir = Math.random() < 0.5 ? -1 : 1;
    let slid = 0;
    const dot = document.createElement("span");
    dot.className = "motif";
    dot.setAttribute("aria-hidden", "true");
    dot.textContent = "●";
    dot.style.cssText = `position:absolute;font:${fs}px/${lh}px var(--mono);color:var(--accent);pointer-events:none;z-index:1`;
    document.body.appendChild(dot);
    const place = (el, r, c) => { el.style.left = `${x + c * cw}px`; el.style.top = `${r * lh}px`; };
    const step = () => {
      if (!dot.isConnected || row >= lines.length - 1) return dot.remove();
      const trail = dot.cloneNode(true);
      trail.style.transition = "opacity 0.9s linear";
      trail.style.opacity = "0.5";
      document.body.appendChild(trail);
      requestAnimationFrame(() => { trail.style.opacity = "0"; });
      setTimeout(() => trail.remove(), 1000);
      const down = [dir, 0, -dir].filter((d) => live(row + 1, col + d));
      if (down.length) {
        // Follow the line down, keeping the current direction if possible.
        if (down[0] !== 0) dir = down[0];
        row++;
        col += down[0];
      } else {
        // Dead end: slide along this row (a triangle's base) to where a line continues.
        const along = [dir, -dir].find((d) => live(row, col + d) || live(row, col + 2 * d));
        if (along !== undefined && slid < cols) {
          dir = along;
          col += live(row, col + along) ? along : 2 * along;
          slid++;
        } else {
          row++;
          slid = 0;
        }
      }
      if (down.length) slid = 0;
      place(dot, row, col);
      setTimeout(step, 28);
    };
    place(dot, row, col);
    step();
  }

  let pending;
  const schedule = () => { clearTimeout(pending); pending = setTimeout(build, 150); };
  // Fonts change both the character width and the page height, so wait for them.
  window.addEventListener("load", () => (document.fonts ? document.fonts.ready : Promise.resolve()).then(build));
  window.addEventListener("resize", schedule);
})();
