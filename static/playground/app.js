"use strict";

// ============================================================
// Bac à sable : entraînement d'un petit réseau dans le navigateur
// ============================================================

const DATASETS = [
    { key: "cercles", label: "Cercles" },
    { key: "xor", label: "Damier" },
    { key: "nuages", label: "Nuages" },
    { key: "lunes", label: "Lunes" },
    { key: "spirale", label: "Spirale" },
];
const POINT_COUNT = 260;
const MAX_LAYERS = 4;
const MAX_NEURONS = 8;
const COLORS = { 1: "#ffab40", 0: "#5cc1ea" };

const state = {
    dataset: "cercles",
    noise: 0.1,
    testRatio: 0.3,
    features: ["x", "y"],
    hidden: [4, 4],
    activation: "tanh",
    lr: 0.03,
    batch: 16,
    l2: 0,
    speed: 1,
    addClass: 1,
    showTest: false,
    discretize: false,
};

let train = [];          // [{x, y, label}]
let test = [];
let custom = [];         // points posés à la main (toujours dans l'entraînement)
let trainX = [], trainY = [], testX = [], testY = [];
let net = null;
let epoch = 0;
let history = [];        // [{train, test}] échantillonné
let running = false;
let frame = 0;
let slowCounter = 0;
let seed = (Math.random() * 1e9) | 0;

const $ = (id) => document.getElementById(id);
const field = $("field");
const fieldCtx = field.getContext("2d");
const pointsCanvas = $("points");
const pointsCtx = pointsCanvas.getContext("2d");
const lossCanvas = $("loss-chart");
const lossCtx = lossCanvas.getContext("2d");
const netSvg = $("net-svg");

// ============================================================
// Données
// ============================================================

function generateData() {
    const random = TinyNN.rng(seed);
    const all = TinyNN.shuffle(TinyNN.datasets[state.dataset](POINT_COUNT, state.noise, random), random);
    const nTest = Math.round(all.length * state.testRatio);
    test = all.slice(0, nTest);
    train = all.slice(nTest);
    custom = [];
    encodeData();
}

function encodeData() {
    const encode = (p) => TinyNN.featurize(p.x, p.y, state.features);
    const trainPoints = train.concat(custom);
    trainX = trainPoints.map(encode);
    trainY = trainPoints.map((p) => p.label);
    testX = test.map(encode);
    testY = test.map((p) => p.label);
}

// ============================================================
// Réseau
// ============================================================

function buildNetwork() {
    net = new TinyNN.Network([state.features.length, ...state.hidden, 1], { activation: state.activation });
    epoch = 0;
    history = [];
    $("param-count").textContent = `${net.parameterCount} paramètres`;
    renderLayerControls();
    $("diagnosis").textContent = "Lancez l'entraînement pour voir la perte diminuer.";
    renderAll();
}

function trainEpoch() {
    // Mélange à chaque époque : les lots ne sont jamais les mêmes
    const order = trainX.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    for (let b = 0; b < order.length; b += state.batch) {
        const idx = order.slice(b, b + state.batch);
        net.trainBatch(idx.map((i) => trainX[i]), idx.map((i) => trainY[i]), state.lr, { momentum: 0.9, l2: state.l2 });
    }
    epoch++;
}

function diverged() {
    return net.weights.some((W) => W.some((row) => row.some((w) => !Number.isFinite(w))));
}

// ============================================================
// Rendu
// ============================================================

function resizeCanvases() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = pointsCanvas.clientWidth;
    pointsCanvas.width = pointsCanvas.height = Math.max(1, Math.round(size * dpr));
    lossCanvas.width = Math.max(1, Math.round(lossCanvas.clientWidth * dpr));
    lossCanvas.height = Math.max(1, Math.round(lossCanvas.clientHeight * dpr));
}

function renderField() {
    TinyNN.paintBoundary(fieldCtx, net, state.features, field.width, { discretize: state.discretize });
}

function renderPoints() {
    const size = pointsCanvas.width;
    const scale = size / 2;
    const r = Math.max(3.5, size / 130);
    pointsCtx.clearRect(0, 0, size, size);

    // Axes discrets
    pointsCtx.strokeStyle = "rgba(244, 247, 251, 0.14)";
    pointsCtx.lineWidth = 1;
    pointsCtx.beginPath();
    pointsCtx.moveTo(scale, 0); pointsCtx.lineTo(scale, size);
    pointsCtx.moveTo(0, scale); pointsCtx.lineTo(size, scale);
    pointsCtx.stroke();

    const draw = (p, hollow) => {
        pointsCtx.beginPath();
        pointsCtx.arc((p.x + 1) * scale, (1 - p.y) * scale, r, 0, Math.PI * 2);
        if (hollow) {
            pointsCtx.fillStyle = "#040d21";
            pointsCtx.fill();
            pointsCtx.lineWidth = Math.max(2, r * 0.55);
            pointsCtx.strokeStyle = COLORS[p.label];
        } else {
            pointsCtx.fillStyle = COLORS[p.label];
            pointsCtx.fill();
            pointsCtx.lineWidth = Math.max(1, r * 0.3);
            pointsCtx.strokeStyle = "#040d21";
        }
        pointsCtx.stroke();
    };
    for (const p of train) draw(p, false);
    for (const p of custom) draw(p, false);
    if (state.showTest) for (const p of test) draw(p, true);
}

function renderLoss() {
    const W = lossCanvas.width, H = lossCanvas.height;
    const dpr = W / lossCanvas.clientWidth || 1;
    const pad = { l: 8 * dpr, r: 8 * dpr, t: 10 * dpr, b: 16 * dpr };
    lossCtx.clearRect(0, 0, W, H);
    lossCtx.font = `${10 * dpr}px "JetBrains Mono", monospace`;
    lossCtx.fillStyle = "#64799a";
    lossCtx.textBaseline = "alphabetic";

    if (history.length < 2) {
        lossCtx.textAlign = "center";
        lossCtx.fillText("La courbe de perte apparaîtra ici", W / 2, H / 2);
        return;
    }
    const max = Math.max(0.05, ...history.map((h) => Math.max(h.train, h.test)));
    const x = (i) => pad.l + (i / (history.length - 1)) * (W - pad.l - pad.r);
    const y = (v) => pad.t + (1 - Math.min(v, max) / max) * (H - pad.t - pad.b);

    lossCtx.strokeStyle = "#1d3558";
    lossCtx.lineWidth = 1;
    lossCtx.beginPath();
    lossCtx.moveTo(pad.l, y(0)); lossCtx.lineTo(W - pad.r, y(0));
    lossCtx.moveTo(pad.l, y(max)); lossCtx.lineTo(W - pad.r, y(max));
    lossCtx.stroke();
    lossCtx.textAlign = "left";
    lossCtx.fillText(max.toFixed(2), pad.l, y(max) - 2 * dpr);
    lossCtx.textAlign = "right";
    lossCtx.fillText(`époque ${epoch}`, W - pad.r, H - 3 * dpr);
    lossCtx.textAlign = "left";
    lossCtx.fillText("0", pad.l, H - 3 * dpr);

    for (const [key, color] of [["test", "#85d5e6"], ["train", "#ffab40"]]) {
        lossCtx.strokeStyle = color;
        lossCtx.lineWidth = 2 * dpr;
        lossCtx.lineJoin = "round";
        lossCtx.beginPath();
        history.forEach((h, i) => (i ? lossCtx.lineTo(x(i), y(h[key])) : lossCtx.moveTo(x(i), y(h[key]))));
        lossCtx.stroke();
    }
}

function svgEl(tag, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
}

function renderNetwork() {
    const W = 340, H = 210;
    const sizes = net.sizes;
    const colX = (l) => 34 + (l / (sizes.length - 1)) * (W - 68);
    const rowY = (l, i) => {
        const n = sizes[l];
        const gap = Math.min(24, (H - 44) / Math.max(n, 1));
        return H / 2 + 6 + (i - (n - 1) / 2) * gap;
    };
    netSvg.textContent = "";

    let maxW = 0.5;
    for (const layer of net.weights) for (const row of layer) for (const w of row) maxW = Math.max(maxW, Math.abs(w));

    for (let l = 0; l < net.weights.length; l++) {
        for (let j = 0; j < sizes[l + 1]; j++) {
            for (let i = 0; i < sizes[l]; i++) {
                const w = net.weights[l][j][i];
                const strength = Math.min(1, Math.abs(w) / maxW);
                netSvg.appendChild(svgEl("line", {
                    x1: colX(l), y1: rowY(l, i), x2: colX(l + 1), y2: rowY(l + 1, j),
                    stroke: w >= 0 ? "#ffab40" : "#5cc1ea",
                    "stroke-width": (0.4 + strength * 3.2).toFixed(2),
                    "stroke-opacity": (0.18 + strength * 0.7).toFixed(2),
                    "stroke-linecap": "round",
                }));
            }
        }
    }
    for (let l = 0; l < sizes.length; l++) {
        const isInput = l === 0, isOutput = l === sizes.length - 1;
        const label = svgEl("text", {
            x: colX(l), y: 13, "text-anchor": "middle", fill: "#64799a",
            "font-size": 8.5, "font-family": "JetBrains Mono, monospace",
        });
        label.textContent = isInput ? "ENTRÉES" : isOutput ? "SORTIE" : `C${l}`;
        netSvg.appendChild(label);
        for (let i = 0; i < sizes[l]; i++) {
            netSvg.appendChild(svgEl("circle", {
                cx: colX(l), cy: rowY(l, i), r: isOutput ? 9 : 7.5,
                fill: isInput ? "#11264a" : isOutput ? "#ffab40" : "#17305a",
                stroke: isInput ? "#85d5e6" : isOutput ? "#ffab40" : "#9bb0c9", "stroke-width": 1.4,
            }));
            if (isInput) {
                const t = svgEl("text", {
                    x: colX(l) - 12, y: rowY(l, i) + 3, "text-anchor": "end", fill: "#9bb0c9",
                    "font-size": 7.5, "font-family": "JetBrains Mono, monospace",
                });
                t.textContent = TinyNN.FEATURES[state.features[i]].label;
                netSvg.appendChild(t);
            }
        }
    }
}

function renderMetrics() {
    if (!trainX.length) return;
    const tr = net.evaluate(trainX, trainY);
    const te = testX.length ? net.evaluate(testX, testY) : tr;
    $("m-epoch").textContent = epoch;
    $("m-train").textContent = tr.loss.toFixed(3);
    $("m-test").textContent = te.loss.toFixed(3);
    $("m-acc").textContent = Math.round(te.accuracy * 100) + " %";
    return { tr, te };
}

function diagnose(tr, te) {
    const el = $("diagnosis");
    if (epoch < 30) {
        el.textContent = "Le réseau commence tout juste à ajuster ses poids.";
    } else if (te.accuracy >= 0.97 && te.loss < tr.loss * 2.5 + 0.05) {
        el.textContent = "Problème résolu : le réseau généralise bien aux points qu'il n'a jamais vus.";
    } else if (te.loss > tr.loss * 2.5 + 0.1 && tr.accuracy > 0.95) {
        el.textContent = "Surapprentissage : la perte d'entraînement baisse mais la perte de test remonte. Essayez moins de neurones, ou de la régularisation L2.";
    } else if (epoch > 300 && tr.accuracy < 0.8) {
        el.textContent = "Le réseau plafonne. Il manque peut-être de neurones, ou d'une entrée mieux adaptée au problème.";
    } else {
        el.textContent = "L'entraînement progresse : la frontière se rapproche des données.";
    }
}

function renderAll() {
    renderField();
    renderPoints();
    renderNetwork();
    renderLoss();
    return renderMetrics();
}

// ============================================================
// Boucle d'entraînement
// ============================================================

function recordHistory(tr, te) {
    history.push({ train: tr.loss, test: te.loss });
    // On garde une courbe légère : au-delà de 400 points, on en retire un sur deux
    if (history.length > 400) history = history.filter((_, i) => i % 2 === 0);
}

function step(epochs) {
    for (let i = 0; i < epochs; i++) trainEpoch();
    if (diverged()) {
        setRunning(false);
        $("diagnosis").textContent = "L'entraînement a divergé : le taux d'apprentissage est trop élevé, les poids ont explosé. Baissez-le puis réinitialisez.";
        return;
    }
    const m = renderAll();
    if (m) {
        recordHistory(m.tr, m.te);
        diagnose(m.tr, m.te);
    }
}

function loop() {
    frame = 0;
    if (!running) return;
    if (state.speed < 1) {
        // Mode lent : une époque toutes les 5 images
        slowCounter = (slowCounter + 1) % 5;
        if (slowCounter === 0) step(1);
    } else {
        step(state.speed);
    }
    if (running) frame = requestAnimationFrame(loop);
}

function setRunning(on) {
    running = on;
    $("btn-start").textContent = on ? "Pause" : "Entraîner";
    cancelAnimationFrame(frame);
    frame = on ? requestAnimationFrame(loop) : 0;
}

// ============================================================
// Interface
// ============================================================

function renderDatasetButtons() {
    const grid = $("dataset-grid");
    for (const d of DATASETS) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dataset-btn" + (d.key === state.dataset ? " active" : "");
        btn.dataset.key = d.key;
        const thumb = document.createElement("canvas");
        thumb.width = thumb.height = 56;
        const c = thumb.getContext("2d");
        for (const p of TinyNN.datasets[d.key](90, 0.05, TinyNN.rng(11))) {
            c.fillStyle = COLORS[p.label];
            c.fillRect((p.x + 1) * 28 - 1.5, (1 - p.y) * 28 - 1.5, 3, 3);
        }
        btn.append(thumb, d.label);
        btn.addEventListener("click", () => {
            state.dataset = d.key;
            grid.querySelectorAll(".dataset-btn").forEach((b) => b.classList.toggle("active", b === btn));
            seed = (Math.random() * 1e9) | 0;
            generateData();
            buildNetwork();
        });
        grid.appendChild(btn);
    }
}

function renderFeatureChips() {
    const list = $("feature-list");
    for (const [key, feature] of Object.entries(TinyNN.FEATURES)) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "feature-chip";
        chip.textContent = feature.label;
        chip.setAttribute("aria-pressed", String(state.features.includes(key)));
        chip.addEventListener("click", () => {
            const on = state.features.includes(key);
            if (on && state.features.length === 1) return; // il faut au moins une entrée
            state.features = Object.keys(TinyNN.FEATURES).filter((k) => (k === key ? !on : state.features.includes(k)));
            chip.setAttribute("aria-pressed", String(!on));
            encodeData();
            buildNetwork();
        });
        list.appendChild(chip);
    }
}

function renderLayerControls() {
    const box = $("layer-controls");
    box.textContent = "";
    state.hidden.forEach((n, l) => {
        const ctl = document.createElement("div");
        ctl.className = "layer-ctl";
        const minus = document.createElement("button");
        minus.type = "button";
        minus.textContent = "−";
        minus.disabled = n <= 1;
        minus.setAttribute("aria-label", `Retirer un neurone de la couche ${l + 1}`);
        const label = document.createElement("span");
        label.textContent = `C${l + 1} · ${n}`;
        const plus = document.createElement("button");
        plus.type = "button";
        plus.textContent = "+";
        plus.disabled = n >= MAX_NEURONS;
        plus.setAttribute("aria-label", `Ajouter un neurone à la couche ${l + 1}`);
        minus.addEventListener("click", () => { state.hidden[l]--; buildNetwork(); });
        plus.addEventListener("click", () => { state.hidden[l]++; buildNetwork(); });
        ctl.append(minus, label, plus);
        box.appendChild(ctl);
    });
    if (!state.hidden.length) {
        const note = document.createElement("span");
        note.className = "hint";
        note.textContent = "Aucune couche cachée : le réseau ne peut tracer qu'une frontière droite dans l'espace de ses entrées.";
        box.appendChild(note);
    }
    $("btn-add-layer").disabled = state.hidden.length >= MAX_LAYERS;
    $("btn-del-layer").disabled = state.hidden.length === 0;
}

$("btn-start").addEventListener("click", () => setRunning(!running));
$("btn-step").addEventListener("click", () => { setRunning(false); step(1); });
$("btn-reset").addEventListener("click", () => { setRunning(false); buildNetwork(); });
$("btn-regen").addEventListener("click", () => {
    seed = (Math.random() * 1e9) | 0;
    generateData();
    buildNetwork();
});
$("btn-add-layer").addEventListener("click", () => {
    if (state.hidden.length < MAX_LAYERS) state.hidden.push(state.hidden[state.hidden.length - 1] || 4);
    buildNetwork();
});
$("btn-del-layer").addEventListener("click", () => { state.hidden.pop(); buildNetwork(); });

document.querySelectorAll(".speed-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        state.speed = parseFloat(btn.dataset.speed);
        document.querySelectorAll(".speed-btn").forEach((b) => b.classList.toggle("active", b === btn));
    });
});

$("noise").addEventListener("input", (e) => {
    state.noise = e.target.value / 100;
    $("noise-out").textContent = e.target.value + " %";
    generateData();
    buildNetwork();
});
$("test-ratio").addEventListener("input", (e) => {
    state.testRatio = e.target.value / 100;
    $("test-out").textContent = e.target.value + " %";
    generateData();
    buildNetwork();
});

// Changer l'activation reconstruit le réseau ; les autres réglages
// s'appliquent en direct, pendant l'entraînement.
$("activation").addEventListener("change", (e) => { state.activation = e.target.value; buildNetwork(); });
$("lr").addEventListener("change", (e) => { state.lr = parseFloat(e.target.value); });
$("batch").addEventListener("change", (e) => { state.batch = parseInt(e.target.value, 10); });
$("l2").addEventListener("change", (e) => { state.l2 = parseFloat(e.target.value); });

$("show-test").addEventListener("change", (e) => { state.showTest = e.target.checked; renderPoints(); });
$("discretize").addEventListener("change", (e) => { state.discretize = e.target.checked; renderField(); });

document.querySelectorAll(".seg-btn[data-class]").forEach((btn) => {
    btn.addEventListener("click", () => {
        state.addClass = parseInt(btn.dataset.class, 10);
        document.querySelectorAll(".seg-btn[data-class]").forEach((b) => b.classList.toggle("active", b === btn));
    });
});

pointsCanvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const rect = pointsCanvas.getBoundingClientRect();
    custom.push({
        x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
        y: 1 - ((e.clientY - rect.top) / rect.height) * 2,
        label: state.addClass,
    });
    encodeData();
    renderPoints();
    renderMetrics();
});

let resizeTimer = 0;
window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resizeCanvases(); renderPoints(); renderLoss(); }, 100);
});
document.addEventListener("visibilitychange", () => {
    if (document.hidden && running) setRunning(false);
});

// ============================================================
// Démarrage
// ============================================================

renderDatasetButtons();
renderFeatureChips();
resizeCanvases();
generateData();
buildNetwork();
// Les polices arrivent après le premier rendu : on redessine les libellés du graphique.
if (document.fonts && document.fonts.ready) document.fonts.ready.then(renderLoss);
