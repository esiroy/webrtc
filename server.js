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



var whitelist = ['https://mypage.esuccess-inc.com', 'https://mypage.mytutor-jpn.com']

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

io.on("connection", (socket) => {

    

    socket.on('newUser', function(data) {
        let peerid = data.id;
        let roomID = data.roomID;
        
        users.push({
            'id': socket.id,
            'peerid': peerid,
            'userid': data.user.userid,
            'username': data.user.username,
            'user_image': data.user.user_image,
            'nickname': data.user.nickname,
            'status': data.user.status,
            'type': data.user.type,
        });      
        
        console.log("new user joined", data.user.username);

        socket.join(roomID);
        socket.to(roomID).broadcast.emit('userJoined', data);
    
    });
    
    socket.on('disconnect', function() {

        console.log("disconnect", socket.id);

        for (var i in users) {
            if (users[i].id === socket.id) {

               console.log("disconnected user :", users[i])

                io.emit('WEBRTC_USER_LEAVE_SESSION', users[i]);
                delete users[i];
                break;
            }
        }      

        users = users.filter(function(element) {
            return element !== undefined;
        });

        update_webrtc_user_list();        
    });    
    


    function update_webrtc_user_list() {

        io.emit('update_webrt_user_list', users);
    }


    socket.on('changeMedia', (data) => {
    
    	console.log("user change media ");
    	
          
        let id = data.id;
        let roomID = data.roomID;
        let user = data.user;
        let videoStream = data.videoStream;
            	
    	socket.join(roomID);    		
	    socket.to(roomID).broadcast.emit('mediaChanged', data);    
    
    });
    
    socket.on("userShare", (room, videoStream) => {
    
    	console.log("user shared");
    	
    	socket.join(room);    		
	socket.to(room).broadcast.emit('userShared', videoStream);
    });

    
});



server.listen(port, () => {
    console.log("https listening at: " + port);
});
