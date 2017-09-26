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
});
