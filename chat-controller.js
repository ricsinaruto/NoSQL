const chatService = require('./chat-service.js');
const _ = require('lodash');

const chatController = {};

// Inicializáljuk a beállításokat
let selectedRoom = '';
let myUsername = '';
let myAvatar = '';

// Bejelentkezéskor meghívódik és inicializálja a default szobát
chatController.login = function () {
    let usernameInput = document.getElementById('usernameInput');
    let serverInput = document.getElementById('serverInput');
    let avatarInput = document.getElementById('avatarURL');

    if (_.isEmpty(usernameInput.value) || _.isEmpty(serverInput.value)) {
        alert('Kérlek add meg az összes adatot!');
    } else {
        myUsername = _.escape(usernameInput.value);
        myAvatar = _.escape(avatarInput.value);
        chatService.connect(usernameInput.value, serverInput.value, function () {
                //Sikeres csatlakozás esetén
                // Screen-t váltunk (szegényember SPA-ja)
                document.getElementById('login-window').style.display = 'none';
                document.getElementById('main-window').style.display = 'flex';

                // Kiírjuk a bejelentkezett felhasználó nevét
                document.getElementById('username').innerText = myUsername;
                chatController.refreshUsers();
                chatController.refreshRooms();
            },
            function (err) {
                alert("Nem sikerült csatlakozni az adatbázishoz: " + err)
            },
            // Új üzenet érkezett valahova (esemény a room_channel-ben)
            function (roomName) {
                chatController.refreshRoom(roomName);
            },
            // Változott a felhasználók száma
            function () {
                chatController.refreshUsers();
            },
            function () {
                chatController.refreshRooms();
            });
    }
};

// Megjelenít egy új üzenetet az üzenő területen
chatController.renderNewMessage = function (message) {
    // Megkeressük a DOM-ban a "messages" ID-val rendelkező üzenő területet, ami egy rendezetlen lista (<ul>).
    let messageArea = document.getElementById('messages');

    // Kitöltünk és hozzáadunk egy új üzenetet a HTML sablon alapján
    messageArea.insertAdjacentHTML('beforeEnd',
        '<div class="media messages">' +
        '<img src=' + _.escape(message.avatarUrl) + 'width="40" height="40" class="mr-3 message-avatar">' +
        '<div class="media-body">' +
        '<h5 class="mt-0">' + _.escape(message.user) + '</h5>' + _.escape(message.content) +
        '</div>' +
        '</div>' +
        '<hr>'
    );

    // Lescrollozunk az üzenetek aljára
    document.getElementById('messages-panel').scrollTo(0, messageArea.scrollHeight);
};

// Megjelenít egy felhasználót a felhasználói területen
chatController.renderNewUser = function (user) {
    let userList = document.getElementById('user-list');
    let listedUser = _.escape(user);

    // Elnevezzük a két user közötti privát chatet jelző szobát, a sorrend fontos hogy kétirányú lehessen a kommunikáció
    let keys = _.orderBy([myUsername, listedUser]);
    let privateRoomName = keys[0] + '_' + keys[1];

    if (selectedRoom === privateRoomName) {
        // Ha már itt vagyunk nem kell linket készíteni.
        userList.insertAdjacentHTML('beforeEnd', '<li class="selector-panel-item selected"><b>' + listedUser + '</b></li>');
    } else {
        userList.insertAdjacentHTML('beforeEnd', '<li class="selector-panel-item" onclick="chatController.changeRoom(\'' + privateRoomName + '\')">' + listedUser + '</li>');
    }
};

chatController.renderNewRoom = function (room) {
    let roomList = document.getElementById('channel-list');
    let listedRoom = _.escape(room);

    if (selectedRoom === listedRoom) {
        // Ha már itt vagyunk nem kell linket készíteni.
        roomList.insertAdjacentHTML('beforeEnd', '<li class="selector-panel-item selected"><b>' + listedRoom + '</b></li>');
    } else {
        roomList.insertAdjacentHTML('beforeEnd', '<li class="selector-panel-item" onclick="chatController.changeRoom(\'' + listedRoom + '\')">' + listedRoom +  '</li>');
    }
};

// Új üzenetet küldünk a felhasználónkkal
chatController.sendMessage = function () {
    let textInput = document.getElementById('new-message-text');
    if (!_.isEmpty(textInput.value)) {
        let message = {
            avatarUrl: myAvatar,
            user: myUsername,
            content: textInput.value,
            date: new Date()
        };
        chatController.renderNewMessage(message);
        chatService.sendMessage(selectedRoom, message);
    }
    textInput.value = '';
};

// Ha megváltoztatjuk a szobát
chatController.changeRoom = function (roomName) {
    //console.log(roomName);
    selectedRoom = roomName;
    chatController.refreshRooms();
    chatController.refreshRoom();
    chatController.refreshUsers();
};

// Frissítjük a szoba üzeneteinek tartalmát
chatController.refreshRoom = function () {
    document.getElementById('messages').innerHTML = '';

    // Betöltjük az üzeneteket
    chatService.getMessages(selectedRoom, function (messages) {
        _.forEach(messages, function (message) {
            chatController.renderNewMessage(message);
        })
    });
};

chatController.refreshRooms = function () {
    document.getElementById('channel-list').innerHTML = '';
    chatService.getRooms( function(rooms) {
        _.forEach(rooms, function (room) {
            chatController.renderNewRoom(room.name);
        })
    });
};

// Frissítjük a felhasználói lista tartalmát
chatController.refreshUsers = function () {
    document.getElementById('user-list').innerHTML = '';
    // Betöltjük a felhasználókat (magunkat nem írjuk ki)
    chatService.getUsers(function (users) {
        _.forEach(users, function (user) {
            if (myUsername !== user) {
                chatController.renderNewUser(user);
            }
        });
    });
};

module.exports = chatController;
