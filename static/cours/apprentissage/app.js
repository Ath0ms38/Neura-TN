"use strict";

// ============================================================
// Cours : descente de gradient
// ============================================================

const C = Course.COLORS;
const $ = (id) => document.getElementById(id);
const fmt = (v, d = 2) => (Object.is(Math.round(v * 10 ** d), -0) ? 0 : v).toFixed(d);

// Générateur reproductible : tout le monde voit les mêmes points au chargement
function makeRandom(seed) {
    let a = seed >>> 0;
    const next = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.normal = () => Math.sqrt(-2 * Math.log(next() || 1e-9)) * Math.cos(2 * Math.PI * next());
    return next;
}

/** Repère : convertit des coordonnées mathématiques en pixels du canvas. */
function plot(w, h, [x0, x1], [y0, y1], pad = { l: 38, r: 14, t: 14, b: 28 }) {
    const X = (x) => pad.l + ((x - x0) / (x1 - x0)) * (w - pad.l - pad.r);
    const Y = (y) => h - pad.b - ((y - y0) / (y1 - y0)) * (h - pad.t - pad.b);
    return { X, Y, pad, w, h, x0, x1, y0, y1 };
}

function drawAxes(ctx, p, { xLabel, yLabel, xTicks = [], yTicks = [] }) {
    ctx.clearRect(0, 0, p.w, p.h);
    ctx.font = `10px ${Course.FONT.mono}`;
    ctx.lineWidth = 1;
    ctx.strokeStyle = C.grid;
    ctx.fillStyle = C.muted;
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    for (const t of yTicks) {
        ctx.beginPath(); ctx.moveTo(p.pad.l, p.Y(t)); ctx.lineTo(p.w - p.pad.r, p.Y(t)); ctx.stroke();
        ctx.fillText(String(t), p.pad.l - 6, p.Y(t));
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const t of xTicks) {
        ctx.beginPath(); ctx.moveTo(p.X(t), p.pad.t); ctx.lineTo(p.X(t), p.h - p.pad.b); ctx.stroke();
        ctx.fillText(String(t), p.X(t), p.h - p.pad.b + 5);
    }
    ctx.fillStyle = C.soft;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    if (xLabel) ctx.fillText(xLabel, p.w - p.pad.r, p.h - 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    if (yLabel) ctx.fillText(yLabel, 4, 2);
}

function dot(ctx, x, y, r, fill, stroke = C.ink) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = stroke;
    ctx.stroke();
}

// ============================================================
// 01 · Mesurer l'erreur
// ============================================================

const fitData = (() => {
    const r = makeRandom(42);
    return Array.from({ length: 14 }, () => {
        const x = r() * 3.6 - 1.8;
        return { x, y: 0.8 * x + 0.4 + r.normal() * 0.15 };
    });
})();

const mse = (w, b, data = fitData) => data.reduce((s, p) => s + (w * p.x + b - p.y) ** 2, 0) / data.length;

(function sectionFit() {
    const W = 560, H = 360;
    const ctx = Course.canvas($("fit-canvas"), W, H);
    const p = plot(W, H, [-2.2, 2.2], [-2.4, 2.8]);
    let best = Infinity;

    function draw() {
        const w = parseFloat($("fit-w").value), b = parseFloat($("fit-b").value);
        drawAxes(ctx, p, { xLabel: "x", yLabel: "y", xTicks: [-2, -1, 0, 1, 2], yTicks: [-2, -1, 0, 1, 2] });

        // Résidus
        ctx.strokeStyle = C.red;
        ctx.lineWidth = 2;
        for (const pt of fitData) {
            ctx.beginPath();
            ctx.moveTo(p.X(pt.x), p.Y(pt.y));
            ctx.lineTo(p.X(pt.x), p.Y(w * pt.x + b));
            ctx.stroke();
        }
        // Droite du modèle
        ctx.strokeStyle = C.amber;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p.X(-2.2), p.Y(w * -2.2 + b));
        ctx.lineTo(p.X(2.2), p.Y(w * 2.2 + b));
        ctx.stroke();
        for (const pt of fitData) dot(ctx, p.X(pt.x), p.Y(pt.y), 5, C.cyan);

        const loss = mse(w, b);
        best = Math.min(best, loss);
        $("fit-w-val").textContent = fmt(w);
        $("fit-b-val").textContent = fmt(b);
        $("fit-loss").textContent = fmt(loss, 3);
        $("fit-best").textContent = fmt(best, 3);
        if (loss < 0.1) Course.complete(1, "Bien joué. Vous venez de faire, à la main, ce que la descente de gradient fait automatiquement.");
    }

    $("fit-w").addEventListener("input", draw);
    $("fit-b").addEventListener("input", draw);
    draw();
})();

// ============================================================
// 02 · Descendre la pente (une dimension)
// ============================================================

(function sectionDescent() {
    const W = 560, H = 330;
    const ctx = Course.canvas($("gd-canvas"), W, H);

    // La perte en fonction de w seul (b fixé à sa meilleure valeur) est une parabole exacte.
    const n = fitData.length;
    const mx = fitData.reduce((s, q) => s + q.x, 0) / n;
    const my = fitData.reduce((s, q) => s + q.y, 0) / n;
    const sxx = fitData.reduce((s, q) => s + (q.x - mx) ** 2, 0) / n;
    const sxy = fitData.reduce((s, q) => s + (q.x - mx) * (q.y - my), 0) / n;
    const wStar = sxy / sxx;
    const lossAt = (w) => mse(w, my - w * mx);
    const gradAt = (w) => 2 * sxx * (w - wStar);

    const START = -1.6;
    const p = plot(W, H, [-2.6, 4.2], [0, lossAt(START) * 1.25]);
    let w = START, steps = 0, path = [START], timer = 0, finished = false;

    function draw() {
        drawAxes(ctx, p, { xLabel: "pente w", yLabel: "perte", xTicks: [-2, -1, 0, 1, 2, 3, 4], yTicks: [0, 2, 4, 6] });

        ctx.strokeStyle = C.cyan;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i <= 200; i++) {
            const x = p.x0 + (i / 200) * (p.x1 - p.x0);
            const y = Math.min(lossAt(x), p.y1 * 1.2);
            if (i) ctx.lineTo(p.X(x), p.Y(y)); else ctx.moveTo(p.X(x), p.Y(y));
        }
        ctx.stroke();

        // Trajectoire
        ctx.strokeStyle = "rgba(255, 171, 64, 0.55)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        path.forEach((v, i) => {
            const x = p.X(Math.max(p.x0, Math.min(p.x1, v))), y = p.Y(Math.min(lossAt(v), p.y1));
            if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
        path.slice(0, -1).forEach((v) => {
            if (v > p.x0 && v < p.x1 && lossAt(v) < p.y1) dot(ctx, p.X(v), p.Y(lossAt(v)), 3.5, "rgba(255, 171, 64, 0.5)");
        });

        if (w > p.x0 && w < p.x1 && lossAt(w) < p.y1) {
            // Tangente : la pente locale, c'est le gradient
            const g = gradAt(w), half = 0.55;
            ctx.strokeStyle = C.text;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(p.X(w - half), p.Y(lossAt(w) - g * half));
            ctx.lineTo(p.X(w + half), p.Y(lossAt(w) + g * half));
            ctx.stroke();
            dot(ctx, p.X(w), p.Y(lossAt(w)), 8, C.amber);
        }

        $("gd-steps").textContent = steps;
        $("gd-w").textContent = Math.abs(w) > 999 ? "∞" : fmt(w);
        $("gd-grad").textContent = Math.abs(gradAt(w)) > 9999 ? "∞" : fmt(gradAt(w));
        $("gd-loss").textContent = lossAt(w) > 9999 ? "∞" : fmt(lossAt(w), 3);
    }

    function stop() {
        clearInterval(timer);
        timer = 0;
        $("gd-run").textContent = "Descendre";
    }

    function step() {
        if (finished) return;
        const lr = parseFloat($("gd-lr").value);
        const before = Math.abs(w - wStar);
        w -= lr * gradAt(w);
        steps++;
        path.push(w);
        const after = Math.abs(w - wStar);
        const msg = $("gd-message");

        if (after < 0.03) {
            finished = true;
            stop();
            msg.innerHTML = `Arrivé au fond en <strong>${steps} pas</strong>. Le gradient est presque nul : plus rien à corriger.`;
            if (steps <= 5) Course.complete(2, `Fond atteint en ${steps} pas avec η = ${fmt(lr)}.`);
            else if (!Course.isDone(2)) $("challenge-2").querySelector(".challenge-feedback").textContent = `${steps} pas : c'est trop. Recommencez avec un taux plus grand.`;
        } else if (Math.abs(w) > 40) {
            finished = true;
            stop();
            msg.innerHTML = "<strong>Divergence.</strong> Chaque pas dépasse le fond et atterrit plus haut sur le versant opposé : l'erreur explose. Baissez le taux d'apprentissage.";
        } else if (after > before) {
            msg.innerHTML = "Le pas est trop grand : la bille saute par-dessus le fond et remonte <strong>plus haut</strong> en face.";
        } else if ((w - wStar) * (path[path.length - 2] - wStar) < 0) {
            msg.innerHTML = "La bille a dépassé le fond mais atterrit plus bas : elle oscille en se rapprochant.";
        } else if (after / before > 0.85) {
            msg.innerHTML = "Le taux est faible : chaque pas ne fait gagner que quelques pourcents. On y arrivera, lentement.";
        } else {
            msg.innerHTML = "La bille descend. Remarquez que les pas raccourcissent d'eux-mêmes : près du fond, la pente est plus douce.";
        }
        draw();
    }

    function reset() {
        stop();
        w = START; steps = 0; path = [START]; finished = false;
        $("gd-message").textContent = "Cliquez sur « Un pas » : la bille se déplace à l'opposé de la pente.";
        draw();
    }

    $("gd-step").addEventListener("click", () => { stop(); step(); });
    $("gd-run").addEventListener("click", () => {
        if (timer) return stop();
        if (finished) reset();
        $("gd-run").textContent = "Pause";
        timer = setInterval(() => { if (steps >= 120) stop(); else step(); }, 260);
    });
    $("gd-reset").addEventListener("click", reset);
    $("gd-lr").addEventListener("input", (e) => { $("gd-lr-val").textContent = fmt(parseFloat(e.target.value)); });
    draw();
})();

// ============================================================
// 03 · Un paysage à deux paramètres
// ============================================================

(function sectionLandscape() {
    const W = 560, H = 400;
    const canvas = $("land-canvas");
    const ctx = Course.canvas(canvas, W, H);
    const p = plot(W, H, [-1.6, 3.6], [-3.4, 3.4]);

    // Perte quadratique d'une régression sur des x non centrés : une vallée étroite et oblique.
    const HXX = 2.58, HXB = 1.5, HBB = 1, W_STAR = 1, B_STAR = 0;
    const loss = (w, b) => {
        const dw = w - W_STAR, db = b - B_STAR;
        return HXX * dw * dw + 2 * HXB * dw * db + HBB * db * db;
    };
    const grad = (w, b) => {
        const dw = w - W_STAR, db = b - B_STAR;
        return [2 * (HXX * dw + HXB * db), 2 * (HXB * dw + HBB * db)];
    };

    const DEFAULT_START = { w: 2.7, b: -1.1 };
    let start = { ...DEFAULT_START };
    let pos, vel, steps, path, timer = 0, finished;

    // Le relief ne change jamais : on le dessine une seule fois.
    const relief = document.createElement("canvas");
    relief.width = 280; relief.height = 200;
    (() => {
        const rc = relief.getContext("2d");
        const img = rc.createImageData(relief.width, relief.height);
        for (let j = 0; j < relief.height; j++) {
            for (let i = 0; i < relief.width; i++) {
                const w = p.x0 + (i / relief.width) * (p.x1 - p.x0);
                const b = p.y1 - (j / relief.height) * (p.y1 - p.y0);
                const level = Math.sqrt(loss(w, b));
                const t = Math.min(1, level / 6);
                // Lignes de niveau : assombrissement périodique
                const band = Math.abs((level * 1.6) % 1 - 0.5) < 0.06 ? 0.55 : 1;
                const k = (j * relief.width + i) * 4;
                img.data[k] = (16 + t * 70) * band;
                img.data[k + 1] = (62 - t * 30) * band + (1 - t) * 40;
                img.data[k + 2] = (110 - t * 40) * band + (1 - t) * 30;
                img.data[k + 3] = 255;
            }
        }
        rc.putImageData(img, 0, 0);
    })();

    function draw() {
        drawAxes(ctx, p, { xLabel: "pente w", yLabel: "ordonnée b", xTicks: [-1, 0, 1, 2, 3], yTicks: [-3, -2, -1, 0, 1, 2, 3] });
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(relief, p.pad.l, p.pad.t, W - p.pad.l - p.pad.r, H - p.pad.t - p.pad.b);

        // Fond de la vallée
        ctx.strokeStyle = C.text;
        ctx.lineWidth = 1.5;
        const cx = p.X(W_STAR), cy = p.Y(B_STAR);
        ctx.beginPath();
        ctx.moveTo(cx - 7, cy); ctx.lineTo(cx + 7, cy);
        ctx.moveTo(cx, cy - 7); ctx.lineTo(cx, cy + 7);
        ctx.stroke();

        ctx.save();
        ctx.beginPath();
        ctx.rect(p.pad.l, p.pad.t, W - p.pad.l - p.pad.r, H - p.pad.t - p.pad.b);
        ctx.clip();
        ctx.strokeStyle = C.amber;
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        ctx.beginPath();
        path.forEach((q, i) => (i ? ctx.lineTo(p.X(q.w), p.Y(q.b)) : ctx.moveTo(p.X(q.w), p.Y(q.b))));
        ctx.stroke();
        path.forEach((q) => dot(ctx, p.X(q.w), p.Y(q.b), 2.5, C.amber, "transparent"));
        dot(ctx, p.X(start.w), p.Y(start.b), 5, C.ink, C.text);
        dot(ctx, p.X(pos.w), p.Y(pos.b), 7, C.amber);
        ctx.restore();

        $("land-steps").textContent = steps;
        const l = loss(pos.w, pos.b);
        $("land-loss").textContent = l > 9999 ? "∞" : fmt(l, 3);
    }

    function stop() {
        clearInterval(timer);
        timer = 0;
        $("land-run").textContent = "Descendre";
    }

    function reset() {
        stop();
        pos = { ...start };
        vel = [0, 0];
        steps = 0;
        path = [{ ...start }];
        finished = false;
        draw();
    }

    function step() {
        const lr = parseFloat($("land-lr").value), mom = parseFloat($("land-mom").value);
        const [gw, gb] = grad(pos.w, pos.b);
        vel = [mom * vel[0] - lr * gw, mom * vel[1] - lr * gb];
        pos = { w: pos.w + vel[0], b: pos.b + vel[1] };
        steps++;
        path.push({ ...pos });
        const l = loss(pos.w, pos.b);
        const fb = $("challenge-3").querySelector(".challenge-feedback");
        const fromDefault = start.w === DEFAULT_START.w && start.b === DEFAULT_START.b;

        if (l < 0.02) {
            finished = true;
            stop();
            if (fromDefault && steps < 15) Course.complete(3, `Fond atteint en ${steps} pas (η = ${fmt(lr)}, élan = ${fmt(mom)}).`);
            else if (!Course.isDone(3)) fb.textContent = fromDefault ? `Fond atteint, mais en ${steps} pas. Ajoutez de l'élan pour aller plus vite.` : "Fond atteint. Pour le défi, repartez du départ par défaut (rechargez la page).";
        } else if (!Number.isFinite(l) || l > 1e4) {
            finished = true;
            stop();
            if (!Course.isDone(3)) fb.textContent = "Divergence : le pas est trop grand pour le versant le plus raide de la vallée.";
        } else if (steps >= 200) {
            finished = true;
            stop();
            if (!Course.isDone(3)) fb.textContent = "200 pas et toujours pas au fond : la descente rampe le long de la vallée.";
        }
        draw();
    }

    $("land-run").addEventListener("click", () => {
        if (timer) return stop();
        if (finished || steps > 0) reset();
        $("land-run").textContent = "Pause";
        timer = setInterval(step, 70);
    });
    $("land-reset").addEventListener("click", reset);
    $("land-lr").addEventListener("input", (e) => { $("land-lr-val").textContent = fmt(parseFloat(e.target.value)); });
    $("land-mom").addEventListener("input", (e) => { $("land-mom-val").textContent = fmt(parseFloat(e.target.value)); });
    canvas.addEventListener("pointerdown", (e) => {
        const q = Course.pointer(canvas, e, W, H);
        const w = p.x0 + ((q.x - p.pad.l) / (W - p.pad.l - p.pad.r)) * (p.x1 - p.x0);
        const b = p.y1 - ((q.y - p.pad.t) / (H - p.pad.t - p.pad.b)) * (p.y1 - p.y0);
        if (w < p.x0 || w > p.x1 || b < p.y0 || b > p.y1) return;
        start = { w, b };
        reset();
    });
    reset();
})();

// ============================================================
// 04 · Rétropropagation pas à pas
// ============================================================

(function sectionBackprop() {
    const svg = $("bp-svg");
    const NS = "http://www.w3.org/2000/svg";
    const X = 1.5, TARGET = 1.0, LR = 0.2;
    const INITIAL = { w1: 0.8, w2: -0.5 };
    let weights = { ...INITIAL }, stage = 0, updates = 0;

    function compute() {
        const h = Math.tanh(weights.w1 * X);
        const yhat = weights.w2 * h;
        const L = (yhat - TARGET) ** 2;
        const dY = 2 * (yhat - TARGET);
        const dW2 = dY * h;
        const dH = dY * weights.w2;
        const dW1 = dH * (1 - h * h) * X;
        return { h, yhat, L, dY, dW2, dH, dW1 };
    }

    const el = (tag, attrs, text) => {
        const node = document.createElementNS(NS, tag);
        for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
        if (text !== undefined) node.textContent = text;
        svg.appendChild(node);
        return node;
    };
    const label = (x, y, text, color, size = 12, weight = 500) =>
        el("text", { x, y, fill: color, "font-size": size, "font-weight": weight, "text-anchor": "middle", "font-family": "JetBrains Mono, monospace" }, text);

    function render() {
        const v = compute();
        svg.textContent = "";
        const nodes = [
            { x: 60, name: "x", value: fmt(X), from: 0 },
            { x: 240, name: "h = tanh(w₁·x)", value: fmt(v.h, 3), from: 1 },
            { x: 420, name: "ŷ = w₂·h", value: fmt(v.yhat, 3), from: 2 },
            { x: 580, name: "(ŷ − y)²", value: fmt(v.L, 3), from: 3 },
        ];
        const Y = 96;

        // Arêtes (passe avant, de gauche à droite)
        [[0, 1, `w₁ = ${fmt(weights.w1, 3)}`], [1, 2, `w₂ = ${fmt(weights.w2, 3)}`], [2, 3, `y = ${fmt(TARGET)}`]].forEach(([a, b, text]) => {
            el("line", { x1: nodes[a].x + 44, y1: Y, x2: nodes[b].x - 50, y2: Y, stroke: C.axis, "stroke-width": 2 });
            el("path", { d: `M${nodes[b].x - 50} ${Y}l-8 -5v10z`, fill: C.axis });
            label((nodes[a].x + nodes[b].x) / 2, Y - 12, text, C.cyan, 11);
        });

        nodes.forEach((n, i) => {
            const known = stage >= n.from;
            const isLoss = i === 3;
            el("rect", {
                x: n.x - 44, y: Y - 26, width: 88, height: 52, rx: 10,
                fill: known ? (isLoss ? "rgba(240, 98, 77, 0.16)" : C.panel) : C.ink,
                stroke: known ? (isLoss ? C.red : C.soft) : C.grid, "stroke-width": 1.5,
            });
            label(n.x, Y + 6, known ? n.value : "?", known ? C.text : C.muted, 15, 700);
            label(n.x, Y - 38, i === 3 ? "Perte" : n.name, C.soft, 10.5);
        });

        // Gradients (passe arrière, de droite à gauche)
        const grads = [
            { at: 4, x: 420, y: 168, text: `∂L/∂ŷ = ${fmt(v.dY, 3)}` },
            { at: 5, x: 330, y: 204, text: `∂L/∂w₂ = ${fmt(v.dW2, 3)}`, weight: true },
            { at: 6, x: 240, y: 168, text: `∂L/∂h = ${fmt(v.dH, 3)}` },
            { at: 7, x: 150, y: 204, text: `∂L/∂w₁ = ${fmt(v.dW1, 3)}`, weight: true },
        ];
        for (const g of grads) {
            if (stage < g.at) continue;
            const current = stage === g.at;
            const tw = g.text.length * 7.4 + 18;
            el("rect", {
                x: g.x - tw / 2, y: g.y - 16, width: tw, height: 24, rx: 12,
                fill: current ? C.amber : "rgba(255, 171, 64, 0.12)", stroke: C.amber, "stroke-width": 1,
            });
            label(g.x, g.y, g.text, current ? "#1a0f00" : C.amber, 11.5, 600);
            el("line", { x1: g.x, y1: g.y - 16, x2: g.x, y2: g.weight ? Y + 4 : Y + 28, stroke: C.amber, "stroke-width": 1, "stroke-dasharray": "3 3", opacity: 0.6 });
        }
        if (stage >= 4) {
            el("path", { d: "M600 140 H80", stroke: C.amber, "stroke-width": 1.5, fill: "none", opacity: 0.5 });
            el("path", { d: "M80 140l8 -5v10z", fill: C.amber, opacity: 0.7 });
            label(340, 134, "passe arrière", C.amber, 9.5);
        }

        const messages = [
            `<strong>Départ.</strong> Entrée x = ${fmt(X)}, cible y = ${fmt(TARGET)}. Les poids sont connus, tout le reste est à calculer.`,
            `<strong>Passe avant 1/3.</strong> h = tanh(w₁ · x) = tanh(${fmt(weights.w1 * X, 3)}) = <strong>${fmt(v.h, 3)}</strong>`,
            `<strong>Passe avant 2/3.</strong> ŷ = w₂ · h = ${fmt(weights.w2, 3)} × ${fmt(v.h, 3)} = <strong>${fmt(v.yhat, 3)}</strong>`,
            `<strong>Passe avant 3/3.</strong> Perte = (ŷ − y)² = (${fmt(v.yhat - TARGET, 3)})² = <strong>${fmt(v.L, 3)}</strong>. Maintenant, on remonte.`,
            `<strong>Passe arrière 1/4.</strong> Dérivée de la perte par rapport à la sortie : ∂L/∂ŷ = 2 · (ŷ − y) = <strong>${fmt(v.dY, 3)}</strong>`,
            `<strong>Passe arrière 2/4.</strong> ŷ = w₂ · h, donc ∂ŷ/∂w₂ = h. Gradient de w₂ : ${fmt(v.dY, 3)} × ${fmt(v.h, 3)} = <strong>${fmt(v.dW2, 3)}</strong>`,
            `<strong>Passe arrière 3/4.</strong> Le gradient continue vers la gauche : ∂L/∂h = ∂L/∂ŷ · w₂ = <strong>${fmt(v.dH, 3)}</strong>`,
            `<strong>Passe arrière 4/4.</strong> Dérivée de tanh : 1 − h². Gradient de w₁ : ${fmt(v.dH, 3)} × ${fmt(1 - v.h * v.h, 3)} × ${fmt(X)} = <strong>${fmt(v.dW1, 3)}</strong>. Tous les gradients sont connus : on peut mettre à jour.`,
        ];
        $("bp-message").innerHTML = messages[stage];
        $("bp-prev").disabled = stage === 0;
        $("bp-next").disabled = stage === 7;
        $("bp-apply").disabled = stage !== 7;
        $("bp-updates").textContent = updates;
        $("bp-loss").textContent = stage >= 3 || updates > 0 ? fmt(v.L, 4) : "–";
    }

    $("bp-next").addEventListener("click", () => { stage = Math.min(7, stage + 1); render(); });
    $("bp-prev").addEventListener("click", () => { stage = Math.max(0, stage - 1); render(); });
    $("bp-apply").addEventListener("click", () => {
        const v = compute();
        weights = { w1: weights.w1 - LR * v.dW1, w2: weights.w2 - LR * v.dW2 };
        updates++;
        stage = 3; // les nouvelles valeurs de la passe avant sont affichées, les gradients sont à refaire
        render();
        $("bp-message").innerHTML = `<strong>Mise à jour n° ${updates}.</strong> Chaque poids a reculé de η × son gradient (η = ${LR}). La perte vaut maintenant <strong>${fmt(compute().L, 4)}</strong>. Refaites une passe arrière pour continuer.`;
    });
    $("bp-reset").addEventListener("click", () => { weights = { ...INITIAL }; stage = 0; updates = 0; render(); });
    render();
})();

// ============================================================
// 05 · Surapprentissage
// ============================================================

(function sectionOverfit() {
    const W = 560, H = 300, BW = 560, BH = 150, MAX_DEGREE = 11;
    const ctx = Course.canvas($("poly-canvas"), W, H);
    const bars = Course.canvas($("poly-bars"), BW, BH);
    const p = plot(W, H, [-1.08, 1.08], [-1.7, 1.7]);
    const truth = (x) => 0.9 * Math.sin(3 * x);

    let trainPts, testPts, fits, bestDegree, seed = 7;

    /** Moindres carrés polynomiaux : résout (AᵀA + λI) c = Aᵀy par pivot de Gauss. */
    function fit(points, degree) {
        const n = degree + 1;
        const M = Array.from({ length: n }, () => new Float64Array(n + 1));
        for (const { x, y } of points) {
            const pow = [1];
            for (let k = 1; k <= 2 * degree; k++) pow.push(pow[k - 1] * x);
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) M[i][j] += pow[i + j];
                M[i][n] += pow[i] * y;
            }
        }
        for (let i = 0; i < n; i++) M[i][i] += 1e-9;
        for (let col = 0; col < n; col++) {
            let pivot = col;
            for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
            [M[col], M[pivot]] = [M[pivot], M[col]];
            for (let r = 0; r < n; r++) {
                if (r === col) continue;
                const f = M[r][col] / M[col][col];
                for (let k = col; k <= n; k++) M[r][k] -= f * M[col][k];
            }
        }
        return M.map((row, i) => row[n] / row[i]);
    }
    const evalPoly = (c, x) => c.reduceRight((acc, k) => acc * x + k, 0);
    const error = (c, pts) => pts.reduce((s, q) => s + (evalPoly(c, q.x) - q.y) ** 2, 0) / pts.length;

    function generate() {
        const r = makeRandom(seed);
        const sample = (count, offset) => Array.from({ length: count }, (_, i) => {
            const x = -0.96 + ((i + offset) / count) * 1.92;
            return { x, y: truth(x) + r.normal() * 0.15 };
        });
        trainPts = sample(12, 0.25);
        testPts = sample(16, 0.6);
        fits = [];
        for (let d = 1; d <= MAX_DEGREE; d++) {
            const c = fit(trainPts, d);
            fits[d] = { c, train: error(c, trainPts), test: error(c, testPts) };
        }
        bestDegree = 1;
        for (let d = 2; d <= MAX_DEGREE; d++) if (fits[d].test < fits[bestDegree].test) bestDegree = d;
    }

    function draw() {
        const degree = parseInt($("poly-degree").value, 10);
        $("poly-degree-val").textContent = degree;
        drawAxes(ctx, p, { xLabel: "x", yLabel: "y", xTicks: [-1, -0.5, 0, 0.5, 1], yTicks: [-1, 0, 1] });

        ctx.save();
        ctx.beginPath();
        ctx.rect(p.pad.l, p.pad.t, W - p.pad.l - p.pad.r, H - p.pad.t - p.pad.b);
        ctx.clip();
        // La vraie fonction, que le modèle ne voit jamais
        ctx.strokeStyle = C.muted;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        for (let i = 0; i <= 120; i++) {
            const x = -1.08 + (i / 120) * 2.16;
            if (i) ctx.lineTo(p.X(x), p.Y(truth(x))); else ctx.moveTo(p.X(x), p.Y(truth(x)));
        }
        ctx.stroke();
        ctx.setLineDash([]);
        // Le polynôme ajusté
        ctx.strokeStyle = C.amber;
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        ctx.beginPath();
        for (let i = 0; i <= 300; i++) {
            const x = -1.08 + (i / 300) * 2.16;
            const y = Math.max(-6, Math.min(6, evalPoly(fits[degree].c, x)));
            if (i) ctx.lineTo(p.X(x), p.Y(y)); else ctx.moveTo(p.X(x), p.Y(y));
        }
        ctx.stroke();
        for (const q of testPts) dot(ctx, p.X(q.x), p.Y(q.y), 5, C.ink, C.cyan);
        for (const q of trainPts) dot(ctx, p.X(q.x), p.Y(q.y), 5, C.amber);
        ctx.restore();

        ctx.font = `10px ${Course.FONT.mono}`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        dot(ctx, p.pad.l + 12, p.pad.t + 12, 4, C.amber);
        ctx.fillStyle = C.soft;
        ctx.fillText("entraînement", p.pad.l + 22, p.pad.t + 12);
        dot(ctx, p.pad.l + 118, p.pad.t + 12, 4, C.ink, C.cyan);
        ctx.fillStyle = C.soft;
        ctx.fillText("test", p.pad.l + 128, p.pad.t + 12);
        ctx.fillText("- - vraie fonction", p.pad.l + 166, p.pad.t + 12);

        drawBars(degree);
    }

    function drawBars(current) {
        const pad = { l: 38, r: 14, t: 22, b: 26 };
        const cap = 0.3; // au-delà, la barre est tronquée et marquée d'une flèche
        bars.clearRect(0, 0, BW, BH);
        bars.font = `10px ${Course.FONT.mono}`;
        const slot = (BW - pad.l - pad.r) / MAX_DEGREE;
        const Y = (v) => BH - pad.b - (Math.min(v, cap) / cap) * (BH - pad.t - pad.b);

        bars.strokeStyle = C.grid;
        bars.fillStyle = C.muted;
        bars.textAlign = "right";
        bars.textBaseline = "middle";
        for (const t of [0, 0.1, 0.2, 0.3]) {
            bars.beginPath(); bars.moveTo(pad.l, Y(t)); bars.lineTo(BW - pad.r, Y(t)); bars.stroke();
            bars.fillText(t.toFixed(1), pad.l - 6, Y(t));
        }
        bars.textAlign = "left";
        bars.textBaseline = "top";
        bars.fillStyle = C.amber;
        bars.fillRect(pad.l, 5, 10, 8);
        bars.fillStyle = C.soft;
        bars.fillText("erreur d'entraînement", pad.l + 15, 4);
        bars.fillStyle = C.cyan;
        bars.fillRect(pad.l + 170, 5, 10, 8);
        bars.fillStyle = C.soft;
        bars.fillText("erreur de test", pad.l + 185, 4);

        for (let d = 1; d <= MAX_DEGREE; d++) {
            const x = pad.l + (d - 1) * slot;
            if (d === current) {
                bars.fillStyle = "rgba(255, 255, 255, 0.07)";
                bars.fillRect(x + 2, pad.t - 4, slot - 4, BH - pad.t - pad.b + 8);
            }
            const bw = slot * 0.3;
            [[fits[d].train, C.amber, x + slot * 0.18], [fits[d].test, C.cyan, x + slot * 0.52]].forEach(([v, color, bx]) => {
                bars.fillStyle = color;
                bars.globalAlpha = d === current ? 1 : 0.55;
                bars.fillRect(bx, Y(v), bw, BH - pad.b - Y(v));
                if (v > cap) {
                    bars.beginPath();
                    bars.moveTo(bx + bw / 2, pad.t - 8); bars.lineTo(bx - 1, pad.t - 1); bars.lineTo(bx + bw + 1, pad.t - 1);
                    bars.fill();
                }
                bars.globalAlpha = 1;
            });
            bars.fillStyle = d === current ? C.text : C.muted;
            bars.textAlign = "center";
            bars.textBaseline = "top";
            bars.fillText(String(d), x + slot / 2, BH - pad.b + 6);
        }
        bars.fillStyle = C.soft;
        bars.textAlign = "right";
        bars.textBaseline = "bottom";
        bars.fillText("degré", BW - pad.r, BH);
    }

    $("poly-degree").addEventListener("input", draw);
    $("poly-new").addEventListener("click", () => {
        seed += 13;
        generate();
        const fb = $("challenge-4").querySelector(".challenge-feedback");
        if (!Course.isDone(4)) fb.textContent = "";
        draw();
    });
    $("poly-answer").addEventListener("click", () => {
        const degree = parseInt($("poly-degree").value, 10);
        const fb = $("challenge-4").querySelector(".challenge-feedback");
        // On accepte les quasi-égalités : deux degrés peuvent être à 2 % près
        if (fits[degree].test <= fits[bestDegree].test * 1.02) {
            Course.complete(4, `Oui : au degré ${degree}, l'erreur de test est minimale (${fits[degree].test.toFixed(3)}). Au-delà, l'erreur d'entraînement baisse encore, mais le modèle généralise moins bien.`);
        } else if (degree > bestDegree) {
            fb.textContent = "Pas encore : ce degré colle mieux aux points d'entraînement, mais regardez la barre bleue. Essayez un modèle plus simple.";
        } else {
            fb.textContent = "Pas encore : ce modèle est trop rigide pour suivre la forme des données. Essayez un degré plus élevé.";
        }
    });

    generate();
    draw();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
})();

// ============================================================
// Hero : des courbes de niveau et une descente qui recommence
// ============================================================

Course.hero((ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w * 0.5, cy = h * 0.52, tilt = -0.5;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    for (let i = 1; i <= 9; i++) {
        ctx.beginPath();
        ctx.ellipse(0, 0, i * Math.max(w, h) * 0.085, i * Math.max(w, h) * 0.032, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(133, 213, 230, ${0.2 - i * 0.017})`;
        ctx.lineWidth = 1;
        ctx.stroke();
    }
    // Une descente avec élan, rejouée en boucle
    const period = 9, phase = (t % period) / period;
    const R = Math.max(w, h);
    let x = R * 0.5, y = -R * 0.16, vx = 0, vy = 0;
    const total = 90, shown = Math.floor(phase * total * 1.25);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 0; i < Math.min(shown, total); i++) {
        vx = 0.82 * vx - 0.012 * x;
        vy = 0.82 * vy - 0.085 * y;
        x += vx; y += vy;
        ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(255, 171, 64, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 171, 64, 0.9)";
    ctx.fill();
    ctx.restore();
});

Course.init({ challenges: 4 });
