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
    walkers.length = 0; // a rebuild drops the walkers with their margins
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
        const panel = { x, lines, cols, cw, lh, fs };
        hit.addEventListener("click", (ev) => drop(panel, Math.floor(ev.pageY / lh), Math.floor((ev.pageX - x) / cw)));
        document.body.appendChild(hit);
      }
    }
  }

  // Every click on a margin releases a red walker there. A walker is a short
  // snake that moves along the pattern: each step its head goes to a
  // neighbouring non-blank cell, keeping its heading when it can and otherwise
  // turning at random, inside the visible part of the margin. Each walker draws
  // its own left/right and up/down bias, and its own "temper". When a head runs
  // into another walker the two either annihilate or merge into one walker as
  // long as both together; the chance of annihilating is the mean of their
  // tempers, so it differs from collision to collision.
  const STEP = 70, LIFETIME = 45000, MAX_WALKERS = 40, MAX_LENGTH = 80;
  const walkers = [];
  let ticking = null;
  const MOVES = [[1, -1], [1, 1], [-1, -1], [-1, 1], [0, -2], [0, 2], [1, 0], [-1, 0], [0, -1], [0, 1]];

  function drop(panel, startRow, startCol) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || walkers.length >= MAX_WALKERS) return;
    const { lines, cols } = panel;
    const live = (r, c) => c >= 0 && c < cols && r >= 0 && r < lines.length && lines[r][c] !== " " && lines[r][c] !== undefined;
    let row = Math.max(0, startRow), col = Math.max(0, Math.min(cols - 1, startCol));
    search: for (let d = 0; d < 12; d++) {
      for (const [dr, dc] of [[0, -d], [0, d], [-d, 0], [d, 0], [d, d], [-d, -d], [d, -d], [-d, d]]) {
        if (live(row + dr, col + dc)) { row += dr; col += dc; break search; }
      }
    }
    walkers.push({
      panel, live,
      body: [[row, col]],
      length: 3 + Math.floor(Math.random() * 6),
      heading: MOVES[Math.floor(Math.random() * 4)],
      pRight: 0.2 + 0.6 * Math.random(),
      pDown: 0.2 + 0.6 * Math.random(),
      temper: Math.random(),
      born: performance.now(),
      els: [],
    });
    if (!ticking) ticking = setInterval(tick, STEP);
  }

  function segment(w) {
    const { fs, lh } = w.panel;
    const el = document.createElement("span");
    el.className = "motif";
    el.setAttribute("aria-hidden", "true");
    el.textContent = "●";
    el.style.cssText = `position:absolute;font:${fs}px/${lh}px var(--mono);color:var(--accent);pointer-events:none;z-index:1;transition:opacity 0.6s linear`;
    document.body.appendChild(el);
    return el;
  }

  function vanish(w) {
    for (const el of w.els) { el.style.opacity = "0"; setTimeout(() => el.remove(), 700); }
    w.els = [];
    w.dead = true;
  }

  function move(w) {
    const { lh } = w.panel;
    const top = Math.floor(window.scrollY / lh) + 5; // below the sticky menu
    const bottom = Math.min(w.panel.lines.length - 1, Math.floor((window.scrollY + window.innerHeight) / lh) - 1);
    const inside = (r) => r >= top && r <= bottom;
    let [row, col] = w.body[0];
    if (!inside(row)) {
      row += row < top ? 1 : -1; // the page scrolled away: drift back into view
    } else {
      const weight = ([dr, dc]) => (dc > 0 ? w.pRight : dc < 0 ? 1 - w.pRight : 0.5) * (dr > 0 ? w.pDown : dr < 0 ? 1 - w.pDown : 0.5);
      const options = MOVES.filter(([dr, dc]) => inside(row + dr) && w.live(row + dr, col + dc));
      if (options.length === 0) return;
      let m = options.includes(w.heading) && Math.random() < 0.75 ? w.heading : null;
      if (!m) {
        let pick = Math.random() * options.reduce((t, o) => t + weight(o), 0);
        m = options.find((o) => (pick -= weight(o)) <= 0) || options[0];
      }
      w.heading = m;
      row += m[0];
      col += m[1];
    }
    w.body.unshift([row, col]);
    w.body.length = Math.min(w.body.length, w.length);
  }

  function collide() {
    for (const a of walkers) {
      if (a.dead) continue;
      const [hr, hc] = a.body[0];
      for (const b of walkers) {
        if (b === a || b.dead || b.panel !== a.panel) continue;
        if (!b.body.some(([r, c]) => r === hr && c === hc)) continue;
        if (Math.random() < (a.temper + b.temper) / 2) {
          vanish(a);
          vanish(b);
        } else {
          const [big, small] = a.length >= b.length ? [a, b] : [b, a];
          big.length = Math.min(MAX_LENGTH, a.length + b.length);
          big.born = performance.now();
          vanish(small);
        }
        break;
      }
    }
  }

  function draw(w) {
    const { x, cw, lh } = w.panel;
    while (w.els.length < w.body.length) w.els.push(segment(w));
    while (w.els.length > w.body.length) w.els.pop().remove();
    w.body.forEach(([r, c], i) => {
      const el = w.els[i];
      el.style.left = `${x + c * cw}px`;
      el.style.top = `${r * lh}px`;
      el.style.opacity = String(1 - (0.7 * i) / Math.max(1, w.body.length));
    });
  }

  function tick() {
    const now = performance.now();
    for (const w of walkers) {
      if (w.dead) continue;
      if (now - w.born > LIFETIME) { vanish(w); continue; }
      move(w);
    }
    collide();
    for (let i = walkers.length - 1; i >= 0; i--) if (walkers[i].dead) walkers.splice(i, 1);
    walkers.forEach(draw);
    if (walkers.length === 0) { clearInterval(ticking); ticking = null; }
  }

  let pending;
  const schedule = () => { clearTimeout(pending); pending = setTimeout(build, 150); };
  // Fonts change both the character width and the page height, so wait for them.
  window.addEventListener("load", () => (document.fonts ? document.fonts.ready : Promise.resolve()).then(build));
  window.addEventListener("resize", schedule);
})();
