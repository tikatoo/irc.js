var parseMessage  = require('../lib/parse_message');
var test = require('tape');

var testHelpers = require('./helpers');

test('irc.parseMessage', function(t) {
    var checks = testHelpers.getFixtures('parse-line');

    Object.keys(checks).forEach(function(line) {
        var stripColors = false;
        if (checks[line].hasOwnProperty('stripColors')) {
            stripColors = checks[line].stripColors;
            delete checks[line].stripColors;
        }
        t.equal(
            JSON.stringify(parseMessage(line, stripColors)),
            JSON.stringify(checks[line]),
            line + ' must parse correctly'
        );
    });
    t.end();
});

test('irc.parseMessage non-strict parsing mode', function(t) {
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
