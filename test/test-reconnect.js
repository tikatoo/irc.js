var testHelpers = require('./helpers');
var chai = require('chai');
var expect = chai.expect;
var sinon = require('sinon');

describe('Client', function() {
  describe('connection', function() {
    context('on connection interruption', function() {
      var clientConfig = {retryDelay: 50, autoConnect: false};
      var metaConfig = {callbackEarly: true, autoGreet: false};
      testHelpers.hookMockSetup(beforeEach, afterEach, {client: clientConfig, meta: metaConfig});

      function sharedExample(callback) {
        it('reconnects with exactly one connection at a time', function(done) {
          var mock = this.mock;
          var client = this.client;
          var registeredSpy = sinon.spy();
          client.on('registered', registeredSpy);

          var conns = [];
          mock.server.on('connection', function(c) {
            conns.push(c);
            mock.greet();
          });

          client.once('registered', function() {
            callback(client, conns);
            setTimeout(teardown, 500);
          });

          client.connect();

          function teardown() {
            expect(registeredSpy.calledTwice).to.be.true;
            expect(conns.length).to.equal(2);
            expect(conns[0].destroyed).to.be.true;
            done();
          }
        });
      }

      context('when ended', function() {
        // when the client ends the connection (potentially unexpectedly)
        sharedExample(function(client, _conns) {
          console.log('ending');
          client.end();
        });
      });

      context('when connection breaks', function() {
        // when connection breaks from server end, like connection error
        sharedExample(function(_client, conns) {
          console.log('destroying');
          conns[conns.length-1].destroy();
        });
      });
    });

    context('with standard client', function() {
      testHelpers.hookMockSetup(beforeEach, afterEach);

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

      it('clears up auto-reconnect if told to disconnect');
    });
  });
});
