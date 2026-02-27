let socket;
let vsts = {};
let currentTargetVST = null;
let prevX = null;
let prevY = null;
let mode = 'waveform';

function setup() {
    createCanvas(windowWidth, windowHeight);
    socket = io.connect('http://10.0.3.34:3333');

    socket.on('vst_list', (list) => {
        list.forEach(id => {
            if (!vsts[id]) {
                let waveGl = createGraphics(windowWidth, windowHeight);
                waveGl.clear();
                let melodyGl = createGraphics(windowWidth, windowHeight);
                melodyGl.clear();
                vsts[id] = { waveLayer: waveGl, melodyLayer: melodyGl, lockedY: null };
            }
        });

        Object.keys(vsts).forEach(id => {
            if (!list.includes(id)) {
                vsts[id].waveLayer.remove();
                vsts[id].melodyLayer.remove();
                delete vsts[id];
            }
        });
        if (!list.includes(currentTargetVST)) {
            currentTargetVST = list.length > 0 ? list[0] : null;
        }
    });

    socket.on('connect', () => { socket.emit('request_current_vst'); });
}

function draw() {
    background(51);
    drawTabs();
    drawModeToggle();

    if (!currentTargetVST || !vsts[currentTargetVST])
        return;

    let current = vsts[currentTargetVST];
    let canvasTop = 100;
    let canvasH = height - canvasTop;

    image(current.waveLayer, 0, 0);
    image(current.melodyLayer, 0, 0);

    if (mouseIsPressed && current.lockedY !== null && mouseY > canvasTop) {
        stroke(255, 255, 255, 120);
        line(0, current.lockedY, width, current.lockedY);
    }

    if (mouseIsPressed && mouseY > canvasTop) {
        if (current.lockedY === null) {
            current.lockedY = mouseY;
            if (mode === 'waveform') {
                current.waveLayer.clear();
                // socket.emit('drawing', { type: 'clear', target: currentTargetVST });
            } else {
                current.melodyLayer.clear();
                // socket.emit('drawing', { type: 'melody_clear', target: currentTargetVST });
            }
            prevX = mouseX;
            prevY = mouseY;
            return;
        }

        if (prevX !== null && prevY !== null) {
            let x1 = prevX / width;
            let y1 = prevY / height;
            let x2 = mouseX / width;
            let y2 = mouseY / height;

            if (mode === 'waveform') {
                current.waveLayer.stroke(0, 255, 200);
                current.waveLayer.strokeWeight(4);
                current.waveLayer.line(prevX, prevY, mouseX, mouseY);
                socket.emit('drawing', {
                    type: 'drawing',
                    x1, y1, x2, y2,
                    target: currentTargetVST
                });
            } else {
                current.melodyLayer.stroke(255, 200, 100);
                current.melodyLayer.strokeWeight(4);
                current.melodyLayer.line(prevX, prevY, mouseX, mouseY);
                socket.emit('drawing', {
                    type: 'melody',
                    x1, y1, x2, y2,
                    target: currentTargetVST
                });
            }
        }
        prevX = mouseX;
        prevY = mouseY;
    }
}

function mouseReleased() {
    if (!currentTargetVST || !vsts[currentTargetVST])
        return;
    if (mode === 'waveform') {
        socket.emit('drawing', { type: 'pen_up', target: currentTargetVST });
    } else {
        socket.emit('drawing', { type: 'melody_pen_up', target: currentTargetVST });
    }
    vsts[currentTargetVST].lockedY = null;
    prevX = null;
    prevY = null;
}

function drawTabs() {
    let ids = Object.keys(vsts);
    if (ids.length === 0)
        return;

    let tabWidth = width / ids.length;
    let x = 0;

    for (let i = 0; i < ids.length; i++) {
        let id = ids[i];
        fill(id === currentTargetVST ? color(100, 255, 100) : color(80));
        stroke(0);
        rect(x, 0, tabWidth, 50);

        fill(0);
        noStroke();
        textSize(16);
        textAlign(CENTER, CENTER);
        text(`VST: ${id.substring(0, 6)}`, x + tabWidth / 2, 25);
        x += tabWidth;
    }
}

function drawModeToggle() {
    let buttonWidth = 100;
    let buttonHeight = 36;
    let y = 55;
    let gap = 8;

    fill(mode === 'waveform' ? color(80, 180, 255) : color(60));
    stroke(150);
    strokeWeight(1);
    rect(gap, y, buttonWidth, buttonHeight);
    fill(255);
    noStroke();
    textSize(14);
    textAlign(CENTER, CENTER);
    text('Waveform', gap + buttonWidth / 2, y + buttonHeight / 2);

    fill(mode === 'melody' ? color(255, 180, 80) : color(60));
    stroke(150);
    strokeWeight(1);
    rect(gap + buttonWidth + gap, y, buttonWidth, buttonHeight);
    fill(255);
    noStroke();
    text('Melody', gap + buttonWidth + gap + buttonWidth / 2, y + buttonHeight / 2);

    if (mode === 'melody') {
        fill(color(80, 255, 120));
        stroke(150);
        strokeWeight(1);
        rect(gap + (buttonWidth + gap) * 2, y, 60, buttonHeight);
        fill(0);
        noStroke();
        textSize(12);
        text('Play', gap + (buttonWidth + gap) * 2 + 30, y + buttonHeight / 2);
    }
}

function mousePressed() {
    let buttonWidth = 100;
    let buttonHeight = 36;
    let y = 55;
    let gap = 8;

    if (mouseY < 50) {
        let ids = Object.keys(vsts);
        if (ids.length === 0)
            return;
        let index = floor(mouseX / (width / ids.length));
        currentTargetVST = ids[index];
        return;
    }

    if (mouseY >= y && mouseY <= y + buttonHeight) {
        if (mouseX >= gap && mouseX <= gap + buttonWidth) {
            mode = 'waveform';
            return;
        }
        if (mouseX >= gap + buttonWidth + gap && mouseX <= gap + buttonWidth + gap + buttonWidth) {
            mode = 'melody';
            return;
        }
        if (mode === 'melody' && mouseX >= gap + (buttonWidth + gap) * 2 && mouseX <= gap + (buttonWidth + gap) * 2 + 60) {
            socket.emit('drawing', { type: 'melody_play', target: currentTargetVST });
            return;
        }
    }
}
