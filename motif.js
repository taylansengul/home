// Margin motif: fills the empty space left and right of the content with a
// faint monospace pattern that runs the full height of the page.
// Change MOTIF to switch every page; ?m=<name> previews another one.
// Available: waves (travelling | standing wave), bifurcation (logistic map),
// ca (cellular automata, rules 30 | 90), pitchfork (pattern appearing).
// Only drawn when the margin is wide enough, so phones never see it.
(function () {
  const MOTIF = "waves";
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
    }
  }

  let pending;
  const schedule = () => { clearTimeout(pending); pending = setTimeout(build, 150); };
  // Fonts change both the character width and the page height, so wait for them.
  window.addEventListener("load", () => (document.fonts ? document.fonts.ready : Promise.resolve()).then(build));
  window.addEventListener("resize", schedule);
})();
