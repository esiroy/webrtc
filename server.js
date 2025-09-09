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

io.on("connection", (socket) => {    


    console.log("test user connected, with id " + socket.id)

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




    /*****************************************/
    /*  CANVAS AUDIO PLAYER CONTROL SERVER
    /*****************************************/

    socket.on("PLAY_AUDIO", (data) => {
        console.log("> PLAY_AUDIO", data);
        io.to(data.channelid).emit("PLAY_AUDIO", data);
        //io.sockets.emit("PAUSE_AUDIO", data);
    });

    socket.on("GOTO_AUDIO", (data) => {
        console.log(">>| GOTO_AUDIO", data);
        io.to(data.channelid).emit("GOTO_AUDIO", data);
        //io.sockets.emit("PAUSE_AUDIO", data);
    });

    socket.on("PAUSE_AUDIO", (data) => {
        console.log("|| PAUSE_AUDIO", data);
        io.to(data.channelid).emit("PAUSE_AUDIO", data);
        //io.sockets.emit("PAUSE_AUDIO", data);
    });

    socket.on("NEXT_AUDIO", (data) => {
        console.log(">> next audio file", data);
        io.to(data.channelid).emit("NEXT_AUDIO", data);
        //io.sockets.emit("NEXT_AUDIO", data);
    });

    socket.on("PREV_AUDIO", (data) => {
        console.log("<< previous audio file", data)
        io.to(data.channelid).emit("PREV_AUDIO", data);
        //io.sockets.emit("PREV_AUDIO_FILE", data);
    });

    socket.on("SEEK_AUDIO", (data) => {
        console.log("<<Time>> SEEK", data)
        io.to(data.channelid).emit("SEEK_AUDIO", data);
        //io.sockets.emit("PREV_AUDIO_FILE", data);
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
    
    socket.on("userShare", (room, videoStream) => {    
    	console.log("user shared");    	
    	socket.join(room);    		
	    socket.to(room).broadcast.emit('userShared', videoStream);
    });

    
    /*****************************************/
    /*  MEMBER ALL PAGE CALL TO ACTIONS
    /*****************************************/

    socket.on("CALL_USER", (data) => {

        console.log("CALL_USER", data.user.nickname);

        //io.to('' + data.channelid + '').emit("CALL_USER", data);
        io.sockets.emit("CALL_USER", data);
    });

    socket.on("CALL_USER_PINGBACK", (data) => {

        console.log("CALL_USER_PINGBACK", data);

        io.to('' + data.channelid + '').emit("CALL_USER_PINGBACK", data);
    });


    socket.on("ACCEPT_CALL", (data) => {

        console.log("ACCEPT_CALL", data);

        io.sockets.emit("ACCEPT_CALL", data);
        
    });


    socket.on("DROP_CALL", (data) => {

         console.log("ACCEDROP_CALLPT_CALL", data);

        io.sockets.emit("DROP_CALL", data);
    });


 /*****************************************/
    /*  SESSION ACTIONS
    /*****************************************/

    socket.on("JOIN_SESSION", (data) => {
        io.to('' + data.channelid + '').emit("JOIN_SESSION", data);
    });

    //@desc: this will send a ping to determin if online
    socket.on("JOIN_SESSION_PINGBACK", (data) => {
        io.to('' + data.channelid + '').emit("JOIN_SESSION_PINGBACK", data);
    });


    //@desc: this will send a pingback to sender to signal online status
    socket.on("TUTOR_JOINED", (data) => {
        io.to('' + data.channelid + '').emit("TUTOR_JOINED", data);
    });


    socket.on("MEMBER_JOINED", (data) => {
        io.to('' + data.channelid + '').emit("MEMBER_JOINED", data);
    });

    //socket.on("LEAVE_CANVAS_SESSION", (data) => {
        //WHEN USER LEFT THE SESSION, MAKE THE CANVAS USER LEAVE TO
       //io.to('' + data.channelid + '').emit("LEAVE_CANVAS_SESSION", data);
    //});


    socket.on("START_SESSION", (data) => {
        io.to('' + data.channelid + '').emit("START_SESSION", data);
    });

    socket.on("CANCEL_SESSION", (data) => {
        io.to('' + data.channelid + '').emit("CANCEL_SESSION", data);
    });

    socket.on("END_SESSION", (data) => {
        io.to('' + data.channelid + '').emit("END_SESSION", data);
    });



    socket.on("START_MEMBER_TIMER", (data) => {
        io.to('' + data.channelid + '').emit("START_MEMBER_TIMER", data);
    });

    socket.on("PAUSE_MEMBER_TIMER", (data) => {
        io.to('' + data.channelid + '').emit("PAUSE_MEMBER_TIMER", data);
    });

    socket.on("STOP_MEMBER_TIMER", (data) => {
        io.to('' + data.channelid + '').emit("STOP_MEMBER_TIMER", data);
    });
    

    /*****************************************/
    /*  CANVAS SERVER
    /*****************************************/


    socket.on("START_SLIDER", (data) => {
        io.sockets.emit("START_SLIDER", data);
    });

    socket.on("SEND_DRAWING", (data) => {
        io.to('' + data.channelid + '').emit('UPDATE_DRAWING', data);
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
    

    /*****************************************/
    /*  ADMIN CHAT SUPPORT MESSENGER 
    /*****************************************/

    socket.on("SEND_USER_MESSAGE", function(data) {

        console.log("SEND_USER_MESSAGE ", data.recipient.username);

        //io.sockets.connected[data.id].emit("PRIVATE_MESSAGE", data);
        /*
        for (var i in users) {

            if (data.recipient.username == users[i].username) 
            {              
                io.sockets.connected[users[i].id].emit("PRIVATE_MESSAGE", data);
                //break;
            }            
        }*/

        io.sockets.emit("PRIVATE_MESSAGE", data);

        //this.handleUserPrivateMsg(data);
    });

    socket.on("SEND_OWNER_MESSAGE", function(data) {

        io.emit('OWNER_MESSAGE', data);
        //this.handleUserPrivateMsg(data);
    });

    socket.on('JOIN_CHANNEL', function(data) {
        const { channelID } = data;
    
        // Join the specified channel room
        socket.join(channelID);
    
        // Optionally, you can emit a confirmation back to the client
        socket.emit('CHANNEL_JOINED', { channelID });
    });
    
    /*Register connected user*/
    socket.on('REGISTER', function(user) {

        console.log("joined", user);

        //console.log("user connected, with id " + socket.id + " " + user.username)

        //remove if ever there is same userid
        /*
        for (var i in users) {
            if (users[i].userid === user.userid) {
                delete users[i];
                break;
            }
        }*/

        socket.join(user.channelid);


        users = users.filter(function(element) {
            return element !== undefined;
        });

        users.push({
            'id': socket.id,
            'channelid': user.channelid,
            'userid': user.userid,
            'username': user.username,
            'user_image': user.user_image,
            'nickname': user.nickname,
            'status': user.status,
            'type': user.type,
            'chat_type': user.chat_type
        });


        update_user_list();
    });


    //THIS WILL EMIT THE USER LIST TO CLIENT SIDE
    function update_user_list() {

        io.emit('update_user_list', users);
    }

    //Removing the socket on disconnect
    socket.on('disconnect', function() {

        for (var i in users) {
            if (users[i].id === socket.id) {
                if (users[i].channelid == null) {

                    console.log("user left session",  users[i])
                    io.emit('LEAVE_SESSION', users[i]);

                } else if (users[i].chat_type == 'canvas' ) {

                    console.log("user left CANVAS session",  users[i])               
                    io.to('' + users[i].channelid + '').emit("LEAVE_CANVAS_SESSION", users[i]);
                }                
                
                //delete users[i];
                users.splice(i, 1); // Remove the user from the array
                break;
            }
        }

        

        users = users.filter(function(element) {
            return element !== undefined;
        });

        update_user_list();
    });

    //default (public)
    socket.on('SEND_MESSAGE', function(data) {
        io.emit('MESSAGE', data)
    });

    // Private message handling
    socket.on('SEND_PRIVATE_MESSAGE', function(data) {

        console.log("SEND_PRIVATE_MESSAGE", data.recipientID);

        io.to('' + data.recipientID + '').emit("PRIVATE_MESSAGE_SENT", data);
    });    

});



server.listen(port, () => {
    console.log("https listening at: " + port);
});
