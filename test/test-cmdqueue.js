var testHelpers = require('./helpers');
var chai = require('chai');
var expect = chai.expect;
var sinon = require('sinon');

describe('Client', function() {
  describe('command queue', function() {
    context('with config disabled', function() {
      testHelpers.hookMockSetup(beforeEach, afterEach);

      beforeEach(function(done) {
        var self = this;
        setTimeout(function() {
          self.connSpy = sinon.spy();
          self.client.conn.write = self.connSpy;
          done();
        }, 10);
      });

      it('is not enabled', function() {
        this.client.send('PING', 'test 1');
        this.client.send('PING', 'test 2');
        expect(this.connSpy.args).to.deep.equal([
          ['PING :test 1\r\n'],
          ['PING :test 2\r\n']
        ]);
      });
    });

    function sharedExamplesForCmdQueue() {
      beforeEach(function() {
        this.connSpy = sinon.spy();
        this.client.conn.write = this.connSpy;
      });

      it('is enabled', function(done) {
        var self = this;
        self.client.send('PING', 'test 1');
        self.client.send('PING', 'test 2');
        expect(self.connSpy.callCount).to.equal(0);
        setTimeout(first, 10);
        setTimeout(second, 30);

        function first() {
          expect(self.connSpy.args).to.deep.equal([
            ['PING :test 1\r\n']
          ]);
        }
        function second() {
          expect(self.connSpy.args).to.deep.equal([
            ['PING :test 1\r\n'],
            ['PING :test 2\r\n']
          ]);
          done();
        }
      });

      it('provides internal _sendImmediate to send immediately', function() {
        var self = this;
        function wrap() {
          self.client._sendImmediate('PING', 'test 1');
          self.client._sendImmediate('PING', 'test 2');
        }
        expect(wrap).not.to.throw();
        expect(this.connSpy.args).to.deep.equal([
          ['PING :test 1\r\n'],
          ['PING :test 2\r\n']
        ]);
      });

      it('disconnects immediately and clears queue', function(done) {
        var self = this;
        self.client.send('PING', 'test 1');
        self.client.send('PING', 'test 2');
        expect(self.connSpy.callCount).to.equal(0);
        setTimeout(first, 10);
        setTimeout(second, 50);

        function first() {
          expect(self.connSpy.args).to.deep.equal([
            ['PING :test 1\r\n']
          ]);
          self.client.disconnect();
          expect(self.connSpy.args).to.deep.equal([
            ['PING :test 1\r\n'],
            ['QUIT :node-irc says goodbye\r\n']
          ]);
        }
        function second() {
          expect(self.connSpy.args).to.deep.equal([
            ['PING :test 1\r\n'],
            ['QUIT :node-irc says goodbye\r\n']
          ]);
          done();
        }
      });
    }

    context('with config enabled', function() {
      testHelpers.hookMockSetup(beforeEach, afterEach, {client: {floodProtection: true, floodProtectionDelay: 10}});

      beforeEach(function(done) {
        setTimeout(done, 50);
      });

      sharedExamplesForCmdQueue();
    });

    context('with method called', function() {
      testHelpers.hookMockSetup(beforeEach, afterEach);

      beforeEach(function() {
        this.client.activateFloodProtection(10);
      });

      sharedExamplesForCmdQueue();
    });
  });
});
