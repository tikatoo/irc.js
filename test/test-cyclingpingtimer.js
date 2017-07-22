var test = require('tape');

var testHelpers = require('./helpers');
var withClient = testHelpers.withClient;

test('CyclingPingTimer sends ping after time with no server activity', function(t) {
    withClient(function(obj) {
        var client = obj.client;
        var mock = obj.mock;
        mock.server.on('connection', function() { mock.greet(); });
        obj.closeWithEnd(t);

        var botPinged = false;
        var mustPing = function(line) {
            if (line.substring(0, 4).toUpperCase() === "PING") botPinged = true;
        };
        var mustNotPingEarly = function(line) {
            if (line.substring(0, 4).toUpperCase() === "PING")
                t.ok(false, 'bot must not ping early');
        };

        var timerWantedPing = false;
        var timerMustWantPing = function() {
            timerWantedPing = true;
        };

        client.on('registered', function() {
            mock.on('line', mustPing);
            client.conn.cyclingPingTimer.on('wantPing', timerMustWantPing);
            mock.addListener('line', mustNotPingEarly);
            setTimeout(function() {
                mock.removeListener('line', mustNotPingEarly);
            }, 150);
            setTimeout(function() {
                client.disconnect();
            }, 250);
        });

        client.conn.once('close', function() {
            t.ok(botPinged, 'bot must ping');
            t.ok(timerWantedPing, 'timer must want ping');
            client.end();
        });
    }, { millisecondsOfSilenceBeforePingSent: 200 });
});

test('CyclingPingTimer times out after period given with no server activity', function(t) {
    withClient(function(obj) {
        var client = obj.client;
        var mock = obj.mock;
        mock.server.on('connection', function() { mock.greet(); });
        obj.closeWithEnd(t);

        var receivedTimeout = false;
        var mustTimeout = function() { receivedTimeout = true; };
        var mustNotTimeoutEarly = function() {
            t.ok(false, 'cyclingPingTimer must not time out early');
        };

        client.on('registered', function() {
            var cyclingPingTimer = client.conn.cyclingPingTimer;
            cyclingPingTimer.on('pingTimeout', mustTimeout);
            cyclingPingTimer.addListener('pingTimeout', mustNotTimeoutEarly);
            cyclingPingTimer.once('wantPing', function() {
                // wait 450ms from ping until timeout is allowed
                setTimeout(function() {
                    cyclingPingTimer.removeListener('pingTimeout', mustNotTimeoutEarly);
                }, 400);
            });
        });

        client.conn.once('close', function() {
            t.ok(receivedTimeout, 'cyclingPingTimer times out');
            client.end();
        });
    }, {
        millisecondsOfSilenceBeforePingSent: 200,
        millisecondsBeforePingTimeout: 500
    });
});

test('CyclingPingTimer resets timer with activity', function(t) {
    withClient(function(obj) {
        var client = obj.client;
        var mock = obj.mock;
        mock.server.on('connection', function() { mock.greet(); });
        obj.closeWithEnd(t);

        var activityGiven = 0;
        var activityGiver;
        var giveActivity = function() {
            if (activityGiven >= 5) {
                clearInterval(activityGiver);
                client.disconnect();
                return;
            }
            activityGiven += 1;
            mock.send(':localhost PING ' + activityGiven.toString() + '\r\n');
        };

        var receivedPing = false;
        var mustReceivePing = function() {
            receivedPing = true;
        };
        var mustNotPing = function(line) {
            if (line.substring(0, 4).toUpperCase() === "PING")
                t.ok(false, 'bot must not ping with constant activity reset');
        };

        client.on('registered', function() {
            mock.on('line', mustNotPing);
            client.on('ping', mustReceivePing);
            activityGiver = setInterval(giveActivity, 50);
        });

        client.conn.once('close', function() {
            t.ok(receivedPing, 'bot must receive pings from server');
            client.end();
        });
    }, { millisecondsOfSilenceBeforePingSent: 200 });
});
