// ============ Section 4: Innovation & Crossover + Challenge 3 ============
function initInnovation() {
    const p1Svg = document.getElementById("parent1-svg");
    const p2Svg = document.getElementById("parent2-svg");
    const childSvg = document.getElementById("child-svg");
    const geneAlignment = document.getElementById("gene-alignment");
    const quiz = document.getElementById("innovation-quiz");
    const explanationEl = document.getElementById("crossover-explanation");
    const stepEl = document.getElementById("crossover-step");
    const progressEl = document.getElementById("crossover-progress-fill");

    if (!p1Svg || !p2Svg || !childSvg) return;

    NEAT.resetInnovation();
    const parent1 = NEAT.Genome.create(2, 1);
    parent1.mutateAddNode();
    parent1.mutateAddConnection();
    parent1.mutateAddConnection();

    const parent2 = NEAT.Genome.create(2, 1);
    parent2.mutateAddConnection();
    parent2.mutateAddNode();

    parent1.fitness = 8.5;
    parent2.fitness = 6.2;

    const child = NEAT.Genome.crossover(parent1, parent2);

    const inputLabels = ["A", "B", "bias"];
    const outputLabels = ["Y"];

    // Gene alignment data
    const p1Innovations = parent1.connections.map(c => c.innovation);
    const p2Innovations = parent2.connections.map(c => c.innovation);
    const allInnovations = [...new Set([...p1Innovations, ...p2Innovations])].sort((a, b) => a - b);

    // Animation state
    let currentStep = 0;
    const maxSteps = 5; // 0: intro, 1: P1, 2: P2, 3: alignment, 4: child, 5: complete
    let isPlaying = false;
    let playInterval = null;

    function renderAnimatedCrossover(step) {
        // Clear
        p1Svg.innerHTML = "";
        p2Svg.innerHTML = "";
        childSvg.innerHTML = "";
        if (geneAlignment) geneAlignment.innerHTML = "";

        // Update progress
        if (stepEl) stepEl.textContent = `${step}/${maxSteps}`;
        if (progressEl) progressEl.style.width = `${(step / maxSteps) * 100}%`;

        // Step 0: Introduction
        if (step === 0) {
            if (explanationEl) explanationEl.textContent = "Étape 0 : Deux parents vont se reproduire";
            renderGenomeToSVG(parent1, p1Svg, inputLabels, outputLabels);
            renderGenomeToSVG(parent2, p2Svg, inputLabels, outputLabels);
        }

        // Step 1: Highlight Parent 1 (fitter)
        else if (step === 1) {
            if (explanationEl) explanationEl.textContent = `Étape 1 : Parent 1 (fitness ${parent1.fitness}) - Le plus fit`;
            renderGenomeToSVG(parent1, p1Svg, inputLabels, outputLabels);
            p1Svg.style.border = "3px solid #4CAF50";
            p1Svg.style.borderRadius = "8px";
            p1Svg.style.padding = "5px";
            renderGenomeToSVG(parent2, p2Svg, inputLabels, outputLabels);
            p2Svg.style.opacity = "0.4";
        }

        // Step 2: Highlight Parent 2
        else if (step === 2) {
            if (explanationEl) explanationEl.textContent = `Étape 2 : Parent 2 (fitness ${parent2.fitness}) - Moins fit`;
            renderGenomeToSVG(parent1, p1Svg, inputLabels, outputLabels);
            p1Svg.style.opacity = "0.4";
            p1Svg.style.border = "none";
            renderGenomeToSVG(parent2, p2Svg, inputLabels, outputLabels);
            p2Svg.style.border = "3px solid #FF9800";
            p2Svg.style.borderRadius = "8px";
            p2Svg.style.padding = "5px";
            p2Svg.style.opacity = "1";
        }

        // Step 3: Show gene alignment
        else if (step === 3) {
            if (explanationEl) explanationEl.textContent = "Étape 3 : Alignement des gènes par numéro d'innovation";
            renderGenomeToSVG(parent1, p1Svg, inputLabels, outputLabels);
            renderGenomeToSVG(parent2, p2Svg, inputLabels, outputLabels);
            p1Svg.style.border = "none";
            p2Svg.style.border = "none";
            p1Svg.style.opacity = "1";
            p2Svg.style.opacity = "1";

            if (geneAlignment) {
                geneAlignment.innerHTML = "<h4 style='color: #FFAB40;'>Alignement des gènes</h4>";
                allInnovations.forEach(innov => {
                    const inP1 = p1Innovations.includes(innov);
                    const inP2 = p2Innovations.includes(innov);
                    let type = "matching";
                    let color = "#4CAF50";
                    let label = "M";

                    if (inP1 && !inP2) {
                        if (innov > Math.max(...p2Innovations)) {
                            type = "excess";
                            color = "#FF9800";
                            label = "E";
                        } else {
                            type = "disjoint";
                            color = "#FFC107";
                            label = "D";
                        }
                    } else if (!inP1 && inP2) {
                        if (innov > Math.max(...p1Innovations)) {
                            type = "excess";
                            color = "#FF9800";
                            label = "E";
                        } else {
                            type = "disjoint";
                            color = "#FFC107";
                            label = "D";
                        }
                    }

                    const span = document.createElement("span");
                    span.style.display = "inline-block";
                    span.style.margin = "4px";
                    span.style.padding = "8px 12px";
                    span.style.background = color;
                    span.style.borderRadius = "6px";
                    span.style.fontSize = "12px";
                    span.style.fontWeight = "bold";
                    span.style.color = "#000";
                    span.textContent = `#${innov} (${label})`;
                    span.title = type.charAt(0).toUpperCase() + type.slice(1);
                    geneAlignment.appendChild(span);
                });

                const legend = document.createElement("div");
                legend.style.marginTop = "10px";
                legend.style.fontSize = "11px";
                legend.innerHTML = `
                    <span style="color: #4CAF50;">■ M = Matching</span>
                    <span style="color: #FFC107; margin-left: 10px;">■ D = Disjoint</span>
                    <span style="color: #FF9800; margin-left: 10px;">■ E = Excess</span>
                `;
                geneAlignment.appendChild(legend);
            }
        }

        // Step 4: Show child being created
        else if (step === 4) {
            if (explanationEl) explanationEl.textContent = "Étape 4 : Création de l'enfant (héritage du parent le plus fit)";
            renderGenomeToSVG(parent1, p1Svg, inputLabels, outputLabels);
            renderGenomeToSVG(parent2, p2Svg, inputLabels, outputLabels);
            p1Svg.style.opacity = "0.6";
            p2Svg.style.opacity = "0.6";
            renderGenomeToSVG(child, childSvg, inputLabels, outputLabels);
            childSvg.style.border = "3px solid #FFAB40";
            childSvg.style.borderRadius = "8px";
            childSvg.style.padding = "5px";
        }

        // Step 5: Complete
        else if (step >= 5) {
            if (explanationEl) explanationEl.textContent = "✓ Crossover terminé ! L'enfant combine les gènes des deux parents";
            renderGenomeToSVG(parent1, p1Svg, inputLabels, outputLabels);
            renderGenomeToSVG(parent2, p2Svg, inputLabels, outputLabels);
            renderGenomeToSVG(child, childSvg, inputLabels, outputLabels);
            p1Svg.style.opacity = "1";
            p2Svg.style.opacity = "1";
            childSvg.style.border = "none";

            // Show final alignment
            if (geneAlignment) {
                geneAlignment.innerHTML = "<h4 style='color: #4CAF50;'>Crossover réussi !</h4>";
                const summary = document.createElement("p");
                summary.style.fontSize = "12px";
                summary.style.color = "#CCC";
                summary.innerHTML = `Parent 1: ${parent1.connections.length} connexions<br>Parent 2: ${parent2.connections.length} connexions<br>Enfant: ${child.connections.length} connexions`;
                geneAlignment.appendChild(summary);
            }
        }
    }

    // Animation controls
    const btnPrev = document.getElementById("btn-crossover-prev");
    const btnNext = document.getElementById("btn-crossover-next");
    const btnPlay = document.getElementById("btn-crossover-play");
    const btnReset = document.getElementById("btn-crossover-reset");

    if (btnPrev) btnPrev.addEventListener("click", () => {
        if (currentStep > 0) {
            currentStep--;
            renderAnimatedCrossover(currentStep);
        }
    });

    if (btnNext) btnNext.addEventListener("click", () => {
        if (currentStep < maxSteps) {
            currentStep++;
            renderAnimatedCrossover(currentStep);
        }
    });

    if (btnPlay) btnPlay.addEventListener("click", () => {
        isPlaying = !isPlaying;
        btnPlay.textContent = isPlaying ? "⏸ Pause" : "▶ Play";

        if (isPlaying) {
            playInterval = setInterval(() => {
                if (currentStep >= maxSteps) {
                    isPlaying = false;
                    btnPlay.textContent = "▶ Play";
                    clearInterval(playInterval);
                    return;
                }
                currentStep++;
                renderAnimatedCrossover(currentStep);
            }, 1500);
        } else {
            clearInterval(playInterval);
        }
    });

    if (btnReset) btnReset.addEventListener("click", () => {
        currentStep = 0;
        isPlaying = false;
        if (btnPlay) btnPlay.textContent = "▶ Play";
        clearInterval(playInterval);
        renderAnimatedCrossover(currentStep);
    });

    // Initial render
    renderAnimatedCrossover(currentStep);

    // Challenge 3: Gene type quiz (appears after animation)
    if (quiz) {
        const quizGenes = allInnovations.slice(0, Math.min(3, allInnovations.length));

        quiz.innerHTML = "<h4 style='color: #FFAB40; margin-top: 20px;'>Quiz: Identifiez le type de gène</h4>";
        quizGenes.forEach(innov => {
            const inP1 = p1Innovations.includes(innov);
            const inP2 = p2Innovations.includes(innov);
            let correctType = "matching";

            if (inP1 && !inP2) {
                correctType = innov > Math.max(...p2Innovations) ? "excess" : "disjoint";
            } else if (!inP1 && inP2) {
                correctType = innov > Math.max(...p1Innovations) ? "excess" : "disjoint";
            }

            const div = document.createElement("div");
            div.className = "quiz-item";
            div.style.marginBottom = "10px";
            div.innerHTML = `
                <p style="color: #CCC;">Gène #${innov} :</p>
                <select data-innov="${innov}" data-correct="${correctType}" style="padding: 5px; margin-top: 5px;">
                    <option value="">Choisir...</option>
                    <option value="matching">Matching</option>
                    <option value="disjoint">Disjoint</option>
                    <option value="excess">Excess</option>
                </select>
            `;
            quiz.appendChild(div);
        });

        quiz.addEventListener("change", () => {
            const selects = quiz.querySelectorAll("select");
            let allCorrect = true;

            selects.forEach(select => {
                const correct = select.dataset.correct;
                const value = select.value;

                if (value === "") {
                    allCorrect = false;
                } else if (value !== correct) {
                    allCorrect = false;
                    select.style.borderColor = "#F44336";
                } else {
                    select.style.borderColor = "#4CAF50";
                }
            });

            if (allCorrect && selects.length > 0) {
                completeChallenge(3);
            }
        });
    }
}
