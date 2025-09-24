var fs = require('fs');
var cors = require('cors');
const express = require('express');
const app = express();

app.use(cors());

const { v4: uuidv4 } = require('uuid');
const http = require('http');
const https = require('https');

const port = process.env.PORT || 40010;

// check if running locally (no ssl needed)
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

// whitelist for production
var whitelist = ['https://mypage.esuccess-inc.com', 'https://mypage.mytutor-jpn.com'];

var corsOptionsDelegate = function (req, callback) {
  var corsOptions;
  if (whitelist.indexOf(req.header('Origin')) !== -1) {
    corsOptions = { origin: true };
  } else {
    corsOptions = { origin: false };
  }
  callback(null, corsOptions);
};

/*
const io = require("socket.io")(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});
*/


const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  allowEIO3: true   // ✅ allow engine.io v3 clients
});


const { ExpressPeerServer } = require('peer');

const peer = ExpressPeerServer(server, {
  debug: true,
  key: 'peerjs',
  allow_discovery: true
});

app.use('/peerjs', peer);
app.set('view engine', 'ejs');
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send(uuidv4());
});

app.get('/:room', cors(corsOptionsDelegate), (req, res) => {
  res.render('index', { RoomId: req.params.room });
});

io.on("connection", (socket) => {

  //console.log("🔌 New client connected:", socket.id);

  socket.on("REGISTER", (user) => {
    
    //console.log("📢 User registered:", user);

    if (user.channelid) {

      socket.join(user.channelid);
      console.log(`✅ User ${user.userid} joined channel ${user.channelid}`);

      // Notify others in the same room
      socket.to(user.channelid).emit("userJoined", user);
    }
  });

    socket.on("CALL_USER", (data) => {
        //io.to('' + data.channelid + '').emit("CALL_USER", data);
        io.sockets.emit("CALL_USER", data);
    });

  socket.on("CALL_USER_PINGBACK", (data) => {
    console.log("call user pingback");

    io.to('' + data.channelid + '').emit("CALL_USER_PINGBACK", data);
  });


  socket.on("ACCEPT_CALL", (data) => {
    console.log("accept call");
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
        io.to(data.channelid).emit('UPDATE_DRAWING', data);        
    });
    

    socket.on("CREATE_NEW_SLIDE", (data) => {
        io.to('' + data.channelid + '').emit("CREATE_NEW_SLIDE", data);
    });


    socket.on("GOTO_SLIDE", (data) => {
        io.to('' + data.channelid + '').emit("GOTO_SLIDE", data);
    });


    socket.on("SEND_SLIDE_PRIVATE_MESSAGE", (data) => {
        io.to('' + data.channelid + '').emit("SEND_SLIDE_PRIVATE_MESSAGE", data);
    });


    socket.on("TUTOR_SELECTED_NEW_SLIDES", (data) => {
        io.to('' + data.channelid + '').emit("TUTOR_SELECTED_NEW_SLIDES", data);
    });





});


server.listen(port, () => {
  console.log(`🚀 Server listening at http://localhost:${port}`);
});
