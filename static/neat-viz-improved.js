// ============================================================
// Amélioration de la visualisation NEAT
// Calcule correctement les layers basés sur la profondeur du graphe
// ============================================================

/**
 * Calcule la profondeur (layer) de chaque nœud dans le réseau
 * Utilise un algorithme de longest path pour les DAG
 */
function calculateNodeLayers(nodes, connections) {
    const layers = new Map();

    // Étape 1: Initialiser les inputs et bias au layer 0
    for (const node of nodes) {
        if (node.type === "input" || node.type === "bias") {
            layers.set(node.id, 0);
        }
    }

    // Étape 2: Construire la liste d'adjacence
    const outgoing = new Map();  // node -> [nodes qu'il alimente]
    const incoming = new Map();  // node -> nombre de prédécesseurs

    for (const node of nodes) {
        outgoing.set(node.id, []);
        incoming.set(node.id, 0);
    }

    for (const conn of connections) {
        // Note: connections from getNetworkInfo() are already filtered (enabled only)
        outgoing.get(conn.from).push(conn.to);
        incoming.set(conn.to, incoming.get(conn.to) + 1);
    }

    // Étape 3: Tri topologique avec calcul de profondeur
    const queue = [];

    // Commencer avec tous les nœuds sans prédécesseurs (inputs + bias)
    for (const node of nodes) {
        if (incoming.get(node.id) === 0) {
            queue.push(node.id);
            if (!layers.has(node.id)) {
                layers.set(node.id, 0);
            }
        }
    }

    // Traiter les nœuds dans l'ordre topologique
    while (queue.length > 0) {
        const current = queue.shift();
        const currentLayer = layers.get(current);

        // Pour chaque nœud adjacent
        for (const next of outgoing.get(current)) {
            // La profondeur du nœud suivant est au moins currentLayer + 1
            const nextLayer = Math.max(
                layers.get(next) || 0,
                currentLayer + 1
            );
            layers.set(next, nextLayer);

            // Décrémenter le compteur de prédécesseurs
            incoming.set(next, incoming.get(next) - 1);

            // Si tous les prédécesseurs ont été traités, ajouter à la queue
            if (incoming.get(next) === 0) {
                queue.push(next);
            }
        }
    }

    return layers;
}

/**
 * Organise les nœuds par layer pour la visualisation
 */
function organizeNodesByLayers(nodes, connections) {
    const nodeLayers = calculateNodeLayers(nodes, connections);

    // Trouver le nombre maximum de layers
    const maxLayer = Math.max(...Array.from(nodeLayers.values()));

    // Organiser les nœuds par layer
    const layerArrays = [];
    for (let i = 0; i <= maxLayer; i++) {
        layerArrays.push([]);
    }

    for (const node of nodes) {
        const layer = nodeLayers.get(node.id);
        layerArrays[layer].push(node);
    }

    return {
        layers: layerArrays,
        nodeLayers: nodeLayers,
        numLayers: maxLayer + 1
    };
}

/**
 * Fonction de visualisation améliorée pour remplacer renderNN()
 * À utiliser dans car/app.js et flappy/app.js
 */
function renderNNImproved(genome, svgId, inputLabels, outputLabels) {
    const svg = document.getElementById(svgId);
    svg.innerHTML = "";

    if (!genome) return;

    const info = genome.getNetworkInfo();
    const W = 300, H = 220;  // Match SVG viewBox dimensions

    // Calculer les layers basés sur la profondeur du graphe
    const { layers, nodeLayers, numLayers } = organizeNodesByLayers(
        info.nodes,
        info.connections
    );

    console.log(`Network structure: ${numLayers} layers`);
    layers.forEach((layer, i) => {
        const types = layer.map(n => n.type).join(', ');
        console.log(`  Layer ${i}: ${layer.length} nodes (${types})`);
    });

    // Calculer les positions des nœuds
    const layerSpacing = W / (numLayers + 1);
    const nodePositions = new Map();

    for (let li = 0; li < layers.length; li++) {
        const layer = layers[li];
        const cx = layerSpacing * (li + 1);
        const nodeSpacing = Math.min(25, (H - 30) / Math.max(layer.length, 1));
        const startY = H / 2 - (layer.length - 1) * nodeSpacing / 2;

        for (let ni = 0; ni < layer.length; ni++) {
            const node = layer[ni];
            const y = startY + ni * nodeSpacing;
            nodePositions.set(node.id, { x: cx, y, layer: li });
        }
    }

    // Dessiner les connexions
    for (const conn of info.connections) {
        const from = nodePositions.get(conn.from);
        const to = nodePositions.get(conn.to);
        if (!from || !to) continue;

        const w = Math.abs(conn.weight);
        const color = conn.weight > 0 ? "#4caf50" : "#e85d4a";
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

    // Dessiner les nœuds
    for (const [id, pos] of nodePositions) {
        const node = info.nodes.find(n => n.id === id);
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", pos.x);
        circle.setAttribute("cy", pos.y);
        circle.setAttribute("r", 7);

        const fill = node.type === "input" || node.type === "bias" ? "#6c63ff" :
                     node.type === "output" ? "#e85d4a" : "#f5c542";
        circle.setAttribute("fill", fill);
        circle.setAttribute("class", "nn-node");
        svg.appendChild(circle);

        // Labels pour les inputs
        if ((node.type === "input" || node.type === "bias") && inputLabels[id]) {
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", pos.x - 25);
            text.setAttribute("y", pos.y + 4);
            text.setAttribute("class", "nn-label");
            text.setAttribute("text-anchor", "end");
            text.setAttribute("font-size", "11");
            text.textContent = inputLabels[id];
            svg.appendChild(text);
        }

        // Labels pour les outputs
        if (node.type === "output") {
            const outputNode = info.nodes.filter(n => n.type === "output");
            const oIdx = outputNode.findIndex(n => n.id === id);
            if (oIdx >= 0 && outputLabels[oIdx]) {
                const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                text.setAttribute("x", pos.x + 15);
                text.setAttribute("y", pos.y + 4);
                text.setAttribute("class", "nn-label");
                text.setAttribute("text-anchor", "start");
                text.setAttribute("font-size", "11");
                text.textContent = outputLabels[oIdx];
                svg.appendChild(text);
            }
        }

        // Labels pour les hidden nodes (afficher layer + id)
        if (node.type === "hidden") {
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", pos.x);
            text.setAttribute("y", pos.y - 12);
            text.setAttribute("class", "nn-label");
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("font-size", "9");
            text.setAttribute("fill", "#999");
            text.textContent = `H${id}`;
            svg.appendChild(text);
        }
    }

    // Afficher le nombre de layers et de nœuds
    const statsText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    statsText.setAttribute("x", 5);
    statsText.setAttribute("y", H - 5);
    statsText.setAttribute("font-size", "10");
    statsText.setAttribute("fill", "#666");
    statsText.textContent = `${numLayers} layers, ${info.nodes.length} nodes, ${info.connections.length} conns`;
    svg.appendChild(statsText);
}

// Export pour utilisation dans les autres fichiers
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { calculateNodeLayers, organizeNodesByLayers, renderNNImproved };
}
