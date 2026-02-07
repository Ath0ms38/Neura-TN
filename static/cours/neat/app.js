/* ============================================================
   Neura'TN - Cours : NEAT
   Interactive scrollytelling with 6 challenges
   ============================================================ */

// ============ Global State ============
const challengeState = { completed: new Set(), total: 6 };
const sectionIds = ["hero", "evolution", "genome", "mutations", "innovation", "speciation", "fitness", "evolution-cycle", "applications", "conclusion"];

// ============ Utilities ============
function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }
function lerp(a, b, t) { return a + (b - a) * t; }

// Helper to render genome to SVG element
function renderGenomeToSVG(genome, svg, inputLabels = [], outputLabels = []) {
    svg.innerHTML = "";
    if (!genome) return;

    const info = genome.getNetworkInfo();
    const W = parseFloat(svg.getAttribute("viewBox").split(" ")[2]) || 400;
    const H = parseFloat(svg.getAttribute("viewBox").split(" ")[3]) || 280;

    // Calculate layers
    const nodeLayers = calculateNodeLayers(info.nodes, info.connections);
    const maxLayer = Math.max(...Array.from(nodeLayers.values()));
    const layerArrays = [];
    for (let i = 0; i <= maxLayer; i++) layerArrays.push([]);
    for (const node of info.nodes) {
        const layer = nodeLayers.get(node.id);
        layerArrays[layer].push(node);
    }

    const numLayers = maxLayer + 1;
    const layerSpacing = W / (numLayers + 1);
    const nodePositions = new Map();

    // Position nodes
    for (let li = 0; li < layerArrays.length; li++) {
        const layer = layerArrays[li];
        const cx = layerSpacing * (li + 1);
        const nodeSpacing = Math.min(25, (H - 30) / Math.max(layer.length, 1));
        const startY = H / 2 - (layer.length - 1) * nodeSpacing / 2;

        for (let ni = 0; ni < layer.length; ni++) {
            const node = layer[ni];
            const y = startY + ni * nodeSpacing;
            nodePositions.set(node.id, { x: cx, y, layer: li });
        }
    }

    // Draw connections
    for (const conn of info.connections) {
        const from = nodePositions.get(conn.from);
        const to = nodePositions.get(conn.to);
        if (!from || !to) continue;

        const w = Math.abs(conn.weight);
        const color = conn.weight > 0 ? "#4CAF50" : "#F44336";
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", from.x);
        line.setAttribute("y1", from.y);
        line.setAttribute("x2", to.x);
        line.setAttribute("y2", to.y);
        line.setAttribute("stroke", color);
        line.setAttribute("stroke-width", Math.min(3, 0.5 + w * 0.5));
        line.setAttribute("opacity", Math.min(0.9, 0.2 + w * 0.15));
        svg.appendChild(line);
    }

    // Draw nodes
    for (const [id, pos] of nodePositions) {
        const node = info.nodes.find(n => n.id === id);
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", pos.x);
        circle.setAttribute("cy", pos.y);
        circle.setAttribute("r", 7);

        const fill = node.type === "input" || node.type === "bias" ? "#85D5E6" :
                     node.type === "output" ? "#F44336" : "#FFAB40";
        circle.setAttribute("fill", fill);
        svg.appendChild(circle);

        // Labels for inputs and bias
        if (node.type === "input" || node.type === "bias") {
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", pos.x - 15);
            text.setAttribute("y", pos.y + 4);
            text.setAttribute("text-anchor", "end");
            text.setAttribute("font-size", "10");
            text.setAttribute("fill", "#CCC");

            // Map node ID to label
            if (node.type === "bias") {
                text.textContent = inputLabels[inputLabels.length - 1] || "bias";
            } else {
                // For input nodes, use the node ID as index if available
                const inputNodes = info.nodes.filter(n => n.type === "input");
                const inputIndex = inputNodes.findIndex(n => n.id === id);
                text.textContent = inputLabels[inputIndex] || `in${id}`;
            }
            svg.appendChild(text);
        }

        // Labels for outputs
        if (node.type === "output") {
            const outputNodes = info.nodes.filter(n => n.type === "output");
            const oIdx = outputNodes.findIndex(n => n.id === id);
            if (oIdx >= 0 && outputLabels[oIdx]) {
                const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                text.setAttribute("x", pos.x + 15);
                text.setAttribute("y", pos.y + 4);
                text.setAttribute("text-anchor", "start");
                text.setAttribute("font-size", "10");
                text.setAttribute("fill", "#CCC");
                text.textContent = outputLabels[oIdx];
                svg.appendChild(text);
            }
        }

        // Labels for hidden nodes
        if (node.type === "hidden") {
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", pos.x);
            text.setAttribute("y", pos.y - 12);
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("font-size", "9");
            text.setAttribute("fill", "#999");
            text.textContent = `H${id}`;
            svg.appendChild(text);
        }
    }
}

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

    const scoreText = document.getElementById("final-score-text");
    if (scoreText) scoreText.textContent = `${count}/${challengeState.total} defis completes`;

    const msg = document.getElementById("score-message");
    if (msg) {
        if (count === 6) msg.textContent = "Parfait ! Vous maitrisez NEAT !";
        else if (count >= 4) msg.textContent = "Excellent travail ! Encore quelques defis a relever.";
        else if (count >= 1) msg.textContent = "Bon debut ! N'hesitez pas a revenir completer les defis.";
        else msg.textContent = "Remontez et tentez les defis pour tester vos connaissances !";
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
        dot.title = id.charAt(0).toUpperCase() + id.slice(1);
        dot.addEventListener("click", () => {
            document.getElementById(id).scrollIntoView({ behavior: "smooth" });
        });
        nav.appendChild(dot);
    });

    const dots = nav.querySelectorAll(".nav-dot");
    const textEls = document.querySelectorAll(".section-text");
    const visualEls = document.querySelectorAll(".section-visual");

    const fadeObserver = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) e.target.classList.add("visible");
        });
    }, { threshold: 0.15 });

    textEls.forEach(el => fadeObserver.observe(el));
    visualEls.forEach(el => fadeObserver.observe(el));

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

    let animId;
    let isVisible = true;
    let currentGenome = null;
    let targetGenome = null;
    let morphProgress = 0;
    let genomeIndex = 0;

    function resize() {
        canvas.width = canvas.offsetWidth * window.devicePixelRatio;
        canvas.height = canvas.offsetHeight * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    // Create simple genomes for animation
    const genomes = [];
    NEAT.resetInnovation();

    // Gen 1: Simple 3-1 network
    let g1 = NEAT.Genome.create(3, 1);
    genomes.push(g1);

    // Gen 2: Add a connection
    let g2 = g1.clone();
    for(let i = 0; i < 2; i++) g2.mutateAddConnection();
    genomes.push(g2);

    // Gen 3: Add nodes
    let g3 = g2.clone();
    for(let i = 0; i < 2; i++) {
        g3.mutateAddNode();
    }
    genomes.push(g3);

    // Gen 4: More complexity
    let g4 = g3.clone();
    for(let i = 0; i < 3; i++) {
        g4.mutateAddConnection();
        g4.mutateAddNode();
    }
    genomes.push(g4);

    currentGenome = genomes[0];
    targetGenome = genomes[1];

    function draw(t) {
        if (!isVisible) { animId = requestAnimationFrame(draw); return; }
        const w = canvas.offsetWidth;
        const h = canvas.offsetHeight;
        ctx.clearRect(0, 0, w, h);

        // Morph between genomes
        morphProgress += 0.003;
        if (morphProgress >= 1) {
            morphProgress = 0;
            genomeIndex = (genomeIndex + 1) % (genomes.length - 1);
            currentGenome = genomes[genomeIndex];
            targetGenome = genomes[genomeIndex + 1];
        }

        // Draw current genome (simplified visualization)
        drawGenomeSimple(ctx, currentGenome, w/2, h/2, w * 0.6, h * 0.6);

        animId = requestAnimationFrame(draw);
    }

    function drawGenomeSimple(ctx, genome, cx, cy, width, height) {
        const info = genome.getNetworkInfo();
        const nodeLayers = calculateNodeLayers(info.nodes, info.connections);

        const maxLayer = Math.max(...Array.from(nodeLayers.values()));
        const layerArrays = [];
        for (let i = 0; i <= maxLayer; i++) layerArrays.push([]);
        for (const node of info.nodes) {
            const layer = nodeLayers.get(node.id);
            layerArrays[layer].push(node);
        }

        const nodePositions = {};
        const layerWidth = width / (layerArrays.length + 1);

        layerArrays.forEach((layer, li) => {
            const layerHeight = height / (layer.length + 1);
            layer.forEach((node, ni) => {
                const x = cx - width/2 + layerWidth * (li + 1);
                const y = cy - height/2 + layerHeight * (ni + 1);
                nodePositions[node.id] = { x, y };
            });
        });

        // Draw connections
        info.connections.forEach(conn => {
            const from = nodePositions[conn.from];
            const to = nodePositions[conn.to];
            if (!from || !to) return;

            const alpha = Math.abs(conn.weight) * 0.3;
            ctx.strokeStyle = conn.weight > 0 ? `rgba(76, 175, 80, ${alpha})` : `rgba(244, 67, 54, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
        });

        // Draw nodes
        Object.entries(nodePositions).forEach(([nodeId, pos]) => {
            const node = info.nodes.find(n => n.id === parseInt(nodeId));
            if (!node) return;

            let color = "#85D5E6";
            if (node.type === "output") color = "#F44336";
            else if (node.type === "hidden") color = "#FFAB40";

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    const heroObserver = new IntersectionObserver((entries) => {
        entries.forEach(e => { isVisible = e.isIntersecting; });
    });
    heroObserver.observe(canvas);

    resize();
    window.addEventListener("resize", resize);
    draw(0);
}

// ============ Section 1: Evolution Comparison ============
function initEvolution() {
    const backpropSvg = document.getElementById("backprop-svg");
    const neuroevoSvg = document.getElementById("neuroevo-svg");
    if (!backpropSvg || !neuroevoSvg) return;

    // Draw backprop diagram (single network with gradient arrows)
    backpropSvg.innerHTML = `
        <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <polygon points="0 0, 10 3, 0 6" fill="#FFAB40" />
            </marker>
        </defs>

        <!-- Network structure -->
        <circle cx="40" cy="100" r="10" fill="#85D5E6" stroke="#FFF" stroke-width="1.5" />
        <circle cx="120" cy="70" r="10" fill="#FFAB40" stroke="#FFF" stroke-width="1.5" />
        <circle cx="120" cy="130" r="10" fill="#FFAB40" stroke="#FFF" stroke-width="1.5" />
        <circle cx="200" cy="100" r="10" fill="#F44336" stroke="#FFF" stroke-width="1.5" />

        <!-- Connections -->
        <line x1="50" y1="95" x2="110" y2="75" stroke="#666" stroke-width="2" opacity="0.5" />
        <line x1="50" y1="105" x2="110" y2="125" stroke="#666" stroke-width="2" opacity="0.5" />
        <line x1="130" y1="72" x2="190" y2="95" stroke="#666" stroke-width="2" opacity="0.5" />
        <line x1="130" y1="128" x2="190" y2="105" stroke="#666" stroke-width="2" opacity="0.5" />

        <!-- Gradient arrows -->
        <path d="M 195 85 Q 150 60 125 65" stroke="#FFAB40" stroke-width="2" fill="none" marker-end="url(#arrowhead)" />
        <path d="M 195 115 Q 150 140 125 135" stroke="#FFAB40" stroke-width="2" fill="none" marker-end="url(#arrowhead)" />

        <!-- Labels -->
        <text x="120" y="25" text-anchor="middle" fill="#FFAB40" font-size="13" font-weight="bold">Gradient ∇</text>
        <text x="40" y="85" text-anchor="middle" fill="#FFF" font-size="9">In</text>
        <text x="200" y="85" text-anchor="middle" fill="#FFF" font-size="9">Out</text>
    `;

    // Draw neuroevo diagram (population of networks)
    neuroevoSvg.innerHTML = `
        <!-- Generation 1: Simple networks (faded) -->
        <g opacity="0.3">
            <circle cx="30" cy="50" r="6" fill="#85D5E6" />
            <circle cx="55" cy="50" r="6" fill="#F44336" />
            <line x1="36" y1="50" x2="49" y2="50" stroke="#666" stroke-width="1.5" />
        </g>
        <g opacity="0.3">
            <circle cx="80" cy="45" r="6" fill="#85D5E6" />
            <circle cx="105" cy="45" r="6" fill="#F44336" />
            <line x1="86" y1="45" x2="99" y2="45" stroke="#666" stroke-width="1.5" />
        </g>
        <g opacity="0.3">
            <circle cx="130" cy="55" r="6" fill="#85D5E6" />
            <circle cx="155" cy="55" r="6" fill="#F44336" />
            <line x1="136" y1="55" x2="149" y2="55" stroke="#666" stroke-width="1.5" />
        </g>

        <!-- Generation 2: More complex (medium opacity) -->
        <g opacity="0.5">
            <circle cx="25" cy="95" r="5" fill="#85D5E6" />
            <circle cx="45" cy="85" r="4" fill="#FFAB40" />
            <circle cx="45" cy="105" r="4" fill="#FFAB40" />
            <circle cx="65" cy="95" r="5" fill="#F44336" />
            <line x1="30" y1="92" x2="41" y2="87" stroke="#666" stroke-width="1" />
            <line x1="30" y1="98" x2="41" y2="103" stroke="#666" stroke-width="1" />
            <line x1="49" y1="86" x2="60" y2="92" stroke="#666" stroke-width="1" />
            <line x1="49" y1="104" x2="60" y2="98" stroke="#666" stroke-width="1" />
        </g>
        <g opacity="0.5">
            <circle cx="85" cy="100" r="5" fill="#85D5E6" />
            <circle cx="105" cy="90" r="4" fill="#FFAB40" />
            <circle cx="105" cy="110" r="4" fill="#FFAB40" />
            <circle cx="125" cy="100" r="5" fill="#F44336" />
            <line x1="90" y1="97" x2="101" y2="92" stroke="#666" stroke-width="1" />
            <line x1="90" y1="103" x2="101" y2="108" stroke="#666" stroke-width="1" />
            <line x1="109" y1="91" x2="120" y2="97" stroke="#666" stroke-width="1" />
            <line x1="109" y1="109" x2="120" y2="103" stroke="#666" stroke-width="1" />
        </g>

        <!-- Generation 3: Best evolved (highlighted) -->
        <g opacity="1">
            <circle cx="40" cy="150" r="6" fill="#85D5E6" stroke="#4CAF50" stroke-width="2" />
            <circle cx="65" cy="135" r="5" fill="#FFAB40" stroke="#4CAF50" stroke-width="1.5" />
            <circle cx="65" cy="150" r="5" fill="#FFAB40" stroke="#4CAF50" stroke-width="1.5" />
            <circle cx="65" cy="165" r="5" fill="#FFAB40" stroke="#4CAF50" stroke-width="1.5" />
            <circle cx="90" cy="150" r="6" fill="#F44336" stroke="#4CAF50" stroke-width="2" />
            <line x1="46" y1="145" x2="60" y2="138" stroke="#4CAF50" stroke-width="1.5" />
            <line x1="46" y1="150" x2="60" y2="150" stroke="#4CAF50" stroke-width="1.5" />
            <line x1="46" y1="155" x2="60" y2="163" stroke="#4CAF50" stroke-width="1.5" />
            <line x1="70" y1="137" x2="84" y2="145" stroke="#4CAF50" stroke-width="1.5" />
            <line x1="70" y1="150" x2="84" y2="150" stroke="#4CAF50" stroke-width="1.5" />
            <line x1="70" y1="163" x2="84" y2="155" stroke="#4CAF50" stroke-width="1.5" />
        </g>

        <!-- Labels -->
        <text x="120" y="30" text-anchor="middle" fill="#888" font-size="10">Gen 1</text>
        <text x="120" y="80" text-anchor="middle" fill="#AAA" font-size="10">Gen 2</text>
        <text x="120" y="130" text-anchor="middle" fill="#4CAF50" font-size="11" font-weight="bold">Gen 3 ✓</text>
        <text x="145" y="165" text-anchor="start" fill="#4CAF50" font-size="12" font-weight="bold">Meilleur</text>
    `;
}

// ============ Section 2: Genome Viewer + Challenge 1 ============
function initGenome() {
    const networkSvg = document.getElementById("genome-network-svg");
    const nodeTbody = document.getElementById("node-tbody");
    const connectionTbody = document.getElementById("connection-tbody");
    const explanationEl = document.getElementById("genome-explanation");
    const stepEl = document.getElementById("genome-step");
    const progressEl = document.getElementById("genome-progress-fill");

    if (!networkSvg) return;

    // Create example genome
    NEAT.resetInnovation();
    const genome = NEAT.Genome.create(3, 2);
    genome.mutateAddConnection();
    genome.mutateAddConnection();
    genome.mutateAddNode();
    genome.mutateWeights();

    const inputLabels = ["x1", "x2", "x3", "bias"];
    const outputLabels = ["y1", "y2"];

    // Animation state
    let currentStep = 0;
    const maxSteps = genome.nodes.length + genome.connections.length;
    let isPlaying = false;
    let playInterval = null;

    function renderAnimatedGenome(step) {
        networkSvg.innerHTML = "";
        if (nodeTbody) nodeTbody.innerHTML = "";
        if (connectionTbody) connectionTbody.innerHTML = "";

        const info = genome.getNetworkInfo();
        const W = 400, H = 280;

        // Calculate node positions
        const nodeLayers = calculateNodeLayers(info.nodes, info.connections);
        const maxLayer = Math.max(...Array.from(nodeLayers.values()));
        const layerArrays = [];
        for (let i = 0; i <= maxLayer; i++) layerArrays.push([]);
        for (const node of info.nodes) {
            const layer = nodeLayers.get(node.id);
            layerArrays[layer].push(node);
        }

        const layerSpacing = W / (layerArrays.length + 1);
        const nodePositions = new Map();

        for (let li = 0; li < layerArrays.length; li++) {
            const layer = layerArrays[li];
            const cx = layerSpacing * (li + 1);
            const nodeSpacing = Math.min(25, (H - 30) / Math.max(layer.length, 1));
            const startY = H / 2 - (layer.length - 1) * nodeSpacing / 2;

            for (let ni = 0; ni < layer.length; ni++) {
                const node = layer[ni];
                const y = startY + ni * nodeSpacing;
                nodePositions.set(node.id, { x: cx, y });
            }
        }

        const nodesCount = genome.nodes.length;
        const visibleNodes = Math.min(step + 1, nodesCount);
        const visibleConnections = Math.max(0, step + 1 - nodesCount);

        // Update explanation text
        if (step < nodesCount) {
            const node = genome.nodes[step];
            const typeNames = { input: "Entrée", output: "Sortie", hidden: "Caché", bias: "Biais" };
            explanationEl.textContent = `Étape ${step + 1}/${maxSteps} : Ajout du nœud #${node.id} (${typeNames[node.type]}) - Biais: ${node.bias.toFixed(2)}`;
        } else if (step < maxSteps) {
            const conn = genome.connections[step - nodesCount];
            explanationEl.textContent = `Étape ${step + 1}/${maxSteps} : Connexion #${conn.innovation} de ${conn.inNode} → ${conn.outNode} - Poids: ${conn.weight.toFixed(2)}`;
        } else {
            explanationEl.textContent = `✓ Génome complet : ${genome.nodes.length} nœuds, ${genome.connections.length} connexions`;
        }

        stepEl.textContent = `${step}/${maxSteps}`;
        progressEl.style.width = `${(step / maxSteps) * 100}%`;

        // Draw connections
        for (let i = 0; i < visibleConnections; i++) {
            const conn = genome.connections[i];
            const from = nodePositions.get(conn.inNode);
            const to = nodePositions.get(conn.outNode);
            if (!from || !to) continue;

            const w = Math.abs(conn.weight);
            const color = conn.weight > 0 ? "#4CAF50" : "#F44336";
            const isActive = (i === visibleConnections - 1);

            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", from.x);
            line.setAttribute("y1", from.y);
            line.setAttribute("x2", to.x);
            line.setAttribute("y2", to.y);
            line.setAttribute("stroke", color);
            line.setAttribute("stroke-width", isActive ? 4 : Math.min(3, 0.5 + w * 0.5));
            line.setAttribute("opacity", isActive ? 1 : 0.4);
            if (isActive) line.setAttribute("stroke-dasharray", "5,5");
            networkSvg.appendChild(line);

            if (connectionTbody) {
                const row = document.createElement("tr");
                const weightColor = conn.weight > 0 ? "#4CAF50" : "#F44336";
                row.innerHTML = `
                    <td>${conn.inNode}</td>
                    <td>${conn.outNode}</td>
                    <td><span style="color: ${weightColor}; font-weight: bold;">${conn.weight.toFixed(2)}</span></td>
                    <td><span style="color: ${conn.enabled ? '#4CAF50' : '#666'};">${conn.enabled ? "✓" : "✗"}</span></td>
                    <td><span style="color: #FFAB40;">#${conn.innovation}</span></td>
                `;
                if (isActive) row.style.background = "rgba(255, 171, 64, 0.3)";
                connectionTbody.appendChild(row);
            }
        }

        // Draw nodes
        for (let i = 0; i < visibleNodes; i++) {
            const node = genome.nodes[i];
            const pos = nodePositions.get(node.id);
            if (!pos) continue;

            const isActive = (i === visibleNodes - 1);
            const fill = node.type === "input" || node.type === "bias" ? "#85D5E6" :
                         node.type === "output" ? "#F44336" : "#FFAB40";

            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", pos.x);
            circle.setAttribute("cy", pos.y);
            circle.setAttribute("r", isActive ? 12 : 7);
            circle.setAttribute("fill", fill);
            circle.setAttribute("stroke", isActive ? "#FFF" : "none");
            circle.setAttribute("stroke-width", isActive ? "3" : "0");
            if (isActive) circle.style.filter = "drop-shadow(0 0 10px " + fill + ")";
            networkSvg.appendChild(circle);

            // Add labels
            if (node.type === "input" || node.type === "bias") {
                const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                text.setAttribute("x", pos.x - 15);
                text.setAttribute("y", pos.y + 4);
                text.setAttribute("text-anchor", "end");
                text.setAttribute("font-size", "10");
                text.setAttribute("fill", "#CCC");
                text.textContent = node.type === "bias" ? "bias" : inputLabels[node.id] || `in${node.id}`;
                networkSvg.appendChild(text);
            } else if (node.type === "output") {
                const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                text.setAttribute("x", pos.x + 15);
                text.setAttribute("y", pos.y + 4);
                text.setAttribute("text-anchor", "start");
                text.setAttribute("font-size", "10");
                text.setAttribute("fill", "#CCC");
                const outputIdx = genome.nodes.filter(n => n.type === "output").findIndex(n => n.id === node.id);
                text.textContent = outputLabels[outputIdx] || `out${node.id}`;
                networkSvg.appendChild(text);
            } else if (node.type === "hidden") {
                const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                text.setAttribute("x", pos.x);
                text.setAttribute("y", pos.y - 15);
                text.setAttribute("text-anchor", "middle");
                text.setAttribute("font-size", "9");
                text.setAttribute("fill", "#999");
                text.textContent = `H${node.id}`;
                networkSvg.appendChild(text);
            }

            if (nodeTbody) {
                const row = document.createElement("tr");
                const typeColor = node.type === "output" ? "#F44336" :
                                  node.type === "hidden" ? "#FFAB40" : "#85D5E6";
                row.innerHTML = `
                    <td><strong>${node.id}</strong></td>
                    <td><span style="color: ${typeColor}; font-weight: bold;">${node.type}</span></td>
                    <td>${node.bias.toFixed(2)}</td>
                `;
                if (isActive) row.style.background = "rgba(255, 171, 64, 0.3)";
                nodeTbody.appendChild(row);
            }
        }
    }

    // Controls
    const btnPrev = document.getElementById("btn-genome-prev");
    const btnNext = document.getElementById("btn-genome-next");
    const btnPlay = document.getElementById("btn-genome-play");
    const btnReset = document.getElementById("btn-genome-reset");

    if (btnPrev) btnPrev.addEventListener("click", () => {
        if (currentStep > 0) {
            currentStep--;
            renderAnimatedGenome(currentStep);
        }
    });

    if (btnNext) btnNext.addEventListener("click", () => {
        if (currentStep < maxSteps - 1) {
            currentStep++;
            renderAnimatedGenome(currentStep);
        }
    });

    if (btnPlay) btnPlay.addEventListener("click", () => {
        isPlaying = !isPlaying;
        btnPlay.textContent = isPlaying ? "⏸ Pause" : "▶ Play";

        if (isPlaying) {
            playInterval = setInterval(() => {
                if (currentStep >= maxSteps - 1) {
                    currentStep = maxSteps - 1;
                    isPlaying = false;
                    btnPlay.textContent = "▶ Play";
                    clearInterval(playInterval);
                    renderAnimatedGenome(currentStep);
                    return;
                }
                currentStep++;
                renderAnimatedGenome(currentStep);
            }, 1000);
        } else {
            clearInterval(playInterval);
        }
    });

    if (btnReset) btnReset.addEventListener("click", () => {
        currentStep = 0;
        isPlaying = false;
        if (btnPlay) btnPlay.textContent = "▶ Play";
        clearInterval(playInterval);
        renderAnimatedGenome(currentStep);
    });

    renderAnimatedGenome(currentStep);

    // Challenge 1: Count enabled connections to outputs
    const outputNodes = genome.nodes.filter(n => n.type === "output").map(n => n.id);
    const correctAnswer = genome.connections.filter(c => c.enabled && outputNodes.includes(c.outNode)).length;

    const input = document.getElementById("ch1-input");
    const btn = document.getElementById("ch1-btn");
    const feedback = document.getElementById("ch1-feedback");

    if (btn && input && feedback) {
        btn.addEventListener("click", () => {
            const userAnswer = parseInt(input.value);
            if (userAnswer === correctAnswer) {
                feedback.textContent = "✓ Correct !";
                feedback.style.color = "#4CAF50";
                completeChallenge(1);
            } else {
                feedback.textContent = `✗ Incorrect. Comptez uniquement les connexions activees vers les neurones de sortie.`;
                feedback.style.color = "#F44336";
            }
        });
    }
}

// ============ Section 3: Mutations + Challenge 2 ============
function initMutations() {
    const svg = document.getElementById("mutation-svg");
    const log = document.getElementById("mutation-log");
    if (!svg || !log) return;

    NEAT.resetInnovation();
    let currentGenome = NEAT.Genome.create(2, 1);

    function render() {
        const inputLabels = ["A", "B", "bias"];
        const outputLabels = ["Y"];
        renderGenomeToSVG(currentGenome, svg, inputLabels, outputLabels);

        const hiddenCount = currentGenome.nodes.filter(n => n.type === "hidden").length;
        const connectionCount = currentGenome.connections.length;

        // Check challenge 2
        const ch2Hidden = document.getElementById("ch2-check-hidden");
        const ch2Connections = document.getElementById("ch2-check-connections");

        if (hiddenCount >= 1) {
            ch2Hidden.querySelector(".check-icon").textContent = "✓";
            ch2Hidden.style.color = "#4CAF50";
        }
        if (connectionCount >= 8) {
            ch2Connections.querySelector(".check-icon").textContent = "✓";
            ch2Connections.style.color = "#4CAF50";
        }

        if (hiddenCount >= 1 && connectionCount >= 8) {
            completeChallenge(2);
        }
    }

    document.getElementById("btn-mutate-weight").addEventListener("click", () => {
        currentGenome.mutateWeights();
        log.textContent = "Mutation de poids appliquee";
        render();
    });

    document.getElementById("btn-add-connection").addEventListener("click", () => {
        const before = currentGenome.connections.length;
        currentGenome.mutateAddConnection();
        const after = currentGenome.connections.length;
        if (after > before) {
            log.textContent = "Nouvelle connexion ajoutee";
        } else {
            log.textContent = "Impossible d'ajouter une connexion (cycle evite)";
        }
        render();
    });

    document.getElementById("btn-add-node").addEventListener("click", () => {
        const before = currentGenome.nodes.filter(n => n.type === "hidden").length;
        currentGenome.mutateAddNode();
        const after = currentGenome.nodes.filter(n => n.type === "hidden").length;
        if (after > before) {
            log.textContent = "Nouveau noeud cache ajoute";
        } else {
            log.textContent = "Impossible d'ajouter un noeud";
        }
        render();
    });

    document.getElementById("btn-reset-mutation").addEventListener("click", () => {
        NEAT.resetInnovation();
        currentGenome = NEAT.Genome.create(2, 1);
        log.textContent = "Reseau reinitialise";
        document.getElementById("ch2-check-hidden").querySelector(".check-icon").textContent = "◯";
        document.getElementById("ch2-check-connections").querySelector(".check-icon").textContent = "◯";
        document.getElementById("ch2-check-hidden").style.color = "";
        document.getElementById("ch2-check-connections").style.color = "";
        render();
    });

    render();
}

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

// ============ Section 5: Speciation + Challenge 4 ============
// ============ Section 5: Speciation + Challenge 4 (ANIMATED) ============
function initSpeciation() {
    const container = document.getElementById("speciation-animation");
    if (!container) return;

    // Create canvas
    const canvas = document.createElement("canvas");
    const W = 500, H = 340;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.maxWidth = "100%";
    canvas.style.height = "auto";
    canvas.style.display = "block";
    canvas.style.margin = "0 auto";
    canvas.style.borderRadius = "8px";
    canvas.style.background = "#1a1a2e";
    container.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    // Controls
    const controls = document.createElement("div");
    controls.style.cssText = "text-align:center;margin-top:12px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;align-items:center;";
    controls.innerHTML = `
        <button id="btn-spec-prev" class="ctrl-btn" disabled>&#8592; Precedent</button>
        <button id="btn-spec-next" class="ctrl-btn accent">Suivant &#8594;</button>
        <button id="btn-spec-auto" class="ctrl-btn secondary">&#9654; Auto</button>
        <div id="spec-step-text" style="width:100%;margin-top:8px;color:#CCC;font-size:13px;min-height:20px;"></div>
    `;
    container.appendChild(controls);

    // Create 6 genomes in 3 very distinct groups
    NEAT.resetInnovation();
    const genomeData = [];

    // Group A: Minimal (2 genomes) - only base connections
    for (let i = 0; i < 2; i++) {
        const g = NEAT.Genome.create(2, 1);
        genomeData.push({ genome: g, trueSpecies: 0 });
    }
    // Group B: Medium (2 genomes) - 2 hidden nodes
    for (let i = 0; i < 2; i++) {
        const g = NEAT.Genome.create(2, 1);
        g.mutateAddNode();
        g.mutateAddNode();
        for (let j = 0; j < 2; j++) g.mutateAddConnection();
        genomeData.push({ genome: g, trueSpecies: 1 });
    }
    // Group C: Complex (2 genomes) - 4+ hidden nodes
    for (let i = 0; i < 2; i++) {
        const g = NEAT.Genome.create(2, 1);
        for (let j = 0; j < 4; j++) g.mutateAddNode();
        for (let j = 0; j < 5; j++) g.mutateAddConnection();
        genomeData.push({ genome: g, trueSpecies: 2 });
    }

    const N = genomeData.length; // 6
    const speciesColors = ["#F44336", "#4CAF50", "#2196F3"];
    const speciesNames = ["Espece A", "Espece B", "Espece C"];
    const GRAY = "#666";
    const THRESHOLD = 3.0;

    // Precompute distances between all pairs
    const distances = [];
    for (let i = 0; i < N; i++) {
        distances[i] = [];
        for (let j = 0; j < N; j++) {
            distances[i][j] = NEAT.Genome.compatibilityDistance(genomeData[i].genome, genomeData[j].genome);
        }
    }

    // Precompute speciation steps
    // Step 0: All genomes gray, in a row
    // Step 1: G1 → creates Species A
    // Step 2: G2 compared to G1 → joins A (similar)
    // Step 3: G3 compared to A representative → different → creates Species B
    // Step 4: G4 compared to A, B → joins B
    // Step 5: G5 compared to A, B → different → creates Species C
    // Step 6: G6 compared to A, B, C → joins C
    // Step 7: Final clustering animation

    const speciesAssignment = new Array(N).fill(-1); // -1 = unassigned
    const speciesReps = []; // indices of representatives

    // Run the speciation algorithm step by step
    const steps = [];

    // Step 0: initial state
    steps.push({
        assigned: [...speciesAssignment],
        reps: [...speciesReps],
        comparing: -1,
        comparedTo: -1,
        compDist: 0,
        result: "",
        text: "6 genomes non assignes. Seuil de compatibilite : δ < " + THRESHOLD.toFixed(1)
    });

    // Simulate speciation
    let simAssign = new Array(N).fill(-1);
    let simReps = [];
    let nextSpecies = 0;

    for (let i = 0; i < N; i++) {
        let placed = false;
        let bestCompare = -1;
        let bestDist = Infinity;

        // Compare to each species representative
        for (let si = 0; si < simReps.length; si++) {
            const rep = simReps[si];
            const dist = distances[i][rep];
            if (dist < bestDist) {
                bestDist = dist;
                bestCompare = rep;
            }
        }

        if (bestCompare >= 0 && bestDist < THRESHOLD) {
            // Joins existing species
            const specId = simAssign[bestCompare];
            simAssign[i] = specId;

            steps.push({
                assigned: [...simAssign],
                reps: [...simReps],
                comparing: i,
                comparedTo: bestCompare,
                compDist: bestDist,
                result: "join",
                text: `G${i+1} vs G${bestCompare+1} (rep. ${speciesNames[specId]}) : δ = ${bestDist.toFixed(2)} < ${THRESHOLD.toFixed(1)} → rejoint ${speciesNames[specId]}`
            });
        } else {
            // Creates new species
            const specId = nextSpecies;
            simAssign[i] = specId;
            simReps.push(i);
            nextSpecies++;

            const compText = bestCompare >= 0
                ? `G${i+1} vs ${speciesNames[simAssign[bestCompare]]} : δ = ${bestDist.toFixed(2)} ≥ ${THRESHOLD.toFixed(1)} → `
                : "";
            steps.push({
                assigned: [...simAssign],
                reps: [...simReps],
                comparing: i,
                comparedTo: bestCompare,
                compDist: bestDist,
                result: "new",
                text: compText + `G${i+1} cree ${speciesNames[specId]}`
            });
        }
    }

    // Final step
    steps.push({
        assigned: [...simAssign],
        reps: [...simReps],
        comparing: -1,
        comparedTo: -1,
        compDist: 0,
        result: "done",
        text: `Speciation terminee ! ${nextSpecies} especes creees a partir de 6 genomes.`
    });

    let currentStep = 0;
    let animProgress = 0;
    let animId = null;

    // Target positions: initially in a row, then cluster by species
    function getInitialPos(i) {
        const spacing = W / (N + 1);
        return { x: spacing * (i + 1), y: H / 2 };
    }

    function getClusterPos(i, specId, memberIndex) {
        const cx = (W / 3) * specId + W / 6;
        const cy = H / 2 + 20;
        const angle = memberIndex * Math.PI;
        const r = 30;
        return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
    }

    // Current positions (animated)
    const positions = genomeData.map((_, i) => getInitialPos(i));
    const targetPositions = genomeData.map((_, i) => getInitialPos(i));

    function updateTargets(step) {
        const s = steps[step];
        if (s.result === "done") {
            // Final clustering: move genomes to species clusters
            const memberCount = [0, 0, 0];
            for (let i = 0; i < N; i++) {
                const sp = s.assigned[i];
                if (sp >= 0) {
                    const pos = getClusterPos(i, sp, memberCount[sp]);
                    targetPositions[i] = pos;
                    memberCount[sp]++;
                }
            }
        } else {
            // Keep in row
            for (let i = 0; i < N; i++) {
                targetPositions[i] = getInitialPos(i);
            }
        }
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);

        // Background
        ctx.fillStyle = "#1a1a2e";
        ctx.fillRect(0, 0, W, H);

        const step = steps[currentStep];

        // Draw species labels at bottom when clustering
        if (step.result === "done") {
            for (let si = 0; si < step.reps.length; si++) {
                const cx = (W / 3) * si + W / 6;
                ctx.fillStyle = speciesColors[si];
                ctx.font = "bold 13px sans-serif";
                ctx.textAlign = "center";
                ctx.fillText(speciesNames[si], cx, H - 20);

                // Draw species circle background
                ctx.beginPath();
                ctx.arc(cx, H / 2 + 20, 55, 0, Math.PI * 2);
                ctx.fillStyle = speciesColors[si] + "15";
                ctx.fill();
                ctx.strokeStyle = speciesColors[si] + "44";
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }

        // Draw comparison arrow if comparing
        if (step.comparing >= 0 && step.comparedTo >= 0) {
            const fromPos = positions[step.comparing];
            const toPos = positions[step.comparedTo];

            ctx.strokeStyle = step.result === "join" ? "#4CAF50" : "#F44336";
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(fromPos.x, fromPos.y);
            ctx.lineTo(toPos.x, toPos.y);
            ctx.stroke();
            ctx.setLineDash([]);

            // Distance label
            const mx = (fromPos.x + toPos.x) / 2;
            const my = (fromPos.y + toPos.y) / 2 - 15;
            ctx.fillStyle = "#FFF";
            ctx.font = "bold 12px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(`δ = ${step.compDist.toFixed(2)}`, mx, my);
        }

        // Draw genomes as circles
        for (let i = 0; i < N; i++) {
            const pos = positions[i];
            const specId = step.assigned[i];
            const isRep = step.reps.includes(i);
            const isComparing = step.comparing === i;
            const isComparedTo = step.comparedTo === i;

            // Circle
            const radius = isRep ? 22 : 18;
            const color = specId >= 0 ? speciesColors[specId] : GRAY;

            // Glow for active genome
            if (isComparing) {
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, radius + 8, 0, Math.PI * 2);
                ctx.fillStyle = "#FFAB4033";
                ctx.fill();
            }

            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = color + "33";
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = isRep ? 3 : 2;
            ctx.stroke();

            // Label
            ctx.fillStyle = "#FFF";
            ctx.font = "bold 13px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`G${i + 1}`, pos.x, pos.y);

            // Node/connection info below
            const info = genomeData[i].genome.getNetworkInfo();
            ctx.fillStyle = "#999";
            ctx.font = "10px sans-serif";
            ctx.fillText(`${info.nodes.length}N ${info.connections.length}C`, pos.x, pos.y + radius + 12);

            // Representative star
            if (isRep && specId >= 0) {
                ctx.fillStyle = speciesColors[specId];
                ctx.font = "12px sans-serif";
                ctx.fillText("★", pos.x + radius + 2, pos.y - radius + 2);
            }
        }

        // Title
        ctx.fillStyle = "#FFAB40";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(`Etape ${currentStep} / ${steps.length - 1}`, W / 2, 8);

        // Legend
        ctx.fillStyle = "#888";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("★ = Representant", 8, H - 8);
    }

    function animateToStep(targetStep) {
        currentStep = targetStep;
        updateTargets(targetStep);

        let progress = 0;
        if (animId) cancelAnimationFrame(animId);

        function tick() {
            progress += 0.06;
            if (progress >= 1) progress = 1;

            for (let i = 0; i < N; i++) {
                positions[i] = {
                    x: lerp(positions[i].x, targetPositions[i].x, 0.12),
                    y: lerp(positions[i].y, targetPositions[i].y, 0.12)
                };
            }

            draw();

            if (progress < 1) {
                animId = requestAnimationFrame(tick);
            } else {
                animId = null;
            }
        }
        tick();
    }

    const stepText = document.getElementById("spec-step-text");
    const prevBtn = document.getElementById("btn-spec-prev");
    const nextBtn = document.getElementById("btn-spec-next");
    const autoBtn = document.getElementById("btn-spec-auto");

    function goToStep(s) {
        s = Math.max(0, Math.min(steps.length - 1, s));
        animateToStep(s);
        stepText.textContent = steps[s].text;
        prevBtn.disabled = s === 0;
        nextBtn.disabled = s === steps.length - 1;

        // Complete challenge when reaching the end
        if (s === steps.length - 1) {
            completeChallenge(4);
        }
    }

    prevBtn.addEventListener("click", () => goToStep(currentStep - 1));
    nextBtn.addEventListener("click", () => goToStep(currentStep + 1));

    let autoInterval = null;
    autoBtn.addEventListener("click", () => {
        if (autoInterval) {
            clearInterval(autoInterval);
            autoInterval = null;
            autoBtn.textContent = "▶ Auto";
            return;
        }
        autoBtn.textContent = "⏸ Pause";
        goToStep(0);
        autoInterval = setInterval(() => {
            if (currentStep >= steps.length - 1) {
                clearInterval(autoInterval);
                autoInterval = null;
                autoBtn.textContent = "▶ Auto";
                return;
            }
            goToStep(currentStep + 1);
        }, 1500);
    });

    // Initial draw
    updateTargets(0);
    draw();
    stepText.textContent = steps[0].text;
}
function initFitness() {
    const rawChart = document.getElementById("fitness-raw-chart");
    const adjustedChart = document.getElementById("fitness-adjusted-chart");
    if (!rawChart || !adjustedChart) return;

    // Fix HiDPI rendering
    const dpr = window.devicePixelRatio || 1;
    function setupCanvas(canvas, w, h) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";
        const c = canvas.getContext("2d");
        c.scale(dpr, dpr);
        return c;
    }

    const CW = 220, CH = 200;
    const rawCtx = setupCanvas(rawChart, CW, CH);
    const adjCtx = setupCanvas(adjustedChart, CW, CH);

    // Interactive species data
    let speciesData = [
        { name: "Espece 1", members: 10, fitness: [45, 42, 50, 38, 55, 40, 48, 35, 52, 44] },
        { name: "Espece 2", members: 3, fitness: [60, 55, 65] },
        { name: "Espece 3", members: 15, fitness: [40, 35, 42, 38, 30, 45, 33, 37, 41, 36, 39, 34, 43, 32, 44] }
    ];

    const barColors = ["#F44336", "#4CAF50", "#2196F3"];
    let animProgress = 0;
    let animId = null;

    // Create sliders in the fitness-sliders div
    const slidersDiv = document.getElementById("fitness-sliders");
    if (slidersDiv) {
        slidersDiv.innerHTML = `
            <div style="font-size:12px;color:#FFAB40;margin-bottom:8px;font-weight:bold;">Ajustez la taille des especes :</div>
            ${speciesData.map((sp, i) => `
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                    <span style="color:${barColors[i]};font-size:12px;width:70px;">${sp.name}</span>
                    <input type="range" id="sp-size-${i}" min="1" max="20" value="${sp.members}" style="flex:1;">
                    <span id="sp-size-val-${i}" style="color:#CCC;font-size:12px;width:30px;">${sp.members}</span>
                </div>
            `).join("")}
        `;

        speciesData.forEach((sp, i) => {
            const slider = document.getElementById(`sp-size-${i}`);
            slider.addEventListener("input", (e) => {
                const newSize = parseInt(e.target.value);
                document.getElementById(`sp-size-val-${i}`).textContent = newSize;
                // Adjust member count
                const avgFitness = sp.fitness.reduce((a, b) => a + b, 0) / sp.fitness.length;
                sp.members = newSize;
                sp.fitness = [];
                for (let j = 0; j < newSize; j++) {
                    sp.fitness.push(avgFitness + (Math.random() - 0.5) * 20);
                }
                animProgress = 0;
                startAnimation();
            });
        });
    }

    function drawBarChart(ctx, isAdjusted, progress) {
        const w = CW, h = CH;
        ctx.clearRect(0, 0, w, h);

        // Background
        ctx.fillStyle = "#1a1a2e";
        ctx.fillRect(0, 0, w, h);

        // Grid lines
        ctx.strokeStyle = "#ffffff11";
        ctx.lineWidth = 1;
        for (let y = 30; y < h - 20; y += 30) {
            ctx.beginPath();
            ctx.moveTo(30, y);
            ctx.lineTo(w - 10, y);
            ctx.stroke();
        }

        const values = speciesData.map(sp => {
            const totalF = sp.fitness.reduce((a, b) => a + b, 0);
            return isAdjusted ? totalF / sp.members : totalF;
        });
        const maxVal = Math.max(...values) * 1.15;
        const margin = 30;
        const barAreaW = w - margin - 10;
        const barWidth = barAreaW / (speciesData.length * 2);

        // Y axis label
        ctx.fillStyle = "#888";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.save();
        ctx.translate(12, h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(isAdjusted ? "Fitness ajustee" : "Fitness brute totale", 0, 0);
        ctx.restore();

        speciesData.forEach((sp, i) => {
            const val = values[i];
            const fullHeight = (val / maxVal) * (h - 50);
            const animHeight = fullHeight * Math.min(1, progress);
            const x = margin + i * barWidth * 2 + barWidth * 0.5;
            const y = h - animHeight - 20;

            // Bar shadow
            ctx.fillStyle = barColors[i] + "33";
            ctx.fillRect(x + 2, y + 2, barWidth, animHeight);

            // Bar
            const grad = ctx.createLinearGradient(x, y, x, y + animHeight);
            grad.addColorStop(0, barColors[i]);
            grad.addColorStop(1, barColors[i] + "88");
            ctx.fillStyle = grad;
            ctx.fillRect(x, y, barWidth, animHeight);

            // Border
            ctx.strokeStyle = barColors[i];
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, barWidth, animHeight);

            // Labels
            ctx.fillStyle = barColors[i];
            ctx.font = "bold 11px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(sp.name.replace("Espece ", "Sp"), x + barWidth / 2, h - 5);

            // Value
            if (progress > 0.5) {
                ctx.fillStyle = "#FFF";
                ctx.font = "bold 11px sans-serif";
                ctx.fillText(val.toFixed(0), x + barWidth / 2, y - 6);

                // Members count
                ctx.fillStyle = "#999";
                ctx.font = "10px sans-serif";
                ctx.fillText(`(${sp.members})`, x + barWidth / 2, y - 18);
            }
        });

        // Title
        ctx.fillStyle = "#FFAB40";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(isAdjusted ? "Apres fitness sharing" : "Avant fitness sharing", w / 2, 15);
    }

    function startAnimation() {
        if (animId) cancelAnimationFrame(animId);
        animProgress = 0;

        function tick() {
            animProgress += 0.03;
            if (animProgress > 1) animProgress = 1;

            drawBarChart(rawCtx, false, animProgress);
            drawBarChart(adjCtx, true, animProgress);

            if (animProgress < 1) {
                animId = requestAnimationFrame(tick);
            } else {
                animId = null;
            }
        }
        tick();
    }

    startAnimation();

    const explanation = document.getElementById("fitness-explanation");
    if (explanation) {
        explanation.innerHTML = '<span style="color:#FFAB40;">→</span> Le fitness sharing divise la fitness par la taille de l\'espece. <strong style="color:#4CAF50;">L\'Espece 2</strong> (petite, innovante) obtient le meilleur score ajuste !';
    }

    // Challenge 5
    const input = document.getElementById("ch5-input");
    const btn = document.getElementById("ch5-btn");
    const feedback = document.getElementById("ch5-feedback");

    const correctAnswer = 100 / 4; // 25.0

    if (btn) {
        btn.addEventListener("click", () => {
            const userAnswer = parseFloat(input.value);
            if (Math.abs(userAnswer - correctAnswer) < 0.1) {
                feedback.textContent = "✓ Correct ! 100 / 4 = 25";
                feedback.style.color = "#4CAF50";
                completeChallenge(5);
            } else {
                feedback.textContent = "✗ Incorrect. Rappelez-vous : fitness ajustee = fitness brute / taille espece";
                feedback.style.color = "#F44336";
            }
        });
    }
}

// ============ Section 7: Evolution Cycle + Challenge 6 ============
function initEvolutionCycle() {
    const flowchartSvg = document.getElementById("flowchart-svg");
    const graphCanvas = document.getElementById("evolution-graph");
    if (!flowchartSvg || !graphCanvas) return;

    // Flowchart step data
    const flowSteps = [
        { label: "Evaluation", color: "#2196F3", desc: "Chaque genome est teste et recoit un score de fitness" },
        { label: "Speciation", color: "#4CAF50", desc: "Les genomes sont regroupes en especes par similarite" },
        { label: "Selection", color: "#FF9800", desc: "Les meilleurs genomes de chaque espece sont selectionnes" },
        { label: "Crossover", color: "#9C27B0", desc: "Deux parents sont combines pour creer un enfant" },
        { label: "Mutation", color: "#F44336", desc: "L'enfant subit des mutations aleatoires" }
    ];
    let activeFlowStep = -1;

    function drawFlowchart() {
        const svgNS = "http://www.w3.org/2000/svg";
        flowchartSvg.innerHTML = "";

        // Arrow marker definition
        const defs = document.createElementNS(svgNS, "defs");
        const marker = document.createElementNS(svgNS, "marker");
        marker.setAttribute("id", "fc-arrow");
        marker.setAttribute("viewBox", "0 0 10 10");
        marker.setAttribute("refX", "8");
        marker.setAttribute("refY", "5");
        marker.setAttribute("markerWidth", "6");
        marker.setAttribute("markerHeight", "6");
        marker.setAttribute("orient", "auto-start-reverse");
        const markerPath = document.createElementNS(svgNS, "path");
        markerPath.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
        markerPath.setAttribute("fill", "white");
        marker.appendChild(markerPath);
        defs.appendChild(marker);
        flowchartSvg.appendChild(defs);

        const boxW = 140, boxH = 36, cx = 250, startY = 20, gap = 56;

        flowSteps.forEach((step, i) => {
            const y = startY + i * gap;
            const isActive = i === activeFlowStep;

            // Glow behind active step
            if (isActive) {
                const glow = document.createElementNS(svgNS, "rect");
                glow.setAttribute("x", cx - boxW / 2 - 4);
                glow.setAttribute("y", y - 4);
                glow.setAttribute("width", boxW + 8);
                glow.setAttribute("height", boxH + 8);
                glow.setAttribute("rx", "8");
                glow.setAttribute("fill", "none");
                glow.setAttribute("stroke", step.color);
                glow.setAttribute("stroke-width", "3");
                glow.setAttribute("opacity", "0.6");
                flowchartSvg.appendChild(glow);
            }

            // Box
            const rect = document.createElementNS(svgNS, "rect");
            rect.setAttribute("x", cx - boxW / 2);
            rect.setAttribute("y", y);
            rect.setAttribute("width", boxW);
            rect.setAttribute("height", boxH);
            rect.setAttribute("rx", "6");
            rect.setAttribute("fill", isActive ? step.color : step.color + "88");
            flowchartSvg.appendChild(rect);

            // Label
            const text = document.createElementNS(svgNS, "text");
            text.setAttribute("x", cx);
            text.setAttribute("y", y + boxH / 2 + 5);
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("fill", "white");
            text.setAttribute("font-size", isActive ? "14" : "12");
            text.setAttribute("font-weight", isActive ? "bold" : "normal");
            text.textContent = step.label;
            flowchartSvg.appendChild(text);

            // Arrow to next step
            if (i < flowSteps.length - 1) {
                const arrow = document.createElementNS(svgNS, "path");
                arrow.setAttribute("d", `M ${cx} ${y + boxH} L ${cx} ${y + gap}`);
                arrow.setAttribute("stroke", "white");
                arrow.setAttribute("stroke-width", "2");
                arrow.setAttribute("fill", "none");
                arrow.setAttribute("marker-end", "url(#fc-arrow)");
                flowchartSvg.appendChild(arrow);
            }
        });

        // Loop arrow from Mutation back to Evaluation
        const lastY = startY + 4 * gap + boxH;
        const firstY = startY;
        const loop = document.createElementNS(svgNS, "path");
        loop.setAttribute("d", `M ${cx + boxW/2} ${lastY} Q ${cx + boxW/2 + 60} ${lastY} ${cx + boxW/2 + 60} ${(firstY + lastY) / 2} Q ${cx + boxW/2 + 60} ${firstY} ${cx + boxW/2} ${firstY}`);
        loop.setAttribute("stroke", "#ffffff66");
        loop.setAttribute("stroke-width", "2");
        loop.setAttribute("fill", "none");
        loop.setAttribute("stroke-dasharray", "5,4");
        loop.setAttribute("marker-end", "url(#fc-arrow)");
        flowchartSvg.appendChild(loop);

        // Loop label
        const loopText = document.createElementNS(svgNS, "text");
        loopText.setAttribute("x", cx + boxW / 2 + 68);
        loopText.setAttribute("y", (firstY + lastY) / 2 + 5);
        loopText.setAttribute("fill", "#999");
        loopText.setAttribute("font-size", "11");
        loopText.setAttribute("text-anchor", "middle");
        loopText.textContent = "Boucle";
        flowchartSvg.appendChild(loopText);
    }

    drawFlowchart();

    // Flowchart description
    const highlightDiv = document.getElementById("flowchart-highlight");

    // HiDPI canvas setup
    const dpr = window.devicePixelRatio || 1;
    const GW = 500, GH = 200;
    graphCanvas.width = GW * dpr;
    graphCanvas.height = GH * dpr;
    graphCanvas.style.width = GW + "px";
    graphCanvas.style.height = GH + "px";
    graphCanvas.style.maxWidth = "100%";
    const ctx = graphCanvas.getContext("2d");
    ctx.scale(dpr, dpr);

    let generation = 0;
    let fitnessHistory = [];
    let isRunning = false;
    let population = null;

    // XOR with tanh-compatible targets (-1 and 1 instead of 0 and 1)
    // tanh output range is (-1, 1), so expected values must match
    // Random networks (output ~0) → error ~1 per test → total ~4 → fitness 25%
    // Linear ceiling (OR-like) → total ~3 → fitness ~39%
    // Good XOR with hidden node → total ~0.2 → fitness ~95%+
    const FITNESS_TARGET = 90; // percent

    function xorFitness(genome) {
        const tests = [
            { input: [0, 0], expected: -1 },
            { input: [0, 1], expected: 1 },
            { input: [1, 0], expected: 1 },
            { input: [1, 1], expected: -1 }
        ];

        let totalError = 0;
        tests.forEach(test => {
            const output = genome.activate(test.input)[0];
            totalError += Math.abs(output - test.expected);
        });

        // Max error per test = 2, max total = 8
        // (8 - error)^2 / 64 * 100 gives smooth 0-100% range
        return Math.pow(Math.max(0, 8 - totalError), 2) / 64 * 100;
    }

    function initPopulation() {
        NEAT.resetInnovation();
        population = new NEAT.Population({
            numInputs: 2,
            numOutputs: 1,
            populationSize: 150,
            compatibilityThreshold: 3.0,
            mutationConfig: {
                weightMutateRate: 0.8,
                addNodeRate: 0.1,
                addConnRate: 0.2,
            }
        });
        // Seed 30% of genomes with hidden nodes for structural diversity
        // XOR requires at least 1 hidden node - give NEAT a head start
        for (let i = 0; i < 50; i++) {
            population.genomes[i].mutateAddNode();
            population.genomes[i].mutateAddConnection();
        }
        generation = 0;
        fitnessHistory = [];
    }

    function evolveGeneration() {
        // Highlight flowchart steps in sequence
        const stepIdx = generation % flowSteps.length;
        activeFlowStep = stepIdx;
        drawFlowchart();
        if (highlightDiv) {
            highlightDiv.textContent = flowSteps[stepIdx].desc;
            highlightDiv.style.color = flowSteps[stepIdx].color;
        }

        population.genomes.forEach(g => {
            g.fitness = xorFitness(g);
        });

        const best = population.genomes.reduce((a, b) => a.fitness > b.fitness ? a : b);
        fitnessHistory.push(best.fitness);
        generation++;

        document.getElementById("gen-value").textContent = generation;
        document.getElementById("best-fitness-value").textContent = best.fitness.toFixed(1) + "%";
        document.getElementById("species-value").textContent = population.species ? population.species.length : "--";

        population.evolve();

        drawGraph();

        // Check challenge 6
        if (best.fitness >= FITNESS_TARGET) {
            const progressEl = document.getElementById("ch6-progress");
            const textEl = document.getElementById("ch6-text");
            if (progressEl && textEl) {
                progressEl.style.width = "100%";
                textEl.textContent = `Fitness : ${best.fitness.toFixed(1)}% / ${FITNESS_TARGET}% - Objectif atteint !`;
                textEl.style.color = "#4CAF50";
            }
            completeChallenge(6);
            isRunning = false;
        }
    }

    function drawGraph() {
        const w = GW, h = GH;
        ctx.clearRect(0, 0, w, h);

        // Background
        ctx.fillStyle = "#1a1a2e";
        ctx.fillRect(0, 0, w, h);

        const margin = { top: 20, right: 15, bottom: 30, left: 45 };
        const plotW = w - margin.left - margin.right;
        const plotH = h - margin.top - margin.bottom;

        // Grid + Y labels (0% to 100%)
        ctx.strokeStyle = "#ffffff11";
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const y = margin.top + (plotH / 5) * i;
            ctx.beginPath();
            ctx.moveTo(margin.left, y);
            ctx.lineTo(w - margin.right, y);
            ctx.stroke();

            ctx.fillStyle = "#888";
            ctx.font = "10px sans-serif";
            ctx.textAlign = "right";
            ctx.fillText((100 - i * 20) + "%", margin.left - 5, y + 4);
        }

        // Axes
        ctx.strokeStyle = "#555";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(margin.left, margin.top);
        ctx.lineTo(margin.left, h - margin.bottom);
        ctx.lineTo(w - margin.right, h - margin.bottom);
        ctx.stroke();

        // Axis labels
        ctx.fillStyle = "#999";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Generation", w / 2, h - 5);

        ctx.save();
        ctx.translate(12, h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText("Fitness (%)", 0, 0);
        ctx.restore();

        if (fitnessHistory.length < 1) {
            ctx.fillStyle = "#666";
            ctx.font = "14px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Cliquez sur un bouton pour lancer l'evolution", w / 2, h / 2);
            return;
        }

        const maxGen = Math.max(20, fitnessHistory.length);
        const xScale = plotW / maxGen;

        // Target line at 95%
        const targetY = margin.top + plotH * (1 - FITNESS_TARGET / 100);
        ctx.strokeStyle = "#FF980066";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(margin.left, targetY);
        ctx.lineTo(w - margin.right, targetY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "#FF9800";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("Objectif: " + FITNESS_TARGET + "%", w - margin.right - 80, targetY - 5);

        // Fitness curve
        ctx.beginPath();
        fitnessHistory.forEach((fitness, i) => {
            const x = margin.left + i * xScale;
            const y = margin.top + plotH * (1 - fitness / 100);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = "#4CAF50";
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Fill under curve
        const lastX = margin.left + (fitnessHistory.length - 1) * xScale;
        ctx.lineTo(lastX, h - margin.bottom);
        ctx.lineTo(margin.left, h - margin.bottom);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, margin.top, 0, h - margin.bottom);
        grad.addColorStop(0, "#4CAF5033");
        grad.addColorStop(1, "#4CAF5005");
        ctx.fillStyle = grad;
        ctx.fill();

        // Current point
        if (fitnessHistory.length > 0) {
            const last = fitnessHistory[fitnessHistory.length - 1];
            const lx = margin.left + (fitnessHistory.length - 1) * xScale;
            const ly = margin.top + plotH * (1 - last / 100);

            ctx.beginPath();
            ctx.arc(lx, ly, 5, 0, Math.PI * 2);
            ctx.fillStyle = "#4CAF50";
            ctx.fill();
            ctx.strokeStyle = "#FFF";
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Update progress bar
        const progressEl = document.getElementById("ch6-progress");
        const textEl = document.getElementById("ch6-text");
        if (progressEl && textEl && fitnessHistory.length > 0) {
            const current = fitnessHistory[fitnessHistory.length - 1];
            progressEl.style.width = `${Math.min(100, (current / FITNESS_TARGET) * 100)}%`;
            textEl.textContent = `Fitness : ${current.toFixed(1)}% / ${FITNESS_TARGET}%`;
        }
    }

    // Initial draw with empty state
    drawGraph();

    document.getElementById("btn-evolve-step").addEventListener("click", () => {
        if (!population) initPopulation();
        evolveGeneration();
    });

    document.getElementById("btn-evolve-auto").addEventListener("click", () => {
        if (!population) initPopulation();
        isRunning = true;

        let count = 0;
        const interval = setInterval(() => {
            if (!isRunning || count >= 50) {
                clearInterval(interval);
                activeFlowStep = -1;
                drawFlowchart();
                if (highlightDiv) highlightDiv.textContent = "";
                return;
            }
            evolveGeneration();
            count++;
        }, 150);
    });

    document.getElementById("btn-reset-evolution").addEventListener("click", () => {
        isRunning = false;
        activeFlowStep = -1;
        drawFlowchart();
        if (highlightDiv) highlightDiv.textContent = "";
        initPopulation();
        drawGraph();
        document.getElementById("gen-value").textContent = "0";
        document.getElementById("best-fitness-value").textContent = "0.0%";
        document.getElementById("species-value").textContent = "--";

        const progress = document.getElementById("ch6-progress");
        const text = document.getElementById("ch6-text");
        if (progress && text) {
            progress.style.width = "0%";
            text.textContent = "Fitness : 0.0% / " + FITNESS_TARGET + "%";
            text.style.color = "";
        }
    });
}

// ============ Section 8: Applications ============
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

    // Gen 50: Complex network
    const gen50 = NEAT.Genome.create(4, 1);
    for (let i = 0; i < 5; i++) {
        gen50.mutateAddNode();
        gen50.mutateAddConnection();
        gen50.mutateAddConnection();
    }
    renderGenomeToSVG(gen50, gen50Svg, inputLabels, outputLabels);

    document.getElementById("gen50-nodes").textContent = gen50.nodes.length;
    document.getElementById("gen50-connections").textContent = gen50.connections.length;
    document.getElementById("gen50-fitness").textContent = "8547";
}

// ============ Section 9: Conclusion + Parameter Guide ============
function initConclusion() {
    const paramGrid = document.getElementById("param-grid");
    if (!paramGrid) return;

    const parameters = [
        {
            name: "Taille Population",
            value: "50-500",
            influence: "Performance vs Temps",
            desc: "Plus la population est grande, plus l'exploration est large mais plus l'evolution est lente. Commencer avec 100-150.",
            icon: "👥"
        },
        {
            name: "Taux Mutation Poids",
            value: "0.7-0.9",
            influence: "Adaptation Continue",
            desc: "Probabilite de modifier les poids existants. Haute valeur (80%) permet ajustement fin sans changer la topologie.",
            icon: "⚖️"
        },
        {
            name: "Taux Mutation Connexion",
            value: "0.03-0.10",
            influence: "Complexite Reseau",
            desc: "Probabilite d'ajouter une nouvelle connexion. 5% est un bon equilibre. Trop haut cree des reseaux trop denses.",
            icon: "🔗"
        },
        {
            name: "Taux Mutation Noeud",
            value: "0.01-0.05",
            influence: "Profondeur Reseau",
            desc: "Probabilite d'ajouter un noeud cache. Commencer bas (3%) car augmente beaucoup la complexite.",
            icon: "🔵"
        },
        {
            name: "Seuil Speciation (δt)",
            value: "2.0-4.0",
            influence: "Nombre Especes",
            desc: "Distance max pour appartenir a meme espece. 3.0 est standard. Reduire = plus d'especes = plus de diversite.",
            icon: "🌳"
        },
        {
            name: "Coefficient c1 (Excess)",
            value: "1.0",
            influence: "Distance Topologique",
            desc: "Poids des genes excess dans calcul distance. Standard: 1.0. Augmenter penalise plus les differences structurelles.",
            icon: "📊"
        },
        {
            name: "Coefficient c2 (Disjoint)",
            value: "1.0",
            influence: "Distance Topologique",
            desc: "Poids des genes disjoint. Standard: 1.0. Similaire a c1 mais pour genes au milieu de la structure.",
            icon: "📊"
        },
        {
            name: "Coefficient c3 (Weights)",
            value: "0.3-0.5",
            influence: "Distance Poids",
            desc: "Importance difference poids vs topologie. 0.4 standard. Reduire si topologie plus importante que poids.",
            icon: "📊"
        },
        {
            name: "Taux Survie",
            value: "0.2-0.4",
            influence: "Pression Selection",
            desc: "Proportion qui se reproduit. 20-30% cree forte selection. 40%+ preserve plus de diversite mais ralentit evolution.",
            icon: "🏆"
        },
        {
            name: "Taux Crossover",
            value: "0.7-0.8",
            influence: "Innovation Combinee",
            desc: "Probabilite de reproduction sexuee vs clonage. 75% permet combinaison innovations tout en gardant elites.",
            icon: "🧬"
        },
        {
            name: "Stagnation Max",
            value: "15-20",
            influence: "Elimination Especes",
            desc: "Generations sans amelioration avant extinction espece. 15 gen standard. Permet reallocation ressources.",
            icon: "⏱️"
        },
        {
            name: "Elite par Espece",
            value: "1-2",
            influence: "Conservation Progres",
            desc: "Meilleurs genomes copies sans modification. 1 suffit generalement. Garantit pas de regression.",
            icon: "⭐"
        }
    ];

    paramGrid.style.display = "grid";
    paramGrid.style.gridTemplateColumns = "repeat(auto-fit, minmax(280px, 1fr))";
    paramGrid.style.gap = "15px";
    paramGrid.style.marginTop = "20px";

    parameters.forEach(param => {
        const card = document.createElement("div");
        card.style.background = "rgba(255, 255, 255, 0.05)";
        card.style.borderRadius = "8px";
        card.style.padding = "15px";
        card.style.border = "1px solid rgba(255, 255, 255, 0.1)";
        card.style.transition = "all 0.3s ease";
        card.style.cursor = "default";

        card.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <span style="font-size: 24px;">${param.icon}</span>
                <div style="flex: 1;">
                    <h4 style="color: #FFAB40; margin: 0; font-size: 14px;">${param.name}</h4>
                    <span style="color: #4CAF50; font-size: 12px; font-family: monospace;">${param.value}</span>
                </div>
            </div>
            <div style="margin-bottom: 8px;">
                <strong style="color: #2196F3; font-size: 12px;">Impact:</strong>
                <span style="color: #BBB; font-size: 12px;"> ${param.influence}</span>
            </div>
            <p style="color: #999; font-size: 11px; line-height: 1.5; margin: 0;">
                ${param.desc}
            </p>
        `;

        card.addEventListener("mouseenter", () => {
            card.style.background = "rgba(255, 255, 255, 0.08)";
            card.style.borderColor = "#FFAB40";
            card.style.transform = "translateY(-2px)";
        });

        card.addEventListener("mouseleave", () => {
            card.style.background = "rgba(255, 255, 255, 0.05)";
            card.style.borderColor = "rgba(255, 255, 255, 0.1)";
            card.style.transform = "translateY(0)";
        });

        paramGrid.appendChild(card);
    });

    // Update final score
    const finalScoreText = document.getElementById("final-score-text");
    const scoreMessage = document.getElementById("score-message");
    const completedCount = challengeState.completed.size;

    finalScoreText.textContent = `${completedCount}/${challengeState.total} defis completes`;

    if (completedCount === challengeState.total) {
        scoreMessage.textContent = "🎉 Excellent ! Vous maitrisez NEAT !";
        scoreMessage.style.color = "#4CAF50";
    } else if (completedCount >= 4) {
        scoreMessage.textContent = "👍 Bon travail ! Continuez pour tout completer.";
        scoreMessage.style.color = "#2196F3";
    } else if (completedCount >= 2) {
        scoreMessage.textContent = "💪 Vous progressez ! Essayez les defis restants.";
        scoreMessage.style.color = "#FF9800";
    } else {
        scoreMessage.textContent = "🎯 Relevez les defis pour tester vos connaissances !";
        scoreMessage.style.color = "#FFC107";
    }

    // Highlight completed challenge cards
    challengeState.completed.forEach(id => {
        const card = document.querySelector(`.recap-card[data-challenge="${id}"]`);
        if (card) {
            card.style.borderLeft = "4px solid #4CAF50";
            card.style.background = "rgba(76, 175, 80, 0.1)";
        }
    });
}

// ============ Init All ============
document.addEventListener("DOMContentLoaded", () => {
    initScrollSystem();
    initHero();
    initEvolution();
    initGenome();
    initMutations();
    initInnovation();
    initSpeciation();
    initFitness();
    initEvolutionCycle();
    initApplications();
    initConclusion();
    updateCounter();
});
