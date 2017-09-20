var parseMessage  = require('../lib/parse_message');
var test = require('tape');

var testHelpers = require('./helpers');

['strict', 'non-strict'].forEach(function(type) {
    test('irc.parseMessage ' + type + ' mode', function(t) {
        var checks = testHelpers.getFixtures('parse-line');

        Object.keys(checks).forEach(function(line) {
            var stripColors = false;
            var expected = Object.assign({}, checks[line]);
            if (expected.hasOwnProperty('stripColors')) {
                stripColors = expected.stripColors;
                delete expected.stripColors;
            }
            t.equal(
                JSON.stringify(parseMessage(line, stripColors, type === 'strict')),
                JSON.stringify(expected),
                line + ' must parse correctly'
            );
        });
        t.end();
    });
});

test('irc.parseMessage non-strict parsing mode with Unicode', function(t) {
    var checks = testHelpers.getFixtures('parse-line-nonstrict');

    Object.keys(checks).forEach(function(line) {
        t.equal(
            JSON.stringify(parseMessage(line, false, false)),
            JSON.stringify(checks[line]),
            line + ' must parse correctly'
        );
    });
    t.end();
});
