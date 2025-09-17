var fs = require('fs');
var cors = require('cors')
const express = require('express');
const app = require('express')();

app.use(cors());

const { v4: uuidv4 } = require('uuid');

const http = require('http').createServer(app);
const https = require('https');
const port = process.env.PORT || 40010;


let server;

if (fs.existsSync('./file.pem') && fs.existsSync('./file.crt')) {
    console.log("🔒 Using HTTPS with SSL certs");
    server = https.createServer({
        key: fs.readFileSync('./file.pem'),
        cert: fs.readFileSync('./file.crt')
    }, app);
} else {
    console.log("🌐 Using HTTP (no SSL certs found)");
    server = http.createServer(app);
}

var users = [];

var whitelist = ['https://mypage.esuccess-inc.com',
    'https://mypage.mytutor-jpn.com',
    'https://beta.mytutor-jpn.com'
]

var corsOptionsDelegate = function (req, callback) {
    var corsOptions;
    if (whitelist.indexOf(req.header('Origin')) !== -1) {
        corsOptions = { origin: true } // reflect (enable) the requested origin in the CORS response
    } else {
        corsOptions = { origin: false } // disable CORS for this request
    }
    callback(null, corsOptions) // callback expects two parameters: error and options
}


const io = require("socket.io")(server, { cors: { origin: "*", methods: ["GET", "POST"] } });
//const io = require('socket.io')(server, { wsEngine: 'ws' }, { cors: { origin: "*", methods: ["GET", "POST"], transports: ['websocket', 'polling'], credentials: true }, allowEIO3: true });

const { ExpressPeerServer } = require('peer');

const customGenerationFunction = () => (Math.random().toString(36) + '0000000000000000000').substr(2, 16);

const peer = ExpressPeerServer(server, {
    //'generateClientId': customGenerationFunction,
    'debug': true,
    'port': port,
    'key': 'peerjs',
    'ssl': {
        key: fs.readFileSync('./file.pem'),
        cert: fs.readFileSync('./file.crt')
    },
    'allow_discovery': true
});


app.use('/peerjs', peer);
app.set('view engine', 'ejs')
app.use(express.static('public'))




app.get('/', (req, res) => {
    res.send(uuidv4());
});

app.get('/:room', cors(corsOptionsDelegate), (req, res) => {
    res.render('index', { RoomId: req.params.room });
});



var users = [];
var roomUsers = [];
let rooms = {}; // { roomId: { host: peerId, clients: [] } }

io.on("connection", (socket) => {

    console.log("🔌 New client connected:", socket.id);


    // Host creates a room
    socket.on("create-room", ({ roomId, peerId }) => {
        rooms[roomId] = { host: peerId, clients: [] };
        socket.join(roomId);
        console.log(`Room ${roomId} created by host ${peerId}`);
    });

    // Client joins an existing room
    socket.on("join-room", ({ roomId, peerId }) => {
        if (!rooms[roomId]) {
        console.log("Room "+ roomId + " does not exist " )
        socket.emit("room-error", "Room does not exist");
        return;
        }
        rooms[roomId].clients.push(peerId);
        socket.join(roomId);

        console.log(`Client ${peerId} joined room ${roomId}`);

        // Notify host about new client
        socket.to(roomId).emit("new-client", peerId);

        // Send host ID back to client
        socket.emit("host-info", rooms[roomId].host);
    });


    socket.on("rejoin-host", ({ roomId, peerId }) => {
        console.log("rejoin-room" + roomId + " : " + peerId)
        socket.to(roomId).emit("reconnect-host", peerId);
    });    

    socket.on('newUser', data => {
        let id = data.id;
        let roomID = data.roomID;
        let user = data.user;

        console.log("newUser : ", id, roomID, user.userid);

        socket.join(roomID);
        socket.to(roomID).broadcast.emit('userJoined', data);
        socket.on('disconnect', () => {
            socket.to(roomID).broadcast.emit('userDisconnect', id);
        });
    });


    socket.on('changeMedia', (data) => {
        console.log("user change media ");
        let id = data.id;
        let roomID = data.roomID;
        let user = data.user;
        let videoStream = data.videoStream;
        socket.join(roomID);
        socket.to(roomID).broadcast.emit('mediaChanged', data);
    });


      socket.on("host-start-screenshare", ({ roomId }) => {
          console.log("host has started screen sharing");
          socket.to(roomId).broadcast.emit('host-started-sharing', roomId);
      });


      socket.on("host-stop-screenshare", ({ roomId }) => {
          console.log("user hast stopped screen sharing");
          socket.to(roomId).broadcast.emit('host-stopped-sharing', roomId);
      });

    socket.on("REGISTER", (user) => {

        console.log("📢 User registered:", user.userid);

        // Example: join a channel/room
        if (user.channelid) {
            socket.join(user.channelid);
            console.log(`✅ User ${user.userid} joined channel ${user.channelid}`);

            // Notify others in the same room
            socket.to(user.channelid).emit("userJoined", user);
        }
    });

    /*****************************************/
    /*  MEMBER ALL PAGE CALL TO ACTIONS
    /*****************************************/
    socket.on("CALL_USER", (data) => {
        console.log("call user", data);
        //io.to('' + data.channelid + '').emit("CALL_USER", data);
        io.sockets.emit("CALL_USER", data);
    });

    socket.on("CALL_USER_PINGBACK", (data) => {
        console.log("call user pingback");
        io.to(data.channelid).emit("CALL_USER_PINGBACK", data);
    });


    socket.on("ACCEPT_CALL", (data) => {
        console.log("accpet call");
        io.sockets.emit("ACCEPT_CALL", data);
    });


    socket.on("DROP_CALL", (data) => {
        io.sockets.emit("DROP_CALL", data);
    });


    socket.on("disconnect", () => {
        console.log("❌ Client disconnected:", socket.id);
    });


    /*****************************************/
    /*  CANVAS SERVER
    /*****************************************/
    socket.on("START_SLIDER", (data) => {
        io.sockets.emit("START_SLIDER", data);
    });

    socket.on("SEND_DRAWING", (data) => {
        console.log("send drawing")
        io.to(data.channelid).emit('UPDATE_DRAWING', data);
    });

    socket.on("CREATE_NEW_SLIDE", (data) => {
        io.to('' + data.channelid + '').emit("CREATE_NEW_SLIDE", data);
    });

    socket.on("GOTO_SLIDE", (data) => {
        io.to(data.channelid).emit("GOTO_SLIDE", data);
    });

    socket.on("SEND_SLIDE_PRIVATE_MESSAGE", (data) => {
        io.to(data.channelid).emit("SEND_SLIDE_PRIVATE_MESSAGE", data);
    });

    socket.on("TUTOR_SELECTED_NEW_SLIDES", (data) => {
        io.to(data.channelid).emit("TUTOR_SELECTED_NEW_SLIDES", data);
    });




    /*****************************************/
    /*  SESSION ACTIONS
    /*****************************************/

    socket.on("JOIN_SESSION", (data) => {
        io.to( data.channelid).emit("JOIN_SESSION", data);
    });

    //@desc: this will send a ping to determin if online
    socket.on("JOIN_SESSION_PINGBACK", (data) => {
        io.to(data.channelid).emit("JOIN_SESSION_PINGBACK", data);
    });


    //@desc: this will send a pingback to sender to signal online status
    socket.on("TUTOR_JOINED", (data) => {
        io.to(data.channelid).emit("TUTOR_JOINED", data);
    });


    socket.on("MEMBER_JOINED", (data) => {
        io.to(data.channelid).emit("MEMBER_JOINED", data);
    });

    socket.on("LEAVE_SESSION", (data) => {
        io.to(data.channelid).emit("LEAVE_SESSION", data);
    });


    socket.on("START_SESSION", (data) => {
        console.log("START_SESSION", data)
        io.to(data.channelid).emit("START_SESSION", data);
        //io.to(data.channelid).emit("TEST_START_TIMER", data);
    });

    socket.on("CANCEL_SESSION", (data) => {
        io.to(data.channelid).emit("CANCEL_SESSION", data);
    });

    socket.on("END_SESSION", (data) => {
        io.to(data.channelid).emit("END_SESSION", data);
    });

    socket.on("START_MEMBER_TIMER", (data) => {
        console.log("start member timer emitted by tutor")
        io.to(data.channelid).emit("START_MEMBER_TIMER", data);
    });

    socket.on("PAUSE_MEMBER_TIMER", (data) => {
        io.to(data.channelid).emit("PAUSE_MEMBER_TIMER", data);
    });

    socket.on("STOP_MEMBER_TIMER", (data) => {
        io.to(data.channelid).emit("STOP_MEMBER_TIMER", data);
    });    

});


server.listen(port, () => {
    console.log("https listening at: " + port);
});
