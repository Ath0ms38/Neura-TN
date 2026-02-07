/* ============================================================
   Neura'TN - Cours : Reseaux Convolutifs (CNN)
   Interactive scrollytelling with 7 demos + 6 challenges
   ============================================================ */

// ============ Global State ============
const challengeState = { completed: new Set(), total: 6 };
const sectionIds = ["hero", "image", "convolution", "filtres", "pooling", "features", "architecture", "real-example", "conclusion"];

// ============ Utilities ============
function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

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
    document.getElementById("counter-text").textContent = `${count}/${challengeState.total}`;
    const scoreText = document.getElementById("final-score-text");
    if (scoreText) scoreText.textContent = `${count}/${challengeState.total} defis completes`;
    const msg = document.getElementById("score-message");
    if (msg) {
        if (count === 6) msg.textContent = "Parfait ! Vous maitrisez les bases des CNN !";
        else if (count >= 4) msg.textContent = "Excellent travail ! Encore quelques defis a relever.";
        else if (count >= 2) msg.textContent = "Bon debut ! Continuez a explorer les sections.";
        else msg.textContent = "";
    }
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
        dot.title = id;
        dot.addEventListener("click", () => {
            document.getElementById(id).scrollIntoView({ behavior: "smooth" });
        });
        nav.appendChild(dot);
    });
    const dots = nav.querySelectorAll(".nav-dot");

    // Fade-in observer
    const fadeObs = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("visible"); });
    }, { threshold: 0.15 });
    document.querySelectorAll(".section-text, .section-visual").forEach(el => fadeObs.observe(el));

    // Active section observer
    const activeObs = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                const idx = sectionIds.indexOf(e.target.id);
                dots.forEach((d, i) => d.classList.toggle("active", i === idx));
            }
        });
    }, { threshold: 0.35 });
    sectionIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) activeObs.observe(el);
    });
}

// ============ Hero Animation ============
function initHero() {
    const canvas = document.getElementById("hero-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let pixels = [];
    let animId;
    let isVisible = true;
    const w = () => canvas.offsetWidth;
    const h = () => canvas.offsetHeight;

    function resize() {
        canvas.width = canvas.offsetWidth * window.devicePixelRatio;
        canvas.height = canvas.offsetHeight * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        createPixels();
    }

    function createPixels() {
        pixels = [];
        const count = 40;
        for (let i = 0; i < count; i++) {
            pixels.push({
                x: Math.random() * w(),
                y: Math.random() * h(),
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                size: 4 + Math.random() * 8,
                gray: Math.floor(80 + Math.random() * 175),
                phase: Math.random() * Math.PI * 2,
            });
        }
    }

    function draw(t) {
        if (!isVisible) { animId = requestAnimationFrame(draw); return; }
        const cw = w(), ch = h();
        ctx.clearRect(0, 0, cw, ch);

        pixels.forEach(p => {
            p.x += p.vx + Math.sin(t * 0.0008 + p.phase) * 0.2;
            p.y += p.vy + Math.cos(t * 0.0008 + p.phase) * 0.15;
            if (p.x < -20) p.x = cw + 20;
            if (p.x > cw + 20) p.x = -20;
            if (p.y < -20) p.y = ch + 20;
            if (p.y > ch + 20) p.y = -20;
        });

        // Draw grid connections
        for (let i = 0; i < pixels.length; i++) {
            for (let j = i + 1; j < pixels.length; j++) {
                const dx = pixels[i].x - pixels[j].x;
                const dy = pixels[i].y - pixels[j].y;
                const dist = Math.hypot(dx, dy);
                if (dist < 150) {
                    const alpha = (1 - dist / 150) * 0.12;
                    ctx.strokeStyle = `rgba(133, 213, 230, ${alpha})`;
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(pixels[i].x, pixels[i].y);
                    ctx.lineTo(pixels[j].x, pixels[j].y);
                    ctx.stroke();
                }
            }
        }

        // Draw pixel squares
        pixels.forEach(p => {
            const pulse = 0.7 + 0.3 * Math.sin(t * 0.002 + p.phase);
            const s = p.size * pulse;
            ctx.fillStyle = `rgba(${p.gray}, ${p.gray}, ${Math.min(255, p.gray + 60)}, ${0.25 + 0.15 * pulse})`;
            ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        });

        animId = requestAnimationFrame(draw);
    }

    window.addEventListener("resize", resize);
    const obs = new IntersectionObserver(([e]) => { isVisible = e.isIntersecting; });
    obs.observe(canvas);
    resize();
    animId = requestAnimationFrame(draw);
}

// ============ Section 1: Pixel Grid ============
function initPixelGrid() {
    const canvas = document.getElementById("pixel-grid-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // 8x8 grayscale digit "3" pattern
    const grayData = [
        [  0,   0, 120, 200, 200, 120,   0,   0],
        [  0, 100, 240, 160, 160, 240, 100,   0],
        [  0,   0,   0,  30,  30, 200, 240,   0],
        [  0,   0,  60, 180, 220, 240,  80,   0],
        [  0,   0,  60, 180, 220, 240,  80,   0],
        [  0,   0,   0,  30,  30, 200, 240,   0],
        [  0, 100, 240, 160, 160, 240, 100,   0],
        [  0,   0, 120, 200, 200, 120,   0,   0],
    ];

    // 8x8 RGB color pattern (sunset gradient with cyan stripe)
    const rgbData = [];
    for (let r = 0; r < 8; r++) {
        rgbData[r] = [];
        for (let c = 0; c < 8; c++) {
            if (c >= 3 && c <= 4) {
                // Cyan vertical stripe
                rgbData[r][c] = { r: 30, g: 200, b: 230 };
            } else {
                // Sunset gradient: orange at top, purple at bottom
                const t = r / 7;
                const red = Math.round(255 - t * 100);
                const green = Math.round(150 - t * 100);
                const blue = Math.round(50 + t * 150);
                rgbData[r][c] = { r: red, g: green, b: blue };
            }
        }
    }

    const gridSize = 8;
    let colorMode = "gray"; // "gray" or "rgb"
    let channelView = "all"; // "all", "r", "g", "b"
    let hoverCell = null;
    let showValues = false;

    // Challenge: highlighted cells (only for grayscale mode)
    const highlighted = [
        { r: 0, c: 2 }, { r: 0, c: 3 }, { r: 0, c: 4 }, { r: 0, c: 5 },
        { r: 1, c: 1 }, { r: 1, c: 6 },
    ];
    const highlightSum = highlighted.reduce((s, h) => s + grayData[h.r][h.c], 0);
    const highlightAvg = Math.round(highlightSum / highlighted.length);

    function isHighlighted(r, c) {
        return highlighted.some(h => h.r === r && h.c === c);
    }

    function drawGrid() {
        const cw = canvas.width, ch = canvas.height;
        const cellW = cw / gridSize, cellH = ch / gridSize;
        ctx.clearRect(0, 0, cw, ch);

        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                const x = c * cellW, y = r * cellH;

                // Background color
                if (colorMode === "gray") {
                    const v = grayData[r][c];
                    ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
                } else {
                    const rgb = rgbData[r][c];
                    if (channelView === "all") {
                        ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
                    } else if (channelView === "r") {
                        ctx.fillStyle = `rgb(${rgb.r}, 0, 0)`;
                    } else if (channelView === "g") {
                        ctx.fillStyle = `rgb(0, ${rgb.g}, 0)`;
                    } else if (channelView === "b") {
                        ctx.fillStyle = `rgb(0, 0, ${rgb.b})`;
                    }
                }
                ctx.fillRect(x, y, cellW, cellH);

                // Highlight (only in grayscale mode)
                if (colorMode === "gray" && isHighlighted(r, c)) {
                    ctx.fillStyle = "rgba(255, 171, 64, 0.3)";
                    ctx.fillRect(x, y, cellW, cellH);
                    ctx.strokeStyle = "#FFAB40";
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x + 1, y + 1, cellW - 2, cellH - 2);
                }

                // Hover
                if (hoverCell && hoverCell.r === r && hoverCell.c === c) {
                    ctx.strokeStyle = "#85D5E6";
                    ctx.lineWidth = 3;
                    ctx.strokeRect(x + 1, y + 1, cellW - 2, cellH - 2);
                }

                // Grid lines
                ctx.strokeStyle = "rgba(26, 58, 92, 0.5)";
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, cellW, cellH);

                // Display values if checkbox is enabled
                if (showValues) {
                    ctx.font = "bold 10px monospace";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";

                    if (colorMode === "gray") {
                        const v = grayData[r][c];
                        // White text with dark outline for contrast
                        ctx.strokeStyle = "#000";
                        ctx.lineWidth = 3;
                        ctx.strokeText(v, x + cellW / 2, y + cellH / 2);
                        ctx.fillStyle = "#fff";
                        ctx.fillText(v, x + cellW / 2, y + cellH / 2);
                    } else {
                        const rgb = rgbData[r][c];
                        let text = "";
                        if (channelView === "all") {
                            text = `${rgb.r},${rgb.g},${rgb.b}`;
                        } else if (channelView === "r") {
                            text = rgb.r;
                        } else if (channelView === "g") {
                            text = rgb.g;
                        } else if (channelView === "b") {
                            text = rgb.b;
                        }
                        // Smaller font for RGB triplets
                        if (channelView === "all") {
                            ctx.font = "bold 7px monospace";
                        }
                        ctx.strokeStyle = "#000";
                        ctx.lineWidth = 2.5;
                        ctx.strokeText(text, x + cellW / 2, y + cellH / 2);
                        ctx.fillStyle = "#fff";
                        ctx.fillText(text, x + cellW / 2, y + cellH / 2);
                    }
                }
            }
        }
    }

    // Mouse hover
    canvas.addEventListener("mousemove", (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) / rect.width;
        const my = (e.clientY - rect.top) / rect.height;
        const c = Math.floor(mx * gridSize);
        const r = Math.floor(my * gridSize);
        if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
            hoverCell = { r, c };
            if (colorMode === "gray") {
                const v = grayData[r][c];
                document.getElementById("pixel-info").innerHTML =
                    `Pixel (<strong>${r}</strong>, <strong>${c}</strong>) = <span class="math">${v}</span>`;
            } else {
                const rgb = rgbData[r][c];
                document.getElementById("pixel-info").innerHTML =
                    `Pixel (<strong>${r}</strong>, <strong>${c}</strong>) = RGB(<span class="math">${rgb.r}</span>, <span class="math">${rgb.g}</span>, <span class="math">${rgb.b}</span>)`;
            }
        }
        drawGrid();
    });

    canvas.addEventListener("mouseleave", () => {
        hoverCell = null;
        document.getElementById("pixel-info").textContent = "Survolez la grille pour voir les valeurs des pixels";
        drawGrid();
    });

    // Mode toggle buttons
    document.getElementById("btn-view-gray").addEventListener("click", () => {
        colorMode = "gray";
        document.getElementById("btn-view-gray").classList.add("active");
        document.getElementById("btn-view-rgb").classList.remove("active");
        document.getElementById("channel-info").style.display = "none";
        drawGrid();
    });
    document.getElementById("btn-view-rgb").addEventListener("click", () => {
        colorMode = "rgb";
        document.getElementById("btn-view-rgb").classList.add("active");
        document.getElementById("btn-view-gray").classList.remove("active");
        document.getElementById("channel-info").style.display = "flex";
        drawGrid();
    });

    // Channel buttons
    const channelBtns = ["btn-ch-all", "btn-ch-r", "btn-ch-g", "btn-ch-b"];
    const channelMap = { "btn-ch-all": "all", "btn-ch-r": "r", "btn-ch-g": "g", "btn-ch-b": "b" };
    channelBtns.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener("click", () => {
                channelView = channelMap[btnId];
                channelBtns.forEach(id => document.getElementById(id).classList.remove("active"));
                btn.classList.add("active");
                drawGrid();
            });
        }
    });

    // Show values checkbox
    const showValuesCheckbox = document.getElementById("show-values-checkbox");
    if (showValuesCheckbox) {
        showValuesCheckbox.addEventListener("change", (e) => {
            showValues = e.target.checked;
            drawGrid();
        });
    }

    // Challenge 1
    const ch1Input = document.getElementById("ch1-input");
    const ch1Check = document.getElementById("ch1-check");
    const ch1Result = document.getElementById("ch1-result");

    function checkCh1() {
        const val = parseInt(ch1Input.value);
        if (isNaN(val)) return;
        if (Math.abs(val - highlightAvg) <= 2) {
            ch1Result.textContent = "\u2714";
            ch1Result.className = "calc-result correct";
            completeChallenge(1);
        } else {
            ch1Result.textContent = "\u2718";
            ch1Result.className = "calc-result wrong";
        }
    }
    ch1Check.addEventListener("click", checkCh1);
    ch1Input.addEventListener("keydown", (e) => { if (e.key === "Enter") checkCh1(); });

    drawGrid();
}

// ============ Section 2: Convolution ============
function initConvolution() {
    const inputCanvas = document.getElementById("conv-input-canvas");
    const outputCanvas = document.getElementById("conv-output-canvas");
    if (!inputCanvas || !outputCanvas) return;
    const ictx = inputCanvas.getContext("2d");
    const octx = outputCanvas.getContext("2d");

    const inputGrid = [
        [1, 2, 0, 1, 0, 3],
        [0, 1, 2, 3, 1, 0],
        [1, 0, 1, 2, 0, 1],
        [2, 1, 0, 1, 3, 2],
        [0, 2, 1, 0, 1, 0],
        [1, 0, 3, 2, 1, 1],
    ];

    const kernel = [
        [ 0, -1,  0],
        [-1,  4, -1],
        [ 0, -1,  0],
    ];

    const inSize = 6, kSize = 3, outSize = 4;
    let outputGrid = Array.from({ length: outSize }, () => Array(outSize).fill(null));
    let currentStep = -1; // -1 = not started
    let autoAnimId = null;

    // Challenge position
    const challengeRow = 1, challengeCol = 2;
    let challengeAnswer = 0;
    // Compute answer
    for (let kr = 0; kr < kSize; kr++) {
        for (let kc = 0; kc < kSize; kc++) {
            challengeAnswer += kernel[kr][kc] * inputGrid[challengeRow + kr][challengeCol + kc];
        }
    }

    function stepToPos(step) {
        return { r: Math.floor(step / outSize), c: step % outSize };
    }

    function drawInputGrid() {
        const cw = inputCanvas.width, ch = inputCanvas.height;
        const cellW = cw / inSize, cellH = ch / inSize;
        ictx.clearRect(0, 0, cw, ch);

        for (let r = 0; r < inSize; r++) {
            for (let c = 0; c < inSize; c++) {
                const x = c * cellW, y = r * cellH;
                ictx.fillStyle = "#0A2540";
                ictx.fillRect(x, y, cellW, cellH);
                ictx.strokeStyle = "rgba(26, 58, 92, 0.6)";
                ictx.lineWidth = 1;
                ictx.strokeRect(x, y, cellW, cellH);
                ictx.fillStyle = "#85D5E6";
                ictx.font = `bold ${Math.floor(cellW * 0.4)}px Courier New`;
                ictx.textAlign = "center";
                ictx.textBaseline = "middle";
                ictx.fillText(inputGrid[r][c], x + cellW / 2, y + cellH / 2);
            }
        }

        // Highlight challenge position
        if (currentStep < 0) {
            ictx.strokeStyle = "#FFAB40";
            ictx.lineWidth = 3;
            ictx.strokeRect(challengeCol * cellW, challengeRow * cellH, kSize * cellW, kSize * cellH);
        }

        // Highlight current kernel position
        if (currentStep >= 0 && currentStep < outSize * outSize) {
            const pos = stepToPos(currentStep);
            ictx.strokeStyle = "#FFAB40";
            ictx.lineWidth = 3;
            ictx.strokeRect(pos.c * cellW, pos.r * cellH, kSize * cellW, kSize * cellH);

            // Highlight individual cells
            for (let kr = 0; kr < kSize; kr++) {
                for (let kc = 0; kc < kSize; kc++) {
                    ictx.fillStyle = "rgba(255, 171, 64, 0.15)";
                    ictx.fillRect((pos.c + kc) * cellW, (pos.r + kr) * cellH, cellW, cellH);
                }
            }
        }
    }

    function drawOutputGrid() {
        const cw = outputCanvas.width, ch = outputCanvas.height;
        const cellW = cw / outSize, cellH = ch / outSize;
        octx.clearRect(0, 0, cw, ch);

        for (let r = 0; r < outSize; r++) {
            for (let c = 0; c < outSize; c++) {
                const x = c * cellW, y = r * cellH;
                const val = outputGrid[r][c];
                octx.fillStyle = val !== null ? "#0E2A47" : "#0A2540";
                octx.fillRect(x, y, cellW, cellH);
                octx.strokeStyle = "rgba(26, 58, 92, 0.6)";
                octx.lineWidth = 1;
                octx.strokeRect(x, y, cellW, cellH);

                if (val !== null) {
                    octx.fillStyle = "#FFAB40";
                    octx.font = `bold ${Math.floor(cellW * 0.35)}px Courier New`;
                    octx.textAlign = "center";
                    octx.textBaseline = "middle";
                    octx.fillText(val, x + cellW / 2, y + cellH / 2);
                } else {
                    octx.fillStyle = "#78909C";
                    octx.font = `${Math.floor(cellW * 0.3)}px Courier New`;
                    octx.textAlign = "center";
                    octx.textBaseline = "middle";
                    octx.fillText("?", x + cellW / 2, y + cellH / 2);
                }

                // Highlight just-computed cell
                if (currentStep >= 0 && r === stepToPos(currentStep).r && c === stepToPos(currentStep).c && val !== null) {
                    octx.strokeStyle = "#FFAB40";
                    octx.lineWidth = 2;
                    octx.strokeRect(x + 1, y + 1, cellW - 2, cellH - 2);
                }
            }
        }
    }

    function updateKernelDisplay() {
        const display = document.getElementById("kernel-display");
        let html = "";
        for (let r = 0; r < kSize; r++) {
            for (let c = 0; c < kSize; c++) {
                const v = kernel[r][c];
                const cls = (currentStep >= 0 && currentStep < outSize * outSize) ? " highlight" : "";
                html += `<div class="kernel-cell${cls}">${v >= 0 ? " " + v : v}</div>`;
            }
        }
        display.innerHTML = html;
    }

    function computeStep(step) {
        const pos = stepToPos(step);
        let sum = 0;
        const parts = [];
        for (let kr = 0; kr < kSize; kr++) {
            for (let kc = 0; kc < kSize; kc++) {
                const iv = inputGrid[pos.r + kr][pos.c + kc];
                const kv = kernel[kr][kc];
                sum += iv * kv;
                if (kv !== 0) parts.push(`(${kv})&times;${iv}`);
            }
        }
        outputGrid[pos.r][pos.c] = sum;
        return { sum, parts, pos };
    }

    function drawAll() {
        drawInputGrid();
        drawOutputGrid();
        updateKernelDisplay();
    }

    function stepForward() {
        if (autoAnimId) { clearInterval(autoAnimId); autoAnimId = null; }
        currentStep++;
        if (currentStep >= outSize * outSize) {
            document.getElementById("conv-step-text").innerHTML = "Convolution terminee ! La grille de sortie <strong>4&times;4</strong> est complete.";
            drawAll();
            return;
        }
        const result = computeStep(currentStep);
        document.getElementById("conv-step-text").innerHTML =
            `Position (<strong>${result.pos.r}</strong>, <strong>${result.pos.c}</strong>) : ${result.parts.join(" + ")} = <strong>${result.sum}</strong>`;
        drawAll();
    }

    function autoCompute() {
        resetConv();
        autoAnimId = setInterval(() => {
            currentStep++;
            if (currentStep >= outSize * outSize) {
                clearInterval(autoAnimId);
                autoAnimId = null;
                document.getElementById("conv-step-text").innerHTML = "Convolution terminee ! La grille de sortie <strong>4&times;4</strong> est complete.";
                drawAll();
                return;
            }
            computeStep(currentStep);
            drawAll();
        }, 400);
    }

    function resetConv() {
        if (autoAnimId) { clearInterval(autoAnimId); autoAnimId = null; }
        currentStep = -1;
        outputGrid = Array.from({ length: outSize }, () => Array(outSize).fill(null));
        document.getElementById("conv-step-text").textContent = 'Cliquez sur "Etape suivante" pour demarrer';
        drawAll();
    }

    document.getElementById("btn-conv-step").addEventListener("click", stepForward);
    document.getElementById("btn-conv-auto").addEventListener("click", autoCompute);
    document.getElementById("btn-conv-reset").addEventListener("click", resetConv);

    // Challenge 2
    const ch2Input = document.getElementById("ch2-input");
    const ch2Check = document.getElementById("ch2-check");
    const ch2Result = document.getElementById("ch2-result");
    document.getElementById("ch2-label").textContent = `sortie(${challengeRow}, ${challengeCol}) =`;

    function checkCh2() {
        const val = parseInt(ch2Input.value);
        if (isNaN(val)) return;
        if (val === challengeAnswer) {
            ch2Result.textContent = "\u2714";
            ch2Result.className = "calc-result correct";
            completeChallenge(2);
        } else {
            ch2Result.textContent = "\u2718";
            ch2Result.className = "calc-result wrong";
        }
    }
    ch2Check.addEventListener("click", checkCh2);
    ch2Input.addEventListener("keydown", (e) => { if (e.key === "Enter") checkCh2(); });

    drawAll();
}

// ============ Section 3: Filters ============
function initFilters() {
    const origCanvas = document.getElementById("filter-original");
    const resultCanvas = document.getElementById("filter-result");
    if (!origCanvas || !resultCanvas) return;
    const origCtx = origCanvas.getContext("2d");
    const resCtx = resultCanvas.getContext("2d");

    // 12x12 sample image with edges and gradients
    const sampleImage = [
        [200, 200, 200, 200,  40,  40,  40,  40, 200, 200, 200, 200],
        [200, 220, 220, 200,  40,  40,  40,  40, 200, 220, 220, 200],
        [200, 220, 255, 200,  40,  40,  40,  40, 200, 255, 220, 200],
        [200, 200, 200, 200,  40,  40,  40,  40, 200, 200, 200, 200],
        [ 40,  40,  40,  40,  40,  40,  40,  40,  40,  40,  40,  40],
        [ 40,  40,  40,  40,  40,  40,  40,  40,  40,  40,  40,  40],
        [ 40,  40,  40,  40,  40,  40,  40,  40,  40,  40,  40,  40],
        [ 40,  40,  40,  40,  40,  40,  40,  40,  40,  40,  40,  40],
        [200, 200, 200, 200,  40,  40,  40,  40, 120, 140, 160, 180],
        [200, 220, 220, 200,  40,  40,  40,  40, 140, 160, 180, 200],
        [200, 220, 255, 200,  40,  40,  40,  40, 160, 180, 200, 220],
        [200, 200, 200, 200,  40,  40,  40,  40, 180, 200, 220, 240],
    ];
    const imgSize = 12;

    const filters = {
        identity: { name: "Identite", kernel: [[0, 0, 0], [0, 1, 0], [0, 0, 0]] },
        blur: { name: "Flou", kernel: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], scale: 1 / 9 },
        "edge-h": { name: "Bord H", kernel: [[-1, -1, -1], [0, 0, 0], [1, 1, 1]] },
        "edge-v": { name: "Bord V", kernel: [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]] },
        sharpen: { name: "Nettete", kernel: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]] },
    };

    let currentFilter = "identity";

    function applyConv(image, kernel, scale) {
        const s = image.length;
        const kh = kernel.length, kw = kernel[0].length;
        const ph = Math.floor(kh / 2), pw = Math.floor(kw / 2);
        const result = [];
        for (let r = 0; r < s; r++) {
            result[r] = [];
            for (let c = 0; c < s; c++) {
                let sum = 0;
                for (let kr = 0; kr < kh; kr++) {
                    for (let kc = 0; kc < kw; kc++) {
                        const ir = r + kr - ph, ic = c + kc - pw;
                        if (ir >= 0 && ir < s && ic >= 0 && ic < s) {
                            sum += image[ir][ic] * kernel[kr][kc];
                        }
                    }
                }
                if (scale) sum *= scale;
                result[r][c] = sum;
            }
        }
        return result;
    }

    function drawImage(ctx, canvas, data, isFiltered) {
        const cw = canvas.width, ch = canvas.height;
        const s = data.length;
        const cellW = cw / s, cellH = ch / s;
        ctx.clearRect(0, 0, cw, ch);
        for (let r = 0; r < s; r++) {
            for (let c = 0; c < s; c++) {
                const v = data[r][c];
                if (isFiltered && v < 0) {
                    const abs = Math.min(Math.abs(v), 255);
                    ctx.fillStyle = `rgb(${abs}, ${abs * 0.3 | 0}, ${abs * 0.3 | 0})`;
                } else {
                    const clamped = clamp(Math.round(v), 0, 255);
                    ctx.fillStyle = `rgb(${clamped}, ${clamped}, ${clamped})`;
                }
                ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
            }
        }
        // Grid
        ctx.strokeStyle = "rgba(26, 58, 92, 0.3)";
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= s; i++) {
            ctx.beginPath(); ctx.moveTo(i * cellW, 0); ctx.lineTo(i * cellW, ch); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i * cellH); ctx.lineTo(cw, i * cellH); ctx.stroke();
        }
    }

    function updateKernelDisplay() {
        const f = filters[currentFilter];
        const display = document.getElementById("filter-kernel");
        let html = "";
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                let v = f.kernel[r][c];
                if (f.scale) v = (v * f.scale).toFixed(1).replace("0.", ".");
                html += `<div class="kernel-cell">${v}</div>`;
            }
        }
        display.innerHTML = html;
    }

    function render() {
        const f = filters[currentFilter];
        drawImage(origCtx, origCanvas, sampleImage, false);
        const filtered = applyConv(sampleImage, f.kernel, f.scale);
        drawImage(resCtx, resultCanvas, filtered, true);
        updateKernelDisplay();
    }

    document.querySelectorAll(".func-btn[data-filter]").forEach(btn => {
        btn.addEventListener("click", () => {
            currentFilter = btn.dataset.filter;
            document.querySelectorAll(".func-btn[data-filter]").forEach(b => b.classList.toggle("active", b === btn));
            render();
        });
    });

    // Challenge 3: Quiz
    function initFilterQuiz() {
        const container = document.getElementById("filter-quiz");
        const quizData = [
            { question: "Cette image a des contours horizontaux mis en evidence :", answer: "Bord H", options: ["Flou", "Bord H", "Nettete"] },
            { question: "Cette image est lissee, les details sont attenues :", answer: "Flou", options: ["Identite", "Bord V", "Flou"] },
            { question: "Cette image a des contrastes accentues, plus nets :", answer: "Nettete", options: ["Nettete", "Bord H", "Identite"] },
        ];
        let correct = 0;

        quizData.forEach((q, qi) => {
            const item = document.createElement("div");
            item.className = "quiz-item";
            item.innerHTML = `<div class="quiz-question">${qi + 1}. ${q.question}</div><div class="quiz-options"></div>`;
            const opts = item.querySelector(".quiz-options");
            q.options.forEach(opt => {
                const btn = document.createElement("button");
                btn.className = "quiz-option";
                btn.textContent = opt;
                btn.addEventListener("click", () => {
                    if (btn.classList.contains("selected")) return;
                    opts.querySelectorAll(".quiz-option").forEach(b => {
                        b.classList.add("disabled");
                        if (b.textContent === q.answer) b.classList.add("answer");
                    });
                    btn.classList.add("selected");
                    if (opt === q.answer) {
                        btn.classList.add("correct");
                        item.classList.add("correct");
                        correct++;
                    } else {
                        btn.classList.add("wrong");
                        item.classList.add("wrong");
                    }
                    if (correct === quizData.length) completeChallenge(3);
                });
                opts.appendChild(btn);
            });
            container.appendChild(item);
        });
    }
    initFilterQuiz();
    render();
}

// ============ Section 4: Pooling ============
function initPooling() {
    const inputCanvas = document.getElementById("pool-input-canvas");
    const outputCanvas = document.getElementById("pool-output-canvas");
    if (!inputCanvas || !outputCanvas) return;
    const ictx = inputCanvas.getContext("2d");
    const octx = outputCanvas.getContext("2d");

    const inputGrid = [
        [4, 2, 7, 1, 3, 5],
        [6, 8, 3, 9, 2, 4],
        [1, 5, 6, 2, 8, 7],
        [3, 7, 4, 8, 1, 6],
        [9, 2, 5, 3, 7, 4],
        [1, 6, 8, 2, 5, 9],
    ];

    const inSize = 6, outSize = 3;
    let poolMode = "max";
    let outputGrid = Array.from({ length: outSize }, () => Array(outSize).fill(null));
    let currentWindow = -1;
    let autoAnimId = null;

    // Challenge: block at window 1 (row 0, col 1)
    const chBlock = [inputGrid[0][2], inputGrid[0][3], inputGrid[1][2], inputGrid[1][3]];
    const chAnswer = Math.max(...chBlock);

    function drawInput() {
        const cw = inputCanvas.width, ch = inputCanvas.height;
        const cellW = cw / inSize, cellH = ch / inSize;
        ictx.clearRect(0, 0, cw, ch);

        for (let r = 0; r < inSize; r++) {
            for (let c = 0; c < inSize; c++) {
                const x = c * cellW, y = r * cellH;
                ictx.fillStyle = "#0A2540";
                ictx.fillRect(x, y, cellW, cellH);
                ictx.strokeStyle = "rgba(26, 58, 92, 0.6)";
                ictx.lineWidth = 1;
                ictx.strokeRect(x, y, cellW, cellH);
                ictx.fillStyle = "#85D5E6";
                ictx.font = `bold ${Math.floor(cellW * 0.4)}px Courier New`;
                ictx.textAlign = "center";
                ictx.textBaseline = "middle";
                ictx.fillText(inputGrid[r][c], x + cellW / 2, y + cellH / 2);
            }
        }

        // Highlight challenge block when idle
        if (currentWindow < 0) {
            ictx.strokeStyle = "#FFAB40";
            ictx.lineWidth = 3;
            ictx.strokeRect(2 * cellW, 0, 2 * cellW, 2 * cellH);
        }

        // Highlight current 2x2 window
        if (currentWindow >= 0 && currentWindow < outSize * outSize) {
            const wr = Math.floor(currentWindow / outSize) * 2;
            const wc = (currentWindow % outSize) * 2;
            ictx.strokeStyle = "#FFAB40";
            ictx.lineWidth = 3;
            ictx.strokeRect(wc * cellW, wr * cellH, 2 * cellW, 2 * cellH);
            ictx.fillStyle = "rgba(255, 171, 64, 0.15)";
            ictx.fillRect(wc * cellW, wr * cellH, 2 * cellW, 2 * cellH);
        }
    }

    function drawOutput() {
        const cw = outputCanvas.width, ch = outputCanvas.height;
        const cellW = cw / outSize, cellH = ch / outSize;
        octx.clearRect(0, 0, cw, ch);

        for (let r = 0; r < outSize; r++) {
            for (let c = 0; c < outSize; c++) {
                const x = c * cellW, y = r * cellH;
                const val = outputGrid[r][c];
                octx.fillStyle = val !== null ? "#0E2A47" : "#0A2540";
                octx.fillRect(x, y, cellW, cellH);
                octx.strokeStyle = "rgba(26, 58, 92, 0.6)";
                octx.lineWidth = 1;
                octx.strokeRect(x, y, cellW, cellH);

                octx.fillStyle = val !== null ? "#FFAB40" : "#78909C";
                octx.font = `bold ${Math.floor(cellW * 0.35)}px Courier New`;
                octx.textAlign = "center";
                octx.textBaseline = "middle";
                octx.fillText(val !== null ? val : "?", x + cellW / 2, y + cellH / 2);
            }
        }
    }

    function poolStep() {
        if (currentWindow >= outSize * outSize - 1) return;
        currentWindow++;
        const or = Math.floor(currentWindow / outSize);
        const oc = currentWindow % outSize;
        const ir = or * 2, ic = oc * 2;
        const block = [
            inputGrid[ir][ic], inputGrid[ir][ic + 1],
            inputGrid[ir + 1][ic], inputGrid[ir + 1][ic + 1],
        ];
        if (poolMode === "max") {
            outputGrid[or][oc] = Math.max(...block);
        } else {
            outputGrid[or][oc] = Math.round(block.reduce((a, b) => a + b) / 4 * 10) / 10;
        }
        drawInput();
        drawOutput();
    }

    function resetPool() {
        if (autoAnimId) { clearInterval(autoAnimId); autoAnimId = null; }
        currentWindow = -1;
        outputGrid = Array.from({ length: outSize }, () => Array(outSize).fill(null));
        drawInput();
        drawOutput();
    }

    function autoPool() {
        resetPool();
        autoAnimId = setInterval(() => {
            if (currentWindow >= outSize * outSize - 1) {
                clearInterval(autoAnimId);
                autoAnimId = null;
                return;
            }
            poolStep();
        }, 500);
    }

    document.getElementById("btn-pool-step").addEventListener("click", poolStep);
    document.getElementById("btn-pool-auto").addEventListener("click", autoPool);
    document.getElementById("btn-pool-reset").addEventListener("click", resetPool);

    document.getElementById("btn-max-pool").addEventListener("click", () => {
        poolMode = "max";
        document.getElementById("btn-max-pool").classList.add("active");
        document.getElementById("btn-avg-pool").classList.remove("active");
        resetPool();
    });
    document.getElementById("btn-avg-pool").addEventListener("click", () => {
        poolMode = "average";
        document.getElementById("btn-avg-pool").classList.add("active");
        document.getElementById("btn-max-pool").classList.remove("active");
        resetPool();
    });

    // Challenge 4
    document.getElementById("ch4-label").textContent = `max(${chBlock.join(", ")}) =`;
    const ch4Input = document.getElementById("ch4-input");
    const ch4Check = document.getElementById("ch4-check");
    const ch4Result = document.getElementById("ch4-result");

    function checkCh4() {
        const val = parseInt(ch4Input.value);
        if (isNaN(val)) return;
        if (val === chAnswer) {
            ch4Result.textContent = "\u2714";
            ch4Result.className = "calc-result correct";
            completeChallenge(4);
        } else {
            ch4Result.textContent = "\u2718";
            ch4Result.className = "calc-result wrong";
        }
    }
    ch4Check.addEventListener("click", checkCh4);
    ch4Input.addEventListener("keydown", (e) => { if (e.key === "Enter") checkCh4(); });

    drawInput();
    drawOutput();
}

// ============ Section 5: Feature Maps ============
function initFeatureMaps() {
    const origCanvas = document.getElementById("fm-original");
    if (!origCanvas) return;
    const origCtx = origCanvas.getContext("2d");

    // Richer 16x16 sample image (letter T shape with gradient background)
    const sampleImage = [];
    for (let r = 0; r < 16; r++) {
        sampleImage[r] = [];
        for (let c = 0; c < 16; c++) {
            // Background gradient
            let v = 30 + (r / 16) * 40;
            // Horizontal bar of T (rows 2-4)
            if (r >= 2 && r <= 4 && c >= 2 && c <= 13) v = 220;
            // Vertical bar of T (rows 4-13, cols 6-9)
            if (r >= 4 && r <= 13 && c >= 6 && c <= 9) v = 220;
            // Small square in corner (rows 11-14, cols 11-14)
            if (r >= 11 && r <= 14 && c >= 11 && c <= 14) v = 180;
            sampleImage[r][c] = Math.round(v);
        }
    }
    const imgSize = 16;

    const filterDefs = [
        { name: "Bords Horizontaux", kernel: [[-1, -1, -1], [0, 0, 0], [1, 1, 1]], color: "#FFAB40" },
        { name: "Bords Verticaux", kernel: [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]], color: "#85D5E6" },
        { name: "Nettete", kernel: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]], color: "#0097A7" },
    ];

    let activeMap = -1;

    function applyConv(image, kernel) {
        const s = image.length;
        const kh = kernel.length, ph = Math.floor(kh / 2);
        const result = [];
        for (let r = 0; r < s; r++) {
            result[r] = [];
            for (let c = 0; c < s; c++) {
                let sum = 0;
                for (let kr = 0; kr < kh; kr++) {
                    for (let kc = 0; kc < kh; kc++) {
                        const ir = r + kr - ph, ic = c + kc - ph;
                        if (ir >= 0 && ir < s && ic >= 0 && ic < s) {
                            sum += image[ir][ic] * kernel[kr][kc];
                        }
                    }
                }
                result[r][c] = sum;
            }
        }
        return result;
    }

    function drawImageToCanvas(ctx, canvas, data, colorize) {
        const cw = canvas.width, ch = canvas.height;
        const s = data.length;
        const cellW = cw / s, cellH = ch / s;
        ctx.clearRect(0, 0, cw, ch);
        // Find min/max for normalization
        let minV = Infinity, maxV = -Infinity;
        for (let r = 0; r < s; r++) {
            for (let c = 0; c < s; c++) {
                minV = Math.min(minV, data[r][c]);
                maxV = Math.max(maxV, data[r][c]);
            }
        }
        const range = maxV - minV || 1;
        for (let r = 0; r < s; r++) {
            for (let c = 0; c < s; c++) {
                const norm = (data[r][c] - minV) / range;
                if (colorize && data[r][c] < 0) {
                    // Negative values in red tones
                    const intensity = Math.round((1 - norm) * 200);
                    ctx.fillStyle = `rgb(${intensity}, ${intensity * 0.2 | 0}, ${intensity * 0.2 | 0})`;
                } else if (colorize) {
                    const intensity = Math.round(norm * 255);
                    ctx.fillStyle = `rgb(${intensity}, ${intensity}, ${intensity})`;
                } else {
                    const v = clamp(Math.round(data[r][c]), 0, 255);
                    ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
                }
                ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
            }
        }
    }

    function showKernel(idx) {
        const area = document.getElementById("fm-kernel-area");
        const display = document.getElementById("fm-kernel-display");
        const label = document.getElementById("fm-kernel-label");
        if (idx < 0) {
            area.style.display = "none";
            return;
        }
        area.style.display = "flex";
        const f = filterDefs[idx];
        label.textContent = `Noyau : ${f.name}`;
        label.style.color = f.color;
        let html = "";
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                html += `<div class="kernel-cell">${f.kernel[r][c]}</div>`;
            }
        }
        display.innerHTML = html;
    }

    // Draw original image
    drawImageToCanvas(origCtx, origCanvas, sampleImage, false);

    // Draw each feature map
    filterDefs.forEach((f, i) => {
        const canvas = document.getElementById(`fm-map-${i}`);
        const ctx = canvas.getContext("2d");
        const filtered = applyConv(sampleImage, f.kernel);
        drawImageToCanvas(ctx, canvas, filtered, true);
    });

    // Click to highlight
    document.querySelectorAll(".fm-map-item").forEach(item => {
        item.addEventListener("click", () => {
            const idx = parseInt(item.dataset.idx);
            const wasActive = activeMap === idx;
            document.querySelectorAll(".fm-map-item").forEach(el => el.classList.remove("active"));
            if (wasActive) {
                activeMap = -1;
                showKernel(-1);
                document.getElementById("feature-info").textContent = "Cliquez sur une feature map pour voir le noyau utilise";
            } else {
                activeMap = idx;
                item.classList.add("active");
                showKernel(idx);
                const f = filterDefs[idx];
                document.getElementById("feature-info").innerHTML =
                    `Filtre <strong style="color:${f.color}">${f.name}</strong> : chaque filtre detecte un type de motif different`;
            }
        });
    });
}

// ============ Section 6: Architecture ============
function initArchitecture() {
    const svg = document.getElementById("arch-svg");
    if (!svg) return;

    // depth = visual depth for 3D effect (representing channels)
    const layers = [
        { name: "Input", dims: "28\u00d728\u00d71", w: 56, h: 84, depth: 2, color: "#85D5E6", type: "volume" },
        { name: "Conv1+ReLU", dims: "28\u00d728\u00d732", w: 56, h: 84, depth: 16, color: "#FFAB40", type: "volume" },
        { name: "MaxPool", dims: "14\u00d714\u00d732", w: 42, h: 63, depth: 16, color: "#0097A7", type: "volume" },
        { name: "Conv2+ReLU", dims: "14\u00d714\u00d764", w: 42, h: 63, depth: 24, color: "#FFAB40", type: "volume" },
        { name: "MaxPool", dims: "7\u00d77\u00d764", w: 28, h: 42, depth: 24, color: "#0097A7", type: "volume" },
        { name: "Flatten+FC", dims: "128", w: 8, h: 60, depth: 0, color: "#85D5E6", type: "vector" },
        { name: "Output", dims: "10", w: 8, h: 36, depth: 0, color: "#0097A7", type: "vector" },
    ];

    let animProgress = -1;
    let animId = null;

    function draw3DVolume(html, x, y, w, h, depth, color, opacity) {
        const d = Math.min(depth, 20);
        // Back face (offset by depth)
        html += `<rect x="${x + d}" y="${y - d}" width="${w}" height="${h}" rx="3" fill="${color}" opacity="${0.12 * opacity}" stroke="${color}" stroke-width="0.5"/>`;
        // Top face (parallelogram connecting front top to back top)
        html += `<polygon points="${x},${y} ${x + d},${y - d} ${x + w + d},${y - d} ${x + w},${y}" fill="${color}" opacity="${0.08 * opacity}"/>`;
        // Right face (parallelogram connecting front right to back right)
        html += `<polygon points="${x + w},${y} ${x + w + d},${y - d} ${x + w + d},${y + h - d} ${x + w},${y + h}" fill="${color}" opacity="${0.06 * opacity}"/>`;
        // Front face
        html += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#0E2A47" stroke="${color}" stroke-width="1.5" opacity="${opacity}"/>`;
        // Grid pattern inside front face (represents pixel grid)
        const gridN = w > 40 ? 4 : w > 25 ? 3 : 2;
        for (let g = 1; g < gridN; g++) {
            const gx = x + (g / gridN) * w;
            const gy = y + (g / gridN) * h;
            html += `<line x1="${gx}" y1="${y + 2}" x2="${gx}" y2="${y + h - 2}" stroke="${color}" stroke-width="0.3" opacity="${0.2 * opacity}"/>`;
            html += `<line x1="${x + 2}" y1="${gy}" x2="${x + w - 2}" y2="${gy}" stroke="${color}" stroke-width="0.3" opacity="${0.2 * opacity}"/>`;
        }
        return html;
    }

    function drawArch() {
        const svgW = 700, svgH = 300;
        const baseY = 155;
        const totalW = layers.reduce((s, l) => s + l.w + l.depth, 0);
        const gap = (svgW - 40 - totalW) / (layers.length - 1);
        let x = 20;
        const positions = [];

        let html = "";

        layers.forEach((layer, i) => {
            const lx = x;
            const ly = baseY - layer.h / 2;
            const effectiveW = layer.w + layer.depth;
            positions.push({ x: lx, y: ly, w: layer.w, h: layer.h, depth: layer.depth, cx: lx + effectiveW / 2, cy: baseY, effectiveW });
            x += effectiveW + gap;
        });

        // Arrows
        for (let i = 0; i < positions.length - 1; i++) {
            const from = positions[i];
            const to = positions[i + 1];
            const ax1 = from.x + from.effectiveW + 4;
            const ax2 = to.x - 4;
            const isActive = animProgress >= i;
            const opacity = isActive ? 0.9 : 0.2;
            const strokeW = isActive ? 2.5 : 1;
            html += `<line x1="${ax1}" y1="${baseY}" x2="${ax2}" y2="${baseY}" stroke="#78909C" stroke-width="${strokeW}" opacity="${opacity}"/>`;
            html += `<polygon points="${ax2 - 5},${baseY - 3} ${ax2},${baseY} ${ax2 - 5},${baseY + 3}" fill="#78909C" opacity="${opacity}"/>`;
        }

        // Animated pulse
        if (animProgress >= 0 && animProgress < layers.length) {
            const p = positions[animProgress];
            const pw = p.effectiveW + 8, ph = p.h + p.depth + 8;
            html += `<rect x="${p.x - 4}" y="${p.y - p.depth - 4}" width="${pw}" height="${ph}" rx="6" fill="none" stroke="${layers[animProgress].color}" stroke-width="2.5" opacity="0.7">
                <animate attributeName="opacity" values="0.9;0.3;0.9" dur="0.7s" repeatCount="indefinite"/>
            </rect>`;
        }

        // Layer blocks
        positions.forEach((pos, i) => {
            const layer = layers[i];
            const isActive = animProgress === -1 || animProgress >= i;
            const opacity = isActive ? 1.0 : 0.25;

            if (layer.type === "volume" && layer.depth > 0) {
                html = draw3DVolume(html, pos.x, pos.y, pos.w, pos.h, pos.depth, layer.color, opacity);
            } else {
                html += `<rect x="${pos.x}" y="${pos.y}" width="${pos.w}" height="${pos.h}" rx="3" fill="#0E2A47" stroke="${layer.color}" stroke-width="1.5" opacity="${opacity}"/>`;
            }

            // Layer name
            html += `<text x="${pos.cx}" y="${pos.y + pos.h + 18}" text-anchor="middle" fill="${layer.color}" font-size="8.5" font-weight="700" opacity="${opacity}">${layer.name}</text>`;

            // Dimensions
            html += `<text x="${pos.cx}" y="${pos.y - pos.depth - 8}" text-anchor="middle" fill="#78909C" font-size="7.5" opacity="${opacity}">${layer.dims}</text>`;
        });

        // Title
        html += `<text x="350" y="290" text-anchor="middle" fill="#78909C" font-size="10">Architecture CNN (MNIST) : Input &rarr; Conv &rarr; Pool &rarr; Conv &rarr; Pool &rarr; FC &rarr; Output</text>`;

        svg.innerHTML = html;
    }

    function animate() {
        if (animId) { clearTimeout(animId); animId = null; }
        animProgress = -1;
        drawArch();

        let step = 0;
        function tick() {
            animProgress = step;
            drawArch();
            step++;
            if (step < layers.length) {
                animId = setTimeout(tick, 600);
            } else {
                animId = null;
            }
        }
        animId = setTimeout(tick, 300);
    }

    function resetArch() {
        if (animId) { clearTimeout(animId); animId = null; }
        animProgress = -1;
        drawArch();
    }

    document.getElementById("btn-arch-animate").addEventListener("click", animate);
    document.getElementById("btn-arch-reset").addEventListener("click", resetArch);

    // Challenge 5: Layer ordering
    function initLayerSort() {
        const container = document.getElementById("layer-sort-container");
        const correctOrder = ["Input", "Conv+ReLU", "MaxPool", "Conv+ReLU", "MaxPool", "Flatten+FC", "Output"];
        const shuffled = [...correctOrder].sort(() => Math.random() - 0.5);
        let userOrder = [];
        let items = [];

        function render() {
            container.innerHTML = "";

            // Available items
            const available = document.createElement("div");
            available.className = "sort-container";
            shuffled.forEach((name, i) => {
                const item = document.createElement("div");
                item.className = "sort-item";
                item.textContent = name;
                if (userOrder.includes(i)) {
                    item.classList.add("selected");
                }
                item.addEventListener("click", () => {
                    if (userOrder.includes(i)) return;
                    userOrder.push(i);
                    render();
                    if (userOrder.length === correctOrder.length) checkOrder();
                });
                available.appendChild(item);
            });
            container.appendChild(available);

            // User's order
            if (userOrder.length > 0) {
                const orderDiv = document.createElement("div");
                orderDiv.className = "sort-order";
                userOrder.forEach((idx, pos) => {
                    const item = document.createElement("span");
                    item.className = "sort-order-item";
                    item.textContent = `${pos + 1}. ${shuffled[idx]}`;
                    orderDiv.appendChild(item);
                });
                container.appendChild(orderDiv);
            }

            // Reset button
            const resetBtn = document.getElementById("btn-sort-reset");
            resetBtn.style.display = userOrder.length > 0 ? "inline-block" : "none";
        }

        function checkOrder() {
            const userNames = userOrder.map(i => shuffled[i]);
            const isCorrect = userNames.every((name, i) => name === correctOrder[i]);
            if (isCorrect) {
                completeChallenge(5);
                // Mark all items green
                container.querySelectorAll(".sort-order-item").forEach(el => {
                    el.style.background = "#0097A7";
                });
            } else {
                // Mark wrong
                container.querySelectorAll(".sort-order-item").forEach((el, i) => {
                    el.style.background = userOrder.map(idx => shuffled[idx])[i] === correctOrder[i] ? "#0097A7" : "#e85d4a";
                });
            }
        }

        document.getElementById("btn-sort-reset").addEventListener("click", () => {
            userOrder = [];
            render();
        });

        render();
    }
    initLayerSort();
    drawArch();
}

// ============ Section 7: Real Example ============
function initRealExample() {
    const filtersGrid = document.getElementById("filters-grid");
    const digitCanvas = document.getElementById("real-digit-canvas");
    const digitInfo = document.getElementById("real-digit-info");
    const predictionEl = document.getElementById("real-prediction");
    const confidenceEl = document.getElementById("real-confidence");
    const loadBtn = document.getElementById("btn-load-sample");

    if (!filtersGrid || !digitCanvas) return;

    const digitCtx = digitCanvas.getContext("2d");
    let currentSample = null;

    // Fetch and render learned Conv1 filters
    async function loadFilters() {
        try {
            const response = await fetch("/api/cnn-filters");
            const data = await response.json();
            const filters = data.filters;

            filtersGrid.innerHTML = "";
            filters.forEach((f, idx) => {
                const item = document.createElement("div");
                item.className = "filter-item";

                const canvas = document.createElement("canvas");
                canvas.width = 60;
                canvas.height = 60;
                const ctx = canvas.getContext("2d");

                // Draw the 3x3 kernel
                const kernel = f.kernel;
                const cellW = 20, cellH = 20;
                // Find min/max for normalization
                let minV = Infinity, maxV = -Infinity;
                for (let r = 0; r < 3; r++) {
                    for (let c = 0; c < 3; c++) {
                        minV = Math.min(minV, kernel[r][c]);
                        maxV = Math.max(maxV, kernel[r][c]);
                    }
                }
                const range = maxV - minV || 1;

                for (let r = 0; r < 3; r++) {
                    for (let c = 0; c < 3; c++) {
                        const val = kernel[r][c];
                        const norm = (val - minV) / range;
                        // Colorize: negative = red, positive = blue
                        let color;
                        if (val < 0) {
                            const intensity = Math.round((1 - norm) * 200);
                            color = `rgb(${intensity}, ${intensity * 0.3 | 0}, ${intensity * 0.3 | 0})`;
                        } else {
                            const intensity = Math.round(norm * 200);
                            color = `rgb(${intensity * 0.3 | 0}, ${intensity * 0.3 | 0}, ${intensity})`;
                        }
                        ctx.fillStyle = color;
                        ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
                        ctx.strokeStyle = "rgba(26, 58, 92, 0.3)";
                        ctx.lineWidth = 1;
                        ctx.strokeRect(c * cellW, r * cellH, cellW, cellH);
                    }
                }

                const label = document.createElement("div");
                label.className = "filter-label";
                label.textContent = `Filtre ${idx + 1}`;

                item.appendChild(canvas);
                item.appendChild(label);
                filtersGrid.appendChild(item);
            });
        } catch (error) {
            console.error("Error loading filters:", error);
        }
    }

    // Load and display a sample MNIST digit
    async function loadSample() {
        try {
            digitInfo.textContent = "Chargement...";
            predictionEl.textContent = "-";
            confidenceEl.textContent = "-";

            const sampleResp = await fetch("/api/sample");
            const sampleData = await sampleResp.json();
            currentSample = sampleData;

            // Draw the digit
            const image = sampleData.raw_image || sampleData.image;
            const cw = digitCanvas.width, ch = digitCanvas.height;
            const cellW = cw / 28, cellH = ch / 28;
            digitCtx.clearRect(0, 0, cw, ch);

            for (let r = 0; r < 28; r++) {
                for (let c = 0; c < 28; c++) {
                    const v = clamp(Math.round(image[r][c] * 255), 0, 255);
                    digitCtx.fillStyle = `rgb(${v}, ${v}, ${v})`;
                    digitCtx.fillRect(c * cellW, r * cellH, cellW, cellH);
                }
            }

            digitInfo.innerHTML = `Label reel : <strong>${sampleData.label}</strong>`;

            // Predict with CNN
            const predictResp = await fetch("/api/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ model: "cnn", image: sampleData.image })
            });
            const predictData = await predictResp.json();
            const pred = predictData.prediction;
            const probs = predictData.activations.output;
            const confidence = (probs[pred] * 100).toFixed(1);

            predictionEl.textContent = pred;
            confidenceEl.textContent = `${confidence}% confiance`;

            // Color code: green if correct, red if wrong
            if (pred === sampleData.label) {
                predictionEl.style.color = "#4ade80";
            } else {
                predictionEl.style.color = "#e85d4a";
            }
        } catch (error) {
            console.error("Error loading sample:", error);
            digitInfo.textContent = "Erreur de chargement";
        }
    }

    // Challenge 6: Count vertical edge filters
    // Looking at the filters, typically filters with pattern like [-1, 0, 1] repeated vertically detect vertical edges
    // We'll accept 2 or 3 as correct (depends on the trained model)
    const correctAnswers = [2, 3];
    const ch6Input = document.getElementById("ch6-input");
    const ch6Check = document.getElementById("ch6-check");
    const ch6Result = document.getElementById("ch6-result");

    function checkCh6() {
        const val = parseInt(ch6Input.value);
        if (isNaN(val)) return;
        if (correctAnswers.includes(val)) {
            ch6Result.textContent = "\u2714";
            ch6Result.className = "calc-result correct";
            completeChallenge(6);
        } else {
            ch6Result.textContent = "\u2718 Regardez les filtres avec des valeurs negatives a gauche et positives a droite";
            ch6Result.className = "calc-result wrong";
        }
    }

    if (ch6Check) {
        ch6Check.addEventListener("click", checkCh6);
        ch6Input.addEventListener("keydown", (e) => { if (e.key === "Enter") checkCh6(); });
    }

    if (loadBtn) {
        loadBtn.addEventListener("click", loadSample);
    }

    // Initialize
    loadFilters();
    loadSample();
}

// ============ Init ============
document.addEventListener("DOMContentLoaded", () => {
    initScrollSystem();
    initHero();
    initPixelGrid();
    initConvolution();
    initFilters();
    initPooling();
    initFeatureMaps();
    initArchitecture();
    initRealExample();
    updateCounter();
});
