var net = require('net');

var irc = require('../lib/irc');
var test = require('tape');

var testHelpers = require('./helpers');

['when ended', 'when connection breaks'].forEach(function(modifier) {
    test('it reconnects with exactly one connection at a time ' + modifier, function(t) {
        var mock = testHelpers.MockIrcd();
        var client = new irc.Client('localhost', 'testbot', {debug: true, retryDelay: 50});

        var conn = null;
        var registerCount = 0;

        mock.server.on('connection', function(c) {
            conn = c;
            mock.send(':localhost 001 testbot :Welcome to the Internet Relay Chat Network testbot\r\n');
        });

        var firstTime = function() {
            if (modifier == 'when ended') {
                // trigger client connection end, like connection interrupted
                client.end();
            } else if (modifier == 'when connection breaks') {
                // break connection from server end, like connection error
                conn.destroy();
            } else {
                throw new Error("Unexpected test modifier");
            }

            client.once('registered', secondTime);

            // reconnects after 50ms, should take less than 450ms to connect, so end the test after that
            setTimeout(function() {
                killServer();
            }, 500);
        };

        var secondTime = function() {
            // further connections should be considered bad
            mock.server.on('connection', function() {
                t.ok(false);
            });
        }

        var killServer = function() {
            t.equal(registerCount, 2, 'connected to server exactly twice');
            t.end();
            client.disconnect();
            mock.close();
        }

        client.once('registered', firstTime);
        client.on('registered', function() { registerCount += 1; });
    });
});
