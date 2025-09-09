var fs = require('fs');
var cors = require('cors')
const express = require('express');
const app = require('express')();

app.use(cors());

const { v4: uuidv4 } = require('uuid');

const http = require('http').createServer(app);
const https = require('https');
const port = process.env.PORT || 40010;

//const server = require('http').Server(app);

var users = [];

var server = https.createServer({
    key: fs.readFileSync('./file.pem'),
    cert: fs.readFileSync('./file.crt')
}, app);



var whitelist = ['https://mypage.esuccess-inc.com', 
    'https://mypage.mytutor-jpn.com', 
    'https://beta.mytutor-jpn.com'
]

var corsOptionsDelegate = function (req, callback) {
  var corsOptions;
  if (whitelist.indexOf(req.header('Origin')) !== -1) {
    corsOptions = { origin: true } // reflect (enable) the requested origin in the CORS response
  }else{
    corsOptions = { origin: false } // disable CORS for this request
  }
  callback(null, corsOptions) // callback expects two parameters: error and options
}


const io = require("socket.io")(server, { cors: { origin: "*", methods: ["GET", "POST"] }});





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

io.on("connection", (socket) => {
  console.log("🔌 New client connected:", socket.id);

  socket.on("REGISTER", (user) => {
    console.log("📢 User registered:", user);

    // Example: join a channel/room
    if (user.channelid) {
      socket.join(user.channelid);
      console.log(`✅ User ${user.userid} joined channel ${user.channelid}`);

      // Notify others in the same room
      socket.to(user.channelid).emit("userJoined", user);
    }
  });

  socket.on("CALL_USER", (data) => {
    console.log("call user");
    //io.to('' + data.channelid + '').emit("CALL_USER", data);
    io.sockets.emit("CALL_USER", data);
  });

  socket.on("CALL_USER_PINGBACK", (data) => {
    console.log("call user pingback");

    io.to('' + data.channelid + '').emit("CALL_USER_PINGBACK", data);
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
});


server.listen(port, () => {
    console.log("https listening at: " + port);
});
