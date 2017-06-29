[![Travis](https://travis-ci.org/Throne3d/node-irc.svg?branch=master)](https://travis-ci.org/Throne3d/node-irc)
<!-- [//]: # Commented: [![npm](https://img.shields.io/npm/Throne3d/irc.svg?style=flat)](https://www.npmjs.com/package/irc) -->
[![Dependency Status](https://david-dm.org/Throne3d/node-irc.svg)](https://david-dm.org/Throne3d/node-irc)
[![devDependency Status](https://david-dm.org/Throne3d/node-irc/dev-status.svg)](https://david-dm.org/Throne3d/node-irc?type=dev)
[![License](https://img.shields.io/badge/license-GPLv3-blue.svg?style=flat)](http://opensource.org/licenses/GPL-3.0)
[![Join the chat at https://gitter.im/node-irc](https://badges.gitter.im/node-irc.svg)](https://gitter.im/node-irc)


[node-irc](https://node-irc-upd.readthedocs.io/) is an IRC client library written in [JavaScript](http://en.wikipedia.org/wiki/JavaScript) for [Node](http://nodejs.org/).
This project is a fork of [another GitHub repository](https://github.com/martynsmith/node-irc).

You can access more detailed documentation for this module at [Read the Docs](https://node-irc-upd.readthedocs.io/en/latest/)


## Installation

**Currently outdated**.

The easiest way to get it is via [npm](http://github.com/isaacs/npm):

```
npm install irc
```

If you want to run the latest version (i.e. later than the version available via [npm](http://github.com/isaacs/npm)) you can clone this repo, then use [npm](http://github.com/isaacs/npm) to link-install it:

```
npm link /path/to/your/clone
```

Of course, you can just clone this, and manually point at the library itself, but we really recommend using [npm](http://github.com/isaacs/npm)!

Note that as of version 0.3.8, node-irc supports character set detection using [icu](http://site.icu-project.org/).
You'll need to install libiconv (if necessary; Linux systems tend to ship this in their glibc) and libicu (and its headers, if necessary, [install instructions](https://github.com/mooz/node-icu-charset-detector#installing-icu)) in order to use this feature.
If you do not have these libraries or their headers installed, you will receive errors when trying to build these dependencies.
However, node-irc will still install (assuming nothing else failed) and you'll be able to use it, just not the character set features.

## Basic Usage

This library provides basic IRC client functionality.
In the simplest case you can connect to an IRC server like so:

```js
var irc = require('irc');
var client = new irc.Client('irc.yourserver.com', 'myNick', {
    channels: ['#channel'],
});
```

Of course it's not much use once it's connected if that's all you have!

The client emits a large number of events that correlate to things you'd normally see in your favorite IRC client.
Most likely the first one you'll want to use is:

```js
client.addListener('message', function (from, to, message) {
    console.log(from + ' => ' + to + ': ' + message);
});
```

or if you're only interested in messages to the bot itself:

```js
client.addListener('pm', function (from, message) {
    console.log(from + ' => ME: ' + message);
});
```

or to a particular channel:

```js
client.addListener('message#yourchannel', function (from, message) {
    console.log(from + ' => #yourchannel: ' + message);
});
```

At the moment there are functions for joining:

```js
client.join('#yourchannel yourpass');
```

parting:

```js
client.part('#yourchannel');
```

talking:

```js
client.say('#yourchannel', "I'm a bot!");
client.say('nonbeliever', "SRSLY, I AM!");
```

and many others. Check out the API documentation for a complete reference.

For any commands that there aren't methods for you can use the send() method which sends raw messages to the server:

```js
client.send('MODE', '#yourchannel', '+o', 'yournick');
```

## Help! - it keeps crashing!

When the client receives errors from the IRC network, it emits an "error" event.
As stated in the [Node JS EventEmitter documentation](http://nodejs.org/api/events.html#events_class_events_eventemitter) if you don't bind something to this error, it will cause a fatal stack trace.

The upshot of this is basically that if you bind an error handler to your client, errors will be sent there instead of crashing your program:

```js
client.addListener('error', function(message) {
    console.log('error: ', message);
});
```


## Further Support

Further documentation (including a complete API reference) is available in reStructuredText format in the docs/ folder of this project, or online at [Read the Docs](https://node-irc-upd.readthedocs.io/en/latest/).

If you find any issues with the documentation (or the module) please send a pull request or file an issue and we'll do our best to accommodate.

**Outdated:**

You can also visit us on ##node-irc on freenode to discuss issues you're having with the library, pull requests, or anything else related to node-irc.
