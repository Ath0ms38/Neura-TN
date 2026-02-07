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
    let currentStep = 0; // 0: intro, 1: calcul distance, 2: décision, 3: placement
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
        const currentGenomeDiv = document.createElement("div");
        currentGenomeDiv.style.background = "rgba(255, 171, 64, 0.1)";
        currentGenomeDiv.style.border = "2px solid #FFAB40";
        currentGenomeDiv.style.borderRadius = "10px";
        currentGenomeDiv.style.padding = "15px";
        currentGenomeDiv.style.marginBottom = "20px";

        if (currentGenomeIndex < genomes.length) {
            const genome = genomes[currentGenomeIndex];
            const info = genome.getNetworkInfo();

            currentGenomeDiv.innerHTML = `<h4 style="color: #FFAB40; margin-top: 0;">Génome actuel</h4>`;

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

            // Afficher le calcul de distance si on est en train de comparer
            if (currentStep === 1 && species.length > 0) {
                const calcDiv = document.createElement("div");
                calcDiv.style.marginTop = "15px";
                calcDiv.style.padding = "10px";
                calcDiv.style.background = "rgba(0,0,0,0.3)";
                calcDiv.style.borderRadius = "5px";

                const representative = species[species.length - 1][0];
                const distance = NEAT.Genome.compatibilityDistance(genome, representative);

                calcDiv.innerHTML = `
                    <div style="color: #2196F3; font-weight: bold; margin-bottom: 5px;">Calcul de distance avec l'espèce ${species.length}</div>
                    <div style="color: #CCC; font-size: 11px;">δ = ${distance.toFixed(2)}</div>
                    <div style="color: #999; font-size: 10px; margin-top: 5px;">
                        ${distance < 3.0 ? '✓ Distance < 3.0 → Même espèce' : '✗ Distance ≥ 3.0 → Nouvelle espèce'}
                    </div>
                `;
                currentGenomeDiv.appendChild(calcDiv);
            }
        }
        container.appendChild(currentGenomeDiv);

        // Afficher les espèces existantes
        const speciesDiv = document.createElement("div");
        speciesDiv.innerHTML = `<h4 style="color: #4CAF50; margin-bottom: 15px;">Espèces (${species.length})</h4>`;

        const speciesGrid = document.createElement("div");
        speciesGrid.style.display = "grid";
        speciesGrid.style.gridTemplateColumns = "repeat(auto-fit, minmax(200px, 1fr))";
        speciesGrid.style.gap = "15px";

        const colors = ["#F44336", "#4CAF50", "#2196F3"];

        species.forEach((sp, si) => {
            const box = document.createElement("div");
            box.style.background = `linear-gradient(135deg, ${colors[si % colors.length]}22, ${colors[si % colors.length]}11)`;
            box.style.border = `2px solid ${colors[si % colors.length]}`;
            box.style.borderRadius = "10px";
            box.style.padding = "10px";

            box.innerHTML = `<div style="color: ${colors[si % colors.length]}; font-weight: bold; margin-bottom: 10px; text-align: center;">Espèce ${si + 1}</div>`;

            sp.forEach(genome => {
                const miniSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                miniSvg.setAttribute("viewBox", "0 0 200 120");
                miniSvg.style.width = "100%";
                miniSvg.style.height = "60px";
                miniSvg.style.marginBottom = "5px";
                renderGenomeToSVG(genome, miniSvg, inputLabels, outputLabels);
                box.appendChild(miniSvg);
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
        btnPrev.disabled = currentGenomeIndex === 0 && currentStep === 0;
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
            currentGenomeIndex++;
            currentStep = 0;
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

            currentGenomeIndex++;
            currentStep = 0;
        }

        render();

        // Check challenge
        if (currentGenomeIndex >= genomes.length) {
            if (species.length === 3) {
                completeChallenge(4);
            }
        }
    }

    function previousStep() {
        if (currentGenomeIndex > 0) {
            currentGenomeIndex--;
            // Reconstruire species jusqu'à currentGenomeIndex
            species = [];
            for (let i = 0; i < currentGenomeIndex; i++) {
                const g = genomes[i];
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
            }, 1500);
        } else {
            clearInterval(playInterval);
        }
        render();
    }

    function reset() {
        currentGenomeIndex = 0;
        currentStep = 0;
        species = [];
        isPlaying = false;
        clearInterval(playInterval);
        render();
    }

    render();
}

// ============ Section 6: Fitness - VERSION INTERACTIVE ============
function initFitness() {
    const container = document.getElementById("fitness-interactive");
    if (!container) return;

    // Données des espèces
    let speciesData = [
        { name: "Sp1", members: 10, avgFitness: 45 },
        { name: "Sp2", members: 3, avgFitness: 60 },
        { name: "Sp3", members: 7, avgFitness: 35 },
        { name: "Sp4", members: 5, avgFitness: 50 }
    ];

    function render() {
        container.innerHTML = "";

        // Titre
        const title = document.createElement("h3");
        title.textContent = "Fitness Sharing Interactif";
        title.style.color = "#FFAB40";
        title.style.textAlign = "center";
        title.style.marginBottom = "20px";
        container.appendChild(title);

        // Sliders pour ajuster les espèces
        const slidersDiv = document.createElement("div");
        slidersDiv.style.marginBottom = "30px";
        slidersDiv.style.padding = "15px";
        slidersDiv.style.background = "rgba(255,255,255,0.05)";
        slidersDiv.style.borderRadius = "8px";

        const slidersTitle = document.createElement("h4");
        slidersTitle.textContent = "Ajustez les tailles d'espèces";
        slidersTitle.style.color = "#2196F3";
        slidersTitle.style.marginBottom = "15px";
        slidersDiv.appendChild(slidersTitle);

        speciesData.forEach((sp, i) => {
            const row = document.createElement("div");
            row.style.marginBottom = "15px";

            const label = document.createElement("div");
            label.style.color = "#CCC";
            label.style.fontSize = "12px";
            label.style.marginBottom = "5px";
            label.textContent = `${sp.name} - ${sp.members} membres (fitness moy: ${sp.avgFitness})`;
            row.appendChild(label);

            const slider = document.createElement("input");
            slider.type = "range";
            slider.min = "1";
            slider.max = "20";
            slider.value = sp.members;
            slider.style.width = "100%";
            slider.oninput = (e) => {
                speciesData[i].members = parseInt(e.target.value);
                render();
            };
            row.appendChild(slider);

            slidersDiv.appendChild(row);
        });

        container.appendChild(slidersDiv);

        // Graphiques côte à côte
        const chartsDiv = document.createElement("div");
        chartsDiv.style.display = "grid";
        chartsDiv.style.gridTemplateColumns = "1fr 1fr";
        chartsDiv.style.gap = "20px";
        chartsDiv.style.marginBottom = "20px";

        // Raw fitness
        const rawDiv = document.createElement("div");
        rawDiv.innerHTML = `<h4 style="color: #F44336; text-align: center; margin-bottom: 10px;">Fitness Brute</h4>`;
        const rawCanvas = document.createElement("canvas");
        rawCanvas.width = 300;
        rawCanvas.height = 200;
        rawDiv.appendChild(rawCanvas);
        chartsDiv.appendChild(rawDiv);

        // Adjusted fitness
        const adjDiv = document.createElement("div");
        adjDiv.innerHTML = `<h4 style="color: #4CAF50; text-align: center; margin-bottom: 10px;">Fitness Ajustée</h4>`;
        const adjCanvas = document.createElement("canvas");
        adjCanvas.width = 300;
        adjCanvas.height = 200;
        adjDiv.appendChild(adjCanvas);
        chartsDiv.appendChild(adjDiv);

        container.appendChild(chartsDiv);

        // Dessiner les graphiques
        drawFitnessChart(rawCanvas, speciesData, false);
        drawFitnessChart(adjCanvas, speciesData, true);

        // Explication
        const explanation = document.createElement("div");
        explanation.style.padding = "15px";
        explanation.style.background = "rgba(76, 175, 80, 0.1)";
        explanation.style.border = "1px solid #4CAF50";
        explanation.style.borderRadius = "8px";
        explanation.style.color = "#CCC";
        explanation.style.fontSize = "13px";
        explanation.innerHTML = `
            <strong style="color: #4CAF50;">Le fitness sharing protège les petites espèces :</strong><br>
            Les espèces avec peu de membres obtiennent une fitness ajustée plus élevée,
            ce qui leur permet de survivre et d'innover même si leur fitness brute est faible.
        `;
        container.appendChild(explanation);
    }

    function drawFitnessChart(canvas, data, adjusted) {
        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);

        // Calculer les valeurs
        const values = data.map(sp => {
            const total = sp.avgFitness * sp.members;
            return adjusted ? total / sp.members : total;
        });

        const maxValue = Math.max(...values);
        const barWidth = (w - 60) / data.length;

        // Dessiner les barres
        const colors = ["#F44336", "#4CAF50", "#2196F3", "#FF9800"];

        data.forEach((sp, i) => {
            const value = values[i];
            const barHeight = (value / maxValue) * (h - 40);
            const x = 30 + i * barWidth;
            const y = h - 20 - barHeight;

            ctx.fillStyle = colors[i % colors.length];
            ctx.fillRect(x, y, barWidth - 10, barHeight);

            // Label
            ctx.fillStyle = "#CCC";
            ctx.font = "12px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(sp.name, x + (barWidth - 10) / 2, h - 5);

            // Valeur
            ctx.fillText(value.toFixed(0), x + (barWidth - 10) / 2, y - 5);
        });
    }

    render();

    // Challenge 5
    const challengeDiv = document.getElementById("challenge-5");
    if (challengeDiv) {
        challengeDiv.innerHTML = `
            <div class="challenge-header">
                <span class="challenge-icon">★</span>
                <span class="challenge-title">Défi 5 : Fitness Sharing</span>
                <span class="challenge-status" id="ch5-status"></span>
            </div>
            <p class="challenge-text">
                Si une espèce a 4 membres et une fitness brute totale de 100, quelle est la fitness ajustée par individu ?
            </p>
            <div style="display: flex; gap: 10px; align-items: center; margin-top: 10px;">
                <input type="number" id="ch5-input" placeholder="Réponse" style="padding: 8px; border-radius: 4px; border: 1px solid #666; background: #222; color: #FFF; width: 100px;">
                <button id="ch5-btn" class="ctrl-btn accent">Vérifier</button>
                <span id="ch5-feedback" style="margin-left: 10px; font-weight: bold;"></span>
            </div>
        `;

        document.getElementById("ch5-btn").onclick = () => {
            const input = document.getElementById("ch5-input");
            const feedback = document.getElementById("ch5-feedback");
            const answer = parseFloat(input.value);

            if (Math.abs(answer - 25) < 0.1) {
                feedback.textContent = "✓ Correct !";
                feedback.style.color = "#4CAF50";
                completeChallenge(5);
            } else {
                feedback.textContent = "✗ Incorrect. Formule : total / membres";
                feedback.style.color = "#F44336";
            }
        };
    }
}
