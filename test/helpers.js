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

module.exports.irc = irc;
module.exports.ircWithStubbedOutput = ircWithStubbedOutput;

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

function setupMocks(config, callback) {
  // both args optional
  // config.client gets merged into irc.Client config, except client.server and client.nick (used in irc.Client params)
  // config.server is used for MockIrcd (port, encoding, isSecure, disableOutput)
  // config.meta:
  // - autoGreet (default true): automatically greets client on connection
  // - callbackEarly (default false): calls callback when initialization finished instead ofon  client registered event
  // - disableOutput (default true): stubs client's util.log to reduce output clutter
  // - withoutServer (default false): skips server, makes client not autoConnect by default and enables callbackEarly

  if (typeof callback === 'undefined' && typeof config === 'function') { callback = config; config = undefined; }
  config = config || {};
  config.meta = config.meta || {};
  config.client = config.client || {};
  config.server = config.server || {};

  var defaultMeta = {autoGreet: true, callbackEarly: false, disableOutput: true, withoutServer: false};
  var defaultClient = {debug: true};
  var defaultServer = {};

  var metaConfig = Object.assign(defaultMeta, config.meta);
  if (metaConfig.withoutServer) {
    defaultClient.autoConnect = false;
    metaConfig.callbackEarly = true;
  }

  var clientConfig = Object.assign(defaultClient, config.client);
  var serverConfig = Object.assign(defaultServer, config.server);

  var quiet = metaConfig.disableOutput;

  var lineSpy;
  var mock;
  if (!metaConfig.withoutServer) {
    lineSpy = sinon.spy();
    mock = module.exports.MockIrcd(serverConfig.port, serverConfig.encoding, serverConfig.isSecure, quiet);
    mock.on('line', lineSpy);
    mock.server.on('connection', function() {
      if (metaConfig.autoGreet) mock.greet();
    });
  }

  var clientServer = 'localhost';
  if (clientConfig.server) {
    clientServer = clientConfig.server;
    delete clientConfig.server;
  }
  var clientNick = 'testbot';
  if (clientConfig.nick) {
    clientNick = clientConfig.nick;
    delete clientConfig.nick;
  }

  var lib = (quiet) ? ircWithStubbedOutput : irc;
  var client = new lib.Client(clientServer, clientNick, clientConfig);

  var mockObj = {mock: mock, client: client, lineSpy: lineSpy};
  client.once('registered', function() {
    if (!metaConfig.callbackEarly) callback(mockObj);
  });
  if (metaConfig.callbackEarly) callback(mockObj);
}
module.exports.setupMocks = setupMocks;

function teardownMocks(mockObj, callback) {
  mockObj.client.disconnect();
  if (mockObj.mock) {
    mockObj.mock.close(function() { callback(); });
  } else {
    callback();
  }
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
