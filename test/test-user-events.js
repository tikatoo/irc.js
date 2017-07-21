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

    mock.server.on('connection', function() {
        mock.send(':localhost 001 testbot :Welcome to the Internet Relay Chat Network testbot\r\n');
    });

    client.on('registered', function() {
        // welcome bot, give relevant prefix symbols
        mock.send(':localhost 311 testbot testbot ~testbot EXAMPLE.HOST * :testbot\r\n');
        mock.send(':localhost 005 testbot PREFIX=(qaohv)~&@%+ :are supported by this server\r\n');

        // #test: testbot joins. users: testbot, user1, user2
        client.join('#test');
        mock.send(':testbot!~testbot@EXAMPLE.HOST JOIN :#test\r\n')
        mock.send(':localhost 353 testbot = #test :testbot user1 @user2 user3\r\n');
        mock.send(':localhost 366 testbot #test :End of /NAMES list.\r\n');
        // #test2: testbot joins. users: testbot, user1, user3
        client.join('#test2');
        mock.send(':testbot!~testbot@EXAMPLE.HOST JOIN :#test2\r\n')
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
