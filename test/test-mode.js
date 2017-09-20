var testHelpers = require('./helpers');

describe('Client events', function() {
  describe('+mode', function() {
    testHelpers.hookMockSetup(beforeEach, afterEach);

    it('should trigger +mode when joining as operator', function(done) {
      // Set prefix modes
      this.mock.send(':localhost 005 testbot PREFIX=(ov)@+ CHANTYPES=#& :are supported by this server\r\n');

      // Force join into auditorium
      this.mock.send(':testbot JOIN #auditorium\r\n');

      // +o the invisible user
      this.mock.send(':ChanServ MODE #auditorium +o user\r\n');

      this.client.on('+mode', function(channel, by, mode, argument) {
        console.log(channel, by, mode, argument);
        if (channel === '#auditorium' && argument === 'user') {
          done();
        }
      });
    });
  });
});
