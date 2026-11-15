"use strict";

// ============================================================
// Labyrinthe Q-learning : un agent apprend par essais et erreurs
// ============================================================

const COLS = 10, ROWS = 7, CELL = 80;
const EMPTY = 0, WALL = 1, TRAP = 2, GOAL = 3;
const GOAL_REWARD = 10, TRAP_REWARD = -10;
const MAX_STEPS = 250;
// Actions : haut, droite, bas, gauche
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
const ARROWS = ["↑", "→", "↓", "←"];

const PRESETS = {
    couloir: {
        note: "Le chemin direct est barré par un mur : l'agent doit découvrir le détour.",
        start: [0, 3],
        rows: [
            "..........",
            "....#.....",
            "....#.....",
            "....#....G",
            "....#.....",
            "....#.....",
            "..........",
        ],
    },
    falaise: {
        note: "Le chemin le plus court longe les pièges. Activez le sol glissant : l'agent finit par préférer le détour, plus sûr.",
        start: [0, 6],
        rows: [
            "..........",
            "..........",
            "..........",
            "..........",
            "..........",
            "..........",
            ".TTTTTTTTG",
        ],
    },
    dedale: {
        note: "Plusieurs impasses, un piège sur la route : comptez les épisodes avant le premier succès.",
        start: [0, 0],
        rows: [
            "...#......",
            ".#.#.###..",
            ".#...#...#",
            ".###.#.#..",
            "...#...#T.",
            ".#.#####..",
            ".#.......G",
        ],
    },
    vide: {
        note: "Une page blanche : dessinez votre propre labyrinthe avec les outils ci-dessus.",
        start: [0, 3],
        rows: [
            "..........",
            "..........",
            "..........",
            ".........G",
            "..........",
            "..........",
            "..........",
        ],
    },
};

const params = { epsilon: 0.2, alpha: 0.3, gamma: 0.95, slip: 0, cost: 0.1 };

let grid = [];            // grid[y][x]
let start = { x: 0, y: 3 };
let Q = null;             // Float64Array(ROWS * COLS * 4)
let visited = null;       // Uint8Array : cases déjà rencontrées
let agent = { x: 0, y: 3 };
let trail = [];
let episode = 0, steps = 0, score = 0;
let scores = [];          // score de chaque épisode
let outcomes = [];        // true si le trésor a été atteint
let running = false, speed = 10, frame = 0, tickClock = 0;
let tool = "wall", view = "policy";
let hover = null;
let painting = false;

const $ = (id) => document.getElementById(id);
const canvas = $("grid");
const ctx = canvas.getContext("2d");
const chart = $("chart");
const chartCtx = chart.getContext("2d");

const qIndex = (x, y, a) => (y * COLS + x) * 4 + a;

// ============================================================
// Environnement et apprentissage
// ============================================================

function loadPreset(name) {
    const preset = PRESETS[name];
    grid = preset.rows.map((row) => [...row].map((c) => (c === "#" ? WALL : c === "T" ? TRAP : c === "G" ? GOAL : EMPTY)));
    start = { x: preset.start[0], y: preset.start[1] };
    $("preset-note").textContent = preset.note;
    forget();
}

function forget() {
    Q = new Float64Array(ROWS * COLS * 4);
    visited = new Uint8Array(ROWS * COLS);
    episode = 0;
    scores = [];
    outcomes = [];
    resetEpisode();
    render();
    updateStats();
}

function resetEpisode() {
    agent = { ...start };
    trail = [{ ...start }];
    steps = 0;
    score = 0;
    visited[start.y * COLS + start.x] = 1;
}

function bestAction(x, y) {
    // En cas d'égalité, on tire au sort : sinon l'agent favoriserait toujours « haut »
    let best = -Infinity, ties = [];
    for (let a = 0; a < 4; a++) {
        const q = Q[qIndex(x, y, a)];
        if (q > best + 1e-12) { best = q; ties = [a]; }
        else if (Math.abs(q - best) <= 1e-12) ties.push(a);
    }
    return ties[(Math.random() * ties.length) | 0];
}

/** Meilleure action pour l'affichage (sans tirage au sort, donc stable d'une image à l'autre). */
function displayAction(x, y) {
    let best = 0;
    for (let a = 1; a < 4; a++) if (Q[qIndex(x, y, a)] > Q[qIndex(x, y, best)]) best = a;
    return best;
}

function maxQ(x, y) {
    let m = -Infinity;
    for (let a = 0; a < 4; a++) m = Math.max(m, Q[qIndex(x, y, a)]);
    return m;
}

/** Un déplacement de l'agent et la mise à jour de Q correspondante. */
function stepAgent() {
    const { x, y } = agent;
    const action = Math.random() < params.epsilon ? (Math.random() * 4) | 0 : bestAction(x, y);
    // Sol glissant : le mouvement réellement effectué peut différer de celui choisi
    const moved = Math.random() < params.slip ? (Math.random() * 4) | 0 : action;

    let nx = x + DX[moved], ny = y + DY[moved];
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS || grid[ny][nx] === WALL) { nx = x; ny = y; }

    const cell = grid[ny][nx];
    const terminal = cell === GOAL || cell === TRAP;
    const reward = cell === GOAL ? GOAL_REWARD : cell === TRAP ? TRAP_REWARD : -params.cost;

    const i = qIndex(x, y, action);
    const target = reward + (terminal ? 0 : params.gamma * maxQ(nx, ny));
    Q[i] += params.alpha * (target - Q[i]);

    agent = { x: nx, y: ny };
    visited[ny * COLS + nx] = 1;
    trail.push({ x: nx, y: ny });
    if (trail.length > 40) trail.shift();
    steps++;
    score += reward;

    if (terminal || steps >= MAX_STEPS) {
        episode++;
        scores.push(score);
        outcomes.push(cell === GOAL);
        if (scores.length > 600) { scores.shift(); outcomes.shift(); }
        resetEpisode();
        return true;
    }
    return false;
}

// ============================================================
// Rendu
// ============================================================

function valueColor(v) {
    // Rouge (mauvais) -> encre -> vert (bon), saturé à ±10
    const t = Math.max(-1, Math.min(1, v / 10));
    const m = Math.abs(t);
    const [r, g, b] = t >= 0 ? [21, 122, 104] : [142, 47, 42];
    return `rgb(${Math.round(10 + (r - 10) * m)}, ${Math.round(25 + (g - 25) * m)}, ${Math.round(48 + (b - 48) * m)})`;
}

function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth || COLS * CELL;
    const scale = (cssW * dpr) / (COLS * CELL);
    canvas.width = Math.round(COLS * CELL * scale);
    canvas.height = Math.round(ROWS * CELL * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    chart.width = Math.max(1, Math.round(chart.clientWidth * dpr));
    chart.height = Math.max(1, Math.round(chart.clientHeight * dpr));
}

function drawArrow(cx, cy, action, size, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((action * Math.PI) / 2);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, size * 0.55);
    ctx.lineTo(0, -size * 0.35);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.75);
    ctx.lineTo(-size * 0.36, -size * 0.2);
    ctx.lineTo(size * 0.36, -size * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function render() {
    ctx.clearRect(0, 0, COLS * CELL, ROWS * CELL);

    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const px = x * CELL, py = y * CELL;
            const cell = grid[y][x];
            const seen = visited[y * COLS + x];

            if (cell === WALL) {
                ctx.fillStyle = "#2a4268";
                ctx.fillRect(px, py, CELL, CELL);
                ctx.fillStyle = "#33507c";
                ctx.fillRect(px + 5, py + 5, CELL - 10, CELL - 10);
            } else if (cell === GOAL || cell === TRAP) {
                ctx.fillStyle = cell === GOAL ? "#2cc4a5" : "#f0624d";
                ctx.fillRect(px, py, CELL, CELL);
                ctx.fillStyle = "#040d21";
                ctx.font = "700 20px 'JetBrains Mono', monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(cell === GOAL ? "+10" : "−10", px + CELL / 2, py + CELL / 2);
            } else {
                ctx.fillStyle = seen && view !== "none" ? valueColor(maxQ(x, y)) : "#0a1930";
                ctx.fillRect(px, py, CELL, CELL);

                if (view === "q" && seen) {
                    // Quatre triangles : la valeur de chaque direction
                    const c = [px + CELL / 2, py + CELL / 2];
                    const corners = [[px, py], [px + CELL, py], [px + CELL, py + CELL], [px, py + CELL]];
                    for (let a = 0; a < 4; a++) {
                        ctx.fillStyle = valueColor(Q[qIndex(x, y, a)]);
                        ctx.beginPath();
                        ctx.moveTo(c[0], c[1]);
                        ctx.lineTo(...corners[a]);
                        ctx.lineTo(...corners[(a + 1) % 4]);
                        ctx.closePath();
                        ctx.fill();
                        ctx.strokeStyle = "rgba(4, 13, 33, 0.55)";
                        ctx.lineWidth = 1;
                        ctx.stroke();
                        ctx.fillStyle = "#f4f7fb";
                        ctx.font = "500 11px 'JetBrains Mono', monospace";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText(Q[qIndex(x, y, a)].toFixed(1), c[0] + DX[a] * CELL * 0.3, c[1] + DY[a] * CELL * 0.31);
                    }
                } else if (view === "policy" && seen) {
                    const best = maxQ(x, y);
                    let spread = 0;
                    for (let a = 0; a < 4; a++) spread = Math.max(spread, best - Q[qIndex(x, y, a)]);
                    // Pas de flèche tant que l'agent n'a aucune préférence
                    if (spread > 1e-6) drawArrow(px + CELL / 2, py + CELL / 2, displayAction(x, y), 20, "rgba(244, 247, 251, 0.82)");
                }
            }
        }
    }

    // Quadrillage
    ctx.strokeStyle = "rgba(4, 13, 33, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 1; x < COLS; x++) { ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, ROWS * CELL); }
    for (let y = 1; y < ROWS; y++) { ctx.moveTo(0, y * CELL); ctx.lineTo(COLS * CELL, y * CELL); }
    ctx.stroke();

    // Départ
    ctx.strokeStyle = "#85d5e6";
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 6]);
    ctx.strokeRect(start.x * CELL + 7, start.y * CELL + 7, CELL - 14, CELL - 14);
    ctx.setLineDash([]);

    // Trace de l'épisode en cours
    if (trail.length > 1) {
        ctx.strokeStyle = "rgba(255, 171, 64, 0.45)";
        ctx.lineWidth = 4;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        trail.forEach((p, i) => {
            const tx = p.x * CELL + CELL / 2, ty = p.y * CELL + CELL / 2;
            if (i) ctx.lineTo(tx, ty); else ctx.moveTo(tx, ty);
        });
        ctx.stroke();
    }

    // Agent
    const ax = agent.x * CELL + CELL / 2, ay = agent.y * CELL + CELL / 2;
    ctx.fillStyle = "#ffab40";
    ctx.strokeStyle = "#040d21";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ax, ay, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#040d21";
    ctx.beginPath();
    ctx.arc(ax - 5, ay - 3, 2.6, 0, Math.PI * 2);
    ctx.arc(ax + 5, ay - 3, 2.6, 0, Math.PI * 2);
    ctx.fill();

    if (hover) {
        ctx.strokeStyle = "rgba(244, 247, 251, 0.9)";
        ctx.lineWidth = 2;
        ctx.strokeRect(hover.x * CELL + 1, hover.y * CELL + 1, CELL - 2, CELL - 2);
    }
}

function renderChart() {
    const W = chart.width, H = chart.height;
    const dpr = W / (chart.clientWidth || W);
    const pad = 10 * dpr;
    chartCtx.clearRect(0, 0, W, H);
    chartCtx.font = `${10 * dpr}px "JetBrains Mono", monospace`;
    chartCtx.fillStyle = "#64799a";

    if (scores.length < 2) {
        chartCtx.textAlign = "center";
        chartCtx.textBaseline = "middle";
        chartCtx.fillText("Score de chaque épisode", W / 2, H / 2);
        return;
    }
    const recent = scores.slice(-200);
    const min = Math.min(-1, ...recent), max = Math.max(1, ...recent);
    const x = (i) => pad + (i / (recent.length - 1)) * (W - 2 * pad);
    const y = (v) => pad + (1 - (v - min) / (max - min)) * (H - 2 * pad);

    chartCtx.strokeStyle = "#2c4a75";
    chartCtx.lineWidth = 1;
    chartCtx.setLineDash([4 * dpr, 4 * dpr]);
    chartCtx.beginPath();
    chartCtx.moveTo(pad, y(0)); chartCtx.lineTo(W - pad, y(0));
    chartCtx.stroke();
    chartCtx.setLineDash([]);
    chartCtx.textAlign = "left";
    chartCtx.textBaseline = "bottom";
    chartCtx.fillText("0", pad, y(0) - 2 * dpr);

    // Scores bruts, puis moyenne glissante par-dessus
    chartCtx.strokeStyle = "rgba(133, 213, 230, 0.35)";
    chartCtx.lineWidth = 1 * dpr;
    chartCtx.beginPath();
    recent.forEach((v, i) => (i ? chartCtx.lineTo(x(i), y(v)) : chartCtx.moveTo(x(i), y(v))));
    chartCtx.stroke();

    chartCtx.strokeStyle = "#ffab40";
    chartCtx.lineWidth = 2 * dpr;
    chartCtx.lineJoin = "round";
    chartCtx.beginPath();
    recent.forEach((_, i) => {
        const from = Math.max(0, i - 9);
        let sum = 0;
        for (let k = from; k <= i; k++) sum += recent[k];
        const avg = sum / (i - from + 1);
        if (i) chartCtx.lineTo(x(i), y(avg)); else chartCtx.moveTo(x(i), y(avg));
    });
    chartCtx.stroke();
}

function updateStats() {
    $("s-episode").textContent = episode;
    $("s-steps").textContent = steps;
    const last20 = scores.slice(-20);
    $("s-last").textContent = scores.length ? scores[scores.length - 1].toFixed(1) : "–";
    $("s-avg").textContent = last20.length ? (last20.reduce((a, b) => a + b, 0) / last20.length).toFixed(1) : "–";
    const wins = outcomes.slice(-20);
    $("s-success").textContent = wins.length ? Math.round((wins.filter(Boolean).length / wins.length) * 100) + " %" : "–";
    renderChart();
    renderCellInfo();
}

function renderCellInfo() {
    const box = $("cell-info");
    if (!hover) return;
    const { x, y } = hover;
    const cell = grid[y][x];
    box.textContent = "";
    const title = document.createElement("div");
    const kind = cell === WALL ? "un mur" : cell === GOAL ? "le trésor : l'épisode s'arrête ici" : cell === TRAP ? "un piège : l'épisode s'arrête ici" : "";
    title.textContent = `Colonne ${x + 1}, ligne ${y + 1}` + (kind ? ` · ${kind}` : "");
    box.appendChild(title);
    if (cell !== EMPTY) return;

    const best = maxQ(x, y);
    const cross = document.createElement("div");
    cross.className = "q-cross";
    // Disposition en croix : haut / gauche-centre-droite / bas
    const layout = [null, 0, null, 3, "c", 1, null, 2, null];
    for (const slot of layout) {
        const span = document.createElement("span");
        if (slot === null) span.className = "blank";
        else if (slot === "c") { span.className = "center"; span.textContent = "Q"; }
        else {
            const q = Q[qIndex(x, y, slot)];
            span.textContent = `${ARROWS[slot]} ${q.toFixed(2)}`;
            if (q === best && visited[y * COLS + x] && Math.abs(best) > 1e-9) span.className = "best";
        }
        cross.appendChild(span);
    }
    box.appendChild(cross);
}

// ============================================================
// Boucle
// ============================================================

function loop(now) {
    frame = 0;
    if (!running) return;
    if (speed >= 200) {
        // Vitesse maximale : 300 pas par image (plafonnés à 10 ms de calcul),
        // assez vite pour apprendre en quelques secondes, assez lentement pour le voir.
        const t0 = performance.now();
        for (let i = 0; i < 300 && performance.now() - t0 < 10; i++) stepAgent();
    } else {
        // 1x ≈ 6 pas par seconde, 10x ≈ 60
        const interval = 1000 / (6 * speed);
        if (!tickClock) tickClock = now;
        let guard = 0;
        while (now - tickClock >= interval && guard++ < 20) {
            stepAgent();
            tickClock += interval;
        }
        if (guard >= 20) tickClock = now;
    }
    render();
    updateStats();
    frame = requestAnimationFrame(loop);
}

function setRunning(on) {
    running = on;
    tickClock = 0;
    $("btn-start").textContent = on ? "Pause" : "Démarrer";
    cancelAnimationFrame(frame);
    frame = on ? requestAnimationFrame(loop) : 0;
}

// ============================================================
// Édition du labyrinthe
// ============================================================

function cellAt(e) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * COLS);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * ROWS);
    return x >= 0 && x < COLS && y >= 0 && y < ROWS ? { x, y } : null;
}

function paint(cell) {
    const { x, y } = cell;
    const isStart = x === start.x && y === start.y;
    if (tool === "start") {
        if (grid[y][x] !== EMPTY) return;
        start = { x, y };
        resetEpisode();
    } else {
        const value = { wall: WALL, trap: TRAP, goal: GOAL, empty: EMPTY }[tool];
        if (isStart && value !== EMPTY) return; // on ne mure pas la case de départ
        if (grid[y][x] === value) return;
        grid[y][x] = value;
        // La case change de nature : ce que l'agent en savait n'est plus valable
        for (let a = 0; a < 4; a++) Q[qIndex(x, y, a)] = 0;
        if (agent.x === x && agent.y === y && value !== EMPTY) resetEpisode();
    }
    $("preset-note").textContent = "Labyrinthe modifié : l'agent garde sa table Q et doit s'adapter. « Tout oublier » le fait repartir de zéro.";
    render();
}

canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const cell = cellAt(e);
    if (!cell) return;
    canvas.setPointerCapture(e.pointerId);
    painting = true;
    paint(cell);
});
canvas.addEventListener("pointermove", (e) => {
    const cell = cellAt(e);
    if (painting && cell && tool !== "start") paint(cell);
    if ((cell && (!hover || hover.x !== cell.x || hover.y !== cell.y)) || (!cell && hover)) {
        hover = cell;
        render();
        renderCellInfo();
    }
});
const endPaint = () => { painting = false; };
canvas.addEventListener("pointerup", endPaint);
canvas.addEventListener("pointercancel", endPaint);
canvas.addEventListener("pointerleave", () => {
    if (painting) return;
    hover = null;
    render();
});

// ============================================================
// Interface
// ============================================================

$("btn-start").addEventListener("click", () => setRunning(!running));
$("btn-step").addEventListener("click", () => {
    setRunning(false);
    stepAgent();
    render();
    updateStats();
});
$("btn-reset").addEventListener("click", () => { setRunning(false); forget(); });

document.querySelectorAll(".speed-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        speed = parseInt(btn.dataset.speed, 10);
        tickClock = 0;
        document.querySelectorAll(".speed-btn").forEach((b) => b.classList.toggle("active", b === btn));
    });
});
document.querySelectorAll(".tool").forEach((btn) => {
    btn.addEventListener("click", () => {
        tool = btn.dataset.tool;
        document.querySelectorAll(".tool").forEach((b) => b.classList.toggle("active", b === btn));
    });
});
document.querySelectorAll(".view").forEach((btn) => {
    btn.addEventListener("click", () => {
        view = btn.dataset.view;
        document.querySelectorAll(".view").forEach((b) => b.classList.toggle("active", b === btn));
        render();
    });
});
document.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => { setRunning(false); loadPreset(btn.dataset.preset); });
});

function bindSlider(id, key, format, transform = (v) => v) {
    const input = $("p-" + id), output = $("o-" + id);
    input.addEventListener("input", () => {
        params[key] = transform(parseFloat(input.value));
        output.textContent = format(parseFloat(input.value));
    });
}
bindSlider("epsilon", "epsilon", (v) => v.toFixed(2));
bindSlider("alpha", "alpha", (v) => v.toFixed(2));
bindSlider("gamma", "gamma", (v) => v.toFixed(2));
bindSlider("slip", "slip", (v) => v + " %", (v) => v / 100);
bindSlider("cost", "cost", (v) => (v === 0 ? "0.00" : "−" + v.toFixed(2)));

let resizeTimer = 0;
window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resizeCanvas(); render(); renderChart(); }, 100);
});
document.addEventListener("visibilitychange", () => { tickClock = 0; });

// ============================================================
// Démarrage
// ============================================================

grid = PRESETS.couloir.rows.map((row) => [...row].map(() => EMPTY));
Q = new Float64Array(ROWS * COLS * 4);
visited = new Uint8Array(ROWS * COLS);
resizeCanvas();
loadPreset("couloir");
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { render(); renderChart(); });
