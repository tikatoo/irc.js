
irc.js is an IRC client library written in [JavaScript](http://en.wikipedia.org/wiki/JavaScript) for [Node](http://nodejs.org/).
This project is a fork of [irc-upd](https://github.com/Throne3d/node-irc),
which is in turn a fork of [node-irc](https://github.com/martynsmith/node-irc).

You can access more detailed documentation for this module at
[the upstream irc-upd Read the Docs site](https://node-irc-upd.readthedocs.io/en/latest/).
Up-to-date documentation for this fork may arrive eventually
(if I ever get around to it).


## Installation

The easiest way to get it is via [npm](http://github.com/isaacs/npm):

```
npm install --save "git+https://github.com/tikatoo/irc.js"
```

### Character set detection

Character set detection was introduced to node-irc in version 0.3.8.
Since then, it's had a revamp, and now uses [chardet](https://github.com/runk/node-chardet) and [iconv-lite](https://github.com/ashtuchkin/iconv-lite).
It should no longer be necessary to install local libraries to get the encoding conversion to function.
However, if the libraries fail to install for whatever reason, node-irc will still install (assuming nothing else failed) and you'll be able to use it, just not the character set features.

If you install the library without the relevant dependencies at first, and later wish to enable to character set conversion functionality, simply re-run `npm install`.

## Basic Usage

This library provides basic IRC client functionality.
In the simplest case you can connect to an IRC server like so:

```js
var irc = require('irc-upd');
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

You can visit us on our Gitter (found [here](https://gitter.im/node-irc)) to discuss issues you're having with the library, pull requests, or anything else related to node-irc.

If you want to, you can connect to Gitter with your standard IRC client – instructions [here](https://irc.gitter.im/).
