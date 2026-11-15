// ============================================================
// TinyNN — petit perceptron multicouche en JavaScript pur.
// Classification binaire (sortie sigmoïde + entropie croisée),
// entraîné par descente de gradient par mini-lots.
// Utilisé par la page d'accueil, le bac à sable et le cours
// sur la descente de gradient.
// ============================================================

"use strict";

const TinyNN = (() => {
    // ---- Générateur pseudo-aléatoire reproductible ----
    function rng(seed) {
        let a = seed >>> 0;
        const next = () => {
            a = (a + 0x6d2b79f5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        // Loi normale centrée réduite (Box-Muller)
        next.normal = () => {
            let u = 0;
            while (u === 0) u = next();
            return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
        };
        return next;
    }

    const ACTIVATIONS = {
        tanh: { f: (z) => Math.tanh(z), d: (a) => 1 - a * a },
        relu: { f: (z) => (z > 0 ? z : 0), d: (a) => (a > 0 ? 1 : 0) },
        sigmoid: { f: (z) => 1 / (1 + Math.exp(-z)), d: (a) => a * (1 - a) },
        lineaire: { f: (z) => z, d: () => 1 },
    };

    const sigmoid = ACTIVATIONS.sigmoid.f;

    class Network {
        /**
         * @param {number[]} sizes  tailles des couches, ex. [2, 8, 8, 1]
         * @param {{activation?: string, seed?: number}} options
         */
        constructor(sizes, options = {}) {
            this.sizes = sizes.slice();
            this.activation = options.activation || "tanh";
            this.random = rng(options.seed ?? (Math.random() * 2 ** 32) >>> 0);
            this.reset();
        }

        reset() {
            const { sizes } = this;
            this.weights = []; // weights[l][j][i] : neurone i (couche l) -> neurone j (couche l+1)
            this.biases = [];
            this.vW = [];
            this.vB = [];
            for (let l = 0; l < sizes.length - 1; l++) {
                const nIn = sizes[l];
                const nOut = sizes[l + 1];
                // Initialisation de He pour ReLU, de Xavier sinon
                const scale = this.activation === "relu" ? Math.sqrt(2 / nIn) : Math.sqrt(1 / nIn);
                const W = [];
                const V = [];
                for (let j = 0; j < nOut; j++) {
                    const row = new Float64Array(nIn);
                    for (let i = 0; i < nIn; i++) row[i] = this.random.normal() * scale;
                    W.push(row);
                    V.push(new Float64Array(nIn));
                }
                this.weights.push(W);
                this.vW.push(V);
                this.biases.push(new Float64Array(nOut));
                this.vB.push(new Float64Array(nOut));
            }
            this.acts = sizes.map((n) => new Float64Array(n));
            this.deltas = sizes.map((n) => new Float64Array(n));
            this.steps = 0;
        }

        /** Propagation avant. Retourne la probabilité de la classe 1. */
        forward(x) {
            const { weights, biases, acts } = this;
            const act = ACTIVATIONS[this.activation].f;
            const last = weights.length - 1;
            acts[0].set(x);
            for (let l = 0; l <= last; l++) {
                const input = acts[l];
                const output = acts[l + 1];
                const W = weights[l];
                const B = biases[l];
                for (let j = 0; j < output.length; j++) {
                    const row = W[j];
                    let z = B[j];
                    for (let i = 0; i < input.length; i++) z += row[i] * input[i];
                    output[j] = l === last ? sigmoid(z) : act(z);
                }
            }
            return acts[last + 1][0];
        }

        /**
         * Un pas de descente de gradient sur un mini-lot.
         * @returns {number} perte moyenne (entropie croisée) sur le lot
         */
        trainBatch(X, Y, lr, { momentum = 0, l2 = 0 } = {}) {
            const { weights, biases, acts, deltas, vW, vB } = this;
            const dAct = ACTIVATIONS[this.activation].d;
            const L = weights.length;
            const gW = weights.map((W) => W.map((row) => new Float64Array(row.length)));
            const gB = biases.map((b) => new Float64Array(b.length));
            let loss = 0;

            for (let n = 0; n < X.length; n++) {
                const p = this.forward(X[n]);
                const y = Y[n];
                const pc = Math.min(Math.max(p, 1e-9), 1 - 1e-9);
                loss -= y * Math.log(pc) + (1 - y) * Math.log(1 - pc);

                // Sigmoïde + entropie croisée : le gradient en sortie vaut (p - y)
                deltas[L][0] = p - y;
                for (let l = L - 1; l >= 0; l--) {
                    const dOut = deltas[l + 1];
                    const input = acts[l];
                    const W = weights[l];
                    const dIn = deltas[l];
                    if (l > 0) dIn.fill(0);
                    for (let j = 0; j < dOut.length; j++) {
                        const d = dOut[j];
                        if (d === 0) continue;
                        const row = W[j];
                        const gRow = gW[l][j];
                        gB[l][j] += d;
                        for (let i = 0; i < input.length; i++) {
                            gRow[i] += d * input[i];
                            if (l > 0) dIn[i] += d * row[i];
                        }
                    }
                    if (l > 0) for (let i = 0; i < dIn.length; i++) dIn[i] *= dAct(input[i]);
                }
            }

            const inv = 1 / X.length;
            for (let l = 0; l < L; l++) {
                for (let j = 0; j < weights[l].length; j++) {
                    const row = weights[l][j];
                    const gRow = gW[l][j];
                    const vRow = vW[l][j];
                    for (let i = 0; i < row.length; i++) {
                        vRow[i] = momentum * vRow[i] - lr * (gRow[i] * inv + l2 * row[i]);
                        row[i] += vRow[i];
                    }
                    vB[l][j] = momentum * vB[l][j] - lr * gB[l][j] * inv;
                    biases[l][j] += vB[l][j];
                }
            }
            this.steps++;
            return loss * inv;
        }

        /** Perte moyenne et précision sur un jeu de données. */
        evaluate(X, Y) {
            if (X.length === 0) return { loss: 0, accuracy: 0 };
            let loss = 0;
            let correct = 0;
            for (let n = 0; n < X.length; n++) {
                const p = Math.min(Math.max(this.forward(X[n]), 1e-9), 1 - 1e-9);
                loss -= Y[n] * Math.log(p) + (1 - Y[n]) * Math.log(1 - p);
                if (p >= 0.5 === (Y[n] === 1)) correct++;
            }
            return { loss: loss / X.length, accuracy: correct / X.length };
        }

        get parameterCount() {
            let n = 0;
            for (let l = 0; l < this.sizes.length - 1; l++) n += (this.sizes[l] + 1) * this.sizes[l + 1];
            return n;
        }
    }

    // ---- Jeux de données 2D, coordonnées dans [-1, 1] ----
    // Chaque générateur retourne [{x, y, label}] avec label ∈ {0, 1}.
    const datasets = {
        cercles(n, noise, r) {
            const pts = [];
            for (let i = 0; i < n; i++) {
                const label = i % 2;
                const radius = label ? 0.28 * Math.sqrt(r()) : 0.58 + 0.3 * r();
                const a = r() * 2 * Math.PI;
                pts.push({
                    x: radius * Math.cos(a) + r.normal() * noise * 0.3,
                    y: radius * Math.sin(a) + r.normal() * noise * 0.3,
                    label,
                });
            }
            return pts;
        },
        xor(n, noise, r) {
            const pts = [];
            for (let i = 0; i < n; i++) {
                let x = r() * 1.7 - 0.85;
                let y = r() * 1.7 - 0.85;
                x += x > 0 ? 0.06 : -0.06;
                y += y > 0 ? 0.06 : -0.06;
                const label = x * y > 0 ? 1 : 0;
                pts.push({ x: x + r.normal() * noise * 0.3, y: y + r.normal() * noise * 0.3, label });
            }
            return pts;
        },
        nuages(n, noise, r) {
            const pts = [];
            const spread = 0.16 + noise * 0.5;
            for (let i = 0; i < n; i++) {
                const label = i % 2;
                const c = label ? 0.42 : -0.42;
                pts.push({ x: c + r.normal() * spread, y: c + r.normal() * spread, label });
            }
            return pts;
        },
        lunes(n, noise, r) {
            const pts = [];
            for (let i = 0; i < n; i++) {
                const label = i % 2;
                const a = r() * Math.PI;
                // Deux croissants imbriqués, recentrés dans [-1, 1]
                const x = (label ? 1 - Math.cos(a) : Math.cos(a)) * 0.58 - 0.29;
                const y = (label ? 0.5 - Math.sin(a) : Math.sin(a)) * 0.58 - 0.145;
                pts.push({ x: x + r.normal() * noise * 0.25, y: y + r.normal() * noise * 0.25, label });
            }
            return pts;
        },
        spirale(n, noise, r) {
            const pts = [];
            const half = Math.floor(n / 2);
            for (let i = 0; i < n; i++) {
                const label = i % 2;
                const t = (Math.floor(i / 2) / half) * 0.9 + 0.08;
                const a = t * 3.3 * Math.PI + (label ? Math.PI : 0);
                pts.push({
                    x: t * 0.9 * Math.cos(a) + r.normal() * noise * 0.12,
                    y: t * 0.9 * Math.sin(a) + r.normal() * noise * 0.12,
                    label,
                });
            }
            return pts;
        },
    };

    // ---- Caractéristiques d'entrée dérivées de (x, y) ----
    const FEATURES = {
        x: { label: "x₁", f: (x) => x },
        y: { label: "x₂", f: (x, y) => y },
        x2: { label: "x₁²", f: (x) => x * x },
        y2: { label: "x₂²", f: (x, y) => y * y },
        xy: { label: "x₁·x₂", f: (x, y) => x * y },
        sinx: { label: "sin(x₁)", f: (x) => Math.sin(4 * x) },
        siny: { label: "sin(x₂)", f: (x, y) => Math.sin(4 * y) },
    };

    function featurize(x, y, keys) {
        const out = new Float64Array(keys.length);
        for (let i = 0; i < keys.length; i++) out[i] = FEATURES[keys[i]].f(x, y);
        return out;
    }

    function shuffle(array, r) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(r() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Dessine la frontière de décision d'un réseau dans un canvas basse
     * résolution (à agrandir en CSS). Orange = classe 1, bleu = classe 0.
     */
    function paintBoundary(ctx, net, keys, res, { discretize = false } = {}) {
        const img = ctx.createImageData(res, res);
        const d = img.data;
        for (let j = 0; j < res; j++) {
            const y = 1 - (2 * (j + 0.5)) / res;
            for (let i = 0; i < res; i++) {
                const x = (2 * (i + 0.5)) / res - 1;
                let p = net.forward(featurize(x, y, keys));
                if (discretize) p = p >= 0.5 ? 0.85 : 0.15;
                const k = (j * res + i) * 4;
                // Interpolation bleu (#3fa7d6) -> encre (#0a1930) -> orange (#ffab40)
                const t = p * 2 - 1;
                const m = Math.abs(t);
                const [r1, g1, b1] = t > 0 ? [255, 171, 64] : [63, 167, 214];
                d[k] = 10 + (r1 - 10) * m * 0.62;
                d[k + 1] = 25 + (g1 - 25) * m * 0.62;
                d[k + 2] = 48 + (b1 - 48) * m * 0.62;
                d[k + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
    }

    return { Network, datasets, FEATURES, featurize, shuffle, rng, paintBoundary, ACTIVATIONS };
})();

if (typeof module !== "undefined") module.exports = TinyNN;
