var irc = require('../lib/irc');
var test = require('tape');

var testHelpers = require('./helpers');

// 433-before-001, err_nicknameinuse before rpl_welcome
test('it connects, renicks, and sets hostmask properly when nick in use', function(t) {
    var client, mock;

    mock = testHelpers.MockIrcd();
    client = new irc.Client('localhost', 'testbot', {debug: true});

    var sentCommands = [
        "NICK testbot", // client sends NICK message
        "USER nodebot 8 * :nodeJS IRC client", // client sends USER message
        "NICK testbot1", // client sends proper response to 'nickname in use' message
        "QUIT :node-irc says goodbye" // client sends QUIT message
    ];
    var receivedMessages = [
        ":localhost 433 * testbot :Nickname is already in use.\r\n",
        ":localhost 001 testbot1 :Welcome to the Internet Relay Chat Network testbot\r\n"
    ];

    // 1 for messages to server (deepEqual one array)
    // 1 for messages from server (deepEqual one array)
    // 3 for client info
    t.plan(1 + 1 + 3);

    mock.server.on('connection', function() {
        mock.send(':localhost 433 * testbot :Nickname is already in use.\r\n');
        mock.greet('testbot1');
    });

    client.on('registered', function() {
        t.deepEqual(mock.outgoing, receivedMessages, 'mock must send correct messages');
        client.disconnect(function() {
            t.equal(client.hostMask, 'testbot', 'hostmask is as expected after 433');
            t.equal(client.nick, 'testbot1', 'nick is as expected after 433');
            t.equal(client.maxLineLength, 482, 'maxLineLength is as expected after 433');
        });
    });

    mock.on('end', function() {
        var msgs = mock.getIncomingMsgs();
        t.deepEqual(msgs, sentCommands, 'client must send correct messages');
        mock.close();
    });
});
