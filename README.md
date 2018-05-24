# cache-service-node-cache

* A [node-cache](https://github.com/tcs-de/nodecache) plugin for [cache-service](https://github.com/jpodwys/cache-service)
* AND a standalone node-cache wrapper

#### Features

* Background refresh
* Robust API
* Built-in logging with a `verbose` flag.
* Compatible with `cache-service` and `superagent-cache`
* Public access to the underlying `node-cache` instance
* Excellent `.mset()` implementation which allows you to set expirations on a per key, per function call, and/or per `cache-service-cache-module` instance basis.

# Basic Usage

Add to your package.json. `node-cache` is a peer dependency of `cache-service-node-cache`. This repo is currently tested against `node-cache#4.x`.

```json
  ...
  "dependencies": {
    "cache-service-node-cache": "2.x",
    "node-cache": "4.x"
  },
  ...
```

Require and instantiate

```javascript
var csNodeCache = require('cache-service-node-cache');

var cacheModuleConfig = {defaultExpiration: 60};
var nodeCache = new csNodeCache(cacheModuleConfig);
```

Cache!
```javascript
nodeCache.set('key', 'value');
```

# Cache Module Configuration Options

`cache-service-node-cache`'s constructor takes an optional config object with any number of the following properties:

## type

An arbitrary identifier you can assign so you know which cache is responsible for logs and errors.

* type: string
* default: 'node-cache'

## defaultExpiration

The expiration to include when executing cache set commands. Can be overridden via `.set()`'s optional expiration param.

* type: int
* default: 900
* measure: seconds

## backgroundRefreshInterval

How frequently should all background refresh-enabled keys be scanned to determine whether they should be refreshed. For a more thorough explanation on `background refresh`, see the [Using Background Refresh](#using-background-refresh) section.

* type: int
* default: 60000
* measure: milliseconds

## backgroundRefreshMinTtl

The maximum ttl a scanned background refresh-enabled key can have without triggering a refresh. This number should always be greater than `backgroundRefreshInterval`.

* type: int
* default: 70000
* measure: milliseconds

## backgroundRefreshIntervalCheck

Whether to throw an exception if `backgroundRefreshInterval` is greater than `backgroundRefreshMinTtl`. Setting this property to false is highly discouraged.

* type: boolean
* default: true

## verbose

> When used with `cache-service`, this property is overridden by `cache-service`'s `verbose` value.

When false, `cache-service-node-cache` will log only errors. When true, `cache-service-node-cache` will log all activity (useful for testing and debugging).

* type: boolean
* default: false

# API

Although this is a node-cache wrapper, its API differs in some small cases from node-cache's own API because all `cache-service`-compatible cache modules match [`cache-service`'s API](https://github.com/jpodwys/cache-service#api).

## .get(key, callback (err, response))

Retrieve a value by a given key.

* key: type: string
* callback: type: function
* err: type: object
* response: type: string or object

## .mget(keys, callback (err, response))

Retrieve the values belonging to a series of keys. If a key is not found, it will not be in `response`.

* keys: type: an array of strings
* callback: type: function
* err: type: object
* response: type: object, example: {key: 'value', key2: 'value2'...}

## .set(key, value, [expiration], [refresh(key, cb)], [callback])

> See the [Using Background Refresh](#using-background-refresh) section for more about the `refresh` and `callback` params.

Set a value by a given key.

* key: type: string
* callback: type: function
* expiration: type: int, measure: seconds
* refresh: type: function
* callback: type: function

## .mset(obj, [expiration], [callback])

Set multiple values to multiple keys

* obj: type: object, example: {'key': 'value', 'key2': 'value2', 'key3': {cacheValue: 'value3', expiration: 60}}
* callback: type: function

This function exposes a heirarchy of expiration values as follows:
* The `expiration` property of a key that also contains a `cacheValue` property will override all other expirations. (This means that, if you are caching an object, the string 'cacheValue' is a reserved property name within that object.)
* If an object with both `cacheValue` and `expiration` as properties is not present, the `expiration` provided to the `.mset()` argument list will be used.
* If neither of the above is provided, each cache's `defaultExpiration` will be applied.

## .del(keys, [callback (err, count)])

Delete a key or an array of keys and their associated values.

* keys: type: string || array of strings
* callback: type: function
* err: type: object
* count: type: int

## .flush([cb])

Flush all keys and values from.

* callback: type: function

## .db

This is the underlying [`node-cache` instance](https://github.com/tcs-de/nodecache). If needed, you can access `node-cache` functions I haven't abstracted.

# Using Background Refresh

With a typical cache setup, you're left to find the perfect compromise between having a long expiration so that users don't have to suffer through the worst case load time, and a short expiration so data doesn't get stale. `cache-service-cache-module` eliminates the need to worry about users suffering through the longest wait time by automatically refreshing keys for you. Here's how it works:

#### How do I turn it on?

By default, background refresh is off. It will turn itself on the first time you pass a `refresh` param to `.set()`.

#### Configure

There are three options you can manipulate. See the API section for more information about them.

* `backgroundRefreshInterval`
* `backgroundRefreshMinTtl`
* `backgroundRefreshIntervalCheck`

#### Use

Background refresh is exposed via the `.set()` command as follows:

```javascript
cacheModule.set('key', 'value', 300, refresh, cb);
```

If you want to pass `refresh`, you must also pass `cb` because if only four params are passed, `cache-service-node-cache` will assume the fourth param is `cb`.

#### The Refresh Param

###### refresh(key, cb(err, response))

* key: type: string: this is the key that is being refreshed
* cb: type: function: you must trigger this function to pass the data that should replace the current key's value

The `refresh` param MUST be a function that accepts `key` and a callback function that accepts `err` and `response` as follows:

```javascript
var refresh = function(key, cb){
  var response = goGetData();
  cb(null, response);
}
```
