var testHelpers = require('./helpers');
var chai = require('chai');
var expect = chai.expect;
var sinon = require('sinon');

describe('Client', function() {
  function spyEvents(client, actual, expected, teardown, eventNames) {
    eventNames.forEach(function(eventName) {
      client.on(eventName, function() {
        var args = Array.from(arguments);
        args.unshift(eventName);
        args = JSON.parse(JSON.stringify(args));
        var lastArg = args[args.length-1];
        if (typeof lastArg === 'object' && lastArg.prefix) {
          args.pop(); // remove unnecessary `message`s
        }
        actual.push(args);
        if (actual.length === expected.length) teardown();
      });
    });
  }

  describe('user events', function() {
    context('with standard client', function() {
      testHelpers.hookMockSetup(beforeEach, afterEach);
      it('emits events per fixtures', function(done) {
        var mock = this.mock;
        var client = this.client;
        var expected = [
          ['join', '#test', 'testbot'],
          ['names', '#test', {testbot: '', user1: '', user2: '@', user3: ''}],
          ['join', '#test2', 'testbot'],
          ['names', '#test2', {testbot: '', user1: '', user3: ''}],
          ['part', '#test', 'user1', 'Leaving',],
          ['join', '#test', 'user1'],
          ['quit', 'user1', 'Quit: Leaving', ['#test', '#test2']],
          ['nick', 'user2', 'user4', ['#test']],
          ['nick', 'user3', 'user5', ['#test', '#test2']],
          ['join', '#test', 'user6'],
          ['kick', '#test', 'user6', 'user4', 'Test kick'],
          ['quit', 'user4', 'Quit: Leaving', ['#test']],
          ['part', '#test', 'user5', 'Bye'],
          ['quit', 'user5', 'See ya', ['#test2']]
        ];
        var actual = [];

        spyEvents(client, actual, expected, teardown, ['join', 'part', 'quit', 'names', 'nick', 'kick']);

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

        // #test: user6 joins
        mock.send(':user6!~user6@example.host JOIN #test\r\n');
        // #test: user6 is kicked by user4
        mock.send(':user4!~user2@example.host KICK #test user6 :Test kick\r\n');

        // user4 quits (#test)
        mock.send(':user4!~user2@example.host QUIT :Quit: Leaving\r\n');

        // #test: user5 parts
        mock.send(':user5!~user3@example.host PART #test :Bye\r\n');
        // user5 quits (#test2)
        mock.send(':user5!~user3@example.host QUIT :See ya\r\n');

        function teardown() {
          expect(actual).to.deep.equal(expected);
          done();
        }
      });

      it('emits events per fixtures with differing case', function(done) {
        // client requests things around #Channel
        // server responds with #cHannel
        // expect responses of [event, event#cHannel, event#channel]
        var mock = this.mock;
        var client = this.client;

        var expected = [
          ['join', '#tEst', 'testbot'],
          ['join#tEst', 'testbot'],
          ['join#test', 'testbot'],

          ['names', '#tEst', {testbot: '', user1: '', user2: '@', user3: ''}],
          ['names#tEst', {testbot: '', user1: '', user2: '@', user3: ''}],
          ['names#test', {testbot: '', user1: '', user2: '@', user3: ''}],

          ['join', '#tEst2', 'testbot'],
          ['join#tEst2', 'testbot'],
          ['join#test2', 'testbot'],

          ['names', '#tEst2', {testbot: '', user1: '', user3: ''}],
          ['names#tEst2', {testbot: '', user1: '', user3: ''}],
          ['names#test2', {testbot: '', user1: '', user3: ''}],

          ['part', '#tEst', 'user1', 'Leaving'],
          ['part#tEst', 'user1', 'Leaving'],
          ['part#test', 'user1', 'Leaving'],

          ['join', '#tEst', 'user1'],
          ['join#tEst', 'user1'],
          ['join#test', 'user1'],

          ['quit', 'user1', 'Quit: Leaving', ['#test', '#test2']],
          ['nick', 'user2', 'user4', ['#test']],
          ['nick', 'user3', 'user5', ['#test', '#test2']],

          ['join', '#tEst', 'user6'],
          ['join#tEst', 'user6'],
          ['join#test', 'user6'],

          ['kick', '#tEst', 'user6', 'user4', 'Test kick'],
          ['kick#tEst', 'user6', 'user4', 'Test kick'],
          ['kick#test', 'user6', 'user4', 'Test kick'],

          ['quit', 'user4', 'Quit: Leaving', ['#test']],

          ['part', '#tEst', 'user5', 'Bye'],
          ['part#tEst', 'user5', 'Bye'],
          ['part#test', 'user5', 'Bye'],

          ['quit', 'user5', 'See ya', ['#test2']]
        ];
        var actual = [];

        spyEvents(client, actual, expected, teardown, [
          'join',
          'join#tEst', 'join#test',
          'join#tEst2', 'join#test2',

          'names',
          'names#tEst', 'names#test',
          'names#tEst2', 'names#test2',

          'kick', 'kick#tEst', 'kick#test',
          'part', 'part#tEst', 'part#test',

          'quit', 'nick'
        ]);

        // welcome bot, give relevant prefix symbols
        mock.send(':localhost 311 testbot testbot ~testbot EXAMPLE.HOST * :testbot\r\n');
        mock.send(':localhost 005 testbot PREFIX=(qaohv)~&@%+ :are supported by this server\r\n');

        // #test: testbot joins. users: testbot, user1, user2
        client.join('#Test');
        mock.send(':testbot!~testbot@EXAMPLE.HOST JOIN :#tEst\r\n');
        mock.send(':localhost 353 testbot = #tEst :testbot user1 @user2 user3\r\n');
        mock.send(':localhost 366 testbot #tEst :End of /NAMES list.\r\n');
        // #test2: testbot joins. users: testbot, user1, user3
        client.join('#Test2');
        mock.send(':testbot!~testbot@EXAMPLE.HOST JOIN :#tEst2\r\n');
        mock.send(':localhost 353 testbot = #tEst2 :testbot user1 user3\r\n');
        mock.send(':localhost 366 testbot #tEst2 :End of /NAMES list.\r\n');

        // #test: user1 parts, joins
        mock.send(':user1!~user1@example.host PART #tEst :Leaving\r\n');
        mock.send(':user1!~user1@example.host JOIN #tEst\r\n');

        // user1 quits (#test, #test2)
        mock.send(':user1!~user1@example.host QUIT :Quit: Leaving\r\n');
        // user2 renames to user4 (#test)
        mock.send(':user2!~user2@example.host NICK :user4\r\n');
        // user3 renames to user5 (#test, #test2)
        mock.send(':user3!~user3@example.host NICK :user5\r\n');

        // #test: user6 joins
        mock.send(':user6!~user6@example.host JOIN #tEst\r\n');
        // #test: user6 is kicked by user4
        mock.send(':user4!~user2@example.host KICK #tEst user6 :Test kick\r\n');

        // user4 quits (#test)
        mock.send(':user4!~user2@example.host QUIT :Quit: Leaving\r\n');

        // #test: user5 parts
        mock.send(':user5!~user3@example.host PART #tEst :Bye\r\n');
        // user5 quits (#test2)
        mock.send(':user5!~user3@example.host QUIT :See ya\r\n');

        function teardown() {
          expect(actual).to.deep.equal(expected);
          done();
        }
      });

      it('handles self-events properly');

      context('with topics', function() {
        it('gets topic on joining a channel', function(done) {
          var self = this;
          var localTopicSpy = sinon.spy();
          self.client.on('topic', localTopicSpy);
          self.client.on('raw', rawHandler);
          self.client.join('#test');
          self.mock.send(':testbot!~testbot@EXAMPLE.HOST JOIN :#test\r\n');
          self.mock.send(':127.0.0.1 332 testbot #test :test topic\r\n');
          self.mock.send(':127.0.0.1 333 testbot #test user1 1000000000\r\n');

          function rawHandler(message) {
            var chanData;
            if (message.command === 'rpl_topic') {
              expect(message).to.deep.equal({
                prefix: '127.0.0.1',
                server: '127.0.0.1',
                commandType: 'reply',
                command: 'rpl_topic',
                rawCommand: '332',
                args: ['testbot', '#test', 'test topic']
              });
              chanData = self.client.chanData('#test');
              expect(chanData.topic).to.equal('test topic');
            } else if (message.command === 'rpl_topicwhotime') {
              var expectedMessage = {
                prefix: '127.0.0.1',
                server: '127.0.0.1',
                commandType: 'reply',
                command: 'rpl_topicwhotime',
                rawCommand: '333',
                args: ['testbot', '#test', 'user1', '1000000000']
              };
              expect(message).to.deep.equal(expectedMessage);
              expect(localTopicSpy.args).to.deep.equal([[
                '#test',
                'test topic',
                'user1',
                message
              ]]);
              chanData = self.client.chanData('#test');
              expect(chanData.topic).to.equal('test topic');
              expect(chanData.topicBy).to.equal('user1');
              done();
            }
          }
        });

        it('handles topic change', function(done) {
          var self = this;
          var localTopicSpy = sinon.spy();
          self.client.on('topic', localTopicSpy);
          self.client.on('raw', rawHandler);
          self.client.join('#test');
          self.mock.send(':testbot!~testbot@EXAMPLE.HOST JOIN :#test\r\n');
          self.mock.send(':user1!~user1@EXAMPLE2.HOST TOPIC #test :new topic\r\n');

          function rawHandler(message) {
            if (message.command !== 'TOPIC') return;
            expect(message).to.deep.equal({
              prefix: 'user1!~user1@EXAMPLE2.HOST',
              nick: 'user1',
              user: '~user1',
              host: 'EXAMPLE2.HOST',
              commandType: 'normal',
              command: 'TOPIC',
              rawCommand: 'TOPIC',
              args: ['#test', 'new topic']
            });
            var chanData = self.client.chanData('#test');
            expect(chanData.topic).to.equal('new topic');
            expect(chanData.topicBy).to.equal('user1');
            expect(localTopicSpy.args).to.deep.equal([[
              '#test',
              'new topic',
              'user1',
              message
            ]]);

            done();
          }
        });
      });
    });

    context('on kick', function() {
      function setupKickExpect(local, expectedCount, done, expectKicks) {
        var client = local.client;
        var mock = local.mock;
        local.clientKickSpy = sinon.spy();
        client.join('#test');
        client.on('kick', local.clientKickSpy);
        client.on('kick', function() {
          client.send('PING', 'endtest');
        });
        mock.on('line', function(line) {
          if (line === 'PING endtest') teardown(local, expectedCount, done, expectKicks);
        });
        mock.send(':testbot!~testbot@EXAMPLE.HOST JOIN :#test\r\n');
        mock.send(':localhost 353 testbot = #test :testbot @user1 user2\r\n');
        mock.send(':localhost 366 testbot #test :End of /NAMES list.\r\n');
      }

      function teardown(local, expectedCount, done, expectKicks) {
        var joinSpy = local.lineSpy.withArgs(sinon.match(/^JOIN/i));
        expect(joinSpy.callCount).to.equal(expectedCount);
        var clientKickSpy = local.clientKickSpy;
        var kicks = clientKickSpy.args;
        kicks.forEach(function(argList) {
          var lastArg = argList[argList.length-1];
          if (typeof lastArg === 'object' && lastArg.prefix) argList.pop();
        });
        expect(kicks).to.deep.equal(expectKicks);
        done();
      }

      context('when autoRejoin disabled', function() {
        testHelpers.hookMockSetup(beforeEach, afterEach, {client: {autoRejoin: false}});

        it('does not rejoin', function(done) {
          setupKickExpect(this, 1, done, [['#test', 'testbot', 'user1', undefined]]);
          this.mock.send(':user1!~user1@example.host KICK #test testbot\r\n');
        });
      });

      context('when autoRejoin enabled', function() {
        testHelpers.hookMockSetup(beforeEach, afterEach, {client: {autoRejoin: true}});

        it('rejoins if it was kicked user', function(done) {
          setupKickExpect(this, 2, done, [['#test', 'testbot', 'user1', undefined]]);
          this.mock.send(':user1!~user1@example.host KICK #test testbot\r\n');
        });

        it('does not rejoin if it was not kicked user', function(done) {
          setupKickExpect(this, 1, done, [['#test', 'test2', 'user1', undefined]]);
          this.mock.send(':user1!~user1@example.host KICK #test test2\r\n');
        });
      });
    });

    describe('NOTICE', function() {
      testHelpers.hookMockSetup(beforeEach, afterEach);
      it('handles notice from user correctly', function(done) {
        var self = this;

        var noticeSpy = sinon.spy();
        self.client.out.debug = sinon.spy();
        self.client.on('notice', noticeSpy);
        var i = 0;
        self.client.on('notice', function() {
          i++;
          if (i === 2) finish();
        });
        self.mock.send(':testbot2!~testbot2@EXAMPLE2.HOST NOTICE testbot :test message 1\r\n');
        self.mock.send(':testbot2!~testbot2@EXAMPLE2.HOST NOTICE TESTBOT :test message 2\r\n');

        function finish() {
          var exampleMsg = {
            prefix: 'testbot2!~testbot2@EXAMPLE2.HOST',
            nick: 'testbot2',
            user: '~testbot2',
            host: 'EXAMPLE2.HOST',
            command: 'NOTICE',
            rawCommand: 'NOTICE',
            commandType: 'normal'
          };
          expect(noticeSpy.args).to.deep.equal([
            [
              'testbot2',
              'testbot',
              'test message 1',
              Object.assign({args: ['testbot', 'test message 1']}, exampleMsg)
            ],
            [
              'testbot2',
              'TESTBOT',
              'test message 2',
              Object.assign({args: ['TESTBOT', 'test message 2']}, exampleMsg)
            ]
          ]);
          setTimeout(function() {
            expect(self.client.out.debug.args).to.deep.include(
              ['GOT NOTICE from "testbot2": "test message 1"'],
              ['GOT NOTICE from "testbot2": "test message 2"']
            );
            done();
          }, 10);
        }
      });
    });

    describe('PRIVMSG', function() {
      testHelpers.hookMockSetup(beforeEach, afterEach);
      it('handles privmsg from user correctly', function(done) {
        var self = this;

        var pmSpy = sinon.spy();
        var messageSpy = sinon.spy();
        var otherSpy = sinon.spy();
        self.client.out.debug = sinon.spy();
        self.client.on('pm', pmSpy);
        self.client.on('message', messageSpy);
        self.client.on('message#testbot2', otherSpy);
        self.client.on('message#testbot', otherSpy);
        self.client.on('message#TESTBOT', otherSpy);
        var i = 0;
        self.client.on('message', function() {
          i++;
          if (i === 2) setTimeout(finish, 10);
        });
        self.mock.send(':testbot2!~testbot2@EXAMPLE2.HOST PRIVMSG testbot :test message 1\r\n');
        self.mock.send(':testbot2!~testbot2@EXAMPLE2.HOST PRIVMSG TESTBOT :test message 2\r\n');

        function finish() {
          var exampleMsg = {
            prefix: 'testbot2!~testbot2@EXAMPLE2.HOST',
            nick: 'testbot2',
            user: '~testbot2',
            host: 'EXAMPLE2.HOST',
            command: 'PRIVMSG',
            rawCommand: 'PRIVMSG',
            commandType: 'normal'
          };
          var msg1 = Object.assign({args: ['testbot', 'test message 1']}, exampleMsg);
          var msg2 = Object.assign({args: ['TESTBOT', 'test message 2']}, exampleMsg);
          expect(messageSpy.args).to.deep.equal([
            ['testbot2', 'testbot', 'test message 1', msg1],
            ['testbot2', 'TESTBOT', 'test message 2', msg2]
          ]);
          expect(pmSpy.args).to.deep.equal([
            ['testbot2', 'test message 1', msg1],
            ['testbot2', 'test message 2', msg2]
          ]);

          expect(otherSpy.args).to.be.empty;
          setTimeout(function() {
            expect(self.client.out.debug.args).to.deep.include(
              ['GOT MESSAGE from "testbot2": "test message 1"'],
              ['GOT MESSAGE from "testbot2": "test message 2"']
            );
            done();
          }, 10);
        }
      });

      var messageExample = {
        prefix: 'testbot2!~testbot2@EXAMPLE2.HOST',
        nick: 'testbot2',
        user: '~testbot2',
        host: 'EXAMPLE2.HOST',
        command: 'PRIVMSG',
        rawCommand: 'PRIVMSG',
        commandType: 'normal'
      };
      var user = 'testbot2';
      var msg = 'test message 1';

      function channelMsgTest(local, localChannel, remoteChannel, callback) {
        testHelpers.joinChannels(local, [localChannel], [remoteChannel], function() {
          local.otherSpy = sinon.spy();
          local.client.on('pm', local.otherSpy);
          local.client.on('message#testbot', local.otherSpy);
          local.client.on('message#testbot2', local.otherSpy);
          local.messageSpy = sinon.spy();

          var events = [
            'message', 'message#',
            'message' + remoteChannel,
            'message' + remoteChannel.toLowerCase(),
            'message' + localChannel,
            'message' + localChannel.toLowerCase()
          ];
          var distinctEvents = [];
          events.forEach(function(event) {
            if (distinctEvents.indexOf(event) < 0) distinctEvents.push(event);
          });

          distinctEvents.forEach(function(event) {
            local.client.on(event, function() {
              var args = Array.prototype.slice.call(arguments);
              args.unshift(event);
              local.messageSpy.apply(local, args);
            });
          });

          local.client.on('raw', tryEnd);
          local.mock.send(':' + user + '!~testbot2@EXAMPLE2.HOST PRIVMSG ' + remoteChannel + ' :' + msg + '\r\n');

          function tryEnd(message) {
            if (message.command !== 'PRIVMSG') return;
            setTimeout(function() {
              expect(local.otherSpy.callCount).to.equal(0);
              callback(local);
            }, 10);
          }
        });
      }

      it('emits properly in lowercase channel', function(done) {
        var localChannel = '#channel';
        var remoteChannel = '#channel';
        channelMsgTest(this, localChannel, remoteChannel, function(local) {
          var message = Object.assign({args: [remoteChannel, 'test message 1']}, messageExample);
          expect(local.messageSpy.args).to.deep.equal([
            ['message', user, remoteChannel, msg, message],
            ['message#', user, remoteChannel, msg, message],
            ['message' + remoteChannel, user, msg, message]
          ]);
          done();
        });
      });

      it('emits properly in lowercase channel joined mixed-case', function(done) {
        var localChannel = '#Channel';
        var remoteChannel = '#channel';
        channelMsgTest(this, localChannel, remoteChannel, function(local) {
          var message = Object.assign({args: [remoteChannel, 'test message 1']}, messageExample);
          expect(local.messageSpy.args).to.deep.equal([
            ['message', user, remoteChannel, msg, message],
            ['message#', user, remoteChannel, msg, message],
            ['message' + remoteChannel, user, msg, message]
          ]);
          done();
        });
      });

      it('emits properly in mixed-case channel joined lowercase', function(done) {
        var localChannel = '#channel';
        var remoteChannel = '#Channel';
        channelMsgTest(this, localChannel, remoteChannel, function(local) {
          var message = Object.assign({args: [remoteChannel, 'test message 1']}, messageExample);
          expect(local.messageSpy.args).to.deep.equal([
            ['message', user, remoteChannel, msg, message],
            ['message#', user, remoteChannel, msg, message],
            ['message' + remoteChannel, user, msg, message],
            ['message' + remoteChannel.toLowerCase(), user, msg, message]
          ]);
          done();
        });
      });

      it('emits properly in mixed-case channel', function(done) {
        var localChannel = '#Channel';
        var remoteChannel = '#Channel';
        channelMsgTest(this, localChannel, remoteChannel, function(local) {
          var message = Object.assign({args: [remoteChannel, 'test message 1']}, messageExample);
          expect(local.messageSpy.args).to.deep.equal([
            ['message', user, remoteChannel, msg, message],
            ['message#', user, remoteChannel, msg, message],
            ['message' + remoteChannel, user, msg, message],
            ['message' + remoteChannel.toLowerCase(), user, msg, message]
          ]);
          done();
        });
      });
    });

    describe('INVITE', function() {
      testHelpers.hookMockSetup(beforeEach, afterEach);
      it('handles invite from user correctly', function(done) {
        var self = this;

        self.client.on('invite', finish);
        self.mock.send(':testbot2!~testbot2@EXAMPLE2.HOST INVITE testbot :#channel\r\n');

        function finish(channel, from, message) {
          expect(channel).to.equal('#channel');
          expect(from).to.equal('testbot2');
          expect(message).to.deep.equal({
            prefix: 'testbot2!~testbot2@EXAMPLE2.HOST',
            nick: 'testbot2',
            user: '~testbot2',
            host: 'EXAMPLE2.HOST',
            command: 'INVITE',
            rawCommand: 'INVITE',
            commandType: 'normal',
            args: ['testbot', '#channel']
          });
          done();
        }
      });
    });
  });
});
