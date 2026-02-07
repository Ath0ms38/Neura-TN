// ============================================================
// NEAT (NeuroEvolution of Augmenting Topologies) - Vanilla JS
// ============================================================

"use strict";

const NEAT = (() => {
    let globalInnovation = 0;
    const innovationHistory = new Map(); // "inNode->outNode" => innovation number

    function getInnovation(inNode, outNode) {
        const key = `${inNode}->${outNode}`;
        if (innovationHistory.has(key)) return innovationHistory.get(key);
        const innov = ++globalInnovation;
        innovationHistory.set(key, innov);
        return innov;
    }

    function resetInnovation() {
        globalInnovation = 0;
        innovationHistory.clear();
    }

    // ---- Node Gene ----
    class NodeGene {
        constructor(id, type) {
            this.id = id;          // unique integer
            this.type = type;      // "input", "hidden", "output", "bias"
            this.bias = (type === "input" || type === "bias") ? 0 : (Math.random() * 2 - 1);
        }
        clone() {
            const n = new NodeGene(this.id, this.type);
            n.bias = this.bias;
            return n;
        }
    }

    // ---- Connection Gene ----
    class ConnectionGene {
        constructor(inNode, outNode, weight, enabled, innovation) {
            this.inNode = inNode;
            this.outNode = outNode;
            this.weight = weight;
            this.enabled = enabled;
            this.innovation = innovation;
        }
        clone() {
            return new ConnectionGene(this.inNode, this.outNode, this.weight, this.enabled, this.innovation);
        }
    }

    // ---- Activation functions ----
    const activations = {
        tanh: x => Math.tanh(x),
        sigmoid: x => 1 / (1 + Math.exp(-x)),
        relu: x => Math.max(0, x),
    };

    // ---- Genome ----
    class Genome {
        constructor(numInputs, numOutputs) {
            this.numInputs = numInputs;
            this.numOutputs = numOutputs;
            this.nodes = [];       // NodeGene[]
            this.connections = [];  // ConnectionGene[]
            this.fitness = 0;
            this.species = -1;
        }

        static create(numInputs, numOutputs) {
            const g = new Genome(numInputs, numOutputs);
            let id = 0;

            // Input nodes
            for (let i = 0; i < numInputs; i++) {
                g.nodes.push(new NodeGene(id++, "input"));
            }
            // Bias node
            g.nodes.push(new NodeGene(id++, "bias"));
            // Output nodes
            for (let i = 0; i < numOutputs; i++) {
                g.nodes.push(new NodeGene(id++, "output"));
            }

            // Fully connect inputs + bias to outputs
            const biasId = numInputs;
            for (let i = 0; i <= numInputs; i++) { // includes bias
                for (let o = 0; o < numOutputs; o++) {
                    const outId = numInputs + 1 + o;
                    const innov = getInnovation(i, outId);
                    g.connections.push(new ConnectionGene(i, outId, Math.random() * 2 - 1, true, innov));
                }
            }
            return g;
        }

        clone() {
            const g = new Genome(this.numInputs, this.numOutputs);
            g.nodes = this.nodes.map(n => n.clone());
            g.connections = this.connections.map(c => c.clone());
            g.fitness = this.fitness;
            return g;
        }

        getNextNodeId() {
            return Math.max(...this.nodes.map(n => n.id)) + 1;
        }

        // ---- Feed-forward activation ----
        activate(inputs) {
            if (inputs.length !== this.numInputs) {
                throw new Error(`Expected ${this.numInputs} inputs, got ${inputs.length}`);
            }

            const values = new Map();

            // Set input values
            for (let i = 0; i < this.numInputs; i++) {
                values.set(i, inputs[i]);
            }
            // Bias node always 1
            values.set(this.numInputs, 1.0);

            // Topological sort for feed-forward evaluation
            const adj = new Map();     // node -> [{from, weight}]
            const nodeSet = new Set(this.nodes.map(n => n.id));

            for (const n of this.nodes) adj.set(n.id, []);
            for (const c of this.connections) {
                if (!c.enabled) continue;
                adj.get(c.outNode).push({ from: c.inNode, weight: c.weight });
            }

            // Kahn's algorithm
            const inDegree = new Map();
            for (const n of this.nodes) inDegree.set(n.id, 0);
            for (const c of this.connections) {
                if (!c.enabled) continue;
                inDegree.set(c.outNode, (inDegree.get(c.outNode) || 0) + 1);
            }

            const queue = [];
            for (const n of this.nodes) {
                if (n.type === "input" || n.type === "bias") {
                    queue.push(n.id);
                }
            }

            const order = [];
            while (queue.length > 0) {
                const curr = queue.shift();
                order.push(curr);
                for (const c of this.connections) {
                    if (!c.enabled || c.inNode !== curr) continue;
                    inDegree.set(c.outNode, inDegree.get(c.outNode) - 1);
                    if (inDegree.get(c.outNode) === 0) {
                        queue.push(c.outNode);
                    }
                }
            }

            // Evaluate in topological order
            const nodeMap = new Map();
            for (const n of this.nodes) nodeMap.set(n.id, n);

            for (const nid of order) {
                const node = nodeMap.get(nid);
                if (node.type === "input" || node.type === "bias") continue;

                let sum = node.bias;
                for (const edge of adj.get(nid)) {
                    sum += (values.get(edge.from) || 0) * edge.weight;
                }
                values.set(nid, activations.tanh(sum));
            }

            // Collect outputs
            const outputStart = this.numInputs + 1;
            const outputs = [];
            for (let i = 0; i < this.numOutputs; i++) {
                outputs.push(values.get(outputStart + i) || 0);
            }
            return outputs;
        }

        // ---- Mutations ----
        mutateWeights(rate = 0.8, power = 0.5) {
            for (const c of this.connections) {
                if (Math.random() < rate) {
                    if (Math.random() < 0.1) {
                        c.weight = Math.random() * 4 - 2;
                    } else {
                        c.weight += (Math.random() * 2 - 1) * power;
                        c.weight = Math.max(-20, Math.min(20, c.weight));
                    }
                }
            }
        }

        mutateBias(rate = 0.7, power = 0.5) {
            for (const n of this.nodes) {
                if (n.type === "input" || n.type === "bias") continue;
                if (Math.random() < rate) {
                    if (Math.random() < 0.1) {
                        n.bias = Math.random() * 4 - 2;
                    } else {
                        n.bias += (Math.random() * 2 - 1) * power;
                        n.bias = Math.max(-20, Math.min(20, n.bias));
                    }
                }
            }
        }

        mutateAddConnection() {
            const inputNodes = this.nodes.filter(n => n.type !== "output");
            const outputNodes = this.nodes.filter(n => n.type !== "input" && n.type !== "bias");

            // Try a few times to find a new connection
            for (let attempt = 0; attempt < 20; attempt++) {
                const from = inputNodes[Math.floor(Math.random() * inputNodes.length)];
                const to = outputNodes[Math.floor(Math.random() * outputNodes.length)];
                if (from.id === to.id) continue;

                // Check if connection already exists
                const exists = this.connections.some(c => c.inNode === from.id && c.outNode === to.id);
                if (exists) continue;

                // Avoid cycles by checking if to can reach from
                if (this._canReach(to.id, from.id)) continue;

                const innov = getInnovation(from.id, to.id);
                this.connections.push(new ConnectionGene(from.id, to.id, Math.random() * 2 - 1, true, innov));
                return;
            }
        }

        _canReach(fromId, toId) {
            const visited = new Set();
            const stack = [fromId];
            while (stack.length > 0) {
                const curr = stack.pop();
                if (curr === toId) return true;
                if (visited.has(curr)) continue;
                visited.add(curr);
                for (const c of this.connections) {
                    if (c.enabled && c.inNode === curr) {
                        stack.push(c.outNode);
                    }
                }
            }
            return false;
        }

        mutateAddNode() {
            const enabled = this.connections.filter(c => c.enabled);
            if (enabled.length === 0) return;

            const conn = enabled[Math.floor(Math.random() * enabled.length)];
            conn.enabled = false;

            const newId = this.getNextNodeId();
            this.nodes.push(new NodeGene(newId, "hidden"));

            const innov1 = getInnovation(conn.inNode, newId);
            const innov2 = getInnovation(newId, conn.outNode);

            this.connections.push(new ConnectionGene(conn.inNode, newId, 1.0, true, innov1));
            this.connections.push(new ConnectionGene(newId, conn.outNode, conn.weight, true, innov2));
        }

        mutateToggleConnection() {
            if (this.connections.length === 0) return;
            const c = this.connections[Math.floor(Math.random() * this.connections.length)];
            c.enabled = !c.enabled;
        }

        mutate(config = {}) {
            const {
                weightMutateRate = 0.8,
                addNodeRate = 0.03,
                addConnRate = 0.05,
                toggleRate = 0.01,
            } = config;

            this.mutateWeights(weightMutateRate);
            this.mutateBias();

            if (Math.random() < addNodeRate) this.mutateAddNode();
            if (Math.random() < addConnRate) this.mutateAddConnection();
            if (Math.random() < toggleRate) this.mutateToggleConnection();
        }

        // ---- Compatibility distance ----
        static compatibilityDistance(g1, g2, c1 = 1.0, c2 = 1.0, c3 = 0.5) {
            const conns1 = new Map(g1.connections.map(c => [c.innovation, c]));
            const conns2 = new Map(g2.connections.map(c => [c.innovation, c]));

            const allInnovs = new Set([...conns1.keys(), ...conns2.keys()]);
            let matching = 0, disjoint = 0, excess = 0, weightDiff = 0;

            const max1 = g1.connections.length > 0 ? Math.max(...g1.connections.map(c => c.innovation)) : 0;
            const max2 = g2.connections.length > 0 ? Math.max(...g2.connections.map(c => c.innovation)) : 0;
            const maxBoth = Math.min(max1, max2);

            for (const innov of allInnovs) {
                const in1 = conns1.has(innov);
                const in2 = conns2.has(innov);
                if (in1 && in2) {
                    matching++;
                    weightDiff += Math.abs(conns1.get(innov).weight - conns2.get(innov).weight);
                } else if (innov > maxBoth) {
                    excess++;
                } else {
                    disjoint++;
                }
            }

            const n = Math.max(g1.connections.length, g2.connections.length, 1);
            const avgWeight = matching > 0 ? weightDiff / matching : 0;

            return (c1 * excess / n) + (c2 * disjoint / n) + (c3 * avgWeight);
        }

        // ---- Crossover ----
        static crossover(parent1, parent2) {
            // parent1 should be the fitter one
            let p1 = parent1, p2 = parent2;
            if (p2.fitness > p1.fitness) { p1 = parent2; p2 = parent1; }

            const child = new Genome(p1.numInputs, p1.numOutputs);

            // Inherit nodes from fitter parent
            const p1NodeIds = new Set(p1.nodes.map(n => n.id));
            const p2NodeIds = new Set(p2.nodes.map(n => n.id));
            const childNodeIds = new Set();

            for (const n of p1.nodes) {
                child.nodes.push(n.clone());
                childNodeIds.add(n.id);
            }

            // Align connections by innovation
            const conns1 = new Map(p1.connections.map(c => [c.innovation, c]));
            const conns2 = new Map(p2.connections.map(c => [c.innovation, c]));

            for (const [innov, c1] of conns1) {
                if (conns2.has(innov)) {
                    // Matching: randomly pick
                    const chosen = Math.random() < 0.5 ? c1 : conns2.get(innov);
                    child.connections.push(chosen.clone());
                } else {
                    // Disjoint/excess from fitter parent
                    child.connections.push(c1.clone());
                }
            }

            // Ensure all referenced nodes exist
            for (const c of child.connections) {
                for (const nid of [c.inNode, c.outNode]) {
                    if (!childNodeIds.has(nid)) {
                        // Get from either parent
                        const node = p1.nodes.find(n => n.id === nid) ||
                                     p2.nodes.find(n => n.id === nid);
                        if (node) {
                            child.nodes.push(node.clone());
                            childNodeIds.add(nid);
                        }
                    }
                }
            }

            return child;
        }

        // ---- Get network structure for visualization ----
        getNetworkInfo() {
            const nodeMap = new Map();
            for (const n of this.nodes) nodeMap.set(n.id, n);
            return {
                nodes: this.nodes.map(n => ({
                    id: n.id, type: n.type, bias: n.bias,
                })),
                connections: this.connections.filter(c => c.enabled).map(c => ({
                    from: c.inNode, to: c.outNode, weight: c.weight,
                })),
            };
        }
    }

    // ---- Species ----
    class Species {
        constructor(representative) {
            this.representative = representative;
            this.members = [];
            this.bestFitness = -Infinity;
            this.staleness = 0;
        }

        addMember(genome) {
            this.members.push(genome);
            genome.species = this.representative.species;
        }

        adjustFitness() {
            const size = this.members.length;
            for (const m of this.members) {
                m.adjustedFitness = m.fitness / size;
            }
        }

        getBest() {
            return this.members.reduce((a, b) => a.fitness > b.fitness ? a : b);
        }
    }

    // ---- Population ----
    class Population {
        constructor(config) {
            this.config = {
                populationSize: 100,
                numInputs: 2,
                numOutputs: 1,
                compatibilityThreshold: 3.0,
                elitism: 2,
                survivalThreshold: 0.2,
                maxStagnation: 15,
                speciesElitism: 2,
                mutationConfig: {},
                ...config,
            };

            resetInnovation();
            this.generation = 0;
            this.genomes = [];
            this.species = [];
            this.bestGenome = null;
            this.bestFitnessEver = -Infinity;

            for (let i = 0; i < this.config.populationSize; i++) {
                this.genomes.push(Genome.create(this.config.numInputs, this.config.numOutputs));
            }
        }

        speciate() {
            // Clear members
            for (const s of this.species) s.members = [];

            for (const genome of this.genomes) {
                let placed = false;
                for (const s of this.species) {
                    const dist = Genome.compatibilityDistance(genome, s.representative);
                    if (dist < this.config.compatibilityThreshold) {
                        s.addMember(genome);
                        placed = true;
                        break;
                    }
                }
                if (!placed) {
                    const newSpecies = new Species(genome.clone());
                    newSpecies.representative.species = this.species.length;
                    genome.species = this.species.length;
                    newSpecies.members.push(genome);
                    this.species.push(newSpecies);
                }
            }

            // Remove empty species
            this.species = this.species.filter(s => s.members.length > 0);
        }

        evolve() {
            this.speciate();

            // Debug: log species info
            if (this.generation % 5 === 0) {
                console.log(`Gen ${this.generation}: ${this.species.length} species`);
                for (let i = 0; i < this.species.length; i++) {
                    const s = this.species[i];
                    const avgNodes = s.members.reduce((sum, m) => sum + m.nodes.length, 0) / s.members.length;
                    const avgConns = s.members.reduce((sum, m) => sum + m.connections.filter(c => c.enabled).length, 0) / s.members.length;
                    console.log(`  Species ${i}: ${s.members.length} members, ${avgNodes.toFixed(1)} nodes, ${avgConns.toFixed(1)} conns`);
                }
            }

            // Adjust fitness and track staleness
            for (const s of this.species) {
                s.adjustFitness();
                const best = s.getBest();
                if (best.fitness > s.bestFitness) {
                    s.bestFitness = best.fitness;
                    s.staleness = 0;
                } else {
                    s.staleness++;
                }
            }

            // Track global best
            for (const g of this.genomes) {
                if (g.fitness > this.bestFitnessEver) {
                    this.bestFitnessEver = g.fitness;
                    this.bestGenome = g.clone();
                }
            }

            // Remove stagnant species (keep top speciesElitism)
            this.species.sort((a, b) => b.bestFitness - a.bestFitness);
            if (this.species.length > this.config.speciesElitism) {
                this.species = this.species.filter((s, i) =>
                    i < this.config.speciesElitism || s.staleness < this.config.maxStagnation
                );
            }
            if (this.species.length === 0) {
                // Extinction event - restart
                this.genomes = [];
                for (let i = 0; i < this.config.populationSize; i++) {
                    this.genomes.push(Genome.create(this.config.numInputs, this.config.numOutputs));
                }
                this.generation++;
                return;
            }

            // Calculate total adjusted fitness for offspring allocation
            const totalAdjFitness = this.species.reduce((sum, s) => {
                return sum + s.members.reduce((ss, m) => ss + (m.adjustedFitness || 0), 0);
            }, 0);

            const newGenomes = [];

            for (const s of this.species) {
                // Sort members by fitness
                s.members.sort((a, b) => b.fitness - a.fitness);

                // Elitism: keep top performer
                if (this.config.elitism > 0 && s.members.length >= 1) {
                    newGenomes.push(s.members[0].clone());
                }

                // Calculate offspring count
                const speciesAdjFit = s.members.reduce((ss, m) => ss + (m.adjustedFitness || 0), 0);
                let offspringCount = totalAdjFitness > 0
                    ? Math.floor((speciesAdjFit / totalAdjFitness) * this.config.populationSize)
                    : Math.floor(this.config.populationSize / this.species.length);

                // Survivors for breeding
                const cutoff = Math.max(1, Math.ceil(s.members.length * this.config.survivalThreshold));
                const breeders = s.members.slice(0, cutoff);

                for (let i = 0; i < offspringCount - 1 && newGenomes.length < this.config.populationSize; i++) {
                    let child;
                    if (breeders.length === 1 || Math.random() < 0.25) {
                        // Mutation only
                        child = breeders[Math.floor(Math.random() * breeders.length)].clone();
                    } else {
                        // Crossover + mutation
                        const p1 = breeders[Math.floor(Math.random() * breeders.length)];
                        const p2 = breeders[Math.floor(Math.random() * breeders.length)];
                        child = Genome.crossover(p1, p2);
                    }
                    child.mutate(this.config.mutationConfig);
                    child.fitness = 0;
                    newGenomes.push(child);
                }
            }

            // Fill remaining spots
            while (newGenomes.length < this.config.populationSize) {
                const s = this.species[Math.floor(Math.random() * this.species.length)];
                const parent = s.members[Math.floor(Math.random() * s.members.length)];
                const child = parent.clone();
                child.mutate(this.config.mutationConfig);
                child.fitness = 0;
                newGenomes.push(child);
            }

            // Update representative for each species
            for (const s of this.species) {
                s.representative = s.members[Math.floor(Math.random() * s.members.length)].clone();
            }

            this.genomes = newGenomes;
            this.generation++;
        }
    }

    return { Genome, Population, NodeGene, ConnectionGene, resetInnovation, activations };
})();
