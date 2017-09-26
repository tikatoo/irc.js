var testHelpers = require('./helpers');
var itWithCustomMock = testHelpers.itWithCustomMock;
var chai = require('chai');
var expect = chai.expect;
var sinon = require('sinon');

describe('Client', function() {
  describe('raw handler', function() {
    testHelpers.hookMockSetup(beforeEach, afterEach);
    it('throws if an error occurs and no error handler is bound', function() {
      var self = this;
      function wrap() {
        self.client.conn.emit('data', ':127.0.0.1 PING :1\r\n');
      }
      self.client.on('raw', function() {
        throw new Error('test error');
      });
      expect(wrap).to.throw(Error, 'test error');
    });

    it('passes error to error handler if bound', function() {
      var self = this;
      var errorSpy = sinon.spy();
      var error = new Error('test error');
      function wrap() {
        self.client.conn.emit('data', ':127.0.0.1 PING :1\r\n');
      }
      self.client.on('raw', function() {
        throw error;
      });
      self.client.on('error', errorSpy);
      expect(wrap).not.to.throw();
      expect(errorSpy.args).to.deep.equal([[error]]);
    });
  });

  describe('#send', function() {
    testHelpers.hookMockSetup(beforeEach, afterEach);

    beforeEach(function() {
      this.debugSpy = sinon.spy();
      this.connSpy = sinon.spy();
      this.client.out.debug = this.debugSpy;
      this.client.conn.write = this.connSpy;
    });

    it('works with simple data', function() {
      this.client.send('JOIN', '#channel');
      expect(this.debugSpy.args).to.deep.equal([
        ['SEND:', 'JOIN #channel']
      ]);
      expect(this.connSpy.args).to.deep.equal([
        ['JOIN #channel\r\n']
      ]);
    });

    it('works with multiple arguments', function() {
      this.client.send('TEST', 'example', 'data');
      expect(this.debugSpy.args).to.deep.equal([
        ['SEND:', 'TEST example data']
      ]);
      expect(this.connSpy.args).to.deep.equal([
        ['TEST example data\r\n']
      ]);
    });

    it('works with multi-word last parameter', function() {
      this.client.send('TEST', 'example data');
      expect(this.debugSpy.args).to.deep.equal([
        ['SEND:', 'TEST :example data']
      ]);
      expect(this.connSpy.args).to.deep.equal([
        ['TEST :example data\r\n']
      ]);
    });

    itWithCustomMock('does not throw when disconnected',
    {meta: {withoutServer: true}},
    function() {
      var self = this;
      self.debugSpy = sinon.spy();
      self.client.out.debug = self.debugSpy;
      function wrap() {
        self.client.send('TEST', 'example data');
      }
      expect(wrap).not.to.throw();
      expect(self.debugSpy.args).to.deep.equal([
        ['(Disconnected) SEND:', 'TEST :example data']
      ]);
    });

    it('does not throw when disconnecting', function() {
      var self = this;
      function wrap() {
        self.client.disconnect();
        self.client.send('TEST', 'example data');
      }
      expect(wrap).not.to.throw();
      expect(self.debugSpy.args).to.deep.include([
        '(Disconnected) SEND:', 'TEST :example data'
      ]);
      expect(self.connSpy.args).to.deep.equal([
        ['QUIT :node-irc says goodbye\r\n']
      ]);
    });
  });

  describe('#join', function() {
    testHelpers.hookMockSetup(beforeEach, afterEach);

    beforeEach(function(done) {
      var self = this;
      setTimeout(function() {
        self.debugSpy = sinon.spy();
        self.sendSpy = sinon.spy();
        self.client.out.debug = self.debugSpy;
        self.client.send = self.sendSpy;
        done();
      }, 10);
    });

    function sharedExamplesFor(channel, remoteChannel) {
      function downcaseChannels(channels) {
        return channels.map(function(x) { return x.toLowerCase(); });
      }

      it('works with given channel', function() {
        this.client.join(channel);
        expect(this.sendSpy.args).to.deep.equal([
          ['JOIN', channel]
        ]);
      });

      it('adds to opt.channels on successful join', function(done) {
        var self = this;
        self.client.on('join', function() {
          setTimeout(check, 10);
        });
        expect(self.client.opt.channels).to.be.empty;
        self.client.join(channel);
        this.mock.send(':testbot!~testbot@EXAMPLE.HOST JOIN :' + remoteChannel + '\r\n');

        function check() {
          expect(downcaseChannels(self.client.opt.channels)).to.deep.equal([channel.toLowerCase()]);
          done();
        }
      });

      it('calls given callback', function(done) {
        var self = this;
        expect(self.client.opt.channels).to.be.empty;
        self.client.join(channel, check);
        this.mock.send(':testbot!~testbot@EXAMPLE.HOST JOIN :' + remoteChannel + '\r\n');

        function check(nick, message) {
          expect(nick).to.equal('testbot');
          expect(message).to.deep.equal({
            prefix: 'testbot!~testbot@EXAMPLE.HOST',
            nick: 'testbot',
            user: '~testbot',
            host: 'EXAMPLE.HOST',
            commandType: 'normal',
            command: 'JOIN',
            rawCommand: 'JOIN',
            args: [remoteChannel]
          });
          done();
        }
      });
    }

    context('with same lowercase local and remote channel', function() {
      sharedExamplesFor('#channel', '#channel');
    });

    context('with same mixed-case local and remote channel', function() {
      sharedExamplesFor('#Channel', '#Channel');
    });

    context('with mixed-case local channel differing from lowercase remote channel', function() {
      sharedExamplesFor('#Channel', '#channel');
    });

    context('with lowercase local channel differing from mixed-case remote channel', function() {
      sharedExamplesFor('#channel', '#Channel');
    });
  });
});
