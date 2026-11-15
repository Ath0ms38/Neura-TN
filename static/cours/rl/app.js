"use strict";

// ============================================================
// Cours : apprentissage par renforcement
// ============================================================

const C = Course.COLORS;
const $ = (id) => document.getElementById(id);
const fmt = (v, d = 2) => v.toFixed(d);
const signed = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v);

// ============================================================
// 01 · La boucle agent / environnement : le visiteur joue l'agent
// ============================================================

(function sectionLoop() {
    const SIZE = 7, START = 3;
    // Le côté du trésor est tiré au sort une fois, puis ne change plus :
    // d'un épisode à l'autre, le joueur peut donc apprendre.
    const treasure = Math.random() < 0.5 ? 0 : SIZE - 1;
    const pit = treasure === 0 ? SIZE - 1 : 0;
    const known = new Set();
    let pos, total, over, episodes = 0, best = null, visited;

    const box = $("loop-corridor");

    function render() {
        box.textContent = "";
        for (let i = 0; i < SIZE; i++) {
            const cell = document.createElement("div");
            cell.className = "cell";
            const end = i === treasure || i === pit;
            if (end && known.has(i)) {
                cell.classList.add(i === treasure ? "treasure" : "pit");
                cell.textContent = i === treasure ? "+10" : "−10";
            } else if (end) {
                cell.classList.add("unknown");
                cell.textContent = "?";
            } else {
                if (visited.has(i)) cell.classList.add("visited");
                cell.textContent = i === pos ? "" : String(i + 1);
            }
            if (i === pos && !(end && over)) {
                const agent = document.createElement("span");
                agent.className = "agent";
                cell.textContent = "";
                cell.appendChild(agent);
            }
            box.appendChild(cell);
        }
        $("loop-left").disabled = $("loop-right").disabled = over;
        $("loop-episodes").textContent = episodes;
        $("loop-return").textContent = signed(total);
        $("loop-best").textContent = best === null ? "–" : signed(best);
    }

    function pulse(id, text) {
        const el = $(id);
        el.querySelector(".v").textContent = text;
        el.classList.remove("pulse");
        void el.offsetWidth; // relance la transition
        el.classList.add("pulse");
    }

    function reset() {
        pos = START;
        total = 0;
        over = false;
        visited = new Set([START]);
        pulse("loop-state", `case ${START + 1}`);
        $("loop-action").querySelector(".v").textContent = "–";
        $("loop-reward").querySelector(".v").textContent = "–";
        $("loop-action").classList.remove("pulse");
        $("loop-reward").classList.remove("pulse");
        $("loop-message").textContent = known.size
            ? "Nouvel épisode. Cette fois, vous savez quelque chose sur ce couloir."
            : "Choisissez une direction. Vous ne saurez ce qu'il y a au bout qu'en y allant.";
        render();
    }

    function move(dir) {
        if (over) return;
        pos += dir;
        visited.add(pos);
        let reward = -1;
        if (pos === treasure || pos === pit) {
            reward = pos === treasure ? 10 : -10;
            known.add(pos);
            over = true;
            episodes++;
        }
        total += reward;
        pulse("loop-action", dir < 0 ? "← gauche" : "droite →");
        pulse("loop-reward", signed(reward));
        pulse("loop-state", over ? "fin" : `case ${pos + 1}`);

        const msg = $("loop-message");
        if (!over) {
            msg.innerHTML = `Chaque pas coûte <strong>−1</strong> : traîner a un prix. Gain actuel : ${signed(total)}.`;
        } else {
            best = best === null ? total : Math.max(best, total);
            if (pos === pit) {
                msg.innerHTML = `<strong>La fosse : −10.</strong> Gain de l'épisode : ${signed(total)}. Personne ne vous avait prévenu, mais vous le savez maintenant. Rejouez.`;
            } else if (total >= 8) {
                msg.innerHTML = `<strong>Trésor, par le chemin le plus court : ${signed(total)}.</strong> C'est le meilleur gain possible. Vous venez d'apprendre par renforcement : essayer, constater, ajuster.`;
            } else {
                msg.innerHTML = `<strong>Trésor : +10.</strong> Gain de l'épisode : ${signed(total)}, à cause des pas en trop. Rejouez en allant droit au but.`;
            }
        }
        render();
    }

    $("loop-left").addEventListener("click", () => move(-1));
    $("loop-right").addEventListener("click", () => move(1));
    $("loop-reset").addEventListener("click", reset);
    reset();
})();

// ============================================================
// 02 · Explorer ou exploiter : les machines à sous
// ============================================================

(function sectionBandit() {
    const NAMES = ["A", "B", "C", "D"];
    const PULLS = 500;
    let probs, stats, totalPulls, revealed, runs = [], animating = 0;

    const box = $("bandits");
    const W = 560, H = 230;
    const ctx = Course.canvas($("bandit-chart"), W, H);
    const best = () => probs.indexOf(Math.max(...probs));

    function newMachines() {
        probs = [0.2, 0.35, 0.5, 0.75];
        for (let i = probs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [probs[i], probs[j]] = [probs[j], probs[i]];
        }
        stats = probs.map(() => ({ pulls: 0, wins: 0 }));
        totalPulls = 0;
        revealed = false;
        runs = [];
        $("bandit-result").textContent = "";
        if (!Course.isDone(1)) $("challenge-1").querySelector(".challenge-feedback").textContent = "";
        renderMachines();
        drawChart(PULLS);
    }

    function renderMachines(flash) {
        box.textContent = "";
        probs.forEach((p, i) => {
            const s = stats[i];
            const card = document.createElement("div");
            card.className = "bandit";
            if (flash && flash.index === i) card.classList.add(flash.win ? "win" : "lose");
            if (revealed && i === best()) card.classList.add("revealed-best");

            const name = document.createElement("div");
            name.className = "bandit-name";
            name.textContent = `MACHINE ${NAMES[i]}`;
            const rate = document.createElement("div");
            rate.className = "bandit-rate";
            rate.textContent = s.pulls ? Math.round((s.wins / s.pulls) * 100) + " %" : "?";
            const meter = document.createElement("div");
            meter.className = "bandit-meter";
            const fill = document.createElement("i");
            fill.style.width = s.pulls ? (s.wins / s.pulls) * 100 + "%" : "0";
            meter.appendChild(fill);
            const detail = document.createElement("div");
            detail.className = "bandit-detail";
            detail.textContent = revealed
                ? `${s.wins} gains / ${s.pulls} · vraie chance : ${Math.round(p * 100)} %`
                : s.pulls ? `${s.wins} gain${s.wins > 1 ? "s" : ""} sur ${s.pulls} tirage${s.pulls > 1 ? "s" : ""}` : "jamais essayée";

            const pull = document.createElement("button");
            pull.type = "button";
            pull.className = "pull";
            pull.textContent = "Tirer";
            pull.addEventListener("click", () => {
                const win = Math.random() < p;
                s.pulls++;
                if (win) s.wins++;
                totalPulls++;
                renderMachines({ index: i, win });
            });
            const pick = document.createElement("button");
            pick.type = "button";
            pick.textContent = "C'est elle";
            pick.setAttribute("aria-label", `La machine ${NAMES[i]} est la meilleure`);
            pick.addEventListener("click", () => guess(i));

            card.append(name, rate, meter, detail, pull, pick);
            box.appendChild(card);
        });
        $("bandit-count").textContent = `${totalPulls} tirage${totalPulls > 1 ? "s" : ""}`;
    }

    function guess(i) {
        const fb = $("challenge-1").querySelector(".challenge-feedback");
        if (totalPulls < 20) {
            fb.textContent = `Seulement ${totalPulls} tirage${totalPulls > 1 ? "s" : ""} : jouez-en au moins 20 avant de vous prononcer.`;
            return;
        }
        if (i === best()) {
            revealed = true;
            Course.complete(1, `Exact : la machine ${NAMES[i]} gagne ${Math.round(probs[i] * 100)} % du temps. Les vraies probabilités sont maintenant affichées : comparez-les à vos estimations.`);
            renderMachines();
        } else {
            const tried = stats[i].pulls;
            fb.textContent = tried < 6
                ? `Ce n'est pas elle, et ${tried} tirage${tried > 1 ? "s" : ""} sur cette machine ne permettaient pas d'en juger. Explorez davantage.`
                : "Ce n'est pas elle. Une bonne série ne fait pas une bonne machine : avez-vous assez essayé les autres ?";
        }
    }

    /** Fait jouer un agent ε-greedy : retourne la moyenne cumulée des gains. */
    function simulate(eps) {
        const n = probs.map(() => 0), value = probs.map(() => 0);
        const curve = new Float64Array(PULLS);
        let sum = 0;
        for (let t = 0; t < PULLS; t++) {
            let a;
            if (Math.random() < eps) {
                a = Math.floor(Math.random() * probs.length);
            } else {
                const top = Math.max(...value);
                const ties = value.map((v, k) => (v === top ? k : -1)).filter((k) => k >= 0);
                a = ties[Math.floor(Math.random() * ties.length)];
            }
            const r = Math.random() < probs[a] ? 1 : 0;
            n[a]++;
            value[a] += (r - value[a]) / n[a];
            sum += r;
            curve[t] = sum / (t + 1);
        }
        return { eps, curve, ratio: sum / PULLS / Math.max(...probs) };
    }

    function drawChart(upTo) {
        const pad = { l: 38, r: 14, t: 16, b: 28 };
        const X = (t) => pad.l + (t / (PULLS - 1)) * (W - pad.l - pad.r);
        const Y = (v) => H - pad.b - v * (H - pad.t - pad.b);
        ctx.clearRect(0, 0, W, H);
        ctx.font = `10px ${Course.FONT.mono}`;
        ctx.lineWidth = 1;
        ctx.textBaseline = "middle";
        ctx.textAlign = "right";
        for (const t of [0, 0.25, 0.5, 0.75, 1]) {
            ctx.strokeStyle = C.grid;
            ctx.beginPath(); ctx.moveTo(pad.l, Y(t)); ctx.lineTo(W - pad.r, Y(t)); ctx.stroke();
            ctx.fillStyle = C.muted;
            ctx.fillText(Math.round(t * 100) + " %", pad.l - 5, Y(t));
        }
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        for (const t of [0, 100, 200, 300, 400, 499]) ctx.fillText(String(t + 1 === 500 ? 500 : t), X(t), H - pad.b + 6);
        ctx.fillStyle = C.soft;
        ctx.textAlign = "left";
        ctx.fillText("gain moyen par tirage", 4, 2);
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText("tirages", W - pad.r, H - 1);

        if (!runs.length) {
            ctx.fillStyle = C.muted;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("Réglez ε puis laissez l'agent jouer", W / 2, H / 2);
            return;
        }
        // Référence : un joueur qui connaîtrait la meilleure machine
        const top = Math.max(...probs);
        ctx.strokeStyle = C.green;
        ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.moveTo(pad.l, Y(top)); ctx.lineTo(W - pad.r, Y(top)); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = C.green;
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText("joueur omniscient", W - pad.r - 2, Y(top) - 3);

        runs.forEach((run, index) => {
            const latest = index === runs.length - 1;
            const end = latest ? upTo : PULLS;
            ctx.strokeStyle = latest ? C.amber : "rgba(155, 176, 201, 0.4)";
            ctx.lineWidth = latest ? 2.5 : 1.5;
            ctx.lineJoin = "round";
            ctx.beginPath();
            for (let t = 0; t < end; t++) (t ? ctx.lineTo(X(t), Y(run.curve[t])) : ctx.moveTo(X(t), Y(run.curve[t])));
            ctx.stroke();
            if (end > 30) {
                ctx.fillStyle = latest ? C.amber : C.soft;
                ctx.textAlign = "left";
                ctx.textBaseline = "middle";
                const lx = Math.min(X(end - 1) + 4, W - pad.r - 48);
                ctx.fillText(`ε=${fmt(run.eps)}`, lx, Y(run.curve[end - 1]) + (latest ? -9 : 9));
            }
        });
    }

    function run() {
        if (animating) return;
        const eps = parseFloat($("bandit-eps").value);
        const result = simulate(eps);
        // Une seule partie dépend beaucoup de la chance : on juge ε sur la
        // moyenne de 40 parties, et on trace la première.
        let mean = result.ratio;
        for (let k = 1; k < 40; k++) mean += simulate(eps).ratio;
        mean /= 40;
        runs.push(result);
        if (runs.length > 3) runs.shift();
        const finish = () => {
            animating = 0;
            drawChart(PULLS);
            const pct = Math.round(mean * 100);
            const shown = Math.round(result.ratio * 100);
            $("bandit-result").textContent = `ε = ${fmt(eps)} : ${shown} % sur cette partie, ${pct} % en moyenne`;
            const fb = $("challenge-2").querySelector(".challenge-feedback");
            if (mean >= 0.88) {
                Course.complete(2, `${pct} % en moyenne avec ε = ${fmt(eps)} : assez d'exploration pour trouver la meilleure machine, assez peu pour ne pas gaspiller de tirages.`);
            } else if (!Course.isDone(2)) {
                fb.textContent = eps === 0
                    ? `${pct} % en moyenne. Sans exploration, l'agent s'accroche à la première machine qui a payé, même médiocre. Parfois il a de la chance, souvent non.`
                    : eps >= 0.5
                        ? `${pct} % en moyenne. L'agent repère vite la meilleure machine, mais continue de jouer au hasard une bonne partie du temps.`
                        : `${pct} % en moyenne. Pas loin : ajustez légèrement ε.`;
            }
        };
        if (Course.reducedMotion) return finish();
        const startTime = performance.now();
        const tick = (now) => {
            const upTo = Math.min(PULLS, Math.floor(((now - startTime) / 1400) * PULLS) + 2);
            drawChart(upTo);
            if (upTo >= PULLS) finish(); else animating = requestAnimationFrame(tick);
        };
        animating = requestAnimationFrame(tick);
    }

    $("bandit-new").addEventListener("click", () => { cancelAnimationFrame(animating); animating = 0; newMachines(); });
    $("bandit-run").addEventListener("click", run);
    $("bandit-eps").addEventListener("input", (e) => { $("bandit-eps-val").textContent = fmt(parseFloat(e.target.value)); });
    newMachines();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!animating) drawChart(PULLS); });
})();

// ============================================================
// 03 · Le facteur d'actualisation γ
// ============================================================

(function sectionGamma() {
    const W = 560, H = 270;
    const ctx = Course.canvas($("gamma-canvas"), W, H);
    const CELLS = 8, AGENT = 1, COIN = 0, CHEST = 6;
    const COIN_VALUE = 2, CHEST_VALUE = 10;
    const THRESHOLD = Math.pow(COIN_VALUE / CHEST_VALUE, 1 / (CHEST - AGENT - 1));

    function draw() {
        const gamma = parseFloat($("gamma").value);
        const left = COIN_VALUE; // obtenue dès le premier pas
        const right = Math.pow(gamma, CHEST - AGENT - 1) * CHEST_VALUE;
        const goRight = right > left;

        ctx.clearRect(0, 0, W, H);
        const size = 58, gap = 8, x0 = (W - (CELLS * size + (CELLS - 1) * gap)) / 2, y0 = 22;
        const cx = (i) => x0 + i * (size + gap) + size / 2;
        ctx.font = `600 12px ${Course.FONT.mono}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        for (let i = 0; i < CELLS; i++) {
            const x = x0 + i * (size + gap);
            const onPath = goRight ? i > AGENT && i <= CHEST : i === COIN;
            ctx.fillStyle = i === COIN ? "rgba(255, 171, 64, 0.2)" : i === CHEST ? "rgba(44, 196, 165, 0.25)" : C.panel;
            ctx.strokeStyle = onPath ? C.amber : C.grid;
            ctx.lineWidth = onPath ? 2 : 1;
            ctx.beginPath();
            ctx.roundRect(x, y0, size, size, 10);
            ctx.fill();
            ctx.stroke();
            if (i === COIN) { ctx.fillStyle = C.amber; ctx.fillText("+2", cx(i), y0 + size / 2); }
            if (i === CHEST) { ctx.fillStyle = C.green; ctx.fillText("+10", cx(i), y0 + size / 2); }
            if (i === AGENT) {
                ctx.beginPath();
                ctx.arc(cx(i), y0 + size / 2, 14, 0, Math.PI * 2);
                ctx.fillStyle = C.amber;
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = C.ink;
                ctx.stroke();
            }
        }

        // Poids de chaque pas vers le coffre : 1, γ, γ², …
        ctx.font = `10px ${Course.FONT.mono}`;
        for (let i = AGENT + 1; i <= CHEST; i++) {
            const t = i - AGENT - 1;
            const weight = Math.pow(gamma, t);
            ctx.beginPath();
            ctx.arc(cx(i), y0 + size + 22, 3 + weight * 9, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(133, 213, 230, ${0.2 + weight * 0.8})`;
            ctx.fill();
            ctx.fillStyle = C.soft;
            ctx.fillText(t === 0 ? "×1" : `×${weight.toFixed(2)}`, cx(i), y0 + size + 44);
        }
        ctx.fillStyle = C.muted;
        ctx.textAlign = "left";
        ctx.fillText("poids γᵗ", cx(CHEST) + size / 2 + 4, y0 + size + 22);

        // Barres : valeur actualisée de chaque option
        const barY = 176, barH = 22, barX = 150, barW = W - barX - 60, scale = barW / CHEST_VALUE;
        [["Pièce (1 pas)", left, C.amber, !goRight], ["Coffre (5 pas)", right, C.green, goRight]].forEach(([name, value, color, chosen], k) => {
            const y = barY + k * (barH + 14);
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            ctx.font = `${chosen ? 700 : 500} 11px ${Course.FONT.body}`;
            ctx.fillStyle = chosen ? C.text : C.soft;
            ctx.fillText(name, barX - 10, y + barH / 2);
            ctx.fillStyle = C.panel;
            ctx.beginPath(); ctx.roundRect(barX, y, barW, barH, 5); ctx.fill();
            ctx.fillStyle = color;
            ctx.globalAlpha = chosen ? 1 : 0.45;
            ctx.beginPath(); ctx.roundRect(barX, y, Math.max(2, value * scale), barH, 5); ctx.fill();
            ctx.globalAlpha = 1;
            ctx.textAlign = "left";
            ctx.font = `600 11px ${Course.FONT.mono}`;
            ctx.fillStyle = chosen ? C.text : C.soft;
            ctx.fillText(value.toFixed(2), barX + Math.max(2, value * scale) + 8, y + barH / 2);
        });

        $("gamma-val").textContent = fmt(gamma);
        $("gamma-left").textContent = fmt(left);
        $("gamma-right").textContent = fmt(right);
        $("gamma-choice").textContent = goRight ? "le coffre" : "la pièce";
        $("gamma-message").innerHTML = goRight
            ? `Avec γ = ${fmt(gamma)}, le coffre vaut γ⁴ × 10 = <strong>${fmt(right)}</strong>, plus que la pièce. L'agent accepte quatre pas sans récompense pour un gain supérieur.`
            : `Avec γ = ${fmt(gamma)}, le coffre ne vaut plus que γ⁴ × 10 = <strong>${fmt(right)}</strong> vu d'ici. L'agent préfère la pièce, toute proche. Le basculement se produit vers γ = ${fmt(THRESHOLD)}.`;
    }

    $("gamma").addEventListener("input", draw);
    draw();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
})();

// ============================================================
// 04 · La table Q, sur un couloir de six cases
// ============================================================

(function sectionQ() {
    const STATES = 6, GOAL = 5, EPSILON = 0.2, REWARD = 10;
    const LEFT = 0, RIGHT = 1;
    let Q, pos, episodes, stepsInEpisode, lastLength, updated;

    const table = $("qtable");
    const cell = (className, text) => {
        const el = document.createElement("div");
        el.className = className;
        if (text !== undefined) el.textContent = text;
        table.appendChild(el);
        return el;
    };

    function render() {
        table.textContent = "";
        cell("head", "");
        for (let s = 0; s < STATES; s++) cell("head", `case ${s + 1}`);

        cell("row-label", "couloir");
        for (let s = 0; s < STATES; s++) {
            const el = cell("state" + (s === GOAL ? " goal" : ""), s === GOAL ? "+10" : undefined);
            if (s === pos && s !== GOAL) {
                const agent = document.createElement("span");
                agent.className = "agent";
                el.appendChild(agent);
            }
        }
        for (const [action, name] of [[RIGHT, "Q(·, →)"], [LEFT, "Q(·, ←)"]]) {
            cell("row-label", name);
            for (let s = 0; s < STATES; s++) {
                if (s === GOAL) { cell("q none", "fin"); continue; }
                const q = Q[s][action];
                const el = cell("q", fmt(q));
                el.style.background = `rgba(44, 196, 165, ${Math.min(0.75, q / REWARD * 0.75)})`;
                if (updated && updated.s === s && updated.a === action) el.classList.add("updated");
            }
        }
        $("q-episodes").textContent = episodes;
        $("q-length").textContent = lastLength === null ? "–" : lastLength;
    }

    function reset() {
        Q = Array.from({ length: STATES }, () => [0, 0]);
        pos = 0;
        episodes = 0;
        stepsInEpisode = 0;
        lastLength = null;
        updated = null;
        $("q-message").textContent = "L'agent part de la case 1. Le trésor (+10) est en case 6. Il explore au hasard une fois sur cinq.";
        render();
    }

    /** Un pas de Q-learning. Retourne true si l'épisode vient de se terminer. */
    function step(describe) {
        const alpha = parseFloat($("q-alpha").value), gamma = parseFloat($("q-gamma").value);
        const s = pos;
        let a;
        if (Math.random() < EPSILON || Q[s][LEFT] === Q[s][RIGHT]) a = Math.random() < 0.5 ? LEFT : RIGHT;
        else a = Q[s][RIGHT] > Q[s][LEFT] ? RIGHT : LEFT;

        const next = Math.max(0, Math.min(GOAL, s + (a === RIGHT ? 1 : -1)));
        const terminal = next === GOAL;
        const r = terminal ? REWARD : 0;
        const future = terminal ? 0 : Math.max(Q[next][LEFT], Q[next][RIGHT]);
        const old = Q[s][a];
        Q[s][a] = old + alpha * (r + gamma * future - old);
        updated = { s, a };
        stepsInEpisode++;

        if (describe) {
            const arrow = a === RIGHT ? "→" : "←";
            const surprise = r + gamma * future - old;
            $("q-message").innerHTML =
                `Case ${s + 1}, action ${arrow} : <code>Q = ${fmt(old)} + ${fmt(alpha)} × [ ${r} + ${fmt(gamma)} × ${fmt(future)} − ${fmt(old)} ] = <strong>${fmt(Q[s][a])}</strong></code>. ` +
                (Math.abs(surprise) < 1e-9
                    ? "Aucune surprise : la case suivante ne promet rien de plus que prévu, rien ne change."
                    : terminal ? "Le trésor ! La case voisine du trésor prend de la valeur."
                        : "La case suivante avait déjà de la valeur : une partie remonte d'une case.");
        }

        if (terminal) {
            episodes++;
            lastLength = stepsInEpisode;
            stepsInEpisode = 0;
            pos = 0;
            return true;
        }
        pos = next;
        return false;
    }

    $("q-step").addEventListener("click", () => { step(true); render(); });
    $("q-episode").addEventListener("click", () => {
        let guard = 0;
        while (!step(false) && guard++ < 5000);
        const known = Q.filter((row, s) => s < GOAL && Math.max(...row) > 0.005).length;
        $("q-message").innerHTML = `Épisode ${episodes} terminé en <strong>${lastLength} pas</strong>. ` +
            (known < GOAL
                ? `La valeur du trésor a atteint ${known} case${known > 1 ? "s" : ""} sur ${GOAL} : elle recule d'une case à chaque épisode.`
                : "La valeur est remontée jusqu'au départ : à chaque case, la meilleure action est maintenant « → ».");
        render();
    });
    $("q-reset").addEventListener("click", reset);
    $("q-alpha").addEventListener("input", (e) => { $("q-alpha-val").textContent = fmt(parseFloat(e.target.value)); });
    $("q-gamma").addEventListener("input", (e) => { $("q-gamma-val").textContent = fmt(parseFloat(e.target.value)); });

    // Défi 3 : 2 + 0,5 × (0 + 0,9 × 10 − 2) = 5,5
    const quiz = $("q-quiz");
    [
        ["4,5", "Vous avez retenu la moitié de l'ancienne valeur, mais oublié de l'ajouter au résultat : Q + α × surprise."],
        ["5,5", null],
        ["9", "9 est la cible (r + γ × 10). Avec α = 0,5, l'agent ne fait que la moitié du chemin vers elle."],
        ["10", "Deux oublis : γ réduit la valeur de la case suivante à 9, et α ne retient que la moitié de l'écart."],
    ].forEach(([text, hint]) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "quiz-option";
        btn.textContent = text;
        btn.addEventListener("click", () => {
            if (hint === null) {
                btn.classList.add("correct");
                quiz.querySelectorAll(".quiz-option").forEach((b) => { b.disabled = true; });
                Course.complete(3, "Oui : surprise = 0 + 0,9 × 10 − 2 = 7, et l'agent en retient la moitié. 2 + 3,5 = 5,5.");
            } else {
                btn.classList.add("wrong");
                $("challenge-3").querySelector(".challenge-feedback").textContent = hint;
            }
        });
        quiz.appendChild(btn);
    });

    reset();
})();

// ============================================================
// Hero : une valeur qui se propage de case en case
// ============================================================

Course.hero((ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    const size = 56;
    const cols = Math.ceil(w / size) + 1, rows = Math.ceil(h / size) + 1;
    const gx = Math.floor(cols * 0.78), gy = Math.floor(rows * 0.3);
    const reach = ((t * 2.2) % (cols + rows + 6));
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const d = Math.abs(x - gx) + Math.abs(y - gy);
            const lit = d <= reach ? Math.max(0, 0.2 - d * 0.012) * Math.min(1, (reach - d) / 2) : 0;
            ctx.fillStyle = `rgba(44, 196, 165, ${lit})`;
            ctx.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);
            ctx.strokeStyle = "rgba(133, 213, 230, 0.06)";
            ctx.strokeRect(x * size + 2.5, y * size + 2.5, size - 5, size - 5);
        }
    }
    ctx.fillStyle = "rgba(44, 196, 165, 0.55)";
    ctx.fillRect(gx * size + 2, gy * size + 2, size - 4, size - 4);
});

Course.init({ challenges: 3 });
