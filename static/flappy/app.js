"use strict";

// ============ Constants ============
const SCREEN_W = 500, SCREEN_H = 800;
const BASE_Y = 730;
let GRAVITY = 3;
let JUMP_STRENGTH = -10.5;
let TERMINAL_VEL = 16;
let PIPE_GAP = 200;
let PIPE_SPEED = 5;
const PIPE_SPAWN_X = 600;
const BIRD_START_X = 230, BIRD_START_Y = 350;
let POP_SIZE = 100;
const MAX_GENS = 50;
const TARGET_FPS = 30;

// ============ Asset Loading ============
const assets = {};
let assetsLoaded = 0;
const assetList = [
    ["bg", "/static/flappy/imgs/background.png"],
    ["birdUp", "/static/flappy/imgs/bird_wing_up.png"],
    ["birdDown", "/static/flappy/imgs/bird_wing_down.png"],
    ["pipeBody", "/static/flappy/imgs/pipe_body.png"],
    ["pipeEnd", "/static/flappy/imgs/pipe_end.png"],
    ["ground", "/static/flappy/imgs/ground.png"],
];

function loadAssets() {
    return new Promise((resolve) => {
        if (assetList.length === 0) return resolve();
        for (const [name, src] of assetList) {
            const img = new Image();
            img.onload = () => {
                assets[name] = img;
                assetsLoaded++;
                if (assetsLoaded === assetList.length) resolve();
            };
            img.onerror = () => {
                assets[name] = null;
                assetsLoaded++;
                if (assetsLoaded === assetList.length) resolve();
            };
            img.src = src;
        }
    });
}

// ============ Canvas Setup ============
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

// ============ Game State ============
let population = null;
let birds = [];
let pipes = [];
let baseX1 = 0, baseX2 = 0;
let score = 0;
let running = false;
let speed = 1;
let generation = 0;
let bestFitnessEver = 0;
let animFrame = null;
let frameCount = 0;

// ============ Bird Class ============
class Bird {
    constructor(genome) {
        this.x = BIRD_START_X;
        this.y = BIRD_START_Y;
        this.vel = 0;
        this.tickCount = 0;
        this.tilt = 0;
        this.alive = true;
        this.genome = genome;
        this.fitness = 0;
        this.wingUp = true;
        this.animTimer = 0;
    }

    jump() {
        this.vel = JUMP_STRENGTH;
        this.tickCount = 0;
    }

    move() {
        this.tickCount++;
        let disp = this.vel * this.tickCount + 0.5 * GRAVITY * this.tickCount * this.tickCount;
        if (disp > TERMINAL_VEL) disp = TERMINAL_VEL;
        if (disp < 0) disp -= 2;
        this.y += disp;

        // Tilt
        if (disp < 0 || this.y < this.getHeight() + 50) {
            this.tilt = 25;
        } else {
            this.tilt = Math.max(this.tilt - 20, -90);
        }

        // Animation
        this.animTimer++;
        if (this.animTimer >= 5) {
            this.wingUp = !this.wingUp;
            this.animTimer = 0;
        }
    }

    getHeight() {
        const img = this.getCurrentImage();
        return img ? img.height : 24;
    }

    getWidth() {
        const img = this.getCurrentImage();
        return img ? img.width : 34;
    }

    getCurrentImage() {
        if (this.tilt <= -80) return assets.birdDown;
        return this.wingUp ? assets.birdUp : assets.birdDown;
    }

    draw(ctx, highlight) {
        const img = this.getCurrentImage();
        if (!img) {
            ctx.fillStyle = highlight ? "#f5c542" : "rgba(245,197,66,0.3)";
            ctx.beginPath();
            ctx.arc(this.x + 17, this.y + 12, 12, 0, Math.PI * 2);
            ctx.fill();
            return;
        }
        ctx.save();
        ctx.translate(this.x + img.width / 2, this.y + img.height / 2);
        ctx.rotate(-this.tilt * Math.PI / 180);
        ctx.globalAlpha = highlight ? 1.0 : 0.25;
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();
        ctx.globalAlpha = 1.0;
    }
}

// ============ Pipe Class ============
class Pipe {
    constructor() {
        this.x = PIPE_SPAWN_X;
        this.height = 50 + Math.random() * (SCREEN_H - PIPE_GAP - 100);
        this.bottom = this.height + PIPE_GAP;
        this.passed = false;
    }

    move() { this.x -= PIPE_SPEED; }

    isOffScreen() {
        const w = assets.pipeEnd ? assets.pipeEnd.width : 52;
        return this.x + w < 0;
    }

    draw(ctx) {
        const pBody = assets.pipeBody;
        const pEnd = assets.pipeEnd;

        if (!pBody || !pEnd) {
            // Fallback: draw rectangles
            ctx.fillStyle = "#2ecc71";
            ctx.fillRect(this.x, 0, 52, this.height);
            ctx.fillRect(this.x, this.bottom, 52, SCREEN_H - this.bottom);
            ctx.fillStyle = "#27ae60";
            ctx.fillRect(this.x - 3, this.height - 26, 58, 26);
            ctx.fillRect(this.x - 3, this.bottom, 58, 26);
            return;
        }

        const pw = pEnd.width;
        const eh = pEnd.height;

        // Top pipe (drawn upside down)
        const topPipeH = this.height;
        // Draw pipe body tiles
        for (let y = 0; y < topPipeH - eh; y += pBody.height) {
            const drawH = Math.min(pBody.height, topPipeH - eh - y);
            ctx.drawImage(pBody, 0, 0, pBody.width, drawH, this.x, y, pw, drawH);
        }
        // Draw pipe end (flipped)
        ctx.save();
        ctx.translate(this.x + pw / 2, topPipeH - eh / 2);
        ctx.scale(1, -1);
        ctx.drawImage(pEnd, -pw / 2, -eh / 2);
        ctx.restore();

        // Bottom pipe
        const botStart = this.bottom;
        // Draw pipe end
        ctx.drawImage(pEnd, this.x, botStart);
        // Draw pipe body tiles
        for (let y = botStart + eh; y < SCREEN_H; y += pBody.height) {
            const drawH = Math.min(pBody.height, SCREEN_H - y);
            ctx.drawImage(pBody, 0, 0, pBody.width, drawH, this.x, y, pw, drawH);
        }
    }

    collidesWith(bird) {
        const bw = bird.getWidth();
        const bh = bird.getHeight();
        const pw = assets.pipeEnd ? assets.pipeEnd.width : 52;

        // Simple AABB collision
        if (bird.x + bw > this.x && bird.x < this.x + pw) {
            if (bird.y < this.height || bird.y + bh > this.bottom) {
                return true;
            }
        }
        return false;
    }
}

// ============ Parameter Reading ============
function readGameParams() {
    const el = (id, def) => {
        const e = document.getElementById(id);
        return e ? parseFloat(e.value) : def;
    };
    GRAVITY = el("param-gravity", 3);
    JUMP_STRENGTH = el("param-jump-strength", -10.5);
    TERMINAL_VEL = el("param-terminal-vel", 16);
    PIPE_GAP = el("param-pipe-gap", 200);
    PIPE_SPEED = el("param-pipe-speed", 5);
    POP_SIZE = Math.round(el("param-pop-size", 100));
}

// ============ Game Logic ============
function initGeneration() {
    if (!population) {
        readGameParams();
        const el = (id, def) => {
            const e = document.getElementById(id);
            return e ? parseFloat(e.value) : def;
        };
        population = new NEAT.Population({
            populationSize: POP_SIZE,
            numInputs: 6,
            numOutputs: 1,
            compatibilityThreshold: el("param-compat-threshold", 1.5),
            elitism: el("param-elitism", 2),
            survivalThreshold: el("param-survival-threshold", 0.2),
            maxStagnation: el("param-max-stagnation", 8),
            speciesElitism: 3,
            mutationConfig: {
                weightMutateRate: el("param-weight-mutate", 0.8),
                addNodeRate: el("param-add-node", 0.35),
                addConnRate: el("param-add-conn", 0.6),
                toggleRate: el("param-toggle-rate", 0.02),
            },
        });
    }

    birds = population.genomes.map(g => new Bird(g));
    pipes = [new Pipe()];
    score = 0;
    frameCount = 0;
    baseX2 = assets.ground ? assets.ground.width : SCREEN_W;
    baseX1 = 0;
}

function getNextPipeIndex() {
    for (let i = 0; i < pipes.length; i++) {
        const pw = assets.pipeEnd ? assets.pipeEnd.width : 52;
        if (pipes[i].x + pw > birds[0]?.x) return i;
    }
    return 0;
}

function gameTick() {
    frameCount++;

    const aliveBirds = birds.filter(b => b.alive);
    if (aliveBirds.length === 0) return true; // generation over

    const pipeIdx = getNextPipeIndex();
    const pipe = pipes[pipeIdx] || pipes[0];

    // Move birds
    for (const bird of aliveBirds) {
        bird.move();
        bird.fitness += 0.1;

        // Neural network decision
        const midGap = pipe.height + PIPE_GAP / 2;
        const inputs = [
            pipe.x / SCREEN_W,
            pipe.height / SCREEN_H,
            pipe.bottom / SCREEN_H,
            (bird.y - midGap) / SCREEN_H,
            (bird.x - pipe.x) / SCREEN_W,
            bird.y / SCREEN_H,
        ];

        const output = bird.genome.activate(inputs);
        if (output[0] > 0.5) bird.jump();

        // Check death conditions
        if (bird.y + bird.getHeight() >= BASE_Y || bird.y < 0) {
            bird.alive = false;
            bird.genome.fitness = bird.fitness - 1;
        }
    }

    // Move pipes
    for (const pipe of pipes) pipe.move();

    // Check pipe collisions
    for (const pipe of pipes) {
        for (const bird of aliveBirds) {
            if (!bird.alive) continue;
            if (pipe.collidesWith(bird)) {
                bird.alive = false;
                bird.genome.fitness = bird.fitness - 1;
            }
        }

        // Check if pipe passed
        if (!pipe.passed) {
            const pw = assets.pipeEnd ? assets.pipeEnd.width : 52;
            if (aliveBirds.length > 0 && aliveBirds[0].x > pipe.x + pw) {
                pipe.passed = true;
                score++;
                for (const bird of birds.filter(b => b.alive)) {
                    bird.fitness += 5;
                }
            }
        }
    }

    // Remove off-screen pipes, add new ones
    if (pipes.length > 0 && pipes[0].isOffScreen()) pipes.shift();
    const lastPipe = pipes[pipes.length - 1];
    if (lastPipe && lastPipe.x < SCREEN_W - 200) {
        pipes.push(new Pipe());
    }

    // Scroll base
    baseX1 -= PIPE_SPEED;
    baseX2 -= PIPE_SPEED;
    const gw = assets.ground ? assets.ground.width : SCREEN_W;
    if (baseX1 + gw < 0) baseX1 = baseX2 + gw;
    if (baseX2 + gw < 0) baseX2 = baseX1 + gw;

    // Set final fitness for alive birds
    for (const bird of aliveBirds) {
        if (bird.alive) bird.genome.fitness = bird.fitness;
    }

    // Stop if score is high enough
    if (score >= 30) return true;

    return false;
}

// ============ Rendering ============
function render() {
    // Background
    if (assets.bg) {
        ctx.drawImage(assets.bg, 0, 0, SCREEN_W, SCREEN_H);
    } else {
        ctx.fillStyle = "#70c5ce";
        ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    }

    // Pipes
    for (const pipe of pipes) pipe.draw(ctx);

    // Base
    if (assets.ground) {
        ctx.drawImage(assets.ground, baseX1, BASE_Y);
        ctx.drawImage(assets.ground, baseX2, BASE_Y);
    } else {
        ctx.fillStyle = "#ded895";
        ctx.fillRect(0, BASE_Y, SCREEN_W, SCREEN_H - BASE_Y);
    }

    // Birds
    const bestBird = getBestAliveBird();
    for (const bird of birds) {
        if (!bird.alive) continue;
        bird.draw(ctx, bird === bestBird);
    }

    // Score
    ctx.fillStyle = "#fff";
    ctx.font = "bold 48px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(score, SCREEN_W / 2, 70);
    ctx.textAlign = "start";

    // Generation label
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "14px Arial, sans-serif";
    ctx.fillText(`Gen ${generation}`, 10, 25);
    ctx.fillText(`En vie : ${birds.filter(b => b.alive).length}`, 10, 45);
}

function getBestAliveBird() {
    let best = null;
    for (const b of birds) {
        if (b.alive && (!best || b.fitness > best.fitness)) best = b;
    }
    return best;
}

// ============ NN Visualization ============
function renderNN() {
    const svg = document.getElementById("nn-svg");
    svg.innerHTML = "";

    const best = getBestAliveBird();
    const genome = best ? best.genome : (population?.bestGenome || null);
    if (!genome) return;

    const info = genome.getNetworkInfo();
    const W = 300, H = 200;

    // Categorize nodes
    const inputNodes = info.nodes.filter(n => n.type === "input" || n.type === "bias");
    const hiddenNodes = info.nodes.filter(n => n.type === "hidden");
    const outputNodes = info.nodes.filter(n => n.type === "output");

    const layers = [inputNodes, ...( hiddenNodes.length > 0 ? [hiddenNodes] : []), outputNodes];
    const numLayers = layers.length;
    const layerSpacing = W / (numLayers + 1);

    const nodePositions = new Map();

    const inputLabels = ["PipeX", "TopY", "BotY", "Ydiff", "Xdiff", "BirdY", "Bias"];

    for (let li = 0; li < layers.length; li++) {
        const layer = layers[li];
        const cx = layerSpacing * (li + 1);
        const nodeSpacing = Math.min(22, (H - 30) / layer.length);
        const startY = H / 2 - (layer.length - 1) * nodeSpacing / 2;

        for (let ni = 0; ni < layer.length; ni++) {
            const node = layer[ni];
            const y = startY + ni * nodeSpacing;
            nodePositions.set(node.id, { x: cx, y });
        }
    }

    // Draw connections
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

    // Draw nodes
    for (const [id, pos] of nodePositions) {
        const node = info.nodes.find(n => n.id === id);
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", pos.x);
        circle.setAttribute("cy", pos.y);
        circle.setAttribute("r", 7);
        const fill = node.type === "input" || node.type === "bias" ? "#6c63ff" :
                     node.type === "output" ? "#4caf50" : "#f5c542";
        circle.setAttribute("fill", fill);
        circle.setAttribute("class", "nn-node");
        svg.appendChild(circle);

        // Label for input nodes
        if ((node.type === "input" || node.type === "bias") && inputLabels[id]) {
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", pos.x - 30);
            text.setAttribute("y", pos.y + 3);
            text.setAttribute("class", "nn-label");
            text.setAttribute("text-anchor", "end");
            text.textContent = inputLabels[id];
            svg.appendChild(text);
        }

        if (node.type === "output") {
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", pos.x + 15);
            text.setAttribute("y", pos.y + 3);
            text.setAttribute("class", "nn-label");
            text.setAttribute("text-anchor", "start");
            text.textContent = "Sauter";
            svg.appendChild(text);
        }
    }
}

// ============ Stats Update ============
function updateStats() {
    document.getElementById("stat-gen").textContent = generation;
    document.getElementById("stat-alive").textContent = birds.filter(b => b.alive).length;
    document.getElementById("stat-score").textContent = score;

    const currentBest = Math.max(...birds.map(b => b.fitness), 0);
    bestFitnessEver = Math.max(bestFitnessEver, currentBest);
    document.getElementById("stat-best").textContent = bestFitnessEver.toFixed(1);
    document.getElementById("stat-species").textContent = population ? population.species.length : 0;
}

// ============ Main Loop ============
let lastTime = 0;
let accumulator = 0;
const TICK_MS = 1000 / TARGET_FPS;

function gameLoop(timestamp) {
    if (!running) return;

    if (lastTime === 0) lastTime = timestamp;
    const delta = timestamp - lastTime;
    lastTime = timestamp;
    accumulator += delta;

    const ticksPerFrame = speed;
    let ticked = false;

    for (let s = 0; s < ticksPerFrame; s++) {
        const genOver = gameTick();
        ticked = true;
        if (genOver) {
            // Evolve
            population.evolve();
            generation = population.generation;
            initGeneration();
            break;
        }
    }

    render();
    if (ticked && frameCount % 3 === 0) {
        updateStats();
        renderNN();
    }

    animFrame = requestAnimationFrame(gameLoop);
}

function start() {
    if (running) return;
    running = true;
    lastTime = 0;
    accumulator = 0;
    animFrame = requestAnimationFrame(gameLoop);
    document.getElementById("btn-start").textContent = "Pause";
}

function pause() {
    running = false;
    if (animFrame) cancelAnimationFrame(animFrame);
    document.getElementById("btn-start").textContent = "Demarrer";
}

function reset() {
    pause();
    population = null;
    generation = 0;
    bestFitnessEver = 0;
    initGeneration();
    render();
    updateStats();
    renderNN();
}

// ============ Event Listeners ============
document.getElementById("btn-start").addEventListener("click", () => {
    running ? pause() : start();
});

document.getElementById("btn-reset").addEventListener("click", reset);

document.querySelectorAll(".speed-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        speed = parseInt(btn.dataset.speed);
        document.querySelectorAll(".speed-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
    });
});

// ============ Init ============
loadAssets().then(() => {
    initGeneration();
    render();
    updateStats();
});
