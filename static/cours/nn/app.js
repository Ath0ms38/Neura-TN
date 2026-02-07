/* ============================================================
   Neura'TN - Cours : Reseaux de Neurones
   Interactive scrollytelling with 7 demos + 6 challenges
   ============================================================ */

// ============ Global State ============
const challengeState = { completed: new Set(), total: 6 };
const sectionIds = ["hero", "neurone", "poids", "activation", "classifieur", "couches", "multicouche", "propagation", "apprentissage", "conclusion"];

// ============ Utilities ============
function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }
function lerp(a, b, t) { return a + (b - a) * t; }
function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
function relu(x) { return Math.max(0, x); }
function step(x) { return x >= 0 ? 1 : 0; }

function completeChallenge(id) {
    if (challengeState.completed.has(id)) return;
    challengeState.completed.add(id);
    const box = document.getElementById(`challenge-${id}`);
    if (box) {
        box.classList.add("completed");
        const status = document.getElementById(`ch${id}-status`);
        if (status) status.textContent = "\u2714";
    }
    updateCounter();
}

function updateCounter() {
    const count = challengeState.completed.size;
    const el = document.getElementById("counter-text");
    if (el) el.textContent = `${count}/${challengeState.total}`;
    // Update conclusion
    const scoreText = document.getElementById("final-score-text");
    if (scoreText) scoreText.textContent = `${count}/${challengeState.total} defis completes`;
    const msg = document.getElementById("score-message");
    if (msg) {
        if (count === 6) msg.textContent = "Parfait ! Vous maitrisez les bases des reseaux de neurones !";
        else if (count >= 4) msg.textContent = "Excellent travail ! Encore quelques defis a relever.";
        else if (count >= 1) msg.textContent = "Bon debut ! N'hesitez pas a revenir completer les defis.";
        else msg.textContent = "Remontez et tentez les defis pour tester vos connaissances !";
    }
    // Update recap cards
    document.querySelectorAll(".recap-card[data-challenge]").forEach(card => {
        const chId = parseInt(card.dataset.challenge);
        card.classList.toggle("done", challengeState.completed.has(chId));
    });
}

// ============ Scroll & Navigation ============
function initScrollSystem() {
    const nav = document.getElementById("section-nav");
    sectionIds.forEach((id, i) => {
        const dot = document.createElement("button");
        dot.className = "nav-dot";
        dot.title = id.charAt(0).toUpperCase() + id.slice(1);
        dot.addEventListener("click", () => {
            document.getElementById(id).scrollIntoView({ behavior: "smooth" });
        });
        nav.appendChild(dot);
    });

    const dots = nav.querySelectorAll(".nav-dot");
    const textEls = document.querySelectorAll(".section-text");
    const visualEls = document.querySelectorAll(".section-visual");

    // Fade-in observer
    const fadeObserver = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) e.target.classList.add("visible");
        });
    }, { threshold: 0.15 });

    textEls.forEach(el => fadeObserver.observe(el));
    visualEls.forEach(el => fadeObserver.observe(el));

    // Active section observer
    const secObserver = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                const idx = sectionIds.indexOf(e.target.id);
                dots.forEach((d, i) => d.classList.toggle("active", i === idx));
            }
        });
    }, { threshold: 0.35 });

    sectionIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) secObserver.observe(el);
    });
}

// ============ Section 0: Hero Animation ============
function initHero() {
    const canvas = document.getElementById("hero-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let nodes = [];
    let animId;
    let isVisible = true;

    function resize() {
        canvas.width = canvas.offsetWidth * window.devicePixelRatio;
        canvas.height = canvas.offsetHeight * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    function createNodes() {
        nodes = [];
        const w = canvas.offsetWidth;
        const h = canvas.offsetHeight;
        for (let i = 0; i < 25; i++) {
            nodes.push({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                r: 3 + Math.random() * 4,
                phase: Math.random() * Math.PI * 2,
            });
        }
    }

    function draw(t) {
        if (!isVisible) { animId = requestAnimationFrame(draw); return; }
        const w = canvas.offsetWidth;
        const h = canvas.offsetHeight;
        ctx.clearRect(0, 0, w, h);

        nodes.forEach(n => {
            n.x += n.vx + Math.sin(t * 0.001 + n.phase) * 0.3;
            n.y += n.vy + Math.cos(t * 0.001 + n.phase) * 0.2;
            if (n.x < 0) n.x = w;
            if (n.x > w) n.x = 0;
            if (n.y < 0) n.y = h;
            if (n.y > h) n.y = 0;
        });

        // Draw connections
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[i].x - nodes[j].x;
                const dy = nodes[i].y - nodes[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 180) {
                    const alpha = (1 - dist / 180) * 0.15;
                    ctx.strokeStyle = `rgba(133, 213, 230, ${alpha})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(nodes[i].x, nodes[i].y);
                    ctx.lineTo(nodes[j].x, nodes[j].y);
                    ctx.stroke();
                }
            }
        }

        // Draw nodes
        nodes.forEach(n => {
            const pulse = 0.8 + 0.2 * Math.sin(t * 0.002 + n.phase);
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.r * pulse, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 171, 64, ${0.3 + 0.2 * pulse})`;
            ctx.fill();
        });

        animId = requestAnimationFrame(draw);
    }

    // Visibility observer
    const obs = new IntersectionObserver(([e]) => { isVisible = e.isIntersecting; }, { threshold: 0.01 });
    obs.observe(canvas);

    window.addEventListener("resize", () => { resize(); createNodes(); });
    resize();
    createNodes();
    animId = requestAnimationFrame(draw);
}

// ============ Section 1: Neuron Comparison ============
function initNeuronComparison() {
    const svg = document.getElementById("neuron-svg");
    if (!svg) return;
    let mode = "bio";

    function drawBio() {
        return `
        <g class="bio-neuron" opacity="1">
            <!-- Cell body -->
            <ellipse cx="250" cy="160" rx="55" ry="45" fill="#0E2A47" stroke="#85D5E6" stroke-width="2.5"/>
            <text x="250" y="165" text-anchor="middle" fill="#85D5E6" font-size="12" font-weight="600">Corps cellulaire</text>
            <!-- Dendrites -->
            <path d="M195 160 Q140 100 100 80" stroke="#FFAB40" stroke-width="2" fill="none" opacity="0.7"/>
            <path d="M195 145 Q150 90 120 60" stroke="#FFAB40" stroke-width="2" fill="none" opacity="0.7"/>
            <path d="M195 175 Q140 210 100 230" stroke="#FFAB40" stroke-width="2" fill="none" opacity="0.7"/>
            <path d="M195 185 Q150 240 110 260" stroke="#FFAB40" stroke-width="2" fill="none" opacity="0.7"/>
            <!-- Dendrite branches -->
            <circle cx="100" cy="80" r="4" fill="#FFAB40" opacity="0.6"/>
            <circle cx="120" cy="60" r="3" fill="#FFAB40" opacity="0.6"/>
            <circle cx="100" cy="230" r="4" fill="#FFAB40" opacity="0.6"/>
            <circle cx="110" cy="260" r="3" fill="#FFAB40" opacity="0.6"/>
            <text x="80" y="170" text-anchor="middle" fill="#FFAB40" font-size="11" font-weight="600">Dendrites</text>
            <!-- Axon -->
            <path d="M305 160 Q350 160 380 140 Q410 120 420 160 Q430 200 450 180" stroke="#0097A7" stroke-width="2.5" fill="none"/>
            <text x="420" y="210" text-anchor="middle" fill="#0097A7" font-size="11" font-weight="600">Axone</text>
            <!-- Synapses -->
            <circle cx="450" cy="180" r="6" fill="#0097A7" opacity="0.8"/>
            <circle cx="460" cy="165" r="4" fill="#0097A7" opacity="0.6"/>
            <circle cx="458" cy="195" r="4" fill="#0097A7" opacity="0.6"/>
            <!-- Nucleus -->
            <circle cx="250" cy="155" r="12" fill="#1A3A5C" stroke="#85D5E6" stroke-width="1"/>
        </g>`;
    }

    function drawMath() {
        return `
        <g class="math-neuron" opacity="1">
            <!-- Input nodes -->
            <circle cx="80" cy="80" r="22" fill="#0E2A47" stroke="#FFAB40" stroke-width="2"/>
            <text x="80" y="85" text-anchor="middle" fill="#FFAB40" font-size="14" font-weight="700">x1</text>
            <circle cx="80" cy="160" r="22" fill="#0E2A47" stroke="#FFAB40" stroke-width="2"/>
            <text x="80" y="165" text-anchor="middle" fill="#FFAB40" font-size="14" font-weight="700">x2</text>
            <circle cx="80" cy="240" r="22" fill="#0E2A47" stroke="#FFAB40" stroke-width="2"/>
            <text x="80" y="245" text-anchor="middle" fill="#FFAB40" font-size="14" font-weight="700">x3</text>
            <!-- Connections with weights -->
            <line x1="102" y1="80" x2="228" y2="150" stroke="#85D5E6" stroke-width="2" opacity="0.6"/>
            <text x="155" y="105" fill="#85D5E6" font-size="12" font-weight="600">w1</text>
            <line x1="102" y1="160" x2="228" y2="160" stroke="#85D5E6" stroke-width="2" opacity="0.6"/>
            <text x="165" y="153" fill="#85D5E6" font-size="12" font-weight="600">w2</text>
            <line x1="102" y1="240" x2="228" y2="170" stroke="#85D5E6" stroke-width="2" opacity="0.6"/>
            <text x="155" y="220" fill="#85D5E6" font-size="12" font-weight="600">w3</text>
            <!-- Neuron body -->
            <circle cx="260" cy="160" r="32" fill="#0E2A47" stroke="#85D5E6" stroke-width="2.5"/>
            <text x="260" y="155" text-anchor="middle" fill="#85D5E6" font-size="16" font-weight="700">&Sigma;</text>
            <text x="260" y="172" text-anchor="middle" fill="#78909C" font-size="10">+ b</text>
            <!-- Activation -->
            <line x1="292" y1="160" x2="340" y2="160" stroke="#FFAB40" stroke-width="2"/>
            <rect x="340" y="140" width="50" height="40" rx="6" fill="#0E2A47" stroke="#FFAB40" stroke-width="2"/>
            <text x="365" y="165" text-anchor="middle" fill="#FFAB40" font-size="13" font-weight="700">f(z)</text>
            <!-- Output -->
            <line x1="390" y1="160" x2="430" y2="160" stroke="#0097A7" stroke-width="2"/>
            <circle cx="450" cy="160" r="22" fill="#0E2A47" stroke="#0097A7" stroke-width="2"/>
            <text x="450" y="165" text-anchor="middle" fill="#0097A7" font-size="13" font-weight="700">sortie</text>
        </g>`;
    }

    function render() {
        svg.innerHTML = mode === "bio" ? drawBio() : drawMath();
        document.getElementById("label-bio").classList.toggle("active", mode === "bio");
        document.getElementById("label-math").classList.toggle("active", mode === "math");
        document.getElementById("btn-bio").classList.toggle("active", mode === "bio");
        document.getElementById("btn-math").classList.toggle("active", mode === "math");
    }

    document.getElementById("btn-bio").addEventListener("click", () => { mode = "bio"; render(); });
    document.getElementById("btn-math").addEventListener("click", () => { mode = "math"; render(); });
    render();
}

// ============ Section 2: Weights Playground ============
function initWeightsPlayground() {
    const svg = document.getElementById("weights-svg");
    if (!svg) return;

    const ids = ["x1", "x2", "x3", "w1", "w2", "w3", "b"];
    const sliders = {};
    const displays = {};
    ids.forEach(id => {
        sliders[id] = document.getElementById(`sl-${id}`);
        displays[id] = document.getElementById(`val-${id}`);
    });

    function getVal(id) { return parseFloat(sliders[id].value); }

    function computeZ() {
        return getVal("x1") * getVal("w1") + getVal("x2") * getVal("w2") + getVal("x3") * getVal("w3") + getVal("b");
    }

    function drawNeuronSVG() {
        const vals = {};
        ids.forEach(id => { vals[id] = getVal(id); });
        const z = computeZ();

        function connStyle(w) {
            const absW = Math.abs(w);
            const thick = clamp(absW * 3, 0.5, 8);
            const color = w >= 0 ? "#FFAB40" : "#85D5E6";
            const opacity = clamp(0.3 + absW * 0.15, 0.3, 1);
            return `stroke="${color}" stroke-width="${thick}" opacity="${opacity}"`;
        }

        svg.innerHTML = `
            <!-- Input nodes -->
            <circle cx="60" cy="60" r="28" fill="#0E2A47" stroke="#78909C" stroke-width="1.5"/>
            <text x="60" y="55" text-anchor="middle" fill="#78909C" font-size="10">x1</text>
            <text x="60" y="70" text-anchor="middle" fill="#FFAB40" font-size="14" font-weight="700">${vals.x1.toFixed(1)}</text>

            <circle cx="60" cy="140" r="28" fill="#0E2A47" stroke="#78909C" stroke-width="1.5"/>
            <text x="60" y="135" text-anchor="middle" fill="#78909C" font-size="10">x2</text>
            <text x="60" y="150" text-anchor="middle" fill="#FFAB40" font-size="14" font-weight="700">${vals.x2.toFixed(1)}</text>

            <circle cx="60" cy="220" r="28" fill="#0E2A47" stroke="#78909C" stroke-width="1.5"/>
            <text x="60" y="215" text-anchor="middle" fill="#78909C" font-size="10">x3</text>
            <text x="60" y="230" text-anchor="middle" fill="#FFAB40" font-size="14" font-weight="700">${vals.x3.toFixed(1)}</text>

            <!-- Connections -->
            <line x1="88" y1="60" x2="212" y2="130" ${connStyle(vals.w1)}/>
            <text x="140" y="85" fill="#85D5E6" font-size="11" font-weight="600">${vals.w1.toFixed(1)}</text>

            <line x1="88" y1="140" x2="212" y2="140" ${connStyle(vals.w2)}/>
            <text x="150" y="133" fill="#85D5E6" font-size="11" font-weight="600">${vals.w2.toFixed(1)}</text>

            <line x1="88" y1="220" x2="212" y2="150" ${connStyle(vals.w3)}/>
            <text x="140" y="200" fill="#85D5E6" font-size="11" font-weight="600">${vals.w3.toFixed(1)}</text>

            <!-- Neuron body -->
            <circle cx="240" cy="140" r="32" fill="#0E2A47" stroke="#85D5E6" stroke-width="2.5"/>
            <text x="240" y="135" text-anchor="middle" fill="#85D5E6" font-size="16" font-weight="700">&Sigma;</text>
            <text x="240" y="152" text-anchor="middle" fill="#78909C" font-size="10">b=${vals.b.toFixed(1)}</text>

            <!-- Output -->
            <line x1="272" y1="140" x2="360" y2="140" stroke="#FFAB40" stroke-width="2"/>
            <circle cx="390" cy="140" r="32" fill="#0E2A47" stroke="#FFAB40" stroke-width="2.5"/>
            <text x="390" y="135" text-anchor="middle" fill="#78909C" font-size="10">z</text>
            <text x="390" y="152" text-anchor="middle" fill="#FFAB40" font-size="16" font-weight="800">${z.toFixed(1)}</text>
        `;
    }

    function update() {
        ids.forEach(id => {
            displays[id].textContent = getVal(id).toFixed(1);
        });
        const z = computeZ();
        document.getElementById("output-z").textContent = z.toFixed(1);
        drawNeuronSVG();

        // Challenge 1: z = 10
        const diff = Math.abs(z - 10);
        const progress = clamp((1 - diff / 20) * 100, 0, 100);
        const fill = document.getElementById("ch1-progress");
        if (fill) {
            fill.style.width = progress + "%";
            fill.classList.toggle("success", diff < 0.5);
        }
        const txt = document.getElementById("ch1-text");
        if (txt) txt.textContent = `z = ${z.toFixed(1)} / 10`;

        if (diff < 0.5) completeChallenge(1);
    }

    ["w1", "w2", "w3", "b"].forEach(id => {
        sliders[id].addEventListener("input", update);
    });

    update();
}

// ============ Section 3: Activation Functions ============
function initActivation() {
    const canvas = document.getElementById("activation-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let currentFn = "step";
    let mouseX = null;
    const formulas = {
        step: "f(z) = { 0 si z < 0, 1 si z \u2265 0 }",
        sigmoid: "f(z) = 1 / (1 + e^(-z))",
        relu: "f(z) = max(0, z)",
    };
    const fns = { step, sigmoid, relu };

    function toCanvasX(z) { return (z + 6) / 12 * canvas.width; }
    function toCanvasY(v) { return canvas.height - ((v + 0.5) / 3 * canvas.height); }
    function fromCanvasX(px) { return px / canvas.width * 12 - 6; }

    function draw() {
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        // Grid
        ctx.strokeStyle = "rgba(26, 58, 92, 0.5)";
        ctx.lineWidth = 1;
        for (let z = -5; z <= 5; z++) {
            const x = toCanvasX(z);
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (let v = 0; v <= 2; v += 0.5) {
            const y = toCanvasY(v);
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }

        // Axes
        ctx.strokeStyle = "#78909C";
        ctx.lineWidth = 1.5;
        const ax0 = toCanvasX(0), ay0 = toCanvasY(0);
        ctx.beginPath(); ctx.moveTo(0, ay0); ctx.lineTo(w, ay0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ax0, 0); ctx.lineTo(ax0, h); ctx.stroke();

        // Axis labels
        ctx.fillStyle = "#78909C";
        ctx.font = "11px Arial";
        ctx.textAlign = "center";
        for (let z = -5; z <= 5; z++) {
            if (z === 0) continue;
            ctx.fillText(z, toCanvasX(z), ay0 + 16);
        }
        ctx.textAlign = "right";
        for (let v = 0; v <= 2; v += 0.5) {
            if (v === 0) continue;
            ctx.fillText(v.toFixed(1), ax0 - 8, toCanvasY(v) + 4);
        }

        // Function curve
        ctx.strokeStyle = "#85D5E6";
        ctx.lineWidth = 3;
        ctx.beginPath();
        const fn = fns[currentFn];
        for (let px = 0; px <= w; px++) {
            const z = fromCanvasX(px);
            const v = fn(z);
            const y = toCanvasY(v);
            if (px === 0) ctx.moveTo(px, y);
            else ctx.lineTo(px, y);
        }
        ctx.stroke();

        // Mouse follower
        if (mouseX !== null) {
            const z = fromCanvasX(mouseX);
            const v = fn(z);
            const cy = toCanvasY(v);

            // Vertical line
            ctx.strokeStyle = "rgba(255, 171, 64, 0.3)";
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(mouseX, 0); ctx.lineTo(mouseX, h); ctx.stroke();
            ctx.setLineDash([]);

            // Horizontal line
            ctx.strokeStyle = "rgba(255, 171, 64, 0.3)";
            ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();

            // Point
            ctx.beginPath();
            ctx.arc(mouseX, cy, 6, 0, Math.PI * 2);
            ctx.fillStyle = "#FFAB40";
            ctx.fill();

            // Value label
            ctx.fillStyle = "#FFAB40";
            ctx.font = "bold 12px Courier New";
            ctx.textAlign = "left";
            ctx.fillText(`z=${z.toFixed(1)} f(z)=${v.toFixed(2)}`, mouseX + 10, cy - 10);
        }
    }

    canvas.addEventListener("mousemove", (e) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = (e.clientX - rect.left) / rect.width * canvas.width;
        draw();
    });

    canvas.addEventListener("mouseleave", () => {
        mouseX = null;
        draw();
    });

    document.querySelectorAll(".func-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            currentFn = btn.dataset.fn;
            document.querySelectorAll(".func-btn").forEach(b => b.classList.toggle("active", b === btn));
            document.getElementById("activation-formula").textContent = formulas[currentFn];
            draw();
        });
    });

    draw();

    // Challenge 2: Activation quiz
    initActivationQuiz();
}

function initActivationQuiz() {
    const container = document.getElementById("activation-quiz");
    if (!container) return;

    const questions = [
        { input: -2, output: 0, answer: "relu", text: "Entree = -2, Sortie attendue = 0" },
        { input: 0.5, output: "0.62", answer: "sigmoid", text: "Entree = 0.5, Sortie attendue \u2248 0.62" },
        { input: 3, output: 3, answer: "relu", text: "Entree = 3, Sortie attendue = 3" },
    ];

    let score = 0;
    let answered = 0;

    questions.forEach((q, i) => {
        const item = document.createElement("div");
        item.className = "quiz-item";
        item.innerHTML = `
            <div class="quiz-question">${q.text}</div>
            <div class="quiz-options">
                <button class="quiz-option" data-fn="step">Step</button>
                <button class="quiz-option" data-fn="sigmoid">Sigmoid</button>
                <button class="quiz-option" data-fn="relu">ReLU</button>
            </div>
        `;
        container.appendChild(item);

        item.querySelectorAll(".quiz-option").forEach(opt => {
            opt.addEventListener("click", () => {
                if (item.classList.contains("correct") || item.classList.contains("wrong")) return;

                const chosen = opt.dataset.fn;
                const isCorrect = chosen === q.answer;

                opt.classList.add("selected", isCorrect ? "correct" : "wrong");
                item.classList.add(isCorrect ? "correct" : "wrong");

                if (!isCorrect) {
                    item.querySelectorAll(".quiz-option").forEach(o => {
                        if (o.dataset.fn === q.answer) o.classList.add("answer");
                        if (o !== opt) o.classList.add("disabled");
                    });
                } else {
                    item.querySelectorAll(".quiz-option").forEach(o => {
                        if (o !== opt) o.classList.add("disabled");
                    });
                    score++;
                }

                answered++;
                if (answered === questions.length && score === questions.length) {
                    completeChallenge(2);
                }
            });
        });
    });
}

// ============ Section 4: Classifier Demo ============
function initClassifier() {
    const canvas = document.getElementById("classifier-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let points = [];
    let w1 = 0.5, w2 = 0.5, bias = -2;
    let training = false;
    let trainInterval = null;
    let dataMode = "linear"; // "linear" or "circle"
    let trainEpoch = 0;

    function generateLinearPoints() {
        points = [];
        for (let i = 0; i < 30; i++) {
            points.push({ x: 1 + Math.random() * 3, y: 1 + Math.random() * 3, label: 0 });
        }
        for (let i = 0; i < 30; i++) {
            points.push({ x: 4 + Math.random() * 3, y: 4 + Math.random() * 3, label: 1 });
        }
    }

    function generateCirclePoints() {
        points = [];
        // Inner circle = class 1 (orange), outer ring = class 0 (cyan)
        for (let i = 0; i < 40; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * 1.5;
            points.push({ x: 4 + r * Math.cos(angle), y: 4 + r * Math.sin(angle), label: 1 });
        }
        for (let i = 0; i < 40; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = 2.5 + Math.random() * 1.2;
            points.push({ x: 4 + r * Math.cos(angle), y: 4 + r * Math.sin(angle), label: 0 });
        }
    }

    function generatePoints() {
        if (dataMode === "circle") generateCirclePoints();
        else generateLinearPoints();
    }

    function toCanvasX(x) { return x / 8 * canvas.width; }
    function toCanvasY(y) { return canvas.height - y / 8 * canvas.height; }

    function classify(x, y) {
        return w1 * x + w2 * y + bias >= 0 ? 1 : 0;
    }

    function getAccuracy() {
        let correct = 0;
        points.forEach(p => {
            if (classify(p.x, p.y) === p.label) correct++;
        });
        return correct / points.length;
    }

    function draw() {
        const cw = canvas.width, ch = canvas.height;
        ctx.clearRect(0, 0, cw, ch);

        // Background regions
        for (let px = 0; px < cw; px += 4) {
            for (let py = 0; py < ch; py += 4) {
                const x = px / cw * 8;
                const y = (ch - py) / ch * 8;
                const c = classify(x, y);
                ctx.fillStyle = c === 1 ? "rgba(255,171,64,0.06)" : "rgba(133,213,230,0.06)";
                ctx.fillRect(px, py, 4, 4);
            }
        }

        // Decision boundary
        if (Math.abs(w2) > 0.001) {
            ctx.strokeStyle = "#FFAB40";
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            const x0 = 0, y0 = -(w1 * x0 + bias) / w2;
            const x1 = 8, y1_val = -(w1 * x1 + bias) / w2;
            ctx.moveTo(toCanvasX(x0), toCanvasY(y0));
            ctx.lineTo(toCanvasX(x1), toCanvasY(y1_val));
            ctx.stroke();
            ctx.setLineDash([]);
        } else if (Math.abs(w1) > 0.001) {
            const xBound = -bias / w1;
            ctx.strokeStyle = "#FFAB40";
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(toCanvasX(xBound), 0);
            ctx.lineTo(toCanvasX(xBound), ch);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Grid
        ctx.strokeStyle = "rgba(26, 58, 92, 0.3)";
        ctx.lineWidth = 0.5;
        for (let i = 1; i < 8; i++) {
            const x = toCanvasX(i), y = toCanvasY(i);
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke();
        }

        // Points
        points.forEach(p => {
            const pred = classify(p.x, p.y);
            const correct = pred === p.label;
            ctx.beginPath();
            ctx.arc(toCanvasX(p.x), toCanvasY(p.y), 5, 0, Math.PI * 2);
            ctx.fillStyle = p.label === 1 ? "#FFAB40" : "#85D5E6";
            ctx.fill();
            if (!correct) {
                ctx.strokeStyle = "#e85d4a";
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });

        const acc = getAccuracy();
        document.getElementById("accuracy-value").textContent = (acc * 100).toFixed(0) + "%";

        if (acc === 1 && dataMode === "linear") completeChallenge(3);
    }

    function trainStep() {
        // Batch perceptron: average gradient over all misclassified points
        const lr = 0.1;
        let dw1 = 0, dw2 = 0, db = 0;
        let misclassified = 0;

        points.forEach(p => {
            const pred = classify(p.x, p.y);
            const error = p.label - pred;
            if (error !== 0) {
                dw1 += error * p.x;
                dw2 += error * p.y;
                db += error;
                misclassified++;
            }
        });

        if (misclassified > 0) {
            w1 += lr * dw1 / misclassified;
            w2 += lr * dw2 / misclassified;
            bias += lr * db / misclassified;
        }

        trainEpoch++;
        draw();

        // Stop conditions
        if (getAccuracy() === 1) {
            stopTraining();
            showMessage("");
        } else if (dataMode === "circle" && trainEpoch >= 100) {
            stopTraining();
            showMessage("Impossible ! Une droite ne peut pas separer un cercle. Il faut <strong>plusieurs couches</strong> pour tracer des frontieres non-lineaires.");
        } else if (dataMode === "linear" && trainEpoch >= 200) {
            stopTraining();
        }
    }

    function showMessage(html) {
        const msg = document.getElementById("classifier-message");
        if (msg) {
            msg.innerHTML = html;
            msg.style.display = html ? "block" : "none";
        }
    }

    function stopTraining() {
        if (trainInterval) {
            clearInterval(trainInterval);
            trainInterval = null;
            training = false;
            document.getElementById("btn-train").textContent = "Entrainer";
        }
    }

    function resetClassifier() {
        stopTraining();
        w1 = 0.5; w2 = 0.5; bias = -2;
        trainEpoch = 0;
        showMessage("");
        generatePoints();
        draw();
    }

    // Data mode buttons
    document.querySelectorAll(".data-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            dataMode = btn.dataset.mode;
            document.querySelectorAll(".data-btn").forEach(b => b.classList.toggle("active", b === btn));
            resetClassifier();
            drawClassifierNetwork();
        });
    });

    document.getElementById("btn-train").addEventListener("click", () => {
        if (training) {
            stopTraining();
        } else {
            training = true;
            trainEpoch = 0;
            showMessage("");
            document.getElementById("btn-train").textContent = "Stop";
            trainInterval = setInterval(trainStep, 80);
        }
    });

    document.getElementById("btn-reset-classifier").addEventListener("click", resetClassifier);

    // Drag boundary
    let dragging = false;
    canvas.addEventListener("mousedown", () => { dragging = true; });
    canvas.addEventListener("mousemove", (e) => {
        if (!dragging) return;
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) / rect.width * 8;
        const my = (1 - (e.clientY - rect.top) / rect.height) * 8;
        bias = -(w1 * mx + w2 * my);
        draw();
    });
    canvas.addEventListener("mouseup", () => { dragging = false; });
    canvas.addEventListener("mouseleave", () => { dragging = false; });

    // Mini network diagram
    function drawClassifierNetwork() {
        const netSvg = document.getElementById("classifier-net-svg");
        if (!netSvg) return;

        let html = `
            <!-- Input x -->
            <circle cx="40" cy="35" r="18" fill="#0E2A47" stroke="#FFAB40" stroke-width="1.5"/>
            <text x="40" y="39" text-anchor="middle" fill="#FFAB40" font-size="12" font-weight="700">x</text>
            <!-- Input y -->
            <circle cx="40" cy="85" r="18" fill="#0E2A47" stroke="#FFAB40" stroke-width="1.5"/>
            <text x="40" y="89" text-anchor="middle" fill="#FFAB40" font-size="12" font-weight="700">y</text>
            <!-- Connections -->
            <line x1="58" y1="35" x2="122" y2="60" stroke="#85D5E6" stroke-width="1.5" opacity="0.7"/>
            <text x="85" y="42" fill="#85D5E6" font-size="9">w1</text>
            <line x1="58" y1="85" x2="122" y2="60" stroke="#85D5E6" stroke-width="1.5" opacity="0.7"/>
            <text x="85" y="82" fill="#85D5E6" font-size="9">w2</text>
            <!-- Neuron -->
            <circle cx="140" cy="60" r="20" fill="#0E2A47" stroke="#85D5E6" stroke-width="2"/>
            <text x="140" y="56" text-anchor="middle" fill="#85D5E6" font-size="13" font-weight="700">&Sigma;</text>
            <text x="140" y="68" text-anchor="middle" fill="#78909C" font-size="8">+b</text>
            <!-- Output connection -->
            <line x1="160" y1="60" x2="200" y2="60" stroke="#0097A7" stroke-width="1.5"/>
            <!-- Output -->
            <circle cx="220" cy="60" r="18" fill="#0E2A47" stroke="#0097A7" stroke-width="1.5"/>
            <text x="220" y="64" text-anchor="middle" fill="#0097A7" font-size="10" font-weight="700">classe</text>
            <!-- Label -->
            <text x="140" y="112" text-anchor="middle" fill="#78909C" font-size="9">1 neurone = frontiere lineaire</text>
        `;

        if (dataMode === "circle") {
            html += `
                <line x1="10" y1="10" x2="270" y2="110" stroke="#e85d4a" stroke-width="2" opacity="0.4"/>
                <line x1="270" y1="10" x2="10" y2="110" stroke="#e85d4a" stroke-width="2" opacity="0.4"/>
            `;
        }

        netSvg.innerHTML = html;
    }

    generatePoints();
    draw();
    drawClassifierNetwork();
}

// ============ Section 5: Network Builder ============
function initNetworkBuilder() {
    const svg = document.getElementById("network-svg");
    if (!svg) return;

    let layers = [3, 4, 2];
    let selectedLayer = 1; // Hidden layer selected by default
    let pulseActive = false;
    let pulses = [];
    let pulseAnimId = null;
    let hasPropagated = false;

    function totalNeurons() { return layers.reduce((a, b) => a + b, 0); }
    function hiddenLayers() { return layers.length - 2; }

    function getNodePositions() {
        const positions = [];
        const svgW = 600, svgH = 380;
        const marginX = 60, marginY = 40;
        const usableW = svgW - marginX * 2;
        const usableH = svgH - marginY * 2;

        layers.forEach((count, li) => {
            const x = marginX + (li / (layers.length - 1)) * usableW;
            const layerPositions = [];
            for (let ni = 0; ni < count; ni++) {
                const y = marginY + ((ni + 0.5) / count) * usableH;
                layerPositions.push({ x, y });
            }
            positions.push(layerPositions);
        });
        return positions;
    }

    function drawNetwork() {
        const positions = getNodePositions();
        let html = "";

        // Connections
        for (let li = 0; li < positions.length - 1; li++) {
            for (let ni = 0; ni < positions[li].length; ni++) {
                for (let nj = 0; nj < positions[li + 1].length; nj++) {
                    const from = positions[li][ni];
                    const to = positions[li + 1][nj];
                    html += `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="#1A3A5C" stroke-width="1" opacity="0.5"/>`;
                }
            }
        }

        // Nodes
        positions.forEach((layer, li) => {
            const isInput = li === 0;
            const isOutput = li === layers.length - 1;
            const isSelected = li === selectedLayer;
            const color = isInput ? "#85D5E6" : isOutput ? "#0097A7" : "#FFAB40";
            const strokeW = isSelected ? 3 : 1.5;

            layer.forEach((pos, ni) => {
                html += `<circle cx="${pos.x}" cy="${pos.y}" r="14" fill="#0E2A47" stroke="${color}" stroke-width="${strokeW}" class="net-node" data-layer="${li}"/>`;
            });

            // Layer label
            const labelY = 380 - 8;
            const label = isInput ? "Entree" : isOutput ? "Sortie" : `Cachee ${li}`;
            html += `<text x="${layer[0].x}" y="${labelY}" text-anchor="middle" fill="#78909C" font-size="10">${label}</text>`;
        });

        svg.innerHTML = html;

        // Click on nodes to select layer
        svg.querySelectorAll(".net-node").forEach(node => {
            node.style.cursor = "pointer";
            node.addEventListener("click", () => {
                selectedLayer = parseInt(node.dataset.layer);
                drawNetwork();
            });
        });

        // Update info
        const info = document.getElementById("network-info");
        if (info) info.textContent = `${layers.length} couches \u00b7 ${totalNeurons()} neurones`;

        updateChallenge4();
    }

    function animatePulses() {
        if (!pulseActive || pulses.length === 0) return;
        const positions = getNodePositions();

        // Draw base network first
        drawNetwork();

        // Overlay pulses
        let svgContent = svg.innerHTML;
        let allDone = true;

        pulses.forEach(p => {
            if (p.progress >= 1) return;
            allDone = false;
            p.progress += 0.02;
            if (p.progress > 1) p.progress = 1;

            const from = positions[p.fromLayer][p.fromNode];
            const to = positions[p.toLayer][p.toNode];
            const x = lerp(from.x, to.x, p.progress);
            const y = lerp(from.y, to.y, p.progress);
            svgContent += `<circle cx="${x}" cy="${y}" r="4" fill="#FFAB40" opacity="${1 - p.progress * 0.5}"/>`;
        });

        svg.innerHTML = svgContent;

        if (allDone) {
            pulseActive = false;
            setTimeout(drawNetwork, 300);
        } else {
            pulseAnimId = requestAnimationFrame(animatePulses);
        }
    }

    function startPulse() {
        pulses = [];
        const positions = getNodePositions();
        for (let li = 0; li < positions.length - 1; li++) {
            for (let ni = 0; ni < positions[li].length; ni++) {
                for (let nj = 0; nj < positions[li + 1].length; nj++) {
                    pulses.push({
                        fromLayer: li, fromNode: ni,
                        toLayer: li + 1, toNode: nj,
                        progress: -li * 0.3 - Math.random() * 0.1, // stagger
                    });
                }
            }
        }
        pulseActive = true;
        hasPropagated = true;
        updateChallenge4();
        animatePulses();
    }

    function updateChallenge4() {
        const hl = hiddenLayers();
        const tn = totalNeurons();
        const chLayers = document.getElementById("ch4-check-layers");
        const chNeurons = document.getElementById("ch4-check-neurons");
        const chProp = document.getElementById("ch4-check-propagate");

        if (chLayers) {
            const ok = hl === 3;
            chLayers.classList.toggle("done", ok);
            chLayers.querySelector(".check-icon").textContent = ok ? "\u25cf" : "\u25cb";
        }
        if (chNeurons) {
            const ok = tn >= 12;
            chNeurons.classList.toggle("done", ok);
            chNeurons.querySelector(".check-icon").textContent = ok ? "\u25cf" : "\u25cb";
        }
        if (chProp) {
            chProp.classList.toggle("done", hasPropagated);
            chProp.querySelector(".check-icon").textContent = hasPropagated ? "\u25cf" : "\u25cb";
        }

        if (hl === 3 && tn >= 12 && hasPropagated) {
            completeChallenge(4);
        }
    }

    document.getElementById("btn-add-layer").addEventListener("click", () => {
        if (layers.length >= 8) return;
        layers.splice(layers.length - 1, 0, 3);
        selectedLayer = layers.length - 2;
        drawNetwork();
    });

    document.getElementById("btn-remove-layer").addEventListener("click", () => {
        if (layers.length <= 2) return;
        if (selectedLayer > 0 && selectedLayer < layers.length - 1) {
            layers.splice(selectedLayer, 1);
            selectedLayer = clamp(selectedLayer, 0, layers.length - 1);
        } else if (layers.length > 2) {
            layers.splice(layers.length - 2, 1);
            selectedLayer = clamp(selectedLayer, 0, layers.length - 1);
        }
        drawNetwork();
    });

    document.getElementById("btn-add-neuron").addEventListener("click", () => {
        if (layers[selectedLayer] >= 8) return;
        layers[selectedLayer]++;
        drawNetwork();
    });

    document.getElementById("btn-remove-neuron").addEventListener("click", () => {
        if (layers[selectedLayer] <= 1) return;
        layers[selectedLayer]--;
        drawNetwork();
    });

    document.getElementById("btn-pulse").addEventListener("click", startPulse);

    drawNetwork();
}

// ============ Section 6: MLP Classifier (Non-Linear) ============
function initMLPClassifier() {
    const canvas = document.getElementById("mlp-classifier-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const netSvg = document.getElementById("mlp-network-svg");

    const architecture = [2, 6, 6, 1];
    let weights = [];
    let biases = [];
    let points = [];
    let training = false;
    let trainAnimId = null;
    let epoch = 0;

    // Hidden layers use tanh (centered, better gradients), output uses sigmoid
    function mlpSigmoid(x) { return 1 / (1 + Math.exp(-clamp(x, -500, 500))); }
    function mlpTanh(x) { const e = Math.exp(2 * clamp(x, -500, 500)); return (e - 1) / (e + 1); }
    function mlpTanhDeriv(out) { return 1 - out * out; }

    function initNetwork() {
        weights = [];
        biases = [];
        for (let l = 0; l < architecture.length - 1; l++) {
            const fanIn = architecture[l];
            const fanOut = architecture[l + 1];
            const isOutput = l === architecture.length - 2;
            // Larger init for tanh hidden layers, standard for sigmoid output
            const scale = isOutput ? Math.sqrt(1 / fanIn) : Math.sqrt(2 / fanIn);
            const layerW = [];
            const layerB = [];
            for (let j = 0; j < fanOut; j++) {
                const neuronW = [];
                for (let i = 0; i < fanIn; i++) {
                    neuronW.push((Math.random() * 2 - 1) * scale);
                }
                layerW.push(neuronW);
                layerB.push((Math.random() - 0.5) * 0.1);
            }
            weights.push(layerW);
            biases.push(layerB);
        }
    }

    function forward(input) {
        const activations = [input];
        let current = input;
        for (let l = 0; l < weights.length; l++) {
            const isOutput = l === weights.length - 1;
            const next = [];
            for (let j = 0; j < weights[l].length; j++) {
                let sum = biases[l][j];
                for (let i = 0; i < current.length; i++) {
                    sum += current[i] * weights[l][j][i];
                }
                // tanh for hidden, sigmoid for output
                next.push(isOutput ? mlpSigmoid(sum) : mlpTanh(sum));
            }
            activations.push(next);
            current = next;
        }
        return activations;
    }

    function predict(x, y) {
        const acts = forward([x, y]);
        return acts[acts.length - 1][0];
    }

    function trainOneEpoch(lr) {
        const shuffled = [...points].sort(() => Math.random() - 0.5);
        let totalLoss = 0;

        for (const p of shuffled) {
            const activations = forward([p.x, p.y]);
            const output = activations[activations.length - 1][0];
            const target = p.label;
            totalLoss += (output - target) ** 2;

            // Backpropagation: compute deltas
            const deltas = [];
            // Cross-entropy gradient for sigmoid output: just (output - target)
            deltas[weights.length - 1] = [output - target];

            for (let l = weights.length - 2; l >= 0; l--) {
                const layerDeltas = [];
                for (let j = 0; j < weights[l].length; j++) {
                    let error = 0;
                    for (let k = 0; k < weights[l + 1].length; k++) {
                        error += deltas[l + 1][k] * weights[l + 1][k][j];
                    }
                    // tanh derivative for hidden layers
                    layerDeltas.push(error * mlpTanhDeriv(activations[l + 1][j]));
                }
                deltas[l] = layerDeltas;
            }

            // Update weights and biases
            for (let l = 0; l < weights.length; l++) {
                for (let j = 0; j < weights[l].length; j++) {
                    for (let i = 0; i < weights[l][j].length; i++) {
                        weights[l][j][i] -= lr * deltas[l][j] * activations[l][i];
                    }
                    biases[l][j] -= lr * deltas[l][j];
                }
            }
        }

        return totalLoss / points.length;
    }

    function generateCircleData() {
        points = [];
        for (let i = 0; i < 60; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * 0.35;
            points.push({ x: r * Math.cos(angle), y: r * Math.sin(angle), label: 1 });
        }
        for (let i = 0; i < 60; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = 0.65 + Math.random() * 0.35;
            points.push({ x: r * Math.cos(angle), y: r * Math.sin(angle), label: 0 });
        }
    }

    function getAccuracy() {
        let correct = 0;
        points.forEach(p => {
            if ((predict(p.x, p.y) >= 0.5 ? 1 : 0) === p.label) correct++;
        });
        return correct / points.length;
    }

    function drawMLPCanvas() {
        const cw = canvas.width, ch = canvas.height;
        ctx.clearRect(0, 0, cw, ch);

        // Decision boundary heatmap
        const pxStep = 6;
        for (let px = 0; px < cw; px += pxStep) {
            for (let py = 0; py < ch; py += pxStep) {
                const x = (px / cw) * 2 - 1;
                const y = ((ch - py) / ch) * 2 - 1;
                const prob = predict(x, y);
                if (prob > 0.5) {
                    ctx.fillStyle = `rgba(255, 171, 64, ${(prob - 0.5) * 0.3})`;
                } else {
                    ctx.fillStyle = `rgba(133, 213, 230, ${(0.5 - prob) * 0.3})`;
                }
                ctx.fillRect(px, py, pxStep, pxStep);
            }
        }

        // Grid
        ctx.strokeStyle = "rgba(26, 58, 92, 0.3)";
        ctx.lineWidth = 0.5;
        for (let i = 1; i < 8; i++) {
            const v = i / 8 * cw;
            ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v, ch); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, v); ctx.lineTo(cw, v); ctx.stroke();
        }

        // Data points
        points.forEach(p => {
            const px = (p.x + 1) / 2 * cw;
            const py = ch - (p.y + 1) / 2 * ch;
            const predicted = predict(p.x, p.y) >= 0.5 ? 1 : 0;
            const correct = predicted === p.label;

            ctx.beginPath();
            ctx.arc(px, py, 5, 0, Math.PI * 2);
            ctx.fillStyle = p.label === 1 ? "#FFAB40" : "#85D5E6";
            ctx.fill();
            if (!correct) {
                ctx.strokeStyle = "#e85d4a";
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });

        const acc = getAccuracy();
        document.getElementById("mlp-accuracy-value").textContent = (acc * 100).toFixed(0) + "%";
        document.getElementById("mlp-epoch-value").textContent = epoch;
    }

    function drawMLPNetworkSVG() {
        if (!netSvg) return;
        const layers = architecture;
        const svgW = 200, svgH = 300;
        const marginX = 30, marginY = 15;
        const usableW = svgW - marginX * 2;
        const usableH = svgH - marginY * 2 - 15;

        const positions = [];
        layers.forEach((count, li) => {
            const x = marginX + (li / (layers.length - 1)) * usableW;
            const layerPos = [];
            for (let ni = 0; ni < count; ni++) {
                const y = marginY + ((ni + 0.5) / count) * usableH;
                layerPos.push({ x, y });
            }
            positions.push(layerPos);
        });

        let html = "";
        // Connections with weight coloring
        for (let li = 0; li < positions.length - 1; li++) {
            for (let ni = 0; ni < positions[li].length; ni++) {
                for (let nj = 0; nj < positions[li + 1].length; nj++) {
                    const from = positions[li][ni];
                    const to = positions[li + 1][nj];
                    const w = weights.length > li && weights[li][nj] ? weights[li][nj][ni] || 0 : 0;
                    const absW = Math.min(Math.abs(w), 3);
                    const opacity = 0.1 + absW * 0.2;
                    const color = w >= 0 ? "#FFAB40" : "#85D5E6";
                    html += `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${color}" stroke-width="0.8" opacity="${opacity}"/>`;
                }
            }
        }
        // Nodes
        const colors = ["#FFAB40", "#85D5E6", "#85D5E6", "#0097A7"];
        const labels = ["Entree", "Cachee 1", "Cachee 2", "Sortie"];
        positions.forEach((layer, li) => {
            layer.forEach(pos => {
                html += `<circle cx="${pos.x}" cy="${pos.y}" r="7" fill="#0E2A47" stroke="${colors[li]}" stroke-width="1.5"/>`;
            });
            html += `<text x="${layer[0].x}" y="${svgH - 2}" text-anchor="middle" fill="#78909C" font-size="7">${labels[li]}</text>`;
        });

        netSvg.innerHTML = html;
    }

    function showMLPMessage(html) {
        const msg = document.getElementById("mlp-message");
        if (msg) {
            msg.innerHTML = html;
            msg.style.display = html ? "block" : "none";
        }
    }

    function stopTraining() {
        training = false;
        if (trainAnimId) {
            cancelAnimationFrame(trainAnimId);
            trainAnimId = null;
        }
        document.getElementById("btn-mlp-train").textContent = "Entrainer";
    }

    function startTraining() {
        if (training) {
            stopTraining();
            return;
        }
        training = true;
        epoch = 0;
        showMLPMessage("");
        document.getElementById("btn-mlp-train").textContent = "Stop";

        const lr = 0.03;
        const minFrames = 80; // au moins ~1.3s d'animation
        let frame = 0;

        function step() {
            if (!training) return;

            trainOneEpoch(lr);
            epoch++;
            frame++;

            drawMLPCanvas();
            // Update SVG every 5 frames to save perf
            if (frame % 5 === 0) drawMLPNetworkSVG();

            const acc = getAccuracy();

            if ((frame >= minFrames && acc >= 0.98) || epoch >= 5000) {
                stopTraining();
                drawMLPNetworkSVG();
                if (acc >= 0.95) {
                    showMLPMessage("Le reseau multicouche a appris a separer le cercle ! La <strong>non-linearite</strong> des couches cachees permet de tracer des frontieres courbes.");
                } else {
                    showMLPMessage("Le reseau n'a pas converge. Essayez de <strong>reinitialiser</strong> et relancer l'entrainement (les poids de depart sont aleatoires).");
                }
            } else {
                trainAnimId = requestAnimationFrame(step);
            }
        }

        trainAnimId = requestAnimationFrame(step);
    }

    function resetMLP() {
        stopTraining();
        epoch = 0;
        initNetwork();
        generateCircleData();
        showMLPMessage("");
        drawMLPCanvas();
        drawMLPNetworkSVG();
    }

    document.getElementById("btn-mlp-train").addEventListener("click", startTraining);
    document.getElementById("btn-mlp-reset").addEventListener("click", resetMLP);

    initNetwork();
    generateCircleData();
    drawMLPCanvas();
    drawMLPNetworkSVG();
}

// ============ Section 7: Forward Pass ============
function initForwardPass() {
    const svg = document.getElementById("forward-svg");
    if (!svg) return;

    // Network: 2 inputs, 2 hidden (ReLU), 1 output
    const inputs = [1.0, 0.5];
    const w = [
        [0.6, -0.2], // input->hidden1: w11, w12
        [0.3, 0.8],  // input->hidden2: w21, w22
    ];
    const bh = [-0.1, 0.2]; // hidden biases
    const wo = [0.7, -0.4]; // hidden->output weights
    const bo = 0.1; // output bias

    // Precompute
    const z1 = inputs[0] * w[0][0] + inputs[1] * w[0][1] + bh[0];
    const h1 = relu(z1);
    const z2 = inputs[0] * w[1][0] + inputs[1] * w[1][1] + bh[1];
    const h2 = relu(z2);
    const zOut = h1 * wo[0] + h2 * wo[1] + bo;
    const out = relu(zOut);

    let currentStep = 0;
    const maxSteps = 6;

    const stepDescriptions = [
        "Pret. Cliquez sur <strong>Etape suivante</strong> pour commencer la propagation.",
        `<strong>Entrees :</strong> x1 = ${inputs[0]}, x2 = ${inputs[1]}`,
        `<strong>Neurone cache 1 :</strong> z = <span class="math">${inputs[0]}\u00d7${w[0][0]} + ${inputs[1]}\u00d7${w[0][1]} + (${bh[0]}) = ${z1.toFixed(2)}</span> \u2192 ReLU = <span class="math">${h1.toFixed(2)}</span>`,
        `<strong>Neurone cache 2 :</strong> z = <span class="math">${inputs[0]}\u00d7${w[1][0]} + ${inputs[1]}\u00d7${w[1][1]} + ${bh[1]} = ${z2.toFixed(2)}</span> \u2192 ReLU = <span class="math">${h2.toFixed(2)}</span>`,
        `<strong>Sortie :</strong> z = <span class="math">${h1.toFixed(2)}\u00d7${wo[0]} + ${h2.toFixed(2)}\u00d7${wo[1]} + ${bo} = ${zOut.toFixed(2)}</span>`,
        `<strong>Resultat final :</strong> ReLU(${zOut.toFixed(2)}) = <span class="math">${out.toFixed(2)}</span>`,
    ];

    const nodePositions = {
        i1: { x: 80, y: 130 }, i2: { x: 80, y: 250 },
        h1: { x: 300, y: 130 }, h2: { x: 300, y: 250 },
        o: { x: 520, y: 190 },
    };

    function drawForward() {
        let html = "";

        const activeColor = (step) => currentStep >= step ? "#FFAB40" : "#1A3A5C";
        const nodeActive = (step) => currentStep >= step ? "#FFAB40" : "#85D5E6";
        const nodeOpacity = (step) => currentStep >= step ? 1 : 0.4;

        // Connections (input -> hidden)
        html += `<line x1="110" y1="130" x2="270" y2="130" stroke="${activeColor(2)}" stroke-width="2"/>`;
        html += `<text x="190" y="120" fill="${activeColor(2)}" font-size="10" text-anchor="middle">${w[0][0]}</text>`;
        html += `<line x1="110" y1="250" x2="270" y2="130" stroke="${activeColor(2)}" stroke-width="2"/>`;
        html += `<text x="170" y="180" fill="${activeColor(2)}" font-size="10">${w[0][1]}</text>`;

        html += `<line x1="110" y1="130" x2="270" y2="250" stroke="${activeColor(3)}" stroke-width="2"/>`;
        html += `<text x="170" y="200" fill="${activeColor(3)}" font-size="10">${w[1][0]}</text>`;
        html += `<line x1="110" y1="250" x2="270" y2="250" stroke="${activeColor(3)}" stroke-width="2"/>`;
        html += `<text x="190" y="265" fill="${activeColor(3)}" font-size="10" text-anchor="middle">${w[1][1]}</text>`;

        // Connections (hidden -> output)
        html += `<line x1="330" y1="130" x2="490" y2="190" stroke="${activeColor(4)}" stroke-width="2"/>`;
        html += `<text x="400" y="155" fill="${activeColor(4)}" font-size="10">${wo[0]}</text>`;
        html += `<line x1="330" y1="250" x2="490" y2="190" stroke="${activeColor(4)}" stroke-width="2"/>`;
        html += `<text x="400" y="230" fill="${activeColor(4)}" font-size="10">${wo[1]}</text>`;

        // Input nodes
        html += `<circle cx="80" cy="130" r="28" fill="#0E2A47" stroke="${nodeActive(1)}" stroke-width="2" opacity="${nodeOpacity(1)}"/>`;
        html += `<text x="80" y="125" text-anchor="middle" fill="#78909C" font-size="10">x1</text>`;
        html += `<text x="80" y="140" text-anchor="middle" fill="#FFAB40" font-size="14" font-weight="700">${currentStep >= 1 ? inputs[0] : "?"}</text>`;

        html += `<circle cx="80" cy="250" r="28" fill="#0E2A47" stroke="${nodeActive(1)}" stroke-width="2" opacity="${nodeOpacity(1)}"/>`;
        html += `<text x="80" y="245" text-anchor="middle" fill="#78909C" font-size="10">x2</text>`;
        html += `<text x="80" y="260" text-anchor="middle" fill="#FFAB40" font-size="14" font-weight="700">${currentStep >= 1 ? inputs[1] : "?"}</text>`;

        // Hidden nodes
        html += `<circle cx="300" cy="130" r="28" fill="#0E2A47" stroke="${nodeActive(2)}" stroke-width="2" opacity="${nodeOpacity(2)}"/>`;
        html += `<text x="300" y="125" text-anchor="middle" fill="#78909C" font-size="10">h1</text>`;
        html += `<text x="300" y="140" text-anchor="middle" fill="#85D5E6" font-size="13" font-weight="700">${currentStep >= 2 ? h1.toFixed(2) : "?"}</text>`;
        if (currentStep >= 2) html += `<text x="300" y="100" text-anchor="middle" fill="#78909C" font-size="9">b=${bh[0]}</text>`;

        html += `<circle cx="300" cy="250" r="28" fill="#0E2A47" stroke="${nodeActive(3)}" stroke-width="2" opacity="${nodeOpacity(3)}"/>`;
        html += `<text x="300" y="245" text-anchor="middle" fill="#78909C" font-size="10">h2</text>`;
        html += `<text x="300" y="260" text-anchor="middle" fill="#85D5E6" font-size="13" font-weight="700">${currentStep >= 3 ? h2.toFixed(2) : "?"}</text>`;
        if (currentStep >= 3) html += `<text x="300" y="280" text-anchor="middle" fill="#78909C" font-size="9">b=${bh[1]}</text>`;

        // Output node
        html += `<circle cx="520" cy="190" r="28" fill="#0E2A47" stroke="${nodeActive(5)}" stroke-width="2" opacity="${nodeOpacity(4)}"/>`;
        html += `<text x="520" y="185" text-anchor="middle" fill="#78909C" font-size="10">sortie</text>`;
        html += `<text x="520" y="200" text-anchor="middle" fill="#0097A7" font-size="14" font-weight="700">${currentStep >= 5 ? out.toFixed(2) : "?"}</text>`;
        if (currentStep >= 4) html += `<text x="520" y="225" text-anchor="middle" fill="#78909C" font-size="9">b=${bo}</text>`;

        svg.innerHTML = html;
        document.getElementById("step-explanation").innerHTML = stepDescriptions[currentStep];
    }

    document.getElementById("btn-step").addEventListener("click", () => {
        if (currentStep < maxSteps) {
            currentStep++;
            drawForward();
        }
    });

    document.getElementById("btn-auto-forward").addEventListener("click", () => {
        currentStep = 0;
        drawForward();
        let i = 0;
        const interval = setInterval(() => {
            i++;
            currentStep = i;
            drawForward();
            if (i >= maxSteps) clearInterval(interval);
        }, 800);
    });

    document.getElementById("btn-reset-forward").addEventListener("click", () => {
        currentStep = 0;
        drawForward();
    });

    drawForward();

    // Challenge 5: Calculate yourself
    initCalcChallenge(inputs, w, bh, wo, bo, z1, h1, z2, h2, zOut, out);
}

function initCalcChallenge(inputs, w, bh, wo, bo, z1, h1, z2, h2, zOut, out) {
    const container = document.getElementById("calc-challenge");
    if (!container) return;

    const steps = [
        { label: `${inputs[0]}\u00d7${w[0][0]} + ${inputs[1]}\u00d7${w[0][1]} + (${bh[0]}) =`, answer: z1 },
        { label: `ReLU(${z1.toFixed(2)}) =`, answer: h1 },
        { label: `${inputs[0]}\u00d7${w[1][0]} + ${inputs[1]}\u00d7${w[1][1]} + ${bh[1]} =`, answer: z2 },
        { label: `ReLU(${z2.toFixed(2)}) =`, answer: h2 },
        { label: `${h1.toFixed(2)}\u00d7${wo[0]} + ${h2.toFixed(2)}\u00d7${wo[1]} + ${bo} =`, answer: zOut },
    ];

    let score = 0;
    let answered = 0;

    steps.forEach((s, i) => {
        const row = document.createElement("div");
        row.className = "calc-step";
        row.innerHTML = `
            <span class="calc-label">${s.label}</span>
            <input type="number" step="0.01" placeholder="?" id="calc-input-${i}">
            <button id="calc-check-${i}">OK</button>
            <span class="calc-result" id="calc-result-${i}"></span>
        `;
        container.appendChild(row);

        const input = row.querySelector("input");
        const btn = row.querySelector("button");
        const result = row.querySelector(".calc-result");

        function check() {
            if (result.textContent) return;
            const val = parseFloat(input.value);
            if (isNaN(val)) return;
            const correct = Math.abs(val - s.answer) < 0.15;
            result.textContent = correct ? "\u2714" : `\u2716 ${s.answer.toFixed(2)}`;
            result.className = "calc-result " + (correct ? "correct" : "wrong");
            input.disabled = true;
            btn.disabled = true;
            if (correct) score++;
            answered++;

            if (answered === steps.length && score >= 3) {
                completeChallenge(5);
            }
        }

        btn.addEventListener("click", check);
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });
    });
}

// ============ Section 8: Gradient Descent (3D Surface) ============
function initGradientDescent() {
    const canvas = document.getElementById("gradient-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const cw = canvas.width, ch = canvas.height;

    // Loss landscape: f(w1,w2) = (w1-3)^2 + (w2-2)^2
    const cxLoss = 3, cyLoss = 2;
    const wMin = -1, wMax = 7;
    const gridN = 32;
    const maxLoss = 32;
    const zScale = 2.8; // height scaling

    // Oblique projection parameters
    const depthAngle = Math.PI / 6; // 30 deg
    const depthScale = 12;
    const xScale = 42;
    const yScale = 7;
    const originX = 80;
    const originY = ch - 50;

    let pos = null;
    let trail = [];
    let running = false;
    let iterCount = 0;
    let animId = null;

    function loss(w1, w2) {
        return (w1 - cxLoss) ** 2 + (w2 - cyLoss) ** 2;
    }

    function gradientFn(w1, w2) {
        return { dw1: 2 * (w1 - cxLoss), dw2: 2 * (w2 - cyLoss) };
    }

    // Project (w1, w2, z) -> screen (px, py)
    // w1 = horizontal axis, w2 = depth axis, z = height (loss)
    function project(w1, w2, z) {
        const nw1 = w1 - wMin;
        const nw2 = w2 - wMin;
        const px = originX + nw1 * xScale + nw2 * Math.cos(depthAngle) * depthScale;
        const py = originY - z * yScale - nw2 * Math.sin(depthAngle) * depthScale;
        return { x: px, y: py };
    }

    // Inverse project screen (px, py) -> (w1, w2) on z=0 base plane
    function unproject(px, py) {
        const nw2 = (originY - py) / (Math.sin(depthAngle) * depthScale);
        const nw1 = (px - originX - nw2 * Math.cos(depthAngle) * depthScale) / xScale;
        return { w1: nw1 + wMin, w2: nw2 + wMin };
    }

    function lossColor(l) {
        const t = clamp(l / maxLoss, 0, 1);
        const r = Math.floor(lerp(0, 200, t));
        const g = Math.floor(lerp(80, 60, t));
        const b = Math.floor(lerp(90, 20, t));
        return `rgb(${r},${g},${b})`;
    }

    function lossColorBright(l) {
        const t = clamp(l / maxLoss, 0, 1);
        const r = Math.floor(lerp(20, 255, t));
        const g = Math.floor(lerp(100, 80, t));
        const b = Math.floor(lerp(110, 30, t));
        return `rgb(${r},${g},${b})`;
    }

    function draw() {
        ctx.clearRect(0, 0, cw, ch);
        ctx.fillStyle = "#001633";
        ctx.fillRect(0, 0, cw, ch);

        const step = (wMax - wMin) / gridN;

        // Draw surface quads back-to-front (painter's algorithm)
        // Back = high w2 index, front = low w2 index
        for (let j = gridN - 1; j >= 0; j--) {
            for (let i = 0; i < gridN; i++) {
                const w1 = wMin + i * step;
                const w2 = wMin + j * step;
                const w1b = w1 + step;
                const w2b = w2 + step;

                const z00 = loss(w1, w2) / zScale;
                const z10 = loss(w1b, w2) / zScale;
                const z01 = loss(w1, w2b) / zScale;
                const z11 = loss(w1b, w2b) / zScale;

                const p00 = project(w1, w2, z00);
                const p10 = project(w1b, w2, z10);
                const p01 = project(w1, w2b, z01);
                const p11 = project(w1b, w2b, z11);

                const avgZ = (z00 + z10 + z01 + z11) / 4;

                // Fill quad
                ctx.beginPath();
                ctx.moveTo(p00.x, p00.y);
                ctx.lineTo(p10.x, p10.y);
                ctx.lineTo(p11.x, p11.y);
                ctx.lineTo(p01.x, p01.y);
                ctx.closePath();
                ctx.fillStyle = lossColor(avgZ * zScale);
                ctx.fill();

                // Wireframe
                ctx.strokeStyle = lossColorBright(avgZ * zScale);
                ctx.lineWidth = 0.4;
                ctx.stroke();
            }
        }

        // Draw base plane grid lines for reference
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= 8; i++) {
            const v = wMin + i;
            const a = project(v, wMin, 0);
            const b = project(v, wMax, 0);
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            const c = project(wMin, v, 0);
            const d = project(wMax, v, 0);
            ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
        }

        // Axis labels
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "bold 12px Arial";
        const labelW1 = project(wMax + 0.3, wMin, 0);
        ctx.textAlign = "left";
        ctx.fillText("w1", labelW1.x, labelW1.y + 4);
        const labelW2 = project(wMin, wMax + 0.3, 0);
        ctx.fillText("w2", labelW2.x - 10, labelW2.y);

        // Minimum marker on surface
        const minZ = loss(cxLoss, cyLoss) / zScale;
        const minP = project(cxLoss, cyLoss, minZ);
        ctx.beginPath();
        ctx.arc(minP.x, minP.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#0097A7";
        ctx.fill();
        ctx.strokeStyle = "rgba(0,151,167,0.6)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(minP.x, minP.y, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#0097A7";
        ctx.font = "10px Arial";
        ctx.textAlign = "center";
        ctx.fillText("minimum", minP.x, minP.y + 20);

        // Trail on surface
        if (trail.length > 1) {
            ctx.strokeStyle = "rgba(255,171,64,0.8)";
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            const tp0 = project(trail[0].w1, trail[0].w2, loss(trail[0].w1, trail[0].w2) / zScale);
            ctx.moveTo(tp0.x, tp0.y);
            for (let i = 1; i < trail.length; i++) {
                const tp = project(trail[i].w1, trail[i].w2, loss(trail[i].w1, trail[i].w2) / zScale);
                ctx.lineTo(tp.x, tp.y);
            }
            ctx.stroke();

            // Trail dots
            trail.forEach((p, i) => {
                const tp = project(p.w1, p.w2, loss(p.w1, p.w2) / zScale);
                const alpha = 0.3 + 0.7 * (i / trail.length);
                ctx.beginPath();
                ctx.arc(tp.x, tp.y, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,171,64,${alpha})`;
                ctx.fill();
            });
        }

        // Current position (ball on surface)
        if (pos) {
            const pz = loss(pos.w1, pos.w2) / zScale;
            const pp = project(pos.w1, pos.w2, pz);

            // Shadow on base plane
            const sp = project(pos.w1, pos.w2, 0);
            ctx.beginPath();
            ctx.ellipse(sp.x, sp.y, 6, 3, 0, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(0,0,0,0.3)";
            ctx.fill();

            // Vertical line from surface to base
            ctx.strokeStyle = "rgba(255,171,64,0.2)";
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(pp.x, pp.y);
            ctx.lineTo(sp.x, sp.y);
            ctx.stroke();
            ctx.setLineDash([]);

            // Ball
            ctx.beginPath();
            ctx.arc(pp.x, pp.y, 8, 0, Math.PI * 2);
            const grad = ctx.createRadialGradient(pp.x - 2, pp.y - 2, 1, pp.x, pp.y, 8);
            grad.addColorStop(0, "#FFD180");
            grad.addColorStop(1, "#FFAB40");
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.strokeStyle = "rgba(255,171,64,0.6)";
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Update stats
        const lossVal = pos ? loss(pos.w1, pos.w2) : null;
        document.getElementById("loss-value").textContent = lossVal !== null ? lossVal.toFixed(3) : "--";
        document.getElementById("iter-value").textContent = iterCount;
        updateChallenge6(lossVal);
    }

    function stepGradient() {
        if (!pos) return;
        const lr = parseFloat(document.getElementById("lr-slider").value);
        const g = gradientFn(pos.w1, pos.w2);
        pos = { w1: pos.w1 - lr * g.dw1, w2: pos.w2 - lr * g.dw2 };
        trail.push({ ...pos });
        iterCount++;
        draw();

        const l = loss(pos.w1, pos.w2);
        if (l < 0.1 || iterCount >= 200) {
            stopGradient();
        }
    }

    function stopGradient() {
        if (animId) {
            clearInterval(animId);
            animId = null;
            running = false;
        }
    }

    function updateChallenge6(lossVal) {
        const fill = document.getElementById("ch6-progress");
        const text = document.getElementById("ch6-text");
        if (!fill || !text) return;

        if (lossVal === null) {
            fill.style.width = "0%";
            text.textContent = "Cliquez sur la surface pour placer le point de depart";
            return;
        }

        const progress = clamp((1 - lossVal / 32) * 100, 0, 100);
        fill.style.width = progress + "%";
        fill.classList.toggle("success", lossVal < 0.1 && iterCount <= 50);

        if (lossVal < 0.1 && iterCount <= 50) {
            text.textContent = `Erreur = ${lossVal.toFixed(3)} en ${iterCount} iterations !`;
            completeChallenge(6);
        } else if (lossVal < 0.1) {
            text.textContent = `Erreur = ${lossVal.toFixed(3)} mais ${iterCount} iterations (max 50)`;
        } else {
            text.textContent = `Erreur = ${lossVal.toFixed(3)} | Iterations = ${iterCount}/50`;
        }
    }

    canvas.addEventListener("click", (e) => {
        if (running) return;
        const rect = canvas.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width * cw;
        const py = (e.clientY - rect.top) / rect.height * ch;
        const wp = unproject(px, py);
        // Clamp to valid range
        wp.w1 = clamp(wp.w1, wMin, wMax);
        wp.w2 = clamp(wp.w2, wMin, wMax);
        pos = { w1: wp.w1, w2: wp.w2 };
        trail = [{ ...pos }];
        iterCount = 0;
        draw();
    });

    document.getElementById("btn-gradient-start").addEventListener("click", () => {
        if (!pos) return;
        if (running) {
            stopGradient();
            return;
        }
        running = true;
        animId = setInterval(stepGradient, 50);
    });

    document.getElementById("btn-gradient-reset").addEventListener("click", () => {
        stopGradient();
        pos = null;
        trail = [];
        iterCount = 0;
        draw();
    });

    document.getElementById("lr-slider").addEventListener("input", (e) => {
        document.getElementById("lr-value").textContent = parseFloat(e.target.value).toFixed(2);
    });

    draw();
}

// ============ Initialization ============
document.addEventListener("DOMContentLoaded", () => {
    initScrollSystem();
    initHero();
    initNeuronComparison();
    initWeightsPlayground();
    initActivation();
    initClassifier();
    initNetworkBuilder();
    initMLPClassifier();
    initForwardPass();
    initGradientDescent();
    updateCounter();
});
