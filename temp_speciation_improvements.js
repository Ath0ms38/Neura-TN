// ============ Section 5: Speciation + Challenge 4 (NOUVELLE VERSION) ============
function initSpeciation() {
    NEAT.resetInnovation();

    // Create 8 genomes in 4 distinct pairs
    const genomes = [];

    // Species A: Minimal networks (2 genomes)
    for (let i = 0; i < 2; i++) {
        const g = NEAT.Genome.create(2, 1);
        genomes.push(g);
    }

    // Species B: Networks with 2 added connections (2 genomes)
    for (let i = 0; i < 2; i++) {
        const g = NEAT.Genome.create(2, 1);
        g.mutateAddConnection();
        g.mutateAddConnection();
        genomes.push(g);
    }

    // Species C: Networks with 1 hidden node (2 genomes)
    for (let i = 0; i < 2; i++) {
        const g = NEAT.Genome.create(2, 1);
        g.mutateAddNode();
        g.mutateAddConnection();
        genomes.push(g);
    }

    // Species D: Complex networks (2 genomes)
    for (let i = 0; i < 2; i++) {
        const g = NEAT.Genome.create(2, 1);
        g.mutateAddNode();
        g.mutateAddNode();
        g.mutateAddConnection();
        g.mutateAddConnection();
        genomes.push(g);
    }

    const inputLabels = ["x", "y", "bias"];
    const outputLabels = ["out"];

    // Render all 8 genomes
    const genomeGrid = document.getElementById("genome-grid");
    if (genomeGrid) {
        genomeGrid.innerHTML = "";
        genomeGrid.style.display = "grid";
        genomeGrid.style.gridTemplateColumns = "repeat(4, 1fr)";
        genomeGrid.style.gap = "10px";
        genomeGrid.style.marginBottom = "20px";

        genomes.forEach((genome, i) => {
            const card = document.createElement("div");
            card.className = "genome-card";
            card.dataset.genomeId = i;
            card.dataset.correctSpecies = Math.floor(i / 2); // 0-1 = species 0, 2-3 = species 1, etc.
            card.style.background = "rgba(255,255,255,0.05)";
            card.style.border = "2px solid rgba(255,255,255,0.2)";
            card.style.borderRadius = "8px";
            card.style.padding = "10px";
            card.style.cursor = "pointer";
            card.style.transition = "all 0.3s";

            const title = document.createElement("div");
            title.textContent = `Génome ${i + 1}`;
            title.style.textAlign = "center";
            title.style.color = "#FFAB40";
            title.style.fontSize = "12px";
            title.style.fontWeight = "bold";
            title.style.marginBottom = "5px";
            card.appendChild(title);

            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("viewBox", "0 0 200 120");
            svg.style.width = "100%";
            svg.style.height = "auto";
            renderGenomeToSVG(genome, svg, inputLabels, outputLabels);
            card.appendChild(svg);

            const info = genome.getNetworkInfo();
            const stats = document.createElement("div");
            stats.style.textAlign = "center";
            stats.style.fontSize = "10px";
            stats.style.color = "#999";
            stats.style.marginTop = "5px";
            stats.textContent = `${info.nodes.length}N / ${info.connections.length}C`;
            card.appendChild(stats);

            genomeGrid.appendChild(card);
        });
    }

    // Species boxes for interaction
    const speciesContainer = document.getElementById("species-container");
    if (speciesContainer) {
        speciesContainer.innerHTML = "";
        speciesContainer.style.display = "grid";
        speciesContainer.style.gridTemplateColumns = "repeat(2, 1fr)";
        speciesContainer.style.gap = "15px";
        speciesContainer.style.marginTop = "20px";

        const colors = ["#F44336", "#4CAF50", "#2196F3", "#FF9800"];
        const labels = ["Espèce A", "Espèce B", "Espèce C", "Espèce D"];

        for (let i = 0; i < 4; i++) {
            const box = document.createElement("div");
            box.className = "species-box";
            box.dataset.speciesId = i;
            box.style.background = `linear-gradient(135deg, ${colors[i]}22, ${colors[i]}11)`;
            box.style.border = `2px dashed ${colors[i]}`;
            box.style.borderRadius = "10px";
            box.style.padding = "15px";
            box.style.minHeight = "150px";
            box.style.transition = "all 0.3s";

            const header = document.createElement("div");
            header.textContent = labels[i];
            header.style.color = colors[i];
            header.style.fontWeight = "bold";
            header.style.fontSize = "14px";
            header.style.marginBottom = "10px";
            header.style.textAlign = "center";
            box.appendChild(header);

            const dropZone = document.createElement("div");
            dropZone.className = "drop-zone";
            dropZone.style.minHeight = "100px";
            dropZone.style.display = "flex";
            dropZone.style.flexDirection = "column";
            dropZone.style.gap = "5px";
            box.appendChild(dropZone);

            speciesContainer.appendChild(box);
        }
    }

    // Click interaction: click a genome then click a species box
    let selectedGenome = null;

    document.querySelectorAll(".genome-card").forEach(card => {
        card.addEventListener("click", () => {
            // Deselect previous
            document.querySelectorAll(".genome-card").forEach(c => {
                c.style.border = "2px solid rgba(255,255,255,0.2)";
                c.style.transform = "scale(1)";
            });

            // Select this one
            selectedGenome = card.dataset.genomeId;
            card.style.border = "2px solid #FFAB40";
            card.style.transform = "scale(1.05)";
        });
    });

    document.querySelectorAll(".species-box").forEach(box => {
        box.addEventListener("click", () => {
            if (!selectedGenome) return;

            const card = document.querySelector(`[data-genome-id="${selectedGenome}"]`);
            if (!card) return;

            // Check if already placed
            if (card.parentElement.className === "drop-zone") {
                // Remove from previous species
                card.parentElement.removeChild(card);
            } else {
                // Remove from grid
                card.parentElement.removeChild(card);
            }

            // Add to this species
            const dropZone = box.querySelector(".drop-zone");
            card.style.border = "2px solid rgba(255,255,255,0.2)";
            card.style.transform = "scale(1)";
            card.style.marginBottom = "5px";
            dropZone.appendChild(card);

            selectedGenome = null;

            // Check if challenge complete
            checkSpeciationChallenge();
        });
    });

    function checkSpeciationChallenge() {
        const feedback = document.getElementById("ch4-feedback");
        if (!feedback) return;

        // Check if all 8 genomes are placed
        const gridCards = document.querySelectorAll("#genome-grid .genome-card");
        if (gridCards.length > 0) {
            feedback.textContent = "Placez tous les génomes dans les espèces";
            feedback.style.color = "#FF9800";
            return;
        }

        // Check if each species has exactly 2 genomes
        let allCorrect = true;
        let speciesCount = [0, 0, 0, 0];

        document.querySelectorAll(".species-box").forEach(box => {
            const speciesId = parseInt(box.dataset.speciesId);
            const cards = box.querySelectorAll(".genome-card");
            speciesCount[speciesId] = cards.length;

            if (cards.length !== 2) {
                allCorrect = false;
            } else {
                // Check if both genomes belong to this species
                cards.forEach(card => {
                    const correctSpecies = parseInt(card.dataset.correctSpecies);
                    if (correctSpecies !== speciesId) {
                        allCorrect = false;
                    }
                });
            }
        });

        if (allCorrect) {
            feedback.textContent = "✓ Parfait ! Vous avez correctement groupé les génomes par similarité !";
            feedback.style.color = "#4CAF50";
            completeChallenge(4);
        } else {
            feedback.textContent = "✗ Pas tout à fait... Les génomes similaires doivent être dans la même espèce (2 par espèce)";
            feedback.style.color = "#F44336";
        }
    }

    // Reset button
    const resetBtn = document.getElementById("btn-reset-speciation");
    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            // Move all cards back to grid
            document.querySelectorAll(".genome-card").forEach(card => {
                if (card.parentElement.className === "drop-zone") {
                    card.parentElement.removeChild(card);
                    const genomeGrid = document.getElementById("genome-grid");
                    if (genomeGrid) genomeGrid.appendChild(card);
                }
                card.style.border = "2px solid rgba(255,255,255,0.2)";
                card.style.transform = "scale(1)";
            });

            const feedback = document.getElementById("ch4-feedback");
            if (feedback) {
                feedback.textContent = "";
            }

            selectedGenome = null;
        });
    }
}
