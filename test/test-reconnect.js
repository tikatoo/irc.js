var irc = require('../lib/irc');
var test = require('tape');

var testHelpers = require('./helpers');

['when ended', 'when connection breaks'].forEach(function(modifier) {
    test('it reconnects with exactly one connection at a time ' + modifier, function(t) {
        var mock = testHelpers.MockIrcd();
        var client = new irc.Client('localhost', 'testbot', {debug: true, retryDelay: 50});

        var conns = [];
        var registerCount = 0;

        mock.server.on('connection', function(c) {
            conns.push(c);
            mock.greet();
        });

        var firstTime = function() {
            if (modifier == 'when ended') {
                // trigger client connection end, like connection interrupted
                client.end();
            } else if (modifier == 'when connection breaks') {
                // break connection from server end, like connection error
                conns[conns.length-1].destroy();
            } else {
                throw new Error("Unexpected test modifier");
            }

            client.once('registered', secondTime);

            // reconnects after 50ms, should take less than 450ms to connect, so end the test after that
            setTimeout(function() {
                killClient();
            }, 500);
        };

        var secondTime = function() {
            // further connections should be considered bad
            mock.server.on('connection', function() {
                t.ok(false, 'must only connect twice');
            });
        }

        var killClient = function() {
            mock.once('end', killedServer);
            client.disconnect();
        }

        var killedServer = function() {
            t.equal(registerCount, 2, 'must connect to server exactly twice');
            setTimeout(killConns, 500);
            mock.close(function(){ t.end(); });
        }

        var killConns = function() {
            conns.forEach(function(conn) {
                if (!conn.destroyed) {
                    t.ok(false, 'connections must end themselves properly');
                    conn.destroy();
                }
            });
        }

        client.once('registered', firstTime);
        client.on('registered', function() { registerCount += 1; });
    });
});

test('it disallows double connections', function(t) {
    var mock = testHelpers.MockIrcd();
    var client = new irc.Client('localhost', 'testbot', {debug: true});

    var count = 0;

    mock.server.on('connection', function() { mock.greet(); });

    client.on('registered', function() {
        var oldConn = client.conn;
        client.out.error = function(msg) {
            count += 1;
            t.equal(msg, 'Connection already active, not reconnecting – please disconnect first', 'got expected error on attempted double-connect');
        }
        client.connect();
        count += 1;
        t.equal(oldConn, client.conn, 'did not change connection when connecting again');

        client.disconnect();
    });

    mock.on('end', function() {
        t.equal(count, 2, 'must pass two tests');
        mock.close(function(){ t.end(); });
    });
});
