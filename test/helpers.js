/* Mock irc server */

var path = require('path');
var fs = require('fs');
var net = require('net');
var tls = require('tls');
var util = require('util');
var irc = require('../lib/irc');
var EventEmitter = require('events').EventEmitter;
var sinon = require('sinon');
var proxyquire = require('proxyquire');
var stubbedUtil = {log: function(){}};
var ircWithStubbedOutput = proxyquire('../lib/irc', {util: stubbedUtil});

var MockIrcd = function(port, encoding, isSecure, quiet) {
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
    if (!quiet) console.log('Mock server initializing.');

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
        if (!quiet) console.log('Mock server closed.');
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

module.exports.MockIrcd = function(port, encoding, isSecure, quiet) {
    return new MockIrcd(port, encoding, isSecure, quiet);
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

function setupMocks(config, callback) {
  // config.client gets merged into irc.Client config
  // config.meta:
  // - autoGreet (default true): automatically greets client on connection
  // - callbackEarly (default false): calls callback on server connection instead of client registered event
  // - disableOutput (default true): stubs util.log to reduce output clutter
  if (typeof callback === 'undefined' && typeof config === 'function') { callback = config; config = undefined; }
  config = config || {};
  config.meta = config.meta || {};
  config.client = config.client || {};

  var metaConfig = Object.assign({autoGreet: true, callbackEarly: false, disableOutput: true}, config.meta);
  var clientConfig = Object.assign({debug: true}, config.client);

  var lib = irc;
  if (metaConfig.disableOutput) {
    lib = ircWithStubbedOutput;
  }
  var lineSpy = sinon.spy();
  var mock = module.exports.MockIrcd(undefined, undefined, undefined, metaConfig.disableOutput);
  mock.on('line', lineSpy);
  var client = new lib.Client('localhost', 'testbot', clientConfig);
  var mockObj = {mock: mock, client: client, lineSpy: lineSpy};

  mock.server.on('connection', function() {
    if (metaConfig.autoGreet) mock.greet();
  });
  client.once('registered', function() {
    if (!metaConfig.callbackEarly) callback(mockObj);
  });
  if (metaConfig.callbackEarly) callback(mockObj);
  return mockObj;
}
module.exports.setupMocks = setupMocks;

function teardownMocks(mockObj, callback) {
  mockObj.client.disconnect();
  mockObj.mock.close(function() { callback(); });
}
module.exports.teardownMocks = teardownMocks;

function itWithCustomMock(msg, config, body) {
  it(msg, function(done) {
    // (teardown) => start => processBody => after
    function start() {
      setupMocks(config, processBody);
    }
    function after() {
      teardownMocks({client: this.client, mock: this.mock}, done);
    }
    function processBody(mockObj) {
      this.client = mockObj.client;
      this.mock = mockObj.mock;
      this.lineSpy = mockObj.lineSpy;
      // handle tests that don't claim to be async
      if (body.length > 0) {
        body(after);
      } else {
        body();
        after();
      }
    }
    if (this.client || this.mock) {
      teardownMocks({client: this.client, mock: this.mock}, start);
    } else {
      start();
    }
  });
}
module.exports.itWithCustomMock = itWithCustomMock;

module.exports.hookMockSetup = function hookMockSetup(beforeEach, afterEach, config) {
  config = config || {};
  beforeEach(function(done) {
    var self = this;
    setupMocks(config, function(mocks) {
      for (var key in mocks) {
        self[key] = mocks[key];
      }
      done();
    });
  });

  afterEach(function(done) {
    teardownMocks({client: this.client, mock: this.mock}, done);
  });
};
