// ============ State ============
let currentModel = "nn";
let currentImage = null;       // normalized 28x28 array (from MNIST sample)
let isDrawing = false;
let predictTimer = null;
let pendingPredict = false;

const canvas = document.getElementById("draw-canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const svg = document.getElementById("network-svg");
const predDisplay = document.getElementById("prediction-display");
const trueLabel = document.getElementById("true-label");

// ============ Canvas Drawing (native 28x28) ============
ctx.imageSmoothingEnabled = false;
ctx.fillStyle = "#000";
ctx.fillRect(0, 0, 28, 28);

function canvasPos(e) {
    const r = canvas.getBoundingClientRect();
    return {
        x: Math.floor((e.clientX - r.left) / r.width * 28),
        y: Math.floor((e.clientY - r.top) / r.height * 28),
    };
}

function drawDot(px, py) {
    // Draw a 2x2 block to mimic MNIST stroke width
    ctx.fillStyle = "#fff";
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const nx = px + dx;
            const ny = py + dy;
            if (nx >= 0 && nx < 28 && ny >= 0 && ny < 28) {
                // Center pixel full brightness, neighbors dimmer
                const dist = Math.abs(dx) + Math.abs(dy);
                if (dist === 0) {
                    ctx.globalAlpha = 1.0;
                } else if (dist === 1) {
                    ctx.globalAlpha = 0.6;
                } else {
                    ctx.globalAlpha = 0.25;
                }
                ctx.fillRect(nx, ny, 1, 1);
            }
        }
    }
    ctx.globalAlpha = 1.0;
}

function drawLine(x0, y0, x1, y1) {
    // Bresenham's line between two pixel coords
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    while (true) {
        drawDot(x0, y0);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
    }
}

let lastPx = null, lastPy = null;

canvas.addEventListener("mousedown", (e) => {
    isDrawing = true;
    currentImage = null; // user is drawing, discard any loaded sample
    trueLabel.textContent = "";
    const { x, y } = canvasPos(e);
    drawDot(x, y);
    lastPx = x;
    lastPy = y;
    scheduleLivePredict();
});

canvas.addEventListener("mousemove", (e) => {
    if (!isDrawing) return;
    const { x, y } = canvasPos(e);
    if (lastPx !== null) {
        drawLine(lastPx, lastPy, x, y);
    } else {
        drawDot(x, y);
    }
    lastPx = x;
    lastPy = y;
    scheduleLivePredict();
});

canvas.addEventListener("mouseup", () => {
    isDrawing = false;
    lastPx = null;
    lastPy = null;
    scheduleLivePredict();
});

canvas.addEventListener("mouseleave", () => {
    isDrawing = false;
    lastPx = null;
    lastPy = null;
});

// Touch support
canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    isDrawing = true;
    currentImage = null;
    trueLabel.textContent = "";
    const t = e.touches[0];
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((t.clientX - r.left) / r.width * 28);
    const y = Math.floor((t.clientY - r.top) / r.height * 28);
    drawDot(x, y);
    lastPx = x;
    lastPy = y;
    scheduleLivePredict();
});

canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const t = e.touches[0];
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((t.clientX - r.left) / r.width * 28);
    const y = Math.floor((t.clientY - r.top) / r.height * 28);
    if (lastPx !== null) {
        drawLine(lastPx, lastPy, x, y);
    } else {
        drawDot(x, y);
    }
    lastPx = x;
    lastPy = y;
    scheduleLivePredict();
});

canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    isDrawing = false;
    lastPx = null;
    lastPy = null;
    scheduleLivePredict();
});

// ============ Live Prediction (throttled) ============
let lastPredictTime = 0;

function scheduleLivePredict() {
    const now = Date.now();
    const elapsed = now - lastPredictTime;
    if (predictTimer) clearTimeout(predictTimer);

    if (elapsed >= 150) {
        lastPredictTime = now;
        doPredict();
    } else {
        // Schedule for remaining time so we always get a final update
        predictTimer = setTimeout(() => {
            lastPredictTime = Date.now();
            doPredict();
        }, 150 - elapsed);
    }
}

async function doPredict() {
    if (pendingPredict) return;
    pendingPredict = true;

    let image;
    if (currentImage) {
        image = currentImage;
    } else {
        image = getCanvasNormalized();
    }

    try {
        const res = await fetch("/api/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: currentModel, image }),
        });
        const data = await res.json();
        predDisplay.textContent = data.prediction;
        renderProbChart(data.activations.output);
        renderVisualization(data.activations);
    } catch (e) {
        // ignore network errors during rapid drawing
    }
    pendingPredict = false;
}

function getCanvasNormalized() {
    const imgData = ctx.getImageData(0, 0, 28, 28);
    const mean = 0.1307, std = 0.3081;
    const normalized = [];
    for (let y = 0; y < 28; y++) {
        const row = [];
        for (let x = 0; x < 28; x++) {
            const idx = (y * 28 + x) * 4;
            const v = imgData.data[idx] / 255.0;
            row.push((v - mean) / std);
        }
        normalized.push(row);
    }
    return normalized;
}

function drawImageOnCanvas(rawPixels) {
    const imgData = ctx.createImageData(28, 28);
    for (let y = 0; y < 28; y++) {
        for (let x = 0; x < 28; x++) {
            const v = Math.round(rawPixels[y][x] * 255);
            const idx = (y * 28 + x) * 4;
            imgData.data[idx] = v;
            imgData.data[idx + 1] = v;
            imgData.data[idx + 2] = v;
            imgData.data[idx + 3] = 255;
        }
    }
    ctx.putImageData(imgData, 0, 0);
}

// ============ Buttons ============
document.getElementById("btn-clear").addEventListener("click", () => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 28, 28);
    currentImage = null;
    predDisplay.textContent = "?";
    trueLabel.textContent = "";
    clearProbChart();
    clearVisualization();
});

document.getElementById("btn-sample").addEventListener("click", async () => {
    const res = await fetch("/api/sample");
    const data = await res.json();
    currentImage = data.image;
    drawImageOnCanvas(data.raw_image);
    trueLabel.textContent = `Vraie etiquette : ${data.label}`;
    // Immediately predict on the sample
    scheduleLivePredict();
});

// Mode toggle
const modeToggle = document.getElementById("mode-toggle");
modeToggle.addEventListener("change", () => {
    currentModel = modeToggle.checked ? "cnn" : "nn";
    document.getElementById("nn-label").classList.toggle("active", !modeToggle.checked);
    document.getElementById("cnn-label").classList.toggle("active", modeToggle.checked);
    // Re-predict with current canvas content
    scheduleLivePredict();
});

// ============ Probability Chart ============
function renderProbChart(probs) {
    const container = document.getElementById("prob-chart");
    container.innerHTML = "";
    const maxProb = Math.max(...probs);

    for (let i = 0; i < 10; i++) {
        const pct = (probs[i] * 100).toFixed(1);
        const isTop = probs[i] === maxProb;

        const row = document.createElement("div");
        row.className = "prob-row";
        row.innerHTML = `
            <span class="prob-label">${i}</span>
            <div class="prob-bar-bg">
                <div class="prob-bar ${isTop ? "top" : ""}"
                     style="width: ${pct}%"></div>
            </div>
            <span class="prob-value">${pct}%</span>
        `;
        container.appendChild(row);
    }
}

function clearProbChart() {
    const container = document.getElementById("prob-chart");
    container.innerHTML = "";
    for (let i = 0; i < 10; i++) {
        const row = document.createElement("div");
        row.className = "prob-row";
        row.innerHTML = `
            <span class="prob-label">${i}</span>
            <div class="prob-bar-bg">
                <div class="prob-bar" style="width: 0%"></div>
            </div>
            <span class="prob-value">0.0%</span>
        `;
        container.appendChild(row);
    }
}

// ============ Network Visualization ============
function clearVisualization() {
    svg.innerHTML = "";
}

function valToColor(val, minV, maxV) {
    const t = maxV > minV ? (val - minV) / (maxV - minV) : 0;
    const r = Math.round(t * 220 + 15);
    const g = Math.round(t * 180 + 10);
    const b = Math.round((1 - t) * 200 + 55);
    return `rgb(${r},${g},${b})`;
}

function renderVisualization(activations) {
    svg.innerHTML = "";
    if (currentModel === "nn") {
        renderNNVisualization(activations);
    } else {
        renderCNNVisualization(activations);
    }
}

// --------------- NN Visualization ---------------
// Shows ALL nodes: input as 28x28 grid, all 128, all 64, all 10
// Connections drawn as bundled lines between layers
function renderNNVisualization(act) {
    const container = document.getElementById("viz-container");
    const W = container.clientWidth - 20;
    const H = container.clientHeight - 20;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

    const connGroup = createSVG("g");
    svg.appendChild(connGroup);

    const layers = [
        { name: "Input", sublabel: "784 (28x28)", data: flatten2D(act.input), grid: true, gridW: 28, gridH: 28 },
        { name: "FC + ReLU", sublabel: "128 neurons", data: act.fc1_relu },
        { name: "FC + ReLU", sublabel: "64 neurons", data: act.fc2_relu },
        { name: "Output", sublabel: "10 classes", data: act.output },
    ];

    const numLayers = layers.length;
    const layerSpacing = W / (numLayers + 1);
    const layerAnchors = []; // { positions: [{x,y}], topY, botY, centerX }

    for (let li = 0; li < numLayers; li++) {
        const layer = layers[li];
        const cx = layerSpacing * (li + 1);

        // Label
        const label = createSVG("text", { x: cx, y: 18, class: "layer-label" });
        label.textContent = layer.name;
        svg.appendChild(label);
        const sublabel = createSVG("text", { x: cx, y: 31, class: "layer-sublabel" });
        sublabel.textContent = layer.sublabel;
        svg.appendChild(sublabel);

        const minVal = Math.min(...layer.data);
        const maxVal = Math.max(...layer.data);

        if (layer.grid) {
            // Draw input as a 28x28 grid of colored pixels
            const availH = H - 60;
            const pixSize = Math.min(availH / layer.gridH, (layerSpacing * 0.7) / layer.gridW);
            const gridW = layer.gridW * pixSize;
            const gridH = layer.gridH * pixSize;
            const startX = cx - gridW / 2;
            const startY = H / 2 - gridH / 2;

            // Render as image for performance
            const tmpCanvas = document.createElement("canvas");
            tmpCanvas.width = layer.gridW;
            tmpCanvas.height = layer.gridH;
            const tmpCtx = tmpCanvas.getContext("2d");
            const imgData = tmpCtx.createImageData(layer.gridW, layer.gridH);
            for (let y = 0; y < layer.gridH; y++) {
                for (let x = 0; x < layer.gridW; x++) {
                    const idx = y * layer.gridW + x;
                    const t = maxVal > minVal ? (layer.data[idx] - minVal) / (maxVal - minVal) : 0;
                    const pi = (y * layer.gridW + x) * 4;
                    imgData.data[pi] = Math.round(t * 220 + 15);
                    imgData.data[pi + 1] = Math.round(t * 180 + 10);
                    imgData.data[pi + 2] = Math.round((1 - t) * 200 + 55);
                    imgData.data[pi + 3] = 255;
                }
            }
            tmpCtx.putImageData(imgData, 0, 0);
            const img = createSVG("image", {
                x: startX, y: startY, width: gridW, height: gridH,
                href: tmpCanvas.toDataURL(), "image-rendering": "pixelated",
            });
            svg.appendChild(img);
            svg.appendChild(createSVG("rect", {
                x: startX, y: startY, width: gridW, height: gridH,
                fill: "none", stroke: "#3d4260", "stroke-width": 1, rx: 2,
            }));

            // Anchor points along right edge of grid (evenly spaced)
            const anchorCount = 20;
            const positions = [];
            for (let i = 0; i < anchorCount; i++) {
                positions.push({
                    x: startX + gridW,
                    y: startY + (i / (anchorCount - 1)) * gridH,
                });
            }
            layerAnchors.push({ positions, topY: startY, botY: startY + gridH, centerX: cx });
        } else {
            // Draw ALL nodes as a column of circles
            const count = layer.data.length;
            const availH = H - 60;
            const maxR = 8;
            const nodeRadius = Math.min(maxR, availH / (count * 2.5));
            const spacing = Math.min(nodeRadius * 2.4, availH / count);
            const totalH = spacing * (count - 1);
            const startY = H / 2 - totalH / 2;

            const positions = [];
            for (let i = 0; i < count; i++) {
                const y = startY + i * spacing;
                const color = valToColor(layer.data[i], minVal, maxVal);
                svg.appendChild(createSVG("circle", {
                    cx, cy: y, r: nodeRadius, fill: color, class: "node",
                }));
                positions.push({ x: cx, y });
            }
            layerAnchors.push({ positions, topY: startY, botY: startY + totalH, centerX: cx });
        }
    }

    // Draw connections between ALL adjacent layers
    // Use bundled lines: from each layer, sample source points and connect to all dest points
    for (let li = 0; li < layerAnchors.length - 1; li++) {
        const from = layerAnchors[li];
        const to = layerAnchors[li + 1];
        const totalConns = from.positions.length * to.positions.length;
        // Cap SVG lines at ~600 for performance, evenly sampled
        const maxLines = 600;
        const step = Math.max(1, Math.floor(totalConns / maxLines));
        let count = 0;
        for (const fp of from.positions) {
            for (const tp of to.positions) {
                count++;
                if (count % step !== 0) continue;
                connGroup.appendChild(createSVG("line", {
                    x1: fp.x, y1: fp.y, x2: tp.x, y2: tp.y,
                    class: "connection",
                }));
            }
        }
    }
}

// --------------- CNN Visualization ---------------
// Shows ALL feature maps (32 for conv1/pool1, 64 for conv2/pool2),
// all 128 FC nodes, all 10 output nodes, with connections between them
function renderCNNVisualization(act) {
    const container = document.getElementById("viz-container");
    const W = container.clientWidth - 20;
    const H = container.clientHeight - 20;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

    const connGroup = createSVG("g");
    svg.appendChild(connGroup);

    const stages = [];
    const stageCount = 7; // input, conv1, pool1, conv2, pool2, fc, output
    const stageGap = W / (stageCount + 1);
    let xPos = stageGap;

    stages.push({ type: "image", x: xPos, data: act.input, label: "Input", sublabel: "1@28x28" });
    xPos += stageGap;

    if (act.conv1) {
        stages.push({
            type: "maps", x: xPos, maps: act.conv1.maps,
            label: "Conv1+ReLU", sublabel: `${act.conv1.shape[0]}@${act.conv1.shape[1]}x${act.conv1.shape[2]}`,
        });
        xPos += stageGap;
    }
    if (act.pool1) {
        stages.push({
            type: "maps", x: xPos, maps: act.pool1.maps,
            label: "MaxPool", sublabel: `${act.pool1.shape[0]}@${act.pool1.shape[1]}x${act.pool1.shape[2]}`,
        });
        xPos += stageGap;
    }
    if (act.conv2) {
        stages.push({
            type: "maps", x: xPos, maps: act.conv2.maps,
            label: "Conv2+ReLU", sublabel: `${act.conv2.shape[0]}@${act.conv2.shape[1]}x${act.conv2.shape[2]}`,
        });
        xPos += stageGap;
    }
    if (act.pool2) {
        stages.push({
            type: "maps", x: xPos, maps: act.pool2.maps,
            label: "MaxPool", sublabel: `${act.pool2.shape[0]}@${act.pool2.shape[1]}x${act.pool2.shape[2]}`,
        });
        xPos += stageGap;
    }

    stages.push({ type: "nodes", x: xPos, data: act.fc1_relu, label: "FC+ReLU", sublabel: "128 neurons" });
    xPos += stageGap;
    stages.push({ type: "nodes", x: xPos, data: act.output, label: "Output", sublabel: "10 classes" });

    const stageAnchors = [];

    for (const stage of stages) {
        // Labels
        const label = createSVG("text", { x: stage.x, y: 18, class: "layer-label" });
        label.textContent = stage.label;
        svg.appendChild(label);
        const sublabel = createSVG("text", { x: stage.x, y: 31, class: "layer-sublabel" });
        sublabel.textContent = stage.sublabel;
        svg.appendChild(sublabel);

        if (stage.type === "image") {
            const imgSize = Math.min(H - 60, stageGap * 0.7);
            drawFeatureMap(svg, stage.data, stage.x, H / 2, imgSize);
            const half = imgSize / 2;
            const pts = [];
            for (let i = 0; i < 8; i++) {
                pts.push({ x: stage.x + half, y: H / 2 - half + (i / 7) * imgSize });
            }
            stageAnchors.push({ right: pts, left: pts.map(p => ({ x: p.x - imgSize, y: p.y })) });

        } else if (stage.type === "maps") {
            const count = stage.maps.length;
            // Layout: grid of small maps, auto-size columns to fit
            const cols = count <= 32 ? 4 : 8;
            const rows = Math.ceil(count / cols);
            const availH = H - 60;
            const availW = stageGap * 0.85;
            const gap = 2;
            const mapSize = Math.min(
                (availH - (rows - 1) * gap) / rows,
                (availW - (cols - 1) * gap) / cols
            );
            const totalW = cols * mapSize + (cols - 1) * gap;
            const totalH = rows * mapSize + (rows - 1) * gap;
            const startX = stage.x - totalW / 2;
            const startY = H / 2 - totalH / 2;

            const rightAnchors = [];
            const leftAnchors = [];

            for (let i = 0; i < count; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const mx = startX + col * (mapSize + gap) + mapSize / 2;
                const my = startY + row * (mapSize + gap) + mapSize / 2;
                drawFeatureMap(svg, stage.maps[i], mx, my, mapSize);
                rightAnchors.push({ x: mx + mapSize / 2, y: my });
                leftAnchors.push({ x: mx - mapSize / 2, y: my });
            }
            stageAnchors.push({ right: rightAnchors, left: leftAnchors });

        } else if (stage.type === "nodes") {
            const count = stage.data.length;
            const availH = H - 60;
            const maxR = 7;
            const nodeRadius = Math.min(maxR, availH / (count * 2.5));
            const spacing = Math.min(nodeRadius * 2.4, availH / count);
            const totalH = spacing * (count - 1);
            const startY = H / 2 - totalH / 2;
            const minVal = Math.min(...stage.data);
            const maxVal = Math.max(...stage.data);

            const anchors = [];
            for (let i = 0; i < count; i++) {
                const y = startY + i * spacing;
                const color = valToColor(stage.data[i], minVal, maxVal);
                svg.appendChild(createSVG("circle", {
                    cx: stage.x, cy: y, r: nodeRadius, fill: color, class: "node",
                }));
                anchors.push({ x: stage.x, y });
            }
            stageAnchors.push({ right: anchors, left: anchors });
        }
    }

    // Draw connections between adjacent stages
    for (let i = 0; i < stageAnchors.length - 1; i++) {
        const fromPts = stageAnchors[i].right;
        const toPts = stageAnchors[i + 1].left;
        const totalConns = fromPts.length * toPts.length;
        const maxLines = 500;
        const step = Math.max(1, Math.floor(totalConns / maxLines));
        let count = 0;
        for (const fp of fromPts) {
            for (const tp of toPts) {
                count++;
                if (count % step !== 0) continue;
                connGroup.appendChild(createSVG("line", {
                    x1: fp.x, y1: fp.y, x2: tp.x, y2: tp.y,
                    class: "connection",
                }));
            }
        }
    }
}

// ============ Drawing Helpers ============

function drawFeatureMap(parent, data, cx, cy, size) {
    const rows = data.length;
    const cols = data[0].length;
    const pixSize = size / Math.max(rows, cols);
    const startX = cx - (cols * pixSize) / 2;
    const startY = cy - (rows * pixSize) / 2;

    const flat = data.flat();
    const minV = Math.min(...flat);
    const maxV = Math.max(...flat);

    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = cols;
    tmpCanvas.height = rows;
    const tmpCtx = tmpCanvas.getContext("2d");
    const imgData = tmpCtx.createImageData(cols, rows);

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const t = maxV > minV ? (data[y][x] - minV) / (maxV - minV) : 0;
            const idx = (y * cols + x) * 4;
            imgData.data[idx] = Math.round(t * 220 + 15);
            imgData.data[idx + 1] = Math.round(t * 180 + 10);
            imgData.data[idx + 2] = Math.round((1 - t) * 200 + 55);
            imgData.data[idx + 3] = 255;
        }
    }
    tmpCtx.putImageData(imgData, 0, 0);

    const img = createSVG("image", {
        x: startX, y: startY,
        width: cols * pixSize, height: rows * pixSize,
        href: tmpCanvas.toDataURL(),
        "image-rendering": "pixelated",
    });
    const border = createSVG("rect", {
        x: startX, y: startY,
        width: cols * pixSize, height: rows * pixSize,
        fill: "none", stroke: "#3d4260", "stroke-width": 0.5, rx: 1,
    });
    parent.appendChild(img);
    parent.appendChild(border);
}

// ============ Helpers ============
function createSVG(tag, attrs = {}) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, v);
    }
    return el;
}

function flatten2D(arr) {
    if (!Array.isArray(arr[0])) return arr;
    return arr.flat();
}

// ============ Init ============
clearProbChart();
