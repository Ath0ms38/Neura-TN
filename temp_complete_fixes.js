// CORRECTIONS COMPLÈTES POUR LES SECTIONS 5, 6, 7, 8

// ============ Section 5: Speciation - ANIMATION STEP BY STEP ============
function initSpeciation() {
    NEAT.resetInnovation();

    // Créer 6 génomes avec des structures progressivement différentes
    const genomes = [];

    // Génome 0 & 1: Très similaires (même espèce)
    for (let i = 0; i < 2; i++) {
        const g = NEAT.Genome.create(2, 1);
        genomes.push(g);
    }

    // Génome 2 & 3: Avec une connexion supplémentaire (même espèce)
    for (let i = 0; i < 2; i++) {
        const g = NEAT.Genome.create(2, 1);
        g.mutateAddConnection();
        genomes.push(g);
    }

    // Génome 4 & 5: Avec un noeud caché (même espèce)
    for (let i = 0; i < 2; i++) {
        const g = NEAT.Genome.create(2, 1);
        g.mutateAddNode();
        genomes.push(g);
    }

    const inputLabels = ["x", "y", "bias"];
    const outputLabels = ["out"];

    // État de l'animation
    let currentGenomeIndex = 0;
    let species = [];
    let isPlaying = false;
    let playInterval = null;

    const container = document.getElementById("speciation-animation");
    if (!container) return;

    function render() {
        container.innerHTML = "";

        // Titre avec étape actuelle
        const header = document.createElement("div");
        header.style.textAlign = "center";
        header.style.marginBottom = "20px";

        if (currentGenomeIndex >= genomes.length) {
            header.innerHTML = `<h3 style="color: #4CAF50;">✓ Speciation terminée ! ${species.length} espèces créées</h3>`;
        } else {
            header.innerHTML = `<h3 style="color: #FFAB40;">Traitement du génome ${currentGenomeIndex + 1}/${genomes.length}</h3>`;
        }
        container.appendChild(header);

        // Zone d'affichage du génome en cours
        if (currentGenomeIndex < genomes.length) {
            const currentGenomeDiv = document.createElement("div");
            currentGenomeDiv.style.background = "rgba(255, 171, 64, 0.1)";
            currentGenomeDiv.style.border = "2px solid #FFAB40";
            currentGenomeDiv.style.borderRadius = "10px";
            currentGenomeDiv.style.padding = "15px";
            currentGenomeDiv.style.marginBottom = "20px";

            const genome = genomes[currentGenomeIndex];
            const info = genome.getNetworkInfo();

            currentGenomeDiv.innerHTML = `<h4 style="color: #FFAB40; margin-top: 0;">Génome actuel #${currentGenomeIndex + 1}</h4>`;

            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("viewBox", "0 0 200 120");
            svg.style.width = "200px";
            svg.style.height = "120px";
            svg.style.display = "block";
            svg.style.margin = "0 auto";
            renderGenomeToSVG(genome, svg, inputLabels, outputLabels);
            currentGenomeDiv.appendChild(svg);

            const stats = document.createElement("div");
            stats.style.textAlign = "center";
            stats.style.color = "#CCC";
            stats.style.fontSize = "12px";
            stats.style.marginTop = "10px";
            stats.textContent = `${info.nodes.length} nœuds, ${info.connections.length} connexions`;
            currentGenomeDiv.appendChild(stats);

            // Afficher le calcul de distance pour chaque espèce existante
            if (species.length > 0) {
                const calcDiv = document.createElement("div");
                calcDiv.style.marginTop = "15px";
                calcDiv.innerHTML = `<div style="color: #2196F3; font-weight: bold; margin-bottom: 10px;">Calcul de distance avec chaque espèce :</div>`;

                species.forEach((sp, si) => {
                    const representative = sp[0];
                    const distance = NEAT.Genome.compatibilityDistance(genome, representative);
                    const isCompatible = distance < 3.0;

                    const distDiv = document.createElement("div");
                    distDiv.style.padding = "8px";
                    distDiv.style.margin = "5px 0";
                    distDiv.style.background = isCompatible ? "rgba(76, 175, 80, 0.2)" : "rgba(244, 67, 54, 0.2)";
                    distDiv.style.borderRadius = "5px";
                    distDiv.style.fontSize = "11px";
                    distDiv.innerHTML = `
                        Espèce ${si + 1}: δ = <strong>${distance.toFixed(2)}</strong>
                        ${isCompatible ? '<span style="color: #4CAF50;">✓ Compatible (< 3.0)</span>' : '<span style="color: #F44336;">✗ Incompatible (≥ 3.0)</span>'}
                    `;
                    calcDiv.appendChild(distDiv);
                });

                currentGenomeDiv.appendChild(calcDiv);
            }

            container.appendChild(currentGenomeDiv);
        }

        // Afficher les espèces existantes
        const speciesDiv = document.createElement("div");
        speciesDiv.innerHTML = `<h4 style="color: #4CAF50; margin-bottom: 15px;">Espèces actuelles: ${species.length}</h4>`;

        const speciesGrid = document.createElement("div");
        speciesGrid.style.display = "grid";
        speciesGrid.style.gridTemplateColumns = "repeat(auto-fit, minmax(220px, 1fr))";
        speciesGrid.style.gap = "15px";

        const colors = ["#F44336", "#4CAF50", "#2196F3"];

        species.forEach((sp, si) => {
            const box = document.createElement("div");
            box.style.background = `linear-gradient(135deg, ${colors[si % colors.length]}22, ${colors[si % colors.length]}11)`;
            box.style.border = `2px solid ${colors[si % colors.length]}`;
            box.style.borderRadius = "10px";
            box.style.padding = "10px";

            box.innerHTML = `<div style="color: ${colors[si % colors.length]}; font-weight: bold; margin-bottom: 10px; text-align: center;">Espèce ${si + 1} (${sp.length} génomes)</div>`;

            sp.forEach((genome, gi) => {
                const miniDiv = document.createElement("div");
                miniDiv.style.marginBottom = "8px";
                miniDiv.style.padding = "8px";
                miniDiv.style.background = "rgba(0,0,0,0.2)";
                miniDiv.style.borderRadius = "5px";

                const miniSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                miniSvg.setAttribute("viewBox", "0 0 200 120");
                miniSvg.style.width = "100%";
                miniSvg.style.height = "60px";
                renderGenomeToSVG(genome, miniSvg, inputLabels, outputLabels);

                const label = document.createElement("div");
                label.style.fontSize = "10px";
                label.style.color = "#999";
                label.style.textAlign = "center";
                label.style.marginTop = "3px";
                label.textContent = gi === 0 ? "Représentant" : `Membre ${gi}`;

                miniDiv.appendChild(miniSvg);
                miniDiv.appendChild(label);
                box.appendChild(miniDiv);
            });

            speciesGrid.appendChild(box);
        });

        speciesDiv.appendChild(speciesGrid);
        container.appendChild(speciesDiv);

        // Contrôles
        const controls = document.createElement("div");
        controls.style.display = "flex";
        controls.style.justifyContent = "center";
        controls.style.gap = "10px";
        controls.style.marginTop = "20px";

        const btnPrev = document.createElement("button");
        btnPrev.textContent = "◄ Précédent";
        btnPrev.className = "ctrl-btn secondary";
        btnPrev.onclick = () => previousStep();
        btnPrev.disabled = currentGenomeIndex === 0;
        controls.appendChild(btnPrev);

        const btnPlay = document.createElement("button");
        btnPlay.textContent = isPlaying ? "⏸ Pause" : "▶ Play";
        btnPlay.className = "ctrl-btn accent";
        btnPlay.onclick = () => togglePlay();
        controls.appendChild(btnPlay);

        const btnNext = document.createElement("button");
        btnNext.textContent = "Suivant ►";
        btnNext.className = "ctrl-btn secondary";
        btnNext.onclick = () => nextStep();
        btnNext.disabled = currentGenomeIndex >= genomes.length;
        controls.appendChild(btnNext);

        const btnReset = document.createElement("button");
        btnReset.textContent = "↻ Reset";
        btnReset.className = "ctrl-btn secondary";
        btnReset.onclick = () => reset();
        controls.appendChild(btnReset);

        container.appendChild(controls);
    }

    function nextStep() {
        if (currentGenomeIndex >= genomes.length) return;

        const genome = genomes[currentGenomeIndex];

        if (species.length === 0) {
            // Première espèce
            species.push([genome]);
        } else {
            // Chercher une espèce compatible
            let placed = false;
            for (let sp of species) {
                const representative = sp[0];
                const distance = NEAT.Genome.compatibilityDistance(genome, representative);
                if (distance < 3.0) {
                    sp.push(genome);
                    placed = true;
                    break;
                }
            }

            if (!placed) {
                species.push([genome]);
            }
        }

        currentGenomeIndex++;
        render();

        // Check challenge
        if (currentGenomeIndex >= genomes.length && species.length === 3) {
            completeChallenge(4);
        }
    }

    function previousStep() {
        if (currentGenomeIndex > 0) {
            currentGenomeIndex--;
            // Reconstruire species jusqu'à currentGenomeIndex
            species = [];
            for (let i = 0; i < currentGenomeIndex; i++) {
                const g = genomes[i];
                if (species.length === 0) {
                    species.push([g]);
                } else {
                    let placed = false;
                    for (let sp of species) {
                        const rep = sp[0];
                        if (NEAT.Genome.compatibilityDistance(g, rep) < 3.0) {
                            sp.push(g);
                            placed = true;
                            break;
                        }
                    }
                    if (!placed) {
                        species.push([g]);
                    }
                }
            }
            render();
        }
    }

    function togglePlay() {
        isPlaying = !isPlaying;
        if (isPlaying) {
            playInterval = setInterval(() => {
                if (currentGenomeIndex >= genomes.length) {
                    isPlaying = false;
                    clearInterval(playInterval);
                    render();
                } else {
                    nextStep();
                }
            }, 2000);
        } else {
            clearInterval(playInterval);
        }
        render();
    }

    function reset() {
        currentGenomeIndex = 0;
        species = [];
        isPlaying = false;
        clearInterval(playInterval);
        render();
    }

    render();
}

// ============ Section 6: Fitness - VERSION INTERACTIVE ============
function initFitness() {
    const rawChart = document.getElementById("fitness-raw-chart");
    const adjustedChart = document.getElementById("fitness-adjusted-chart");
    if (!rawChart || !adjustedChart) return;

    const rawCtx = rawChart.getContext("2d");
    const adjCtx = adjustedChart.getContext("2d");

    // Données modifiables
    let speciesData = [
        { name: "Sp1", members: 10, totalFitness: 450 },
        { name: "Sp2", members: 3, totalFitness: 180 },
        { name: "Sp3", members: 7, totalFitness: 245 },
        { name: "Sp4", members: 5, totalFitness: 250 }
    ];

    // Créer des sliders interactifs
    const slidersContainer = document.getElementById("fitness-sliders");
    if (slidersContainer) {
        slidersContainer.innerHTML = "<h4 style='color: #2196F3; margin-bottom: 15px; text-align: center;'>Ajustez les tailles des espèces :</h4>";

        speciesData.forEach((sp, i) => {
            const sliderDiv = document.createElement("div");
            sliderDiv.style.marginBottom = "15px";

            const label = document.createElement("div");
            label.id = `sp${i}-label`;
            label.style.color = "#CCC";
            label.style.fontSize = "12px";
            label.style.marginBottom = "5px";
            label.textContent = `${sp.name}: ${sp.members} membres (total: ${sp.totalFitness})`;
            sliderDiv.appendChild(label);

            const slider = document.createElement("input");
            slider.type = "range";
            slider.min = "1";
            slider.max = "20";
            slider.value = sp.members;
            slider.style.width = "100%";
            slider.oninput = (e) => {
                speciesData[i].members = parseInt(e.target.value);
                document.getElementById(`sp${i}-label`).textContent = `${sp.name}: ${sp.members} membres (total: ${sp.totalFitness})`;
                drawCharts();
            };
            sliderDiv.appendChild(slider);

            slidersContainer.appendChild(sliderDiv);
        });
    }

    function drawBarChart(ctx, data, adjusted) {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;

        ctx.clearRect(0, 0, w, h);

        const values = data.map(sp => adjusted ? sp.totalFitness / sp.members : sp.totalFitness);
        const maxValue = Math.max(...values);

        const barWidth = (w - 60) / data.length;
        const colors = ["#F44336", "#4CAF50", "#2196F3", "#FF9800"];

        data.forEach((sp, i) => {
            const value = values[i];
            const barHeight = (value / maxValue) * (h - 50);
            const x = 30 + i * barWidth + 5;
            const y = h - 30 - barHeight;

            // Bar
            ctx.fillStyle = colors[i];
            ctx.fillRect(x, y, barWidth - 10, barHeight);

            // Label
            ctx.fillStyle = "#CCC";
            ctx.font = "12px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(sp.name, x + (barWidth - 10) / 2, h - 10);

            // Value
            ctx.fillText(value.toFixed(0), x + (barWidth - 10) / 2, y - 5);
        });
    }

    function drawCharts() {
        drawBarChart(rawCtx, speciesData, false);
        drawBarChart(adjCtx, speciesData, true);
    }

    drawCharts();

    const explanation = document.getElementById("fitness-explanation");
    if (explanation) {
        explanation.textContent = "Ajustez les sliders pour voir comment le fitness sharing protège les petites espèces !";
    }

    // Challenge 5
    const input = document.getElementById("ch5-input");
    const btn = document.getElementById("ch5-btn");
    const feedback = document.getElementById("ch5-feedback");

    if (btn && input && feedback) {
        btn.addEventListener("click", () => {
            const userAnswer = parseFloat(input.value);
            const correctAnswer = 100 / 4; // 25.0

            if (Math.abs(userAnswer - correctAnswer) < 0.1) {
                feedback.textContent = "✓ Correct ! 100 / 4 = 25";
                feedback.style.color = "#4CAF50";
                completeChallenge(5);
            } else {
                feedback.textContent = `✗ Incorrect. Formule : fitness brute / taille espèce`;
                feedback.style.color = "#F44336";
            }
        });
    }
}

// ============ Section 7: Evolution Cycle - FIX ARROW MARKER ============
function initEvolutionCycle() {
    const flowchartSvg = document.getElementById("flowchart-svg");
    const graphCanvas = document.getElementById("evolution-graph");
    if (!flowchartSvg || !graphCanvas) return;

    // Draw flowchart with PROPER arrow marker definition
    flowchartSvg.innerHTML = `
        <defs>
            <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <polygon points="0 0, 10 3, 0 6" fill="#FFF" />
            </marker>
        </defs>

        <rect x="180" y="20" width="140" height="40" fill="#2196F3" rx="5" />
        <text x="250" y="45" text-anchor="middle" fill="white" font-size="14">Evaluation</text>

        <rect x="180" y="80" width="140" height="40" fill="#4CAF50" rx="5" />
        <text x="250" y="105" text-anchor="middle" fill="white" font-size="14">Speciation</text>

        <rect x="180" y="140" width="140" height="40" fill="#FF9800" rx="5" />
        <text x="250" y="165" text-anchor="middle" fill="white" font-size="14">Selection</text>

        <rect x="180" y="200" width="140" height="40" fill="#9C27B0" rx="5" />
        <text x="250" y="225" text-anchor="middle" fill="white" font-size="14">Crossover</text>

        <rect x="180" y="260" width="140" height="40" fill="#F44336" rx="5" />
        <text x="250" y="285" text-anchor="middle" fill="white" font-size="14">Mutation</text>

        <path d="M 250 60 L 250 80" stroke="white" stroke-width="2" marker-end="url(#arrow)" />
        <path d="M 250 120 L 250 140" stroke="white" stroke-width="2" marker-end="url(#arrow)" />
        <path d="M 250 180 L 250 200" stroke="white" stroke-width="2" marker-end="url(#arrow)" />
        <path d="M 250 240 L 250 260" stroke="white" stroke-width="2" marker-end="url(#arrow)" />
        <path d="M 320 280 Q 380 280 380 40 L 320 40" stroke="white" stroke-width="2" marker-end="url(#arrow)" stroke-dasharray="5,5" />
    `;

    // Evolution simulation continues as before...
    const ctx = graphCanvas.getContext("2d");
    let generation = 0;
    let fitnessHistory = [];
    let isRunning = false;
    let population = null;

    function xorFitness(genome) {
        const tests = [
            { input: [0, 0], expected: 0 },
            { input: [0, 1], expected: 1 },
            { input: [1, 0], expected: 1 },
            { input: [1, 1], expected: 0 }
        ];

        let error = 0;
        tests.forEach(test => {
            const output = genome.activate(test.input)[0];
            error += Math.abs(output - test.expected);
        });

        return Math.max(0, 4 - error);
    }

    function initPopulation() {
        NEAT.resetInnovation();
        population = new NEAT.Population(2, 1, 50);
        generation = 0;
        fitnessHistory = [];
    }

    function evolveGeneration() {
        population.genomes.forEach(g => {
            g.fitness = xorFitness(g);
        });

        const best = population.genomes.reduce((a, b) => a.fitness > b.fitness ? a : b);
        fitnessHistory.push(best.fitness);
        generation++;

        document.getElementById("gen-value").textContent = generation;
        document.getElementById("best-fitness-value").textContent = best.fitness.toFixed(3);
        document.getElementById("species-value").textContent = population.species ? population.species.length : "--";

        population.evolve();

        drawGraph();

        if (best.fitness > 0.95) {
            const progress = document.getElementById("ch6-progress");
            const text = document.getElementById("ch6-text");
            if (progress && text) {
                progress.style.width = "100%";
                text.textContent = `Fitness : ${best.fitness.toFixed(2)} / 0.95 - Objectif atteint !`;
                text.style.color = "#4CAF50";
            }
            completeChallenge(6);
            isRunning = false;
        }
    }

    function drawGraph() {
        ctx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);

        if (fitnessHistory.length < 2) return;

        const maxGen = Math.max(20, fitnessHistory.length);
        const xScale = graphCanvas.width / maxGen;
        const yScale = graphCanvas.height - 20;

        // Draw best fitness line
        ctx.strokeStyle = "#4CAF50";
        ctx.lineWidth = 2;
        ctx.beginPath();

        fitnessHistory.forEach((fitness, i) => {
            const x = i * xScale;
            const y = graphCanvas.height - (fitness / 4 * yScale);

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        ctx.stroke();

        // Draw target line
        ctx.strokeStyle = "#FF9800";
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        const targetY = graphCanvas.height - (0.95 / 4 * yScale);
        ctx.beginPath();
        ctx.moveTo(0, targetY);
        ctx.lineTo(graphCanvas.width, targetY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw labels
        ctx.fillStyle = "#CCC";
        ctx.font = "10px sans-serif";
        ctx.fillText("Gen", 5, graphCanvas.height - 5);
        ctx.fillText("Fitness", 5, 15);
    }

    // Control buttons
    const btnStart = document.getElementById("btn-start-evolution");
    const btnStep = document.getElementById("btn-step-evolution");
    const btnReset = document.getElementById("btn-reset-evolution");

    if (btnStart) {
        btnStart.addEventListener("click", () => {
            if (!population) initPopulation();
            isRunning = !isRunning;
            btnStart.textContent = isRunning ? "⏸ Pause" : "▶ Démarrer";

            if (isRunning) {
                const interval = setInterval(() => {
                    if (!isRunning || generation >= 100) {
                        isRunning = false;
                        clearInterval(interval);
                        btnStart.textContent = "▶ Démarrer";
                        return;
                    }
                    evolveGeneration();
                }, 100);
            }
        });
    }

    if (btnStep) {
        btnStep.addEventListener("click", () => {
            if (!population) initPopulation();
            evolveGeneration();
        });
    }

    if (btnReset) {
        btnReset.addEventListener("click", () => {
            isRunning = false;
            initPopulation();
            drawGraph();
            if (btnStart) btnStart.textContent = "▶ Démarrer";

            const progress = document.getElementById("ch6-progress");
            const text = document.getElementById("ch6-text");
            if (progress) progress.style.width = "0%";
            if (text) {
                text.textContent = "En attente...";
                text.style.color = "#999";
            }
        });
    }

    initPopulation();
    drawGraph();
}

// ============ Section 8: Applications - FIX OVERFLOW ============
function initApplications() {
    const gen1Svg = document.getElementById("gen1-svg");
    const gen50Svg = document.getElementById("gen50-svg");
    if (!gen1Svg || !gen50Svg) return;

    NEAT.resetInnovation();

    // Gen 1: Simple network
    const gen1 = NEAT.Genome.create(4, 1);
    const inputLabels = ["x1", "x2", "x3", "x4", "bias"];
    const outputLabels = ["jump"];
    renderGenomeToSVG(gen1, gen1Svg, inputLabels, outputLabels);

    document.getElementById("gen1-nodes").textContent = gen1.nodes.length;
    document.getElementById("gen1-connections").textContent = gen1.connections.length;
    document.getElementById("gen1-fitness").textContent = "12";

    // Gen 50: Complex network with MODERATE complexity to avoid overflow
    const gen50 = NEAT.Genome.create(4, 1);
    for (let i = 0; i < 3; i++) {  // Reduced from 5 to 3
        gen50.mutateAddNode();
        gen50.mutateAddConnection();
    }
    renderGenomeToSVG(gen50, gen50Svg, inputLabels, outputLabels);

    document.getElementById("gen50-nodes").textContent = gen50.nodes.length;
    document.getElementById("gen50-connections").textContent = gen50.connections.length;
    document.getElementById("gen50-fitness").textContent = "8547";
}
