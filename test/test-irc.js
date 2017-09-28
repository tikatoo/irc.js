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

    describe('whois', function() {
      testHelpers.hookMockSetup(beforeEach, afterEach);

      it('requests and processes own whois data', function(done) {
        var self = this;
        self.mock.on('line', function(line) {
          if (line !== 'WHOIS testbot') return;
          // first arg is nick of target
          self.mock.send(':127.0.0.1 311 testbot testbot ~testbot EXAMPLE.HOST * :test name\r\n'); // whoisuser (user, host, ?, realname)
          self.mock.send(':127.0.0.1 312 testbot testbot 127.0.0.1 :Test server\r\n'); // whoisserver (server, serverinfo)
          self.mock.send(':127.0.0.1 317 testbot testbot 0 1000000000 :seconds idle, signon time\r\n'); // whoisidle (idle)
          self.mock.send(':127.0.0.1 318 testbot testbot :End of /WHOIS list.\r\n');
        });
        self.client.on('whois', function(data) {
          expect(data).to.deep.equal({
            user: '~testbot',
            host: 'EXAMPLE.HOST',
            realname: 'test name',
            server: '127.0.0.1',
            serverinfo: 'Test server',
            idle: '0',
            nick: 'testbot'
          });

          setImmediate(function() {
            expect(self.client.nick).to.equal('testbot');
            expect(self.client.hostMask).to.equal('~testbot@EXAMPLE.HOST');
            expect(self.client.maxLineLength).to.equal(497 - 7 - 21);

            done();
          });
        });
      });
    });

    describe('with sasl', function() {
      var clientConfig = {sasl: true, nick: 'testbot', userName: 'nodebot', realName: 'node', password: 'test'};
      var metaConfig = {autoGreet: false, callbackEarly: true};
      testHelpers.hookMockSetup(beforeEach, afterEach, {client: clientConfig, meta: metaConfig});

      beforeEach(function() {
        this.sendStub = sinon.stub(this.client, 'send');
        this.sendStub.callThrough();
      });

      it('sends sasl on attempted connection', function(done) {
        var self = this;
        self.client.on('connect', function() {
          expect(self.sendStub.args).to.deep.equal([
            ['CAP', 'REQ', 'sasl'],
            ['NICK', 'testbot'],
            ['USER', 'nodebot', 8, '*', 'node']
          ]);
          done();
        });
      });

      it('responds to SASL capability acknowledgement', function(done) {
        var self = this;
        self.mock.on('line', function(line) {
          if (line === 'CAP REQ sasl') {
            self.mock.send(':127.0.0.1 CAP * ACK :sasl\r\n');
          } else if (line === 'AUTHENTICATE PLAIN') {
            end();
          }
        });
        function end() {
          expect(self.sendStub.args).to.deep.equal([
            ['CAP', 'REQ', 'sasl'],
            ['NICK', 'testbot'],
            ['USER', 'nodebot', 8, '*', 'node'],
            ['AUTHENTICATE', 'PLAIN']
          ]);
          done();
        }
      });

      function mockSaslAccepts(local, authMessage, end) {
        local.mock.on('line', function(line) {
          if (line === 'CAP REQ sasl') {
            local.mock.send(':127.0.0.1 CAP * ACK :sasl\r\n');
          } else if (line === 'AUTHENTICATE PLAIN') {
            local.mock.send('AUTHENTICATE +\r\n');
          } else if (line === 'AUTHENTICATE ' + authMessage) {
            local.mock.send(':127.0.0.1 900 testbot testbot!testbot@EXAMPLE.HOST testbot :You are now logged in as testbot\r\n');
            local.mock.send(':127.0.0.1 903 testbot :SASL authentication successful\r\n');
            local.client.on('raw', function(message) {
              if (message.rawCommand === '903') setTimeout(end, 10);
            });
          }
        });
      }

      it('authenticates', function(done) {
        var self = this;
        mockSaslAccepts(self, 'dGVzdGJvdABub2RlYm90AHRlc3Q=', end);
        function end() {
          expect(self.sendStub.args).to.deep.equal([
            ['CAP', 'REQ', 'sasl'],
            ['NICK', 'testbot'],
            ['USER', 'nodebot', 8, '*', 'node'],
            ['AUTHENTICATE', 'PLAIN'],
            ['AUTHENTICATE', 'dGVzdGJvdABub2RlYm90AHRlc3Q='],
            ['CAP', 'END']
          ]);
          expect(self.unhandledSpy.args).to.deep.equal([]);
          done();
        }
      });

      itWithCustomMock('splits authenticate response',
      {client: Object.assign({}, clientConfig, {password: 'long'.repeat(75)}), meta: metaConfig},
      function(done) {
        this.sendStub = sinon.stub(this.client, 'send');
        this.sendStub.callThrough();
        var self = this;
        mockSaslAccepts(self, 'bG9uZ2xvbmdsb25nbG9uZw==', end);
        function end() {
          expect(self.sendStub.args).to.deep.equal([
            ['CAP', 'REQ', 'sasl'],
            ['NICK', 'testbot'],
            ['USER', 'nodebot', 8, '*', 'node'],
            ['AUTHENTICATE', 'PLAIN'],
            // fixture of base64 encoded userName, nick, password
            ['AUTHENTICATE', 'dGVzdGJvdABub2RlYm90AG' + 'xvbmdsb25nbG9uZ2'.repeat(23) + 'xvbmdsb25n'],
            ['AUTHENTICATE', 'bG9uZ2xvbmdsb25nbG9uZw=='],
            ['CAP', 'END']
          ]);
          done();
        }
      });

      itWithCustomMock('handles a 400-byte response',
      {client: Object.assign({}, clientConfig, {password: 'long'.repeat(70) + 'test'}), meta: metaConfig},
      function(done) {
        this.sendStub = sinon.stub(this.client, 'send');
        this.sendStub.callThrough();
        var self = this;
        mockSaslAccepts(self, '+', end);
        function end() {
          expect(self.sendStub.args).to.deep.equal([
            ['CAP', 'REQ', 'sasl'],
            ['NICK', 'testbot'],
            ['USER', 'nodebot', 8, '*', 'node'],
            ['AUTHENTICATE', 'PLAIN'],
            // fixture of base64 encoded userName, nick, password
            ['AUTHENTICATE', 'dGVzdGJvdABub2RlYm90AG' + 'xvbmdsb25nbG9uZ2'.repeat(23) + 'xvbmd0ZXN0'],
            ['AUTHENTICATE', '+'],
            ['CAP', 'END']
          ]);
          done();
        }
      });

      itWithCustomMock('outputs sasl errors properly',
      {client: clientConfig},
      function(done) {
        var self = this;
        self.errorSpy = sinon.spy();
        self.client.on('error', self.errorSpy);
        self.mock.send(':127.0.0.1 CAP * ACK :sasl\r\n');
        self.mock.send(':127.0.0.1 902 testbot :You must use a nick assigned to you\r\n'); // err_nicklocked
        self.mock.send(':127.0.0.1 904 testbot :SASL authentication failed\r\n'); // err_saslfail
        self.mock.send(':127.0.0.1 905 testbot :SASL message too long\r\n'); // err_sasltoolong
        self.mock.send(':127.0.0.1 906 testbot :SASL authentication aborted\r\n'); // err_saslaborted
        self.mock.send(':127.0.0.1 907 testbot :You have already authenticated using SASL\r\n'); // err_saslalready
        self.mock.send(':127.0.0.1 PING :endtest\r\n');
        self.client.on('ping', endTest);
        function endTest() {
          var messageBasis = {
            prefix: '127.0.0.1',
            server: '127.0.0.1',
            commandType: 'error'
          };
          self.client.removeListener('error', self.errorSpy);
          expect(self.errorSpy.args).to.deep.equal([
            [Object.assign({
              rawCommand: '902',
              command: 'err_nicklocked',
              args: ['testbot', 'You must use a nick assigned to you']
            }, messageBasis)],[Object.assign({
              rawCommand: '904',
              command: 'err_saslfail',
              args: ['testbot', 'SASL authentication failed']
            }, messageBasis)],[Object.assign({
              rawCommand: '905',
              command: 'err_sasltoolong',
              args: ['testbot', 'SASL message too long']
            }, messageBasis)],[Object.assign({
              rawCommand: '906',
              command: 'err_saslaborted',
              args: ['testbot', 'SASL authentication aborted']
            }, messageBasis)],[Object.assign({
              rawCommand: '907',
              command: 'err_saslalready',
              args: ['testbot', 'You have already authenticated using SASL']
            }, messageBasis)]
          ]);
          done();
        }
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
      var self = this;
      self.client.on('unhandled', end);
      self.mock.send(':127.0.0.1 150 :test\r\n');
      function end() {
        var expected = {
          prefix: '127.0.0.1',
          server: '127.0.0.1',
          rawCommand: '150',
          command: '150',
          commandType: 'normal',
          args: ['test']
        };
        expect(self.unhandledSpy.args).to.deep.equal(expected);
        done();
      }
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

  it('handles channel-list-related events');

  it('.action actions');
  it('handles CTCP');
});
