var irc = require('../lib/irc');
var test = require('tape');
var testHelpers = require('./helpers');
var proxyquire = require('proxyquire');
var assertNode = require('assert');
var checks = testHelpers.getFixtures('convert-encoding');
var bindTo = { opt: { encoding: 'utf-8' } };

test('irc.Client.convertEncoding old', function(assert) {
    var convertEncoding = function(str) {
        var self = this;

        if (self.opt.encoding) {
            var charsetDetector = require('node-icu-charset-detector');
            var Iconv = require('iconv').Iconv;
            var charset = charsetDetector.detectCharset(str).toString();
            var to = new Iconv(charset, self.opt.encoding);

            return to.convert(str);
        }
        return str;
    }.bind(bindTo);

    checks.causesException.forEach(function iterate(line) {
        var causedException = false;
        try {
            convertEncoding(line);
        } catch (e) {
            causedException = true;
        }

        assert.equal(causedException, true, line + ' caused exception');
    });

    assert.end();
});

test('irc.Client.convertEncoding', function(assert) {
    var convertEncoding = irc.Client.prototype.convertEncoding.bind(bindTo);

    checks.causesException.forEach(function iterate(line) {
        var causedException = false;

        try {
            convertEncoding(line);
        } catch (e) {
            causedException = true;
        }

        assert.equal(causedException, false, line + ' didn\'t cause exception');
    });

    assert.end();
});

var mockCharsetDetector = {detectCharset: function(str) {
    assertNode.deepEqual(Array.from(str), [0x73, 0x63, 0x68, 0xf6, 0x6e]);
    return 'ISO-8859-1';
}};
var mockIconvIconv = function(charset, encoding) {
    assertNode.deepEqual([charset, encoding], ['ISO-8859-1', 'utf-8']);
};
mockIconvIconv.prototype.convert = function(str) {
    assertNode.deepEqual(Array.from(str), [0x73, 0x63, 0x68, 0xf6, 0x6e]);
    return new Buffer([0x73, 0x63, 0x68, 0xc3, 0xb6, 0x6e]);
};
var mockIconv = {Iconv: mockIconvIconv};

test('canConvertEncoding returns false when required modules don\'t load', function(t) {
    t.plan(4);
    var client;

    var ircWithoutCharsetDetector = proxyquire('../lib/irc', { 'node-icu-charset-detector': null, iconv: mockIconv });
    client = new ircWithoutCharsetDetector.Client('localhost', 'nick', {autoConnect: false});
    t.equal(ircWithoutCharsetDetector.canConvertEncoding(), false, 'canConvertEncoding must be false without node-icu-charset-detector');
    t.equal(client.canConvertEncoding(), false, 'Client.canConvertEncoding must be false without node-icu-charset-detector');

    var ircWithoutIconv = proxyquire('../lib/irc', { 'node-icu-charset-detector': mockCharsetDetector, iconv: null });
    client = new ircWithoutCharsetDetector.Client('localhost', 'nick', {autoConnect: false});
    t.equal(ircWithoutIconv.canConvertEncoding(), false, 'canConvertEncoding must be false without iconv');
    t.equal(client.canConvertEncoding(), false, 'Client.canConvertEncoding must be false without iconv');
});

test('canConvertEncoding returns true when convertEncoding works with test data', function(t) {
    t.plan(2);
    var ircWithRequires = proxyquire('../lib/irc', { 'node-icu-charset-detector': mockCharsetDetector, iconv: mockIconv });
    var client = new ircWithRequires.Client('localhost', 'nick', {autoConnect: false});
    t.equal(ircWithRequires.canConvertEncoding(), true, 'canConvertEncoding must be true with functioning modules');
    t.equal(client.canConvertEncoding(), true, 'Client.canConvertEncoding must be true with functioning modules');
});
