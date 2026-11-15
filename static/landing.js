// Page d'accueil : un vrai petit réseau s'entraîne en direct dans le hero.
// Tout le contenu reste lisible sans JavaScript ; ceci n'anime que la figure.
(() => {
    "use strict";
    if (typeof TinyNN === "undefined") return;

    const field = document.getElementById("live-field");
    const overlay = document.getElementById("live-points");
    if (!field || !overlay) return;

    const fieldCtx = field.getContext("2d");
    const ctx = overlay.getContext("2d");
    const out = {
        name: document.getElementById("live-name"),
        epoch: document.getElementById("live-epoch"),
        loss: document.getElementById("live-loss"),
        acc: document.getElementById("live-acc"),
    };

    const SETS = [
        { key: "lunes", label: "Lunes" },
        { key: "cercles", label: "Cercles" },
        { key: "spirale", label: "Spirale" },
        { key: "xor", label: "Damier" },
    ];
    const KEYS = ["x", "y"];
    const BATCH = 16;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

    let setIndex = 0;
    let points = [];
    let X = [];
    let Y = [];
    let net = null;
    let epoch = 0;
    let solvedSince = 0;
    let visible = true;
    let frame = 0;

    function load(index) {
        setIndex = (index + SETS.length) % SETS.length;
        const random = TinyNN.rng((Math.random() * 1e9) | 0);
        points = TinyNN.shuffle(TinyNN.datasets[SETS[setIndex].key](220, 0.12, random), random);
        X = points.map((p) => TinyNN.featurize(p.x, p.y, KEYS));
        Y = points.map((p) => p.label);
        net = new TinyNN.Network([2, 8, 8, 1], { activation: "tanh" });
        epoch = 0;
        solvedSince = 0;
        out.name.textContent = SETS[setIndex].label;
    }

    function trainEpoch() {
        for (let b = 0; b < X.length; b += BATCH) {
            net.trainBatch(X.slice(b, b + BATCH), Y.slice(b, b + BATCH), 0.03, { momentum: 0.9 });
        }
        epoch++;
    }

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const size = overlay.clientWidth;
        overlay.width = overlay.height = Math.round(size * dpr);
    }

    function draw() {
        TinyNN.paintBoundary(fieldCtx, net, KEYS, field.width);
        const size = overlay.width;
        const scale = size / 2;
        const r = Math.max(3, size / 120);
        ctx.clearRect(0, 0, size, size);
        ctx.lineWidth = Math.max(1, size / 420);
        ctx.strokeStyle = "#040d21";
        for (const p of points) {
            ctx.beginPath();
            ctx.arc((p.x + 1) * scale, (1 - p.y) * scale, r, 0, Math.PI * 2);
            ctx.fillStyle = p.label ? "#ffab40" : "#5cc1ea";
            ctx.fill();
            ctx.stroke();
        }
        const { loss, accuracy } = net.evaluate(X, Y);
        out.epoch.textContent = epoch;
        out.loss.textContent = loss.toFixed(3);
        out.acc.textContent = Math.round(accuracy * 100) + " %";
        return accuracy;
    }

    function tick() {
        frame = 0;
        if (!visible) return;
        trainEpoch();
        trainEpoch();
        const accuracy = draw();
        // Une fois le problème résolu (ou après un long moment), on passe au suivant.
        if (accuracy >= 0.99) solvedSince++;
        if (solvedSince > 150 || epoch > 2400) load(setIndex + 1);
        frame = requestAnimationFrame(tick);
    }

    function start() {
        cancelAnimationFrame(frame);
        frame = 0;
        if (reducedMotion.matches) {
            // Sans animation : on montre directement un réseau entraîné.
            while (epoch < 400) trainEpoch();
            draw();
            return;
        }
        frame = requestAnimationFrame(tick);
    }

    document.getElementById("live-next").addEventListener("click", () => {
        load(setIndex + 1);
        start();
    });

    window.addEventListener("resize", () => {
        resize();
        draw();
    });
    document.addEventListener("visibilitychange", () => {
        visible = !document.hidden;
        if (visible && !frame && !reducedMotion.matches) frame = requestAnimationFrame(tick);
    });
    if ("IntersectionObserver" in window) {
        new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting && !document.hidden;
            if (visible && !frame && !reducedMotion.matches) frame = requestAnimationFrame(tick);
        }).observe(overlay);
    }

    load(0);
    resize();
    start();
})();
