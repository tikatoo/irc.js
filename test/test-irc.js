var testHelpers = require('./helpers');
var chai = require('chai');
var expect = chai.expect;

describe('Client', function() {
  describe('connect', function() {
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
});
