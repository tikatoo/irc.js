var irc = require('../lib/irc');
var test = require('tape');

var testHelpers = require('./helpers');

test('joins, parts, renicks and quits', function(t) {
    var mock = testHelpers.MockIrcd();
    var client = new irc.Client('localhost', 'testbot', {debug: true});
    var expected = [
        ['join', '#test', 'testbot'],
        ['names', '#test', {testbot: '', user1: '', user2: '@', user3: ''}],
        ['join', '#test2', 'testbot'],
        ['names', '#test2', {testbot: '', user1: '', user3: ''}],
        ['part', '#test', 'user1', 'Leaving'],
        ['join', '#test', 'user1'],
        ['quit', 'user1', 'Quit: Leaving', ['#test', '#test2']],
        ['nick', 'user2', 'user4', ['#test']],
        ['nick', 'user3', 'user5', ['#test', '#test2']],
        ['quit', 'user4', 'Quit: Leaving', ['#test']],
        ['part', '#test', 'user5', 'Bye'],
        ['quit', 'user5', 'See ya', ['#test2']]
    ];
    var actual = [];

    mock.server.on('connection', function() { mock.greet(); });

    client.on('registered', function() {
        // welcome bot, give relevant prefix symbols
        mock.send(':localhost 311 testbot testbot ~testbot EXAMPLE.HOST * :testbot\r\n');
        mock.send(':localhost 005 testbot PREFIX=(qaohv)~&@%+ :are supported by this server\r\n');

        // #test: testbot joins. users: testbot, user1, user2
        client.join('#test');
        mock.send(':testbot!~testbot@EXAMPLE.HOST JOIN :#test\r\n');
        mock.send(':localhost 353 testbot = #test :testbot user1 @user2 user3\r\n');
        mock.send(':localhost 366 testbot #test :End of /NAMES list.\r\n');
        // #test2: testbot joins. users: testbot, user1, user3
        client.join('#test2');
        mock.send(':testbot!~testbot@EXAMPLE.HOST JOIN :#test2\r\n');
        mock.send(':localhost 353 testbot = #test2 :testbot user1 user3\r\n');
        mock.send(':localhost 366 testbot #test2 :End of /NAMES list.\r\n');

        // #test: user1 parts, joins
        mock.send(':user1!~user1@example.host PART #test :Leaving\r\n');
        mock.send(':user1!~user1@example.host JOIN #test\r\n');

        // user1 quits (#test, #test2)
        mock.send(':user1!~user1@example.host QUIT :Quit: Leaving\r\n');
        // user2 renames to user4 (#test)
        mock.send(':user2!~user2@example.host NICK :user4\r\n');
        // user3 renames to user5 (#test, #test2)
        mock.send(':user3!~user3@example.host NICK :user5\r\n');
        // user4 quits (#test)
        mock.send(':user4!~user2@example.host QUIT :Quit: Leaving\r\n');

        // #test: user5 parts
        mock.send(':user5!~user3@example.host PART #test :Bye\r\n');
        // user5 quits (#test2)
        mock.send(':user5!~user3@example.host QUIT :See ya\r\n');

        client.disconnect();
    });

    function addEvent(arg) {
        arg = JSON.parse(JSON.stringify(arg)); // hack to make it deep copy the arg
        actual.push(arg);
    }

    client.on('join', function(channel, nick) {
        addEvent(['join', channel, nick]);
    });
    client.on('part', function(channel, nick, reason) {
        addEvent(['part', channel, nick, reason]);
    });
    client.on('quit', function(nick, reason, channels) {
        addEvent(['quit', nick, reason, channels]);
    });
    client.on('names', function(channel, nicks) {
        addEvent(['names', channel, nicks]);
    });
    client.on('nick', function(oldnick, newnick, channels) {
        addEvent(['nick', oldnick, newnick, channels]);
    });

    mock.on('end', function() {
        mock.close();
        t.deepEqual(actual, expected);
        t.end();
    });
});

test.skip('client sends both case-preserving and case-lowered events for cased channels');

test.skip('client handles self-events properly');

var withKickSetup = function(t, client, mock, performKicks, onMockClose) {
    // onMockClose receives a parameter of the number of joins that occurred.
    mock.server.on('connection', function() { mock.greet(); });

    var joinCount = 0;
    // prep test to cause client to disconnect on 'endtest' ping
    mock.on('line', function(line) {
        if (line.indexOf("JOIN") >= 0) joinCount++;
        if (line === 'PING endtest') client.disconnect();
    });

    client.on('registered', function() {
        // #test: testbot joins, users: testbot, user1, user2
        client.join('#test');
        mock.send(':testbot!~testbot@EXAMPLE.HOST JOIN :#test\r\n');
        mock.send(':localhost 353 testbot = #test :testbot @user1 user2\r\n');
        mock.send(':localhost 366 testbot #test :End of /NAMES list.\r\n');

        performKicks();
    });

    client.on('kick', function() {
        t.ok(true, 'client must receive kick');
        client.send('PING', 'endtest');
    });

    mock.on('end', function() {
        mock.close(function(){ onMockClose(joinCount); });
    });
};

test('client does not rejoin after kick when config disabled', function(t) {
    var mock = testHelpers.MockIrcd();
    var client = new irc.Client('localhost', 'testbot', {debug: true, autoRejoin: false});

    withKickSetup(t, client, mock, function() {
        mock.send(':user1!~user1@example.host KICK #test testbot\r\n');
    }, function(joinCount) {
        t.equal(joinCount, 1, 'server must receive just one join');
        t.end();
    });
});

test('client rejoins when kicked with config enabled', function(t) {
    var mock = testHelpers.MockIrcd();
    var client = new irc.Client('localhost', 'testbot', {debug: true, autoRejoin: true});

    withKickSetup(t, client, mock, function() {
        mock.send(':user1!~user1@example.host KICK #test testbot\r\n');
    }, function(joinCount) {
        t.equal(joinCount, 2, 'server must receive two joins');
        t.end();
    });
});

test('client only rejoins when self kicked', function(t) {
    var mock = testHelpers.MockIrcd();
    var client = new irc.Client('localhost', 'testbot', {debug: true, autoRejoin: true});

    withKickSetup(t, client, mock, function() {
        mock.send(':user1!~user1@example.host KICK #test test2\r\n');
    }, function(joinCount) {
        t.equal(joinCount, 1, 'server must receive just one join');
        t.end();
    });
});

test.skip('client handles PRIVMSGs properly');

test.skip('client handles INVITEs properly');
