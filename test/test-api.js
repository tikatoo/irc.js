var testHelpers = require('./helpers');
var itWithCustomMock = testHelpers.itWithCustomMock;
var joinChannelsBefore = testHelpers.joinChannelsBefore;
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

    it('works with comma-separated channel example', function() {
      this.client.send('PART', '#channel1,#channel2,#channel3', 'test message');
      expect(this.debugSpy.args).to.deep.equal([
        ['SEND:', 'PART #channel1,#channel2,#channel3 :test message']
      ]);
      expect(this.connSpy.args).to.deep.equal([
        ['PART #channel1,#channel2,#channel3 :test message\r\n']
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

    function downcaseChannels(chans) {
      return chans.map(function(x) { return x.toLowerCase(); });
    }

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

    function sharedExamplesFor(channels, remoteChannels) {
      it('sends correct command and does not throw with no callback', function() {
        var self = this;
        function wrap() {
          self.client.join(channels.join(','));
        }
        expect(wrap).not.to.throw();
        expect(this.sendSpy.args).to.deep.equal([
          ['JOIN', channels.join(',')]
        ]);
      });

      it('adds to opt.channels on successful join', function(done) {
        var self = this;
        var i = 0;
        self.client.on('join', function() {
          i++;
          if (i === channels.length) setTimeout(check, 10);
        });
        expect(self.client.opt.channels).to.be.empty;
        self.client.join(channels.join(','));
        remoteChannels.forEach(function(remoteChan) {
          self.mock.send(':testbot!~testbot@EXAMPLE.HOST JOIN :' + remoteChan + '\r\n');
        });

        function check() {
          expect(downcaseChannels(self.client.opt.channels)).to.deep.equal(downcaseChannels(channels));
          done();
        }
      });

      it('calls given callback', function(done) {
        var self = this;
        expect(self.client.opt.channels).to.be.empty;
        self.client.join(channels.join(','), check);
        remoteChannels.forEach(function(remoteChan) {
          self.mock.send(':testbot!~testbot@EXAMPLE.HOST JOIN :' + remoteChan + '\r\n');
        });

        var i = 0;
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
            args: [remoteChannels[i]]
          });
          i++;
          if (i === channels.length) done();
        }
      });
    }

    context('with same lowercase local and remote channel', function() {
      sharedExamplesFor(['#channel'], ['#channel']);
    });

    context('with same mixed-case local and remote channel', function() {
      sharedExamplesFor(['#Channel'], ['#Channel']);
    });

    context('with mixed-case local channel differing from lowercase remote channel', function() {
      sharedExamplesFor(['#Channel'], ['#channel']);
    });

    context('with lowercase local channel differing from mixed-case remote channel', function() {
      sharedExamplesFor(['#channel'], ['#Channel']);
    });

    context('with multiple channels', function() {
      var localChannels = ['#channel', '#channel2', '#Test', '#Test2'];
      var remoteChannels = ['#channel', '#Channel2', '#test', '#Test2'];

      sharedExamplesFor(localChannels, remoteChannels);
    });

    context('with zero parameter', function() {
      var localChannels = ['#channel', '#channel2', '#Test', '#Test2'];
      var remoteChannels = ['#channel', '#Channel2', '#test', '#Test2'];

      joinChannelsBefore(beforeEach, localChannels, remoteChannels);

      it('sends correct command and does not throw without callback', function() {
        var self = this;
        function wrap() {
          self.client.join('0');
        }
        expect(wrap).not.to.throw();
        expect(this.sendSpy.args).to.deep.equal([
          ['JOIN', '0']
        ]);
      });

      it('removes all channels from opt.channels and does not call callback', function() {
        var self = this;
        var localPartSpy = sinon.spy();
        var callbackSpy = sinon.spy();
        self.client.on('part', localPartSpy);
        self.client.join('0', callbackSpy);
        self.mock.on('line', function(line) {
          if (line !== 'JOIN 0') return;
          remoteChannels.forEach(function(remoteChan) {
            self.mock.send(':testbot!~testbot@EXAMPLE.HOST PART ' + remoteChan + ' :Left all channels\r\n');
          });
        });
        var i = 0;
        self.client.on('part', function() {
          i++;
          if (i === localChannels.length) setTimeout(teardown, 10);
        });

        function teardown() {
          expect(self.client.opt.channels).to.be.empty;
          expect(callbackSpy.callCount).to.equal(0);
          var standardMsg = {
            prefix: 'testbot!~testbot@EXAMPLE.HOST',
            nick: 'testbot',
            user: '~testbot',
            host: 'EXAMPLE.HOST',
            command: 'PART',
            rawCommand: 'PART',
            commandType: 'normal'
          };
          var expected = remoteChannels.map(function(remoteChan) {
            var message = Object.assign({args: [remoteChan, 'Left all channels']}, standardMsg);
            return [remoteChan, 'testbot', 'Left all channels', message];
          });
          expect(localPartSpy.args).to.deep.equal(expected);
        }
      });
    });
  });

  describe('#part', function() {
    testHelpers.hookMockSetup(beforeEach, afterEach);

    function downcaseChannels(chans) {
      return chans.map(function(x) { return x.toLowerCase(); });
    }

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

    function sharedExamplesFor(channels, remoteChannels) {
      joinChannelsBefore(beforeEach, channels, remoteChannels);

      it('works with no message or callback', function() {
        var self = this;
        function wrap() {
          self.client.part(channels.join(','));
        }
        expect(wrap).not.to.throw();
        expect(this.sendSpy.args).to.deep.equal([
          ['PART', channels.join(',')]
        ]);
      });

      it('sends with message and no callback', function() {
        var self = this;
        function wrap() {
          self.client.part(channels.join(','), 'test message');
        }
        expect(wrap).not.to.throw();
        expect(this.sendSpy.args).to.deep.equal([
          ['PART', channels.join(','), 'test message']
        ]);
      });

      it('sends with callback and no message', function() {
        var self = this;
        function wrap() {
          self.client.part(channels.join(','), function() {});
        }
        expect(wrap).not.to.throw();
        expect(this.sendSpy.args).to.deep.equal([
          ['PART', channels.join(',')]
        ]);
      });

      it('sends with message and callback', function() {
        var self = this;
        function wrap() {
          self.client.part(channels.join(','), 'test message', function() {});
        }
        expect(wrap).not.to.throw();
        expect(this.sendSpy.args).to.deep.equal([
          ['PART', channels.join(','), 'test message']
        ]);
      });

      it('removes from opt.channels', function(done) {
        var self = this;
        var i = 0;
        self.client.on('part', function() {
          i++;
          if (i === channels.length) setTimeout(check, 10);
        });
        expect(downcaseChannels(self.client.opt.channels)).to.deep.equal(downcaseChannels(remoteChannels));
        self.client.part(channels.join(','), 'test message');
        remoteChannels.forEach(function(remoteChan) {
          self.mock.send(':testbot!~testbot@EXAMPLE.HOST PART ' + remoteChan + ' :test message\r\n');
        });

        function check() {
          expect(self.client.opt.channels).to.empty;
          done();
        }
      });

      it('calls given callback', function(done) {
        var self = this;
        expect(downcaseChannels(self.client.opt.channels)).to.deep.equal(downcaseChannels(remoteChannels));
        self.client.part(channels.join(','), check);
        remoteChannels.forEach(function(remoteChan) {
          self.mock.send(':testbot!~testbot@EXAMPLE.HOST PART ' + remoteChan + ' :test message\r\n');
        });

        var i = 0;
        function check(nick, reason, message) {
          expect(nick).to.equal('testbot');
          expect(reason).to.equal('test message');
          expect(message).to.deep.equal({
            prefix: 'testbot!~testbot@EXAMPLE.HOST',
            nick: 'testbot',
            user: '~testbot',
            host: 'EXAMPLE.HOST',
            commandType: 'normal',
            command: 'PART',
            rawCommand: 'PART',
            args: [remoteChannels[i], 'test message']
          });
          i++;
          if (i === channels.length) done();
        }
      });
    }

    context('with same lowercase local and remote channel', function() {
      sharedExamplesFor(['#channel'], ['#channel']);
    });

    context('with same mixed-case local and remote channel', function() {
      sharedExamplesFor(['#Channel'], ['#Channel']);
    });

    context('with mixed-case local channel differing from lowercase remote channel', function() {
      sharedExamplesFor(['#Channel'], ['#channel']);
    });

    context('with lowercase local channel differing from mixed-case remote channel', function() {
      sharedExamplesFor(['#channel'], ['#Channel']);
    });

    context('with multiple channels', function() {
      var localChannels = ['#channel', '#channel2', '#Test', '#Test2'];
      var remoteChannels = ['#channel', '#Channel2', '#test', '#Test2'];

      sharedExamplesFor(localChannels, remoteChannels);
    });
  });
});
