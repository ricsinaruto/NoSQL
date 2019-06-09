let _ = require('lodash');
let mongoose = require('mongoose');
let redis = require('redis');

const roomsChannel = 'rooms_channel';
const usersChannel = 'users_channel';
let redisClient;
let redisSubscriberClient;

const chatService = {};

// A felhasználónk neve
let myUsername;

// Az üzenet model leírása
const Message = mongoose.model('Message', new mongoose.Schema({
    avatarUrl: String,
    user: String,
    date: Date,
    content: String,
    room: String
}));

const Room = mongoose.model('channel', new mongoose.Schema({
    name: String
}));

// Csatlakozáskor hívott függvény
chatService.connect = function (username, serverAddress, successCb, failCb, messageCallback, userCallback, channelCallback) {
    myUsername = username;
    let dbReady = false;
    let mqReady = false;

    let db = mongoose.connect('mongodb://bi-chat:bi-chat@' + serverAddress + ':27017/bi-chat?authSource=admin', {useNewUrlParser: true});
    redisClient = redis.createClient({
        host: serverAddress, retry_strategy: function () {
        }
    });

    // Ha minden kapcsolat felépült
    function connectionSuccesfull() {
        // Felvesszük magunkat az online user listára
        redisClient.zadd(usersChannel, 0, username);

        // Szólunk a channelen hogy bejelentkeztünk
        redisClient.publish(usersChannel, username);


        // Feliratkozunk az eseményekre amiket figyelnünk kell
        // A subscribehoz külön kliens kell, ezért lemásoljuk az eredetit
        redisSubscriberClient = redisClient.duplicate();
        redisSubscriberClient.subscribe(roomsChannel);
        redisSubscriberClient.subscribe(usersChannel);
        redisSubscriberClient.subscribe('channels_channel');
        redisSubscriberClient.on('message', function (channel, message) {
            if (channel === roomsChannel) {
                // Ha a szoba channel-be érkezik üzenet azt jelenti valamelyik szobába frissíteni kell az üzeneteket
                console.log('message');
                messageCallback(message);
            } else if (channel === usersChannel) {
                // Ha a user channelbe érkezik üzenet azt jelenti változott a user lista
                console.log('user');
                userCallback();

            } else if (channel === 'channels_channel') {
                console.log("THIS");
                channelCallback();
            }
        });

        successCb();
    }

    // Nem tudjuk a kettő CB közül melyik hívódik meg előszőr, így a második után fogunk csak visszahívni
    db.then(function () {
        dbReady = true;
        if (mqReady === true) {
            connectionSuccesfull();
        }
    }, failCb);

    // Redis kliens eseményei
    redisClient.on('ready', function () {
        mqReady = true;
        if (dbReady === true) {
            // Ha a DB kapcsolatot is felépítettük bejelentkezünk
            connectionSuccesfull();
        }
    });
    redisClient.on('error', failCb);

    chatService.sendRoom();
};

// Lecsatlakozik a szerverről
chatService.disconnect = function () {
    if (!_.isUndefined(redisClient)) {
        redisClient.zrem(usersChannel, myUsername);
        redisClient.publish(usersChannel, myUsername);
    }
};

// Visszaadja a szobában található üzeneteket
chatService.getMessages = function (roomId, cb) {
    Message.find({room: roomId}, function (err, msg) {
        cb(msg)
    });
};

//
chatService.getRooms1 = function (cb) {
    redisClient.zrange('channels_channel', 0, -1, function (error, result) {
        cb(result);
    });
};

chatService.getRooms = function (cb) {
    Room.find({}, function (err, msg) {
        cb(msg)
    });
};

// Visszaadja a bejelentkezett usereket
chatService.getUsers = function (cb) {
    redisClient.zrange(usersChannel, 0, -1, function (error, result) {
        cb(result);
    });
};

// Üzenetet küld
chatService.sendMessage = function (roomId, message) {
    let msg = new Message({
        avatarUrl: message.avatarUrl,
        user: myUsername,
        date: message.date,
        content: message.content,
        room: roomId
    });
    msg.save().then(function () {
        // Szólunk hogy frissítettük a szobában az üzeneteket
        redisClient.publish(roomsChannel, roomId)
    })
};

chatService.sendRoom = function () {
    let room = new Room({
        name: 'Csáky Ricsi dungeon'
    });
    room.save().then(function () {
        // Szólunk hogy frissítettük a szobában az üzeneteket
        redisClient.publish('channels_channel', 'Csáky Ricsi dungeon');
    })
};

module.exports = chatService;
