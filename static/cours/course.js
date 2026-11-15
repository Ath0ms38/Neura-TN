// ============================================================
// Outils communs aux cours récents : navigation par points,
// apparition des sections, suivi des défis, canvas haute densité.
// ============================================================

"use strict";

const Course = (() => {
    const done = new Set();
    let total = 0;

    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

    function init({ challenges }) {
        total = challenges;
        const sections = [...document.querySelectorAll(".course-section")];
        const nav = document.getElementById("section-nav");

        sections.forEach((section) => {
            const dot = document.createElement("button");
            dot.type = "button";
            dot.className = "nav-dot";
            const heading = section.querySelector("h2");
            dot.setAttribute("aria-label", heading ? heading.textContent.replace(/^\d+/, "").trim() : section.id);
            dot.addEventListener("click", () => section.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" }));
            nav.appendChild(dot);
        });
        const dots = [...nav.children];

        // Section courante : celle qui occupe le milieu de l'écran
        const spy = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    const index = sections.indexOf(entry.target);
                    dots.forEach((d, i) => d.classList.toggle("active", i === index));
                }
            }
        }, { rootMargin: "-45% 0px -45% 0px" });
        sections.forEach((s) => spy.observe(s));

        const reveal = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    reveal.unobserve(entry.target);
                }
            }
        }, { threshold: 0.12 });
        document.querySelectorAll(".section-text, .section-visual").forEach((el) => reveal.observe(el));

        updateCounter();
    }

    function updateCounter() {
        const text = document.getElementById("counter-text");
        if (text) text.textContent = `${done.size}/${total}`;
        const final = document.getElementById("final-score-text");
        if (final) final.textContent = `${done.size}/${total} défis réussis`;
        const message = document.getElementById("score-message");
        if (message) {
            message.textContent = done.size === total
                ? "Tous les défis sont relevés : vous maîtrisez les idées de ce cours."
                : done.size === 0
                    ? "Remontez dans le cours pour relever les défis."
                    : "Il reste des défis à relever plus haut dans le cours.";
        }
    }

    /** Marque un défi comme réussi (sans effet s'il l'est déjà). */
    function complete(n, feedback) {
        const box = document.getElementById(`challenge-${n}`);
        if (feedback && box) {
            const fb = box.querySelector(".challenge-feedback");
            if (fb) fb.textContent = feedback;
        }
        if (done.has(n)) return;
        done.add(n);
        if (box) {
            box.classList.add("completed");
            const status = box.querySelector(".challenge-status");
            if (status) status.textContent = "Réussi ✓";
        }
        document.querySelectorAll(`.recap-card[data-challenge="${n}"]`).forEach((c) => c.classList.add("done"));
        updateCounter();
    }

    const isDone = (n) => done.has(n);

    /**
     * Prépare un canvas dessiné en coordonnées logiques (w × h), net sur
     * les écrans haute densité. Retourne le contexte 2D.
     */
    function canvas(el, w, h) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        el.width = Math.round(w * dpr);
        el.height = Math.round(h * dpr);
        el.style.aspectRatio = `${w} / ${h}`;
        const ctx = el.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return ctx;
    }

    /** Position du pointeur en coordonnées logiques du canvas. */
    function pointer(el, e, w, h) {
        const r = el.getBoundingClientRect();
        return { x: ((e.clientX - r.left) / r.width) * w, y: ((e.clientY - r.top) / r.height) * h };
    }

    /** Fond animé discret pour le hero : `draw(ctx, w, h, t)` est appelé à chaque image. */
    function hero(draw) {
        const el = document.getElementById("hero-canvas");
        if (!el) return;
        const ctx = el.getContext("2d");
        let w = 0, h = 0, visible = true, frame = 0;
        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = el.clientWidth; h = el.clientHeight;
            el.width = Math.round(w * dpr); el.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            draw(ctx, w, h, performance.now() / 1000);
        };
        const tick = (now) => {
            frame = 0;
            if (!visible || document.hidden) return;
            draw(ctx, w, h, now / 1000);
            frame = requestAnimationFrame(tick);
        };
        const wake = () => { if (!frame && !reducedMotion) frame = requestAnimationFrame(tick); };
        window.addEventListener("resize", resize);
        document.addEventListener("visibilitychange", wake);
        new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; wake(); }).observe(el);
        resize();
        wake();
    }

    const COLORS = {
        ink: "#040d21", panel: "#0a1930", grid: "#1d3558", axis: "#2c4a75",
        text: "#f4f7fb", muted: "#64799a", soft: "#9bb0c9",
        amber: "#ffab40", cyan: "#85d5e6", blue: "#5cc1ea", green: "#2cc4a5", red: "#f0624d",
    };
    const FONT = { mono: "'JetBrains Mono', monospace", body: "'Instrument Sans', sans-serif" };

    return { init, complete, isDone, canvas, pointer, hero, COLORS, FONT, reducedMotion };
})();
