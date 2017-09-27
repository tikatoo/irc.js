var testHelpers = require('./helpers');
var checks = testHelpers.getFixtures('convert-encoding');
var proxyquire = require('proxyquire');
var chai = require('chai');
var expect = chai.expect;

describe('Client', function() {
  describe('convertEncoding', function() {
    function sharedExamplesFor(encoding) {
      var clientConfig = {};
      if (encoding) clientConfig.encoding = encoding;

      context('with stubbed node-icu-charset-detector and iconv', function() {
        it('works with valid data');
        it('does not throw with sample data');
        it('does not throw with invalid data');
      });

      context('without node-icu-charset-detector and iconv', function() {
        it('does not throw with sample data', function() {
          var ircWithoutCharset = proxyquire('../lib/irc', { 'node-icu-charset-detector': null, iconv: null });
          var client = new ircWithoutCharset.Client('localhost', 'nick', Object.assign({autoConnect: false}, clientConfig));
          checks.causesException.forEach(function(line) {
            var wrap = function() {
              client.convertEncoding(line);
            };
            expect(wrap).not.to.throw();
          });
        });
      });

      context('with proper node-icu-charset-detector and iconv', function() {
        testHelpers.hookMockSetup(beforeEach, afterEach, {client: clientConfig});
        beforeEach(function() {
          if (!this.client.canConvertEncoding()) this.skip();
        });

        it('works with valid data');

        it('does not throw with sample data', function() {
          var client = this.client;
          checks.causesException.forEach(function(line) {
            var wrap = function() {
              client.convertEncoding(line);
            };
            expect(wrap).not.to.throw();
          });
        });

        it('does not throw with invalid data');
      });
    }

    context('without encoding config', function() {
      sharedExamplesFor();
    });

    context('with utf-8 encoding config', function() {
      sharedExamplesFor('utf-8');
    });
  });

  describe('canConvertEncoding', function() {
    var latinData = [0x73, 0x63, 0x68, 0xf6, 0x6e];
    var utfData = [0x73, 0x63, 0x68, 0xc3, 0xb6, 0x6e];
    var mockCharsetDetector = {detectCharset: function(str) {
        expect(Array.from(str)).to.deep.equal(latinData);
        return 'ISO-8859-1';
    }};
    var mockIconvIconv = function(charset, encoding) {
      expect(charset).to.equal('ISO-8859-1');
      expect(encoding).to.equal('utf-8');
    };
    mockIconvIconv.prototype.convert = function(str) {
      expect(Array.from(str)).to.deep.equal(latinData);
      return new Buffer(utfData);
    };
    var mockIconv = {Iconv: mockIconvIconv};

    it('is false when node-icu-charset-detector doesn\'t load', function() {
      var ircWithoutCharsetDetector = proxyquire('../lib/irc', { 'node-icu-charset-detector': null, iconv: mockIconv });
      var client = new ircWithoutCharsetDetector.Client('localhost', 'nick', {autoConnect: false});
      expect(ircWithoutCharsetDetector.canConvertEncoding()).to.be.false;
      expect(client.canConvertEncoding()).to.be.false;
    });

    it('is false when iconv doesn\'t load', function() {
      var ircWithoutIconv = proxyquire('../lib/irc', { 'node-icu-charset-detector': mockCharsetDetector, iconv: null });
      var client = new ircWithoutIconv.Client('localhost', 'nick', {autoConnect: false});
      expect(ircWithoutIconv.canConvertEncoding()).to.be.false;
      expect(client.canConvertEncoding()).to.be.false;
    });

    it('is true when convertEncoding works with test data', function() {
      var ircWithRequires = proxyquire('../lib/irc', { 'node-icu-charset-detector': mockCharsetDetector, iconv: mockIconv });
      var client = new ircWithRequires.Client('localhost', 'nick', {autoConnect: false});
      expect(ircWithRequires.canConvertEncoding()).to.be.true;
      expect(client.canConvertEncoding()).to.be.true;
    });
  });
});
