const MODES = {
    WAVEFORM: 'waveform',
    MELODY: 'melody'
};

const MELODY_PLAYBACK = {
    BAR: 'bar',
    DRAWN_TIMING: 'drawn_timing'
};

const UI = {
    TAB_HEIGHT: 50,
    BUTTON_SIZE: 88,
    BUTTON_GAP: 24,
    BUTTON_BOTTOM_MARGIN: 34
};

let socket;
let vsts = {};
let currentTargetVST = null;
let mode = MODES.WAVEFORM;
let prevX = null;
let prevY = null;
let strokeStartMs = null;
let prevPointMs = null;
let melodyPlaybackMode = MELODY_PLAYBACK.BAR;

function setup() {
    const cnv = createCanvas(windowWidth, windowHeight);
    cnv.position(0, 0);
    cnv.style('display', 'block');
    socket = io.connect('http://localhost:3333');

    socket.on('vst_list', handleVstList);
    socket.on('connect', () => {
        socket.emit('request_current_vst');
        sendMelodyPlaybackMode();
    });
}

function draw() {
    background(51);

    if (currentTargetVST && vsts[currentTargetVST]) {
        const current = vsts[currentTargetVST];
        image(current.waveLayer, 0, 0);
        image(current.melodyLayer, 0, 0);
        drawStrokeGuide(current);
        handleDrawing(current);
    }

    drawTabs();
    drawModeButtons();
}

function windowResized() {
    resizeCanvas(window.innerWidth, window.innerHeight);

    Object.values(vsts).forEach((item) => {
        const nextWave = createGraphics(windowWidth, windowHeight);
        nextWave.image(item.waveLayer, 0, 0);
        item.waveLayer.remove();
        item.waveLayer = nextWave;

        const nextMelody = createGraphics(windowWidth, windowHeight);
        nextMelody.image(item.melodyLayer, 0, 0);
        item.melodyLayer.remove();
        item.melodyLayer = nextMelody;
    });
}

function handleVstList(list) {
    list.forEach((id) => {
        if (vsts[id]) {
            return;
        }

        const waveLayer = createGraphics(windowWidth, windowHeight);
        waveLayer.clear();
        const melodyLayer = createGraphics(windowWidth, windowHeight);
        melodyLayer.clear();

        vsts[id] = {
            waveLayer,
            melodyLayer,
            lockedY: null
        };
    });

    Object.keys(vsts).forEach((id) => {
        if (list.includes(id)) {
            return;
        }

        vsts[id].waveLayer.remove();
        vsts[id].melodyLayer.remove();
        delete vsts[id];
    });

    if (!list.includes(currentTargetVST)) {
        currentTargetVST = list.length > 0 ? list[0] : null;
    }
}

function drawStrokeGuide(current) {
    if (!mouseIsPressed || current.lockedY === null || mouseY <= UI.TAB_HEIGHT) {
        return;
    }

    stroke(255, 255, 255, 120);
    strokeWeight(1);
    line(0, current.lockedY, width, current.lockedY);
}

function handleDrawing(current) {
    if (!mouseIsPressed || mouseY <= UI.TAB_HEIGHT || isPointInModeButton(mouseX, mouseY)) {
        return;
    }

    if (current.lockedY === null) {
        current.lockedY = mouseY;
        strokeStartMs = millis();
        prevPointMs = strokeStartMs;

        if (mode === MODES.WAVEFORM) {
            current.waveLayer.clear();
        } else {
            current.melodyLayer.clear();
        }

        prevX = mouseX;
        prevY = mouseY;
        return;
    }

    if (prevX === null || prevY === null) {
        prevX = mouseX;
        prevY = mouseY;
        prevPointMs = millis();
        return;
    }

    const nowMs = millis();
    const t1 = (prevPointMs ?? nowMs) - (strokeStartMs ?? nowMs);
    const t2 = nowMs - (strokeStartMs ?? nowMs);
    const x1 = prevX / width;
    const y1 = prevY / height;
    const x2 = mouseX / width;
    const y2 = mouseY / height;

    if (mode === MODES.WAVEFORM) {
        current.waveLayer.stroke(0, 255, 200);
        current.waveLayer.strokeWeight(4);
        current.waveLayer.line(prevX, prevY, mouseX, mouseY);
        // For waveform mode, we only need the coordinates, not the timing
        socket.emit('drawing', { type: 'drawing', x1, y1, x2, y2, target: currentTargetVST });
    } else {
        current.melodyLayer.stroke(255, 200, 100);
        current.melodyLayer.strokeWeight(4);
        current.melodyLayer.line(prevX, prevY, mouseX, mouseY);
        socket.emit('drawing', { type: 'melody', x1, y1, t1, x2, y2, t2, target: currentTargetVST });
    }

    prevX = mouseX;
    prevY = mouseY;
    prevPointMs = nowMs;
}

function mousePressed() {
    if (mouseY < UI.TAB_HEIGHT) {
        selectTabFromMouse();
        return;
    }

    const hit = getModeButtonHit(mouseX, mouseY);
    if (hit) {
        if (hit === MODES.MELODY) {
            if (mode === MODES.MELODY) {
                melodyPlaybackMode = melodyPlaybackMode === MELODY_PLAYBACK.BAR
                    ? MELODY_PLAYBACK.DRAWN_TIMING
                    : MELODY_PLAYBACK.BAR;
                sendMelodyPlaybackMode();
            } else {
                mode = MODES.MELODY;
            }
        } else {
            mode = hit;
        }
    }
}

function mouseReleased() {
    if (!currentTargetVST || !vsts[currentTargetVST]) {
        return;
    }

    socket.emit('drawing', {
        type: mode === MODES.WAVEFORM ? 'pen_up' : 'melody_pen_up',
        target: currentTargetVST
    });

    vsts[currentTargetVST].lockedY = null;
    prevX = null;
    prevY = null;
    strokeStartMs = null;
    prevPointMs = null;
}

function selectTabFromMouse() {
    const ids = Object.keys(vsts);
    if (ids.length === 0) {
        return;
    }

    const tabWidth = width / ids.length;
    const index = constrain(floor(mouseX / tabWidth), 0, ids.length - 1);
    currentTargetVST = ids[index];
    sendMelodyPlaybackMode();
}

function drawTabs() {
    const ids = Object.keys(vsts);
    if (ids.length === 0) {
        return;
    }

    const tabWidth = width / ids.length;

    ids.forEach((id, index) => {
        fill(id === currentTargetVST ? color(100, 255, 100) : color(80));
        stroke(0);
        rect(index * tabWidth, 0, tabWidth, UI.TAB_HEIGHT);

        fill(0);
        noStroke();
        textSize(16);
        textAlign(CENTER, CENTER);
        text(`VST: ${id.substring(0, 6)}`, index * tabWidth + tabWidth / 2, UI.TAB_HEIGHT / 2);
    });
}

function getModeButtonLayout() {
    const centerX = width / 2;
    const y = height - UI.BUTTON_BOTTOM_MARGIN - UI.BUTTON_SIZE / 2;
    const leftX = centerX - (UI.BUTTON_SIZE / 2 + UI.BUTTON_GAP / 2);
    const rightX = centerX + (UI.BUTTON_SIZE / 2 + UI.BUTTON_GAP / 2);

    return {
        [MODES.WAVEFORM]: { x: leftX, y },
        [MODES.MELODY]: { x: rightX, y }
    };
}

function drawModeButtons() {
    const layout = getModeButtonLayout();
    const left = layout[MODES.WAVEFORM].x - UI.BUTTON_SIZE / 2;
    const top = layout[MODES.WAVEFORM].y - UI.BUTTON_SIZE / 2;
    const totalWidth = UI.BUTTON_SIZE * 2 + UI.BUTTON_GAP;
    const totalHeight = UI.BUTTON_SIZE;

    noStroke();
    fill(15, 15, 20, 120);
    rect(left - 14, top - 12, totalWidth + 28, totalHeight + 24, 20);

    drawModeButton(layout[MODES.WAVEFORM], MODES.WAVEFORM);
    drawModeButton(layout[MODES.MELODY], MODES.MELODY);
}

function drawModeButton(position, buttonMode) {
    const active = mode === buttonMode;

    stroke(active ? color(240, 240, 240) : color(160, 160, 160));
    strokeWeight(active ? 3 : 2);
    const activeButtonColor = buttonMode === MODES.WAVEFORM ? color(75, 180, 255) : color(255, 180, 100);
    fill(active ? activeButtonColor : color(35, 35, 35, 220));
    circle(position.x, position.y, UI.BUTTON_SIZE);

    if (buttonMode === MODES.WAVEFORM) {
        drawWaveIcon(position.x, position.y, active);
    } else {
        drawMelodyIcon(position.x, position.y, active);
        drawMelodyPlaybackBadge(position.x, position.y + UI.BUTTON_SIZE * 0.42);
    }
}

function drawMelodyPlaybackBadge(x, y) {
    const label = melodyPlaybackMode === MELODY_PLAYBACK.BAR ? 'BAR' : 'DRAW';
    const w = 42;
    const h = 18;

    noStroke();
    fill(0, 0, 0, 190);
    rectMode(CENTER);
    rect(x, y, w, h, 6);
    rectMode(CORNER);

    fill(255);
    textSize(10);
    textAlign(CENTER, CENTER);
    text(label, x, y + 0.5);
}

function drawWaveIcon(cx, cy, active) {
    noFill();
    stroke(active ? color(10, 30, 55) : color(245));
    strokeWeight(4);

    beginShape();
    for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const x = cx - 22 + t * 44;
        const y = cy + sin(t * TWO_PI) * 9;
        vertex(x, y);
    }
    endShape();
}

function drawMelodyIcon(cx, cy, active) {
    noFill();

    // Use the music notes emoji as a base for the melody icon
    textSize(32);
    textAlign(CENTER, CENTER);
    text('🎵', cx, cy + 2);

}

function isPointInModeButton(x, y) {
    return getModeButtonHit(x, y) !== null;
}

function getModeButtonHit(x, y) {
    const layout = getModeButtonLayout();
    const radius = UI.BUTTON_SIZE / 2;

    for (const key of [MODES.WAVEFORM, MODES.MELODY]) {
        const p = layout[key];
        if (dist(x, y, p.x, p.y) <= radius) {
            return key;
        }
    }

    return null;
}

function sendMelodyPlaybackMode() {
    if (!socket || !currentTargetVST) {
        return;
    }

    socket.emit('drawing', {
        type: 'melody_mode',
        mode: melodyPlaybackMode,
        target: currentTargetVST
    });
}
