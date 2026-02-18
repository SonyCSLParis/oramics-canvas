let socket;
let vsts = {}; 
let currentTargetVST = null; 
let prevX = null;
let prevY = null;

function setup() {
    createCanvas(windowWidth, windowHeight);
    socket = io.connect('http://10.0.3.62:3333'); 

    socket.on('vst_list', (list) => {
        list.forEach(id => {
            if (!vsts[id]) {
                let gl = createGraphics(windowWidth, windowHeight);
                gl.clear();
                vsts[id] = { waveLayer: gl, lockedY: null };
            }
        });

        Object.keys(vsts).forEach(id => {
            if (!list.includes(id)) {
                vsts[id].waveLayer.remove(); 
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

    if (!currentTargetVST || !vsts[currentTargetVST])
         return;

    let current = vsts[currentTargetVST];
    if (mouseIsPressed && current.lockedY !== null) {
        stroke(255, 255, 255, 120);
        line(0, current.lockedY, width, current.lockedY);
    }

    image(current.waveLayer, 0, 0);

    if (mouseIsPressed && mouseY > 50) {
        if (current.lockedY === null) {
            current.lockedY = mouseY;
            current.waveLayer.clear(); 
            socket.emit('drawing', { type: 'clear', target: currentTargetVST });
            prevX = mouseX;
            prevY = mouseY;
            return;
        }

        if (prevX !== null && prevY !== null) {
            current.waveLayer.stroke(0, 255, 200);
            current.waveLayer.strokeWeight(4);
            current.waveLayer.line(prevX, prevY, mouseX, mouseY);
            socket.emit('drawing', {
                type: 'drawing',
                x1: prevX / width,
                y1: prevY / height,
                x2: mouseX / width,
                y2: mouseY / height,
                target: currentTargetVST
            });
        }
        prevX = mouseX;
        prevY = mouseY;
    }
}

function mouseReleased() {
    if (!currentTargetVST || !vsts[currentTargetVST])
         return;
    socket.emit('drawing', { type: 'pen_up', target: currentTargetVST });
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
        
        fill(0); noStroke(); textSize(16); textAlign(CENTER, CENTER);
        text(`VST: ${id.substring(0, 6)}`, x + tabWidth / 2, 25);
        x += tabWidth;
    }
}

function mousePressed() {
    if (mouseY < 50) {
        let ids = Object.keys(vsts);
        if (ids.length === 0)
             return;
        let index = floor(mouseX / (width / ids.length));
        currentTargetVST = ids[index];
    }
}
