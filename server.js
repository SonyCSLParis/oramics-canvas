var express = require('express');
var app = express();
var server = app.listen(3333, '0.0.0.0', () => {
  console.log('Oramics Hub running on port 3333');
});

app.use(express.static('public'));

var socket = require('socket.io');
var io = socket(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

let activeVsts = []; 

io.sockets.on('connection', (socket) => {
    console.log("New connection: " + socket.id);

    socket.on('iam_active', (data) => {
        if (!activeVsts.includes(socket.id)) {
            activeVsts.push(socket.id);
        }
        io.emit('vst_list', activeVsts); 
    });

    socket.on('request_current_vst', () => {
        socket.emit('vst_list', activeVsts);
    });

    socket.on('drawing', (data) => {        
        socket.broadcast.emit('to_nannou', data);
        
        if (data.target) {
            io.to(data.target).emit('to_vst', data);
        } 
        else if (data.type === 'clear') {
            io.emit('to_vst', data);
        }
    });

    socket.on('disconnect', () => {
        const initialLength = activeVsts.length;
        activeVsts = activeVsts.filter(id => id !== socket.id);
        
        if (activeVsts.length !== initialLength) {
            io.emit('vst_list', activeVsts);
        }
    });
});