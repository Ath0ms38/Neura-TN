"use strict";

// ============ Constants ============
const CW = 1000, CH = 600;
const GRASS_COLOR = [0, 200, 0];
const ROAD_COLOR = [128, 128, 128];
const CAR_W = 13, CAR_H = 23;
const MAX_SPEED = 175, MIN_SPEED = 0, ACCELERATION = 75, TURN_SPEED = 150;
const DRIFT_FACTOR = 0.8, DRIFT_THRESHOLD = 87.5, DRIFT_FRICTION = 0.95;
const RAY_ANGLES = [-67.5, -45, -22.5, 0, 22.5, 45, 67.5];
const RAY_MAX = 200;
const POP_SIZE = 150;
const MAX_FRAMES = 1000;
const DT = 1 / 60;

// ============ Canvas Setup ============
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

// ============ State ============
let mode = "editor"; // "editor" or "simulation"

// -- Track state --
let trackCanvas, trackCtx, trackImageData;
let checkpoints = [];
let startPos = null;
let startAngle = -90;

// -- Editor state --
let editorTool = "road"; // "road", "erase", "start", "checkpoint"
let brushSize = 30;
let painting = false;
let lastMx = -1, lastMy = -1;
let cpTempStart = null; // temporary checkpoint start point

// -- Simulation state --
let population = null;
let cars = [];
let manualCar = null;
let running = false;
let speed = 1;
let generation = 0;
let bestFitnessEver = 0;
let frameCount = 0;
let animFrame = null;
let showRays = true;
let manualMode = false;
let keys = {};

const speciesColors = [
    "#e85d4a", "#5dade2", "#f5c542", "#a78bfa",
    "#4caf50", "#ff9800", "#e91e63", "#00bcd4",
    "#8bc34a", "#ff5722", "#9c27b0", "#3f51b5",
];

// ============================================================
// TRACK EDITOR
// ============================================================

function initTrackCanvas() {
    trackCanvas = document.createElement("canvas");
    trackCanvas.width = CW;
    trackCanvas.height = CH;
    trackCtx = trackCanvas.getContext("2d");
    trackCtx.fillStyle = `rgb(${GRASS_COLOR.join(",")})`;
    trackCtx.fillRect(0, 0, CW, CH);
    updateTrackImageData();
}

function updateTrackImageData() {
    trackImageData = trackCtx.getImageData(0, 0, CW, CH);
}

function drawBrush(x, y, color, size) {
    trackCtx.fillStyle = color;
    trackCtx.beginPath();
    trackCtx.arc(x, y, size, 0, Math.PI * 2);
    trackCtx.fill();
}

function drawBrushLine(x0, y0, x1, y1, color, size) {
    const dx = x1 - x0, dy = y1 - y0;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(1, Math.ceil(dist / (size * 0.3)));
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        drawBrush(x0 + dx * t, y0 + dy * t, color, size);
    }
}

function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CW / rect.width;
    const scaleY = CH / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
    };
}

function renderEditor() {
    // Draw track
    ctx.drawImage(trackCanvas, 0, 0);

    // Draw checkpoints
    for (let i = 0; i < checkpoints.length; i++) {
        const cp = checkpoints[i];
        ctx.strokeStyle = "#ffff00";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cp.start[0], cp.start[1]);
        ctx.lineTo(cp.end[0], cp.end[1]);
        ctx.stroke();

        // Number
        const mx = (cp.start[0] + cp.end[0]) / 2;
        const my = (cp.start[1] + cp.end[1]) / 2;
        ctx.fillStyle = "#fff";
        ctx.font = "bold 16px 'Segoe UI', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(i + 1, mx, my);
    }

    // Draw temporary checkpoint line
    if (cpTempStart) {
        ctx.strokeStyle = "rgba(255, 255, 0, 0.5)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(cpTempStart[0], cpTempStart[1]);
        // Draw to current mouse position (stored in lastMx/lastMy)
        if (lastMx >= 0) {
            ctx.lineTo(lastMx, lastMy);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Dot at start
        ctx.fillStyle = "#ffff00";
        ctx.beginPath();
        ctx.arc(cpTempStart[0], cpTempStart[1], 5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw start position
    if (startPos) {
        ctx.strokeStyle = "#5dade2";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(startPos.x, startPos.y, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#5dade2";
        ctx.font = "12px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("DEPART", startPos.x, startPos.y - 16);
    }

    // Brush cursor (if road/erase mode)
    if ((editorTool === "road" || editorTool === "erase") && lastMx >= 0) {
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(lastMx, lastMy, brushSize, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Status bar
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, CH - 30, CW, 30);
    ctx.fillStyle = "#fff";
    ctx.font = "12px Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const statusParts = [];
    const toolNames = { road: "Route", erase: "Gomme", start: "Depart", checkpoint: "Checkpoint" };
    statusParts.push(`Outil : ${toolNames[editorTool] || editorTool}`);
    if (startPos) statusParts.push("Depart : place");
    else statusParts.push("Depart : non place");
    statusParts.push(`Checkpoints : ${checkpoints.length}`);
    ctx.fillText(statusParts.join("  |  "), 10, CH - 15);
    ctx.textBaseline = "alphabetic";
}

// -- Editor mouse events --
function onEditorMouseDown(e) {
    const { x, y } = getCanvasCoords(e);

    if (e.button === 2) {
        // Right click always erases
        painting = true;
        lastMx = x; lastMy = y;
        drawBrush(x, y, `rgb(${GRASS_COLOR.join(",")})`, brushSize);
        return;
    }

    if (editorTool === "road") {
        painting = true;
        lastMx = x; lastMy = y;
        drawBrush(x, y, `rgb(${ROAD_COLOR.join(",")})`, brushSize);
    } else if (editorTool === "erase") {
        painting = true;
        lastMx = x; lastMy = y;
        drawBrush(x, y, `rgb(${GRASS_COLOR.join(",")})`, brushSize);
    } else if (editorTool === "start") {
        startPos = { x: Math.round(x), y: Math.round(y) };
        renderEditor();
    } else if (editorTool === "checkpoint") {
        if (!cpTempStart) {
            cpTempStart = [Math.round(x), Math.round(y)];
        } else {
            checkpoints.push({
                start: cpTempStart,
                end: [Math.round(x), Math.round(y)],
                order: checkpoints.length,
            });
            cpTempStart = null;
            renderEditor();
        }
    }
}

function onEditorMouseMove(e) {
    const { x, y } = getCanvasCoords(e);
    lastMx = x; lastMy = y;

    if (painting) {
        const isErase = e.buttons === 2 || editorTool === "erase";
        const color = isErase ? `rgb(${GRASS_COLOR.join(",")})` : `rgb(${ROAD_COLOR.join(",")})`;
        drawBrushLine(lastMx, lastMy, x, y, color, brushSize);
        lastMx = x; lastMy = y;
    }

    renderEditor();
}

function onEditorMouseUp(e) {
    if (painting) {
        painting = false;
        updateTrackImageData();
    }
}

function attachEditorEvents() {
    canvas.addEventListener("mousedown", onEditorMouseDown);
    canvas.addEventListener("mousemove", onEditorMouseMove);
    canvas.addEventListener("mouseup", onEditorMouseUp);
    canvas.addEventListener("mouseleave", onEditorMouseUp);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
}

function detachEditorEvents() {
    canvas.removeEventListener("mousedown", onEditorMouseDown);
    canvas.removeEventListener("mousemove", onEditorMouseMove);
    canvas.removeEventListener("mouseup", onEditorMouseUp);
    canvas.removeEventListener("mouseleave", onEditorMouseUp);
}

// ============================================================
// SIMULATION
// ============================================================

function isGrass(x, y) {
    if (x < 0 || x >= CW || y < 0 || y >= CH) return true;
    const ix = Math.floor(x), iy = Math.floor(y);
    const idx = (iy * CW + ix) * 4;
    const r = trackImageData.data[idx];
    const g = trackImageData.data[idx + 1];
    const b = trackImageData.data[idx + 2];
    return r === GRASS_COLOR[0] && g === GRASS_COLOR[1] && b === GRASS_COLOR[2];
}

function castRays(x, y, angle) {
    const distances = [];
    const endpoints = [];
    for (const rayAngle of RAY_ANGLES) {
        const totalAngle = (angle + rayAngle) * Math.PI / 180;
        const dx = -Math.sin(totalAngle);
        const dy = -Math.cos(totalAngle);
        let dist = 0;
        while (dist < RAY_MAX) {
            const rx = x + dx * dist;
            const ry = y + dy * dist;
            if (isGrass(rx, ry)) break;
            dist += 2;
        }
        distances.push(dist);
        endpoints.push({ x: x + dx * dist, y: y + dy * dist });
    }
    return { distances, endpoints };
}

function ccw(ax, ay, bx, by, cx, cy) {
    return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
}

function lineIntersect(a1x, a1y, a2x, a2y, b1x, b1y, b2x, b2y) {
    return (ccw(a1x, a1y, b1x, b1y, b2x, b2y) !== ccw(a2x, a2y, b1x, b1y, b2x, b2y)) &&
           (ccw(a1x, a1y, a2x, a2y, b1x, b1y) !== ccw(a1x, a1y, a2x, a2y, b2x, b2y));
}

// ---- Car Class ----
class Car {
    constructor(genome) {
        this.x = startPos.x;
        this.y = startPos.y;
        this.angle = startAngle;
        this.speed = 0;
        this.lateralVel = 0;
        this.alive = true;
        this.genome = genome;
        this.checkpoint = 0;
        this.laps = 0;
        this.prevX = this.x;
        this.prevY = this.y;
        this.stuckTimer = 0;
        this.distanceTraveled = 0;
        this.rays = null;
    }

    update(accel, turnDir) {
        if (!this.alive) return;
        if (accel) this.speed += ACCELERATION * DT;
        else { this.speed -= ACCELERATION * DT; }
        this.speed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, this.speed));

        if (Math.abs(this.speed) > 0.1) {
            if (turnDir) this.angle -= TURN_SPEED * DT;
            else this.angle += TURN_SPEED * DT;
        }

        if (Math.abs(this.speed) > DRIFT_THRESHOLD && Math.abs(this.lateralVel) < 20) {
            this.lateralVel += (TURN_SPEED * DT) * DRIFT_FACTOR * (turnDir ? -1 : 1);
        }
        this.lateralVel *= DRIFT_FRICTION;

        const rad = this.angle * Math.PI / 180;
        const vx = -this.speed * Math.sin(rad);
        const vy = -this.speed * Math.cos(rad);
        const dx = this.lateralVel * Math.cos(rad);
        const dy = this.lateralVel * Math.sin(rad);

        this.prevX = this.x;
        this.prevY = this.y;
        this.x += (vx + dx) * DT;
        this.y += (vy + dy) * DT;

        const ddx = this.x - this.prevX;
        const ddy = this.y - this.prevY;
        this.distanceTraveled += Math.sqrt(ddx * ddx + ddy * ddy);

        if (this.checkCollision()) this.alive = false;
        this.checkCheckpoints();

        const moved = Math.sqrt(ddx * ddx + ddy * ddy);
        if (moved < 0.5) { this.stuckTimer++; if (this.stuckTimer > 120) this.alive = false; }
        else this.stuckTimer = 0;
    }

    checkCollision() {
        const rad = this.angle * Math.PI / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        const hw = CAR_W / 2, hh = CAR_H / 2;
        for (const [lx, ly] of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]) {
            const wx = this.x + lx * cos - ly * sin;
            const wy = this.y + lx * sin + ly * cos;
            if (isGrass(wx, wy)) return true;
        }
        return false;
    }

    checkCheckpoints() {
        if (checkpoints.length === 0) return;
        if (this.checkpoint >= checkpoints.length) {
            this.checkpoint = 0;
            this.laps++;
        }
        const cp = checkpoints[this.checkpoint];
        if (lineIntersect(
            this.prevX, this.prevY, this.x, this.y,
            cp.start[0], cp.start[1], cp.end[0], cp.end[1]
        )) {
            this.checkpoint++;
        }
    }

    getFitness() {
        return (this.laps * checkpoints.length + this.checkpoint) * 100 + this.distanceTraveled * 0.01;
    }

    draw(ctx, color, isShowRays) {
        if (!this.alive) return;
        const rad = this.angle * Math.PI / 180;

        if (isShowRays && this.rays) {
            ctx.lineWidth = 1;
            for (const ep of this.rays.endpoints) {
                ctx.strokeStyle = "rgba(76, 175, 80, 0.5)";
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(ep.x, ep.y);
                ctx.stroke();
                ctx.fillStyle = "#e85d4a";
                ctx.beginPath();
                ctx.arc(ep.x, ep.y, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(-rad + Math.PI);
        ctx.fillStyle = color;
        ctx.fillRect(-CAR_W / 2, -CAR_H / 2, CAR_W, CAR_H);
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.fillRect(-CAR_W / 2 + 2, -CAR_H / 2, CAR_W - 4, 5);
        ctx.restore();
    }
}

// ---- Simulation Logic ----
function initGeneration() {
    if (!population && !manualMode) {
        population = new NEAT.Population({
            populationSize: POP_SIZE,
            numInputs: 9,
            numOutputs: 2,
            compatibilityThreshold: 2.0,
            elitism: 3,
            survivalThreshold: 0.2,
            maxStagnation: 6,
            speciesElitism: 2,
            mutationConfig: {
                weightMutateRate: 0.8,
                addNodeRate: 0.2,
                addConnRate: 0.5,
                toggleRate: 0.01,
            },
        });
    }
    if (manualMode) {
        manualCar = new Car(null);
        cars = [manualCar];
    } else {
        cars = population.genomes.map(g => new Car(g));
    }
    frameCount = 0;
}

function gameTick() {
    frameCount++;
    if (frameCount > MAX_FRAMES && !manualMode) return true;

    const aliveCars = cars.filter(c => c.alive);
    if (aliveCars.length === 0) return true;

    for (const car of aliveCars) {
        car.rays = castRays(car.x, car.y, car.angle);

        if (manualMode && car === manualCar) {
            const accel = keys["ArrowUp"] || false;
            const brake = keys["ArrowDown"] || false;
            const turnR = keys["ArrowRight"] || false;
            const turnL = keys["ArrowLeft"] || false;

            if (accel) car.speed += ACCELERATION * DT;
            else if (brake) { car.speed -= ACCELERATION * DT; car.speed = Math.max(MIN_SPEED, car.speed); }

            if (Math.abs(car.speed) > 0.1) {
                if (turnR) car.angle -= TURN_SPEED * DT;
                if (turnL) car.angle += TURN_SPEED * DT;
            }

            const rad = car.angle * Math.PI / 180;
            car.prevX = car.x; car.prevY = car.y;
            car.x += (-car.speed * Math.sin(rad)) * DT;
            car.y += (-car.speed * Math.cos(rad)) * DT;
            car.speed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, car.speed));

            if (car.checkCollision()) {
                car.x = startPos.x; car.y = startPos.y;
                car.angle = startAngle; car.speed = 0;
                car.checkpoint = 0; car.laps = 0;
            }
            car.checkCheckpoints();
        } else {
            const inputs = [
                ...car.rays.distances.map(d => d / RAY_MAX),
                car.speed / MAX_SPEED,
                car.angle / 360,
            ];
            const output = car.genome.activate(inputs);
            car.update(output[0] > 0.5, output[1] > 0.5);
            car.genome.fitness = car.getFitness();
        }
    }
    return false;
}

function renderSimulation() {
    ctx.drawImage(trackCanvas, 0, 0);

    // Checkpoints
    ctx.lineWidth = 2;
    for (let i = 0; i < checkpoints.length; i++) {
        const cp = checkpoints[i];
        ctx.strokeStyle = i === 0 ? "#5dade2" : "rgba(255, 255, 0, 0.3)";
        ctx.beginPath();
        ctx.moveTo(cp.start[0], cp.start[1]);
        ctx.lineTo(cp.end[0], cp.end[1]);
        ctx.stroke();
    }

    // Cars
    let bestCar = null, bestFit = -1;
    for (const car of cars) {
        if (car.alive) {
            const f = car.getFitness();
            if (f > bestFit) { bestFit = f; bestCar = car; }
        }
    }

    if (manualMode && manualCar) {
        manualCar.draw(ctx, "#5dade2", showRays);
    } else {
        for (const car of cars) {
            if (!car.alive) continue;
            const color = speciesColors[car.genome.species % speciesColors.length];
            car.draw(ctx, color, car === bestCar && showRays);
        }
        if (bestCar) {
            ctx.save();
            const rad = bestCar.angle * Math.PI / 180;
            ctx.translate(bestCar.x, bestCar.y);
            ctx.rotate(-rad + Math.PI);
            ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
            ctx.strokeRect(-CAR_W / 2 - 2, -CAR_H / 2 - 2, CAR_W + 4, CAR_H + 4);
            ctx.restore();
        }
    }

    // HUD
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(5, 5, 160, 42);
    ctx.fillStyle = "#fff";
    ctx.font = "12px Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Gen ${generation} | Frame ${frameCount}/${MAX_FRAMES}`, 10, 22);
    ctx.fillText(`En vie : ${cars.filter(c => c.alive).length}/${cars.length}`, 10, 40);
}

// ---- NN Visualization ----
function renderNN() {
    const svg = document.getElementById("nn-svg");
    svg.innerHTML = "";

    let genome = null;
    if (!manualMode) {
        const bestCar = cars.filter(c => c.alive).sort((a, b) => b.getFitness() - a.getFitness())[0];
        genome = bestCar ? bestCar.genome : (population?.bestGenome || null);
    }
    if (!genome) return;

    const info = genome.getNetworkInfo();
    const W = 300, H = 220;
    const inputNodes = info.nodes.filter(n => n.type === "input" || n.type === "bias");
    const hiddenNodes = info.nodes.filter(n => n.type === "hidden");
    const outputNodes = info.nodes.filter(n => n.type === "output");
    const layers = [inputNodes, ...(hiddenNodes.length > 0 ? [hiddenNodes] : []), outputNodes];
    const layerSpacing = W / (layers.length + 1);
    const nodePositions = new Map();
    const inputLabels = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "Spd", "Ang", "Bias"];
    const outputLabels = ["Accel", "Dir"];

    for (let li = 0; li < layers.length; li++) {
        const layer = layers[li];
        const cx = layerSpacing * (li + 1);
        const nodeSpacing = Math.min(18, (H - 20) / layer.length);
        const startY = H / 2 - (layer.length - 1) * nodeSpacing / 2;
        for (let ni = 0; ni < layer.length; ni++) {
            nodePositions.set(layer[ni].id, { x: cx, y: startY + ni * nodeSpacing });
        }
    }

    for (const conn of info.connections) {
        const from = nodePositions.get(conn.from);
        const to = nodePositions.get(conn.to);
        if (!from || !to) continue;
        const w = Math.abs(conn.weight);
        const color = conn.weight > 0 ? "#4caf50" : "#e85d4a";
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", from.x); line.setAttribute("y1", from.y);
        line.setAttribute("x2", to.x); line.setAttribute("y2", to.y);
        line.setAttribute("stroke", color);
        line.setAttribute("stroke-width", Math.min(3, 0.5 + w * 0.5));
        line.setAttribute("opacity", Math.min(0.9, 0.2 + w * 0.15));
        svg.appendChild(line);
    }

    for (const [id, pos] of nodePositions) {
        const node = info.nodes.find(n => n.id === id);
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", pos.x); circle.setAttribute("cy", pos.y);
        circle.setAttribute("r", 6);
        const fill = node.type === "input" || node.type === "bias" ? "#6c63ff" :
                     node.type === "output" ? "#e85d4a" : "#f5c542";
        circle.setAttribute("fill", fill); circle.setAttribute("class", "nn-node");
        svg.appendChild(circle);

        const idx = inputNodes.findIndex(n => n.id === id);
        if (idx >= 0 && inputLabels[idx]) {
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", pos.x - 20); text.setAttribute("y", pos.y + 3);
            text.setAttribute("class", "nn-label"); text.setAttribute("text-anchor", "end");
            text.textContent = inputLabels[idx]; svg.appendChild(text);
        }
        const oIdx = outputNodes.findIndex(n => n.id === id);
        if (oIdx >= 0 && outputLabels[oIdx]) {
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", pos.x + 14); text.setAttribute("y", pos.y + 3);
            text.setAttribute("class", "nn-label"); text.setAttribute("text-anchor", "start");
            text.textContent = outputLabels[oIdx]; svg.appendChild(text);
        }
    }
}

function updateStats() {
    document.getElementById("stat-gen").textContent = generation;
    document.getElementById("stat-alive").textContent = cars.filter(c => c.alive).length;
    document.getElementById("stat-frame").textContent = `${frameCount}/${MAX_FRAMES}`;
    const maxCp = Math.max(...cars.map(c => c.laps * checkpoints.length + c.checkpoint), 0);
    document.getElementById("stat-cp").textContent = maxCp;
    const currentBest = Math.max(...cars.map(c => c.getFitness()), 0);
    bestFitnessEver = Math.max(bestFitnessEver, currentBest);
    document.getElementById("stat-best").textContent = bestFitnessEver.toFixed(1);
    document.getElementById("stat-species").textContent = population ? population.species.length : 0;
}

// ---- Main Loop ----
function gameLoop() {
    if (!running || mode !== "simulation") return;
    for (let s = 0; s < speed; s++) {
        const genOver = gameTick();
        if (genOver && !manualMode) {
            population.evolve();
            generation = population.generation;
            initGeneration();
            break;
        }
    }
    renderSimulation();
    if (frameCount % 5 === 0) { updateStats(); renderNN(); }
    animFrame = requestAnimationFrame(gameLoop);
}

function startSim() {
    if (running) return;
    running = true;
    animFrame = requestAnimationFrame(gameLoop);
    document.getElementById("btn-start").textContent = "Pause";
}

function pauseSim() {
    running = false;
    if (animFrame) cancelAnimationFrame(animFrame);
    document.getElementById("btn-start").textContent = "Demarrer";
}

// ============================================================
// MODE SWITCHING
// ============================================================

function enterEditor() {
    pauseSim();
    mode = "editor";
    population = null;
    generation = 0;
    bestFitnessEver = 0;
    cars = [];

    document.getElementById("editor-controls").style.display = "flex";
    document.getElementById("sim-controls").style.display = "none";
    document.getElementById("editor-help").style.display = "";
    document.getElementById("sim-panels").style.display = "none";
    canvas.style.cursor = "crosshair";

    attachEditorEvents();
    renderEditor();
}

function enterSimulation() {
    if (!startPos) {
        alert("Veuillez definir une position de depart.");
        return;
    }
    if (checkpoints.length < 2) {
        alert("Veuillez ajouter au moins 2 checkpoints.");
        return;
    }

    detachEditorEvents();
    mode = "simulation";
    updateTrackImageData();

    document.getElementById("editor-controls").style.display = "none";
    document.getElementById("sim-controls").style.display = "flex";
    document.getElementById("editor-help").style.display = "none";
    document.getElementById("sim-panels").style.display = "";
    canvas.style.cursor = "default";

    // Determine start angle from first checkpoint direction
    const cp0 = checkpoints[0];
    const cpMidX = (cp0.start[0] + cp0.end[0]) / 2;
    const cpMidY = (cp0.start[1] + cp0.end[1]) / 2;
    const dxToCP = cpMidX - startPos.x;
    const dyToCP = cpMidY - startPos.y;
    startAngle = -Math.atan2(dxToCP, dyToCP) * 180 / Math.PI;

    initGeneration();
    renderSimulation();
    updateStats();
    startSim();
}

// ============================================================
// EVENT LISTENERS
// ============================================================

// Editor tool buttons
document.querySelectorAll(".tool-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const toolMap = {
            "btn-tool-road": "road",
            "btn-tool-erase": "erase",
            "btn-tool-start": "start",
            "btn-tool-checkpoint": "checkpoint",
        };
        if (toolMap[btn.id]) {
            editorTool = toolMap[btn.id];
            cpTempStart = null;
            document.querySelectorAll(".tool-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
        }
    });
});

document.getElementById("btn-undo-cp").addEventListener("click", () => {
    if (cpTempStart) { cpTempStart = null; }
    else if (checkpoints.length > 0) { checkpoints.pop(); }
    renderEditor();
});

document.getElementById("brush-size").addEventListener("input", (e) => {
    brushSize = parseInt(e.target.value);
});

document.getElementById("btn-launch").addEventListener("click", enterSimulation);

// Simulation controls
document.getElementById("btn-start").addEventListener("click", () => {
    running ? pauseSim() : startSim();
});

document.getElementById("btn-edit-track").addEventListener("click", enterEditor);

document.getElementById("chk-rays").addEventListener("change", (e) => { showRays = e.target.checked; });
document.getElementById("chk-manual").addEventListener("change", (e) => {
    manualMode = e.target.checked;
    pauseSim();
    population = null;
    generation = 0;
    bestFitnessEver = 0;
    initGeneration();
    renderSimulation();
    updateStats();
    startSim();
});

document.querySelectorAll(".speed-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        speed = parseInt(btn.dataset.speed);
        document.querySelectorAll(".speed-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
    });
});

window.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
});
window.addEventListener("keyup", (e) => { keys[e.key] = false; });

// ============================================================
// INIT
// ============================================================

initTrackCanvas();
attachEditorEvents();
renderEditor();
