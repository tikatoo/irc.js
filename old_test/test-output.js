var test = require('tape');

var proxyquire = require('proxyquire');

function stubIRC(outputArray) {
    var utilStub = {};
    utilStub.log = function() {
        outputArray.push(Array.prototype.slice.call(arguments));
    };
    return proxyquire('../lib/irc', {util: utilStub});
}

test('debug does not output if debug config disabled', function(t) {
    var output = [];
    var ircWithUtilStub = stubIRC(output);
    var client = new ircWithUtilStub.Client('localhost', 'nick', {debug: false, autoConnect: false});
    client.out.debug('Test message');
    t.deepEqual(output, [], 'must not output');
    t.end();
});

test('debug outputs messages if debug config enabled', function(t) {
    var output = [];
    var ircWithUtilStub = stubIRC(output);
    var client = new ircWithUtilStub.Client('localhost', 'nick', {debug: true, autoConnect: false});
    client.out.debug('Test message');
    t.deepEqual(output, [['Test message']], 'must output correct once');
    client.out.debug('New message');
    t.deepEqual(output, [['Test message'], ['New message']], 'must output correct twice');
    t.end();
});

test('error does not output if both configs disabled', function(t) {
    var output = [];
    var ircWithUtilStub = stubIRC(output);
    var client = new ircWithUtilStub.Client('localhost', 'nick', {debug: false, showErrors: false, autoConnect: false});
    client.out.error('Test message');
    t.deepEqual(output, [], 'must not output');
    t.end();
});

function mustError(client, output, t) {
    client.out.error('Test message');
    t.deepEqual(output,
        [
            ['\u001b[01;31mERROR:', 'Test message', '\u001b[0m']
        ],
        'must output correct once');
    client.out.error('New message');
    t.deepEqual(output,
        [
            ['\u001b[01;31mERROR:', 'Test message', '\u001b[0m'],
            ['\u001b[01;31mERROR:', 'New message', '\u001b[0m']
        ],
        'must output correct twice');
}

test('error outputs messages if debug config enabled', function(t) {
    var output = [];
    var ircWithUtilStub = stubIRC(output);
    var client = new ircWithUtilStub.Client('localhost', 'nick', {debug: true, showErrors: false, autoConnect: false});
    mustError(client, output, t);
    t.end();
});

test('error outputs messages if showErrors config enabled', function(t) {
    var output = [];
    var ircWithUtilStub = stubIRC(output);
    var client = new ircWithUtilStub.Client('localhost', 'nick', {debug: false, showErrors: true, autoConnect: false});
    mustError(client, output, t);
    t.end();
});

test('error outputs messages if both configs enabled', function(t) {
    var output = [];
    var ircWithUtilStub = stubIRC(output);
    var client = new ircWithUtilStub.Client('localhost', 'nick', {debug: true, showErrors: true, autoConnect: false});
    mustError(client, output, t);
    t.end();
});
