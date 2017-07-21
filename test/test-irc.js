var irc = require('../lib/irc');
var test = require('tape');

var testHelpers = require('./helpers');

var expected = testHelpers.getFixtures('basic');
var greeting = ':localhost 001 testbot :Welcome to the Internet Relay Chat Network testbot\r\n';

function runTests(t, isSecure, useSecureObject) {
    var port = isSecure ? 6697 : 6667;
    var mock = testHelpers.MockIrcd(port, 'utf-8', isSecure);
    var client;
    if (isSecure && useSecureObject) {
        client = new irc.Client('notlocalhost', 'testbot', {
            secure: {
                host: 'localhost',
                port: port,
                rejectUnauthorized: false
            },
            selfSigned: true,
            retryCount: 0,
            debug: true
        });
    } else {
        client = new irc.Client('localhost', 'testbot', {
            secure: isSecure,
            selfSigned: true,
            port: port,
            retryCount: 0,
            debug: true
        });
    }

    t.plan(expected.sent.length + expected.received.length);

    mock.server.on(isSecure ? 'secureConnection' : 'connection', function() {
        mock.send(greeting);
    });

    client.on('registered', function() {
        t.equal(mock.outgoing[0], expected.received[0][0], expected.received[0][1]);
        client.disconnect();
    });

    mock.on('end', function() {
        var msgs = mock.getIncomingMsgs();

        for (var i = 0; i < msgs.length; i++) {
            t.equal(msgs[i], expected.sent[i][0], expected.sent[i][1]);
        }
        mock.close();
    });
}

function withClient(func, conf) {
    // closes mock server when it gets a connection end event if server used (client disconnects)
    var obj = {};
    var ircConf = {
        secure: false,
        selfSigned: true,
        port: obj.port,
        retryCount: 0,
        debug: true
    };
    if (conf) ircConf.messageSplit = conf.messageSplit;
    if (conf && conf.withoutServer) {
        ircConf.autoConnect = false;
    } else {
        var t;
        obj.closeWithEnd = function(test) {
            t = test;
        }

        obj.port = 6667;
        obj.mock = testHelpers.MockIrcd(obj.port, 'utf-8', false);
        obj.mock.on('end', function() {
            obj.mock.close(function(){ if (t) t.end(); });
        });
    }
    obj.client = new irc.Client('localhost', 'testbot', ircConf);

    func(obj);
}

test('connect, register and quit', function(t) {
    runTests(t, false, false);
});

test('connect, register and quit, securely', function(t) {
    runTests(t, true, false);
});

test('connect, register and quit, securely, with secure object', function(t) {
    runTests(t, true, true);
});

test ('splitting of long lines', function(t) {
    withClient(function(obj) {
        var client = obj.client;
        var group = testHelpers.getFixtures('_splitLongLines');
        t.plan(group.length);
        group.forEach(function(item) {
            t.deepEqual(client._splitLongLines(item.input, item.maxLength, []), item.result);
        });
    }, { withoutServer: true });
});

test ('splitting of long lines with no maxLength defined.', function(t) {
    withClient(function(obj) {
        var client = obj.client;
        var group = testHelpers.getFixtures('_splitLongLines_no_max');
        t.plan(group.length);
        group.forEach(function(item) {
            t.deepEqual(client._splitLongLines(item.input, null, []), item.result);
        });
    }, { withoutServer: true });
});

test ('opt.messageSplit used when set', function(t) {
    withClient(function(obj) {
        var client = obj.client;
        var group = testHelpers.getFixtures('_speak');
        t.plan(group.length);
        client.send = function() { };
        group.forEach(function(item) {
            client.maxLineLength = item.length;
            client._splitLongLines = function(words, maxLength, _destination) {
                t.equal(maxLength, item.expected);
                return [words];
            }
            client._speak('kind', 'target', 'test message');
        });
    }, { messageSplit: 10, withoutServer: true });
});

test ('splits by byte with Unicode characters', function(t) {
    withClient(function(obj) {
        var client = obj.client;
        var group = testHelpers.getFixtures('_splitLongLines_bytes');
        t.plan(group.length);
        group.forEach(function(item) {
            t.deepEqual(client._splitLongLines(item.input, null, []), item.result);
        });
    }, { withoutServer: true });
});

test ('does not crash when disconnected and trying to send messages', function(t) {
    withClient(function(obj) {
        var client = obj.client;
        var mock = obj.mock;

        mock.server.on('connection', function() {
            mock.send(greeting);
        });

        client.on('registered', function() {
            client.say('#channel', 'message');
            client.disconnect();
        });

        client.conn.once('close', function() {
            client.say('#channel', 'message2');
            client.end();
            client.say('#channel', 'message3');
            t.end();
        });
    });
});

test ('unhandled messages are emitted appropriately', function(t) {
    withClient(function(obj) {
        var client = obj.client;
        var mock = obj.mock;
        obj.closeWithEnd(t);
        var endTimeout;

        mock.server.on('connection', function() {
            mock.send(greeting);
        });

        client.on('registered', function() {
            mock.send(':127.0.0.1 150 :test\r\n');
            client.on('unhandled', function(msg) {
                var expected = {
                    prefix: '127.0.0.1',
                    server: '127.0.0.1',
                    rawCommand: '150',
                    command: '150',
                    commandType: 'normal',
                    args: ['test']
                };
                t.deepEqual(msg, expected, 'unhandled message should be emitted as expected');
                client.disconnect();
            });
            endTimeout = setTimeout(function() {
                if (t.ended) return;
                t.ok(false, 'callback for event must be called');
                client.disconnect();
            }, 1000);
        });

        client.conn.once('close', function() {
            clearTimeout(endTimeout)
            client.end();
        });
    });
});
