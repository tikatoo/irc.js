/* Mock irc server */

var path = require('path');
var fs = require('fs');
var net = require('net');
var tls = require('tls');
var util = require('util');
var irc = require('../lib/irc');
var EventEmitter = require('events').EventEmitter;

var MockIrcd = function(port, encoding, isSecure) {
    var self = this;
    var connectionClass;
    var options = {};

    if (isSecure) {
        connectionClass = tls;
        options = {
            key: fs.readFileSync(path.resolve(__dirname, 'data/ircd.key')),
            cert: fs.readFileSync(path.resolve(__dirname, 'data/ircd.pem'))
        };
    } else {
        connectionClass = net;
    }

    this.port = port || (isSecure ? 6697 : 6667);
    this.encoding = encoding || 'utf-8';
    this.incoming = [];
    this.outgoing = [];
    console.log('Mock server initializing.');

    this.server = connectionClass.createServer(options, function(c) {
        var active = true;
        c.on('data', function(data) {
            var msg = data.toString(self.encoding).split('\r\n').filter(function(m) { return m; });
            self.incoming = self.incoming.concat(msg);
            msg.forEach(function(line) { self.emit('line', line); });
        });

        self.on('send', function(data) {
            if (!active || c.destroyed) return;
            self.outgoing.push(data);
            c.write(data);
        });

        c.on('end', function() {
            active = false;
            self.emit('end');
        });
    });

    this.server.listen(this.port);

    this.server.on('close', function(){
        console.log('Mock server closed.');
    });
};
util.inherits(MockIrcd, EventEmitter);

MockIrcd.prototype.send = function(data) {
    this.emit('send', data);
};

MockIrcd.prototype.close = function() {
    this.server.close.apply(this.server, arguments);
};

MockIrcd.prototype.getIncomingMsgs = function() {
    return this.incoming;
};

MockIrcd.prototype.greet = function(username) {
    username = username || 'testbot';
    this.send(':localhost 001 ' + username + ' :Welcome to the Internet Relay Chat Network testbot\r\n');
};

var fixtures = require('./data/fixtures');
module.exports.getFixtures = function(testSuite) {
    return fixtures[testSuite];
};

module.exports.MockIrcd = function(port, encoding, isSecure) {
    return new MockIrcd(port, encoding, isSecure);
};

module.exports.withClient = function withClient(func, givenConf) {
    // closes mock server when it gets a connection end event if server used (client disconnects)
    var obj = {};
    obj.port = 6667;
    var ircConf = {
        secure: false,
        selfSigned: true,
        port: obj.port,
        retryCount: 0,
        debug: true
    };

    var conf = Object.assign({}, givenConf);
    var withoutServer = conf.withoutServer;
    delete conf.withoutServer;
    Object.keys(conf).forEach(function(key) {
        ircConf[key] = conf[key];
    });

    if (withoutServer) {
        ircConf.autoConnect = false;
    } else {
        var t;
        obj.closeWithEnd = function(test) {
            t = test;
        };

        obj.mock = module.exports.MockIrcd(obj.port, 'utf-8', false);
        obj.mock.on('end', function() {
            obj.mock.close(function(){ if (t) t.end(); });
        });
    }
    obj.client = new irc.Client('localhost', 'testbot', ircConf);

    func(obj);
};
