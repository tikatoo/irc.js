var testHelpers = require('./helpers');
var irc = testHelpers.ircWithStubbedOutput;
var itWithCustomMock = testHelpers.itWithCustomMock;
var chai = require('chai');
var expect = chai.expect;
var sinon = require('sinon');

describe('Client', function() {
  describe('connect', function() {
    context('with standard greeting', function() {
      function runTests(done, isSecure, useSecureObject, skipObject) {
        var expected = testHelpers.getFixtures('basic');
        var port = isSecure ? 6697 : 6667;
        var mock = testHelpers.MockIrcd(port, 'utf-8', isSecure, true);
        var client;
        if (skipObject) {
          client = new irc.Client('localhost', 'testbot');
        } else if (isSecure && useSecureObject) {
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
            port: port,
            selfSigned: true,
            retryCount: 0,
            debug: true
          });
        }

        mock.server.on(isSecure ? 'secureConnection' : 'connection', function() { mock.greet(); });

        client.on('registered', function() {
          expect(mock.outgoing).to.deep.equal(expected.received);
          client.disconnect();
        });

        mock.on('end', function() {
          var msgs = mock.getIncomingMsgs();
          expect(msgs).to.deep.equal(expected.sent);
          mock.close(function() { done(); });
        });
      }

      it('connects, registers and quits with basic config', function(done) {
        runTests(done, false, false, false);
      });

      it('connects, registers and quits with secure boolean config', function(done) {
        runTests(done, true, false, false);
      });

      it('connects, registers and quits, with secure object config', function(done) {
        runTests(done, true, true, false);
      });

      it('connects, registers and quits with no config', function(done) {
        runTests(done, false, false, true);
      });
    });

    context('with double-CRLF greeting', function() {
      testHelpers.hookMockSetup(beforeEach, afterEach, {meta: {callbackEarly: true, autoGreet: false}});

      it('responds properly to greeting with double CRLF', function(done) {
        var greeting = ":localhost 001 testbot :Welcome to the Internet Relay Chat Network testbot\r\n\r\n";
        var mock = this.mock;
        var client = this.client;
        var lineSpy = this.lineSpy;
        mock.server.on('connection', function() { mock.send(greeting); });

        client.on('registered', function() {
          client.disconnect(teardown);
        });

        function teardown() {
          expect(lineSpy.args).to.deep.equal([
            ["NICK testbot"],
            ["USER nodebot 8 * :nodeJS IRC client"],
            ["QUIT :node-irc says goodbye"]
          ]);
          done();
        }
      });
    });

    context('with standard client', function() {
      testHelpers.hookMockSetup(beforeEach, afterEach, {client: {retryDelay: 50}});

      it('disallows double connections', function() {
        var client = this.client;
        var oldConn = client.conn;
        client.out.error = sinon.spy();

        client.connect();
        expect(client.conn).to.equal(oldConn);
        expect(client.out.error.args).to.deep.equal([
          ['Connection already active, not reconnecting – please disconnect first']
        ]);
      });

      it('disallows double disconnections', function() {
        var client = this.client;
        client.disconnect();
        expect(client.conn.requestedDisconnect).to.be.true;
        client.out.error = sinon.spy();

        client.disconnect();
        expect(client.conn.requestedDisconnect).to.be.true;
        expect(client.out.error.args).to.deep.equal([
          ['Connection already disconnecting, skipping disconnect']
        ]);
      });

      itWithCustomMock('skips disconnection if not connected',
      {meta: {withoutServer: true}},
      function() {
        var client = this.client;
        expect(client.conn).to.be.null;
        client.out.error = sinon.spy();

        client.disconnect();
        expect(client.conn).to.be.null;
        expect(client.retryTimeout).not.to.be.ok;
        expect(client.out.error.args).to.deep.equal([
          ['Connection already broken, skipping disconnect']
        ]);
      });

      it('clears up auto-reconnect if told to disconnect while waiting', function(done) {
        var client = this.client;
        client.conn.on('close', abortReconnect);
        client.out.error = sinon.spy();
        client.end();
        function abortReconnect() {
          expect(client.retryTimeout).to.be.ok;
          client.disconnect();
          expect(client.conn).to.be.null;
          expect(client.retryTimeout).to.be.null;
          expect(client.out.error.args).to.deep.equal([
            ['Connection already broken, skipping disconnect (and clearing up automatic retry)']
          ]);
          done();
        }
      });
    });

    context('with motd', function() {
      function sendMotd(mock, nick, messages) {
        messages = messages || ['Message'];
        mock.send(':127.0.0.1 375 ' + nick + ' :- 127.0.0.1 Message of the Day -\r\n');
        messages.forEach(function(line) {
          mock.send(':127.0.0.1 372 ' + nick + ' :- ' + line + '\r\n');
        });
        mock.send(':127.0.0.1 376 ' + nick + ' :End of /MOTD command.\r\n');
      }

      function verifyMotd(client, motd, motdLines) {
        var expected = '- 127.0.0.1 Message of the Day -\n';
        expected += motdLines.map(function(x) { return '- ' + x; }).join('\n') + '\n';
        expected += 'End of /MOTD command.\n';
        expect(motd).to.equal(expected);
        expect(client.motd).to.equal(expected);
      }

      function sharedTests() {
        it('emits motd', function(done) {
          var self = this;
          var motdLines = [
            'Line 1',
            'This is some more text as a test',
            'last line'
          ];
          self.client.on('motd', function(motd) {
            verifyMotd(self.client, motd, motdLines);
            done();
          });
          sendMotd(self.mock, 'testbot', motdLines);
        });

        it('overwrites old motd on new connection', function(done) {
          var self = this;
          var first = ['Sample'];
          var second = ['Sample text'];

          self.client.once('motd', verifyFirst);
          sendMotd(self.mock, 'testbot', first);

          function verifyFirst(motd) {
            verifyMotd(self.client, motd, first);
            self.client.disconnect(setupSecond);
          }

          function setupSecond() {
            self.client.connect();
            self.client.on('registered', function() {
              self.client.once('motd', verifySecond);
              sendMotd(self.mock, 'testbot', second);
            });
          }

          function verifySecond(motd) {
            verifyMotd(self.client, motd, second);
            done();
          }
        });
      }

      context('with opt.channels', function() {
        testHelpers.hookMockSetup(beforeEach, afterEach, {client: {channels: ['#test', '#test2']}});

        sharedTests();

        beforeEach(function() {
          this.joinSpy = this.lineSpy.withArgs(sinon.match(/^JOIN/i));
        });

        it('joins specified channels on motd', function(done) {
          var expected = [['JOIN #test'], ['JOIN #test2']];
          var self = this;
          sendMotd(self.mock, 'testbot');
          self.client.on('motd', function() {
            self.client.send('PING', 'endtest');
          });
          self.mock.on('line', function(line) {
            if (line !== 'PING endtest') return;
            expect(self.joinSpy.args).to.deep.equal(expected);
            done();
          });
        });
      });

      context('without opt.channels', function() {
        testHelpers.hookMockSetup(beforeEach, afterEach);

        sharedTests();

        beforeEach(function() {
          this.joinSpy = this.lineSpy.withArgs(sinon.match(/^JOIN/i));
        });

        it('does not join any channels on motd', function(done) {
          var expected = [];
          var self = this;
          sendMotd(self.mock, 'testbot');
          self.client.on('motd', function() {
            self.client.send('PING', 'endtest');
          });
          self.mock.on('line', function(line) {
            if (line !== 'PING endtest') return;
            expect(self.joinSpy.args).to.deep.equal(expected);
            done();
          });
        });
      });
    });
  });

  describe('_splitLongLines', function() {
    testHelpers.hookMockSetup(beforeEach, afterEach, {meta: {withoutServer: true}});

    it('splits per fixtures', function() {
      var client = this.client;
      var group = testHelpers.getFixtures('_splitLongLines');
      group.forEach(function(item) {
        expect(client._splitLongLines(item.input, item.maxLength, [])).to.deep.equal(item.result);
      });
    });

    it('splits with no maxLength defined', function() {
      var client = this.client;
      var group = testHelpers.getFixtures('_splitLongLines_no_max');
      group.forEach(function(item) {
        expect(client._splitLongLines(item.input, null, [])).to.deep.equal(item.result);
      });
    });

    it('splits by byte with Unicode characters', function() {
      var client = this.client;
      var group = testHelpers.getFixtures('_splitLongLines_bytes');
      group.forEach(function(item) {
        expect(client._splitLongLines(item.input, null, [])).to.deep.equal(item.result);
      });
    });
  });

  describe('_speak', function() {
    itWithCustomMock('calculates maxLength correctly',
    {client: {messageSplit: 10}, meta: {withoutServer: true}},
    function() {
      var client = this.client;
      var tests = [
        {maxLineLength: 30, expected: 10},
        {maxLineLength: 7, expected: 1}
      ];
      tests.forEach(function(item) {
        var splitStub = sinon.stub().callsFake(function(words) { return [words]; });
        client._splitLongLines = splitStub;
        client.maxLineLength = item.maxLineLength;
        client._speak('kind', 'target', 'test message'); // sample data
        expect(splitStub.args).to.deep.equal([
          ['test message', item.expected, []]
        ]);
      });
    });
  });

  describe('unhandled messages', function() {
    testHelpers.hookMockSetup(beforeEach, afterEach, {client: {server: '127.0.0.1'}});
    specify('are emitted appropriately', function(done) {
      var client = this.client;
      var mock = this.mock;
      client.on('unhandled', function(msg) {
        var expected = {
          prefix: '127.0.0.1',
          server: '127.0.0.1',
          rawCommand: '150',
          command: '150',
          commandType: 'normal',
          args: ['test']
        };
        expect(msg).to.deep.equal(expected);
        done();
      });
      mock.send(':127.0.0.1 150 :test\r\n');
    });
  });

  describe('errors', function() {
    testHelpers.hookMockSetup(beforeEach, afterEach, {client: {server: '127.0.0.1'}});
    specify('are emitted appropriately', function(done) {
      var mock = this.mock;
      var client = this.client;

      client.on('error', function(msg) {
        var expected = {
          prefix: '127.0.0.1',
          server: '127.0.0.1',
          rawCommand: '421',
          command: 'err_unknowncommand',
          commandType: 'error',
          args: ['testbot', 'test', 'Unknown command']
        };
        expect(msg).to.deep.equal(expected);
        done();
      });

      client.send('test');
      mock.send(':127.0.0.1 421 testbot test :Unknown command\r\n');
    });
  });

  itWithCustomMock('does not crash when disconnected and sending messages',
  {meta: {withoutServer: true}},
  function() {
    var client = this.client;
    function wrap() {
      client.say('#channel', 'message2');
      client.end();
      client.say('#channel', 'message3');
    }
    expect(wrap).not.to.throw();
  });

  it('handles topic-related events');

  it('handles channel-list-related events');

  it('handles errors in the raw handler');

  describe('command queue', function() {
    it('works as intended');
  });

  it('.part parts');
  it('.action actions');
  it('.notice notices');
  it('.whois works');
  it('handles CTCP');
});
