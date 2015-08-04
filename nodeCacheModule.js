var nodeCache = require('node-cache');

/**
 * nodeCacheModule constructor
 * @constructor
 * @param config: {
 *    type:                           {string | 'node-cache'}
 *    verbose:                        {boolean | false},
 *    expiration:                     {integer | 900},
 *    readOnly:                       {boolean | false},
 *    checkOnPreviousEmpty            {boolean | true},
 *    backgroundRefreshIntervalCheck  {boolean | true},
 *    backgroundRefreshInterval       {integer | 60000},
 *    backgroundRefreshMinTtl         {integer | 70000}
 * }
 */
function nodeCacheModule(config){
  var self = this;
  config = config || {};
  self.verbose = config.verbose || false;
  self.defaultExpiration = config.defaultExpiration || 900;
  self.readOnly = (typeof config.readOnly === 'boolean') ? config.readOnly : false;
  self.checkOnPreviousEmpty = (typeof config.checkOnPreviousEmpty === 'boolean') ? config.checkOnPreviousEmpty : true;
  self.backgroundRefreshInterval = config.backgroundRefreshInterval || 60000;
  self.backgroundRefreshMinTtl = config.backgroundRefreshMinTtl || 70000;
  var refreshKeys = {};
  var backgroundRefreshEnabled = false;

  /**
   ******************************************* PUBLIC FUNCTIONS *******************************************
   */

  /**
   * Get the value associated with a given key
   * @param {string} key
   * @param {function} cb
   * @param {string} cleanKey
   */
  self.get = function(key, cb, cleanKey){
    if(arguments.length < 2){
      throw new exception('INCORRECT_ARGUMENT_EXCEPTION', '.get() requires 2 arguments.');
    }
    log(false, 'get() called:', {key: key});
    try {
      var cacheKey = (cleanKey) ? cleanKey : key;
      self.db.get(cacheKey, function(err, result){
        cb(err, result);
      });
    } catch (err) {
      cb({name: 'GetException', message: err}, null);
    }
  }

  /**
   * Get multiple values given multiple keys
   * @param {array} keys
   * @param {function} cb
   * @param {integer} index
   */
  self.mget = function(keys, cb, index){
    if(arguments.length < 2){
      throw new exception('INCORRECT_ARGUMENT_EXCEPTION', '.mget() requires 2 arguments.');
    }
    log(false, '.mget() called:', {keys: keys});
    self.db.mget(keys, function (err, response){
      cb(err, response, index);
    });
  }

  /**
   * Associate a key and value and optionally set an expiration
   * @param {string} key
   * @param {string | object} value
   * @param {integer} expiration
   * @param {function} refresh
   * @param {function} cb
   */
  self.set = function(){
    if(arguments.length < 2){
      throw new exception('INCORRECT_ARGUMENT_EXCEPTION', '.set() requires a minimum of 2 arguments.');
    }
    var key = arguments[0];
    var value = arguments[1];
    var expiration = arguments[2] || null;
    var refresh = (arguments.length == 5) ? arguments[3] : null;
    var cb = (arguments.length == 5) ? arguments[4] : arguments[3];
    cb = cb || noop;
    log(false, '.set() called:', {key: key, value: value});
    try {
      if(!self.readOnly){
        expiration = expiration || self.defaultExpiration;
        var exp = (expiration * 1000) + Date.now();
        self.db.set(key, value, expiration, cb);
        if(refresh){
          refreshKeys[key] = {expiration: exp, lifeSpan: expiration, refresh: refresh};
          backgroundRefreshInit();
        }
      }
    } catch (err) {
      log(true, '.set() failed for cache of type ' + self.type, {name: 'NodeCacheSetException', message: err});
    }
  }

  /**
   * Associate multiple keys with multiple values and optionally set expirations per function and/or key
   * @param {object} obj
   * @param {integer} expiration
   * @param {function} cb
   */
  self.mset = function(obj, expiration, cb){
    if(arguments.length < 1){
      throw new exception('INCORRECT_ARGUMENT_EXCEPTION', '.mset() requires a minimum of 1 argument.');
    }
    log(false, '.mset() called:', {data: obj});
    for(key in obj){
      if(obj.hasOwnProperty(key)){
        var tempExpiration = expiration || self.defaultExpiration;
        var value = obj[key];
        if(typeof value === 'object' && value.cacheValue){
          tempExpiration = value.expiration || tempExpiration;
          value = value.cacheValue;
        }
        self.db.set(key, value, tempExpiration);
      }
    }
    if(cb) cb();
  }

  /**
   * Delete the provided keys and their associated values
   * @param {array} keys
   * @param {function} cb
   */
  self.del = function(keys, cb){
    if(arguments.length < 1){
      throw new exception('INCORRECT_ARGUMENT_EXCEPTION', '.del() requires a minimum of 1 argument.');
    }
    log(false, '.del() called:', {keys: keys});
    try {
      self.db.del(keys, function (err, count){
        if(cb){
          cb(err, count);
        }
      });
      if(typeof keys === 'object'){
        for(var i = 0; i < keys.length; i++){
          var key = keys[i];
          delete refreshKeys[key];
        }
      }
      else{
        delete refreshKeys[keys];
      }
    } catch (err) {
      log(true, '.del() failed for cache of type ' + this.type, err);
    }
  }

  /**
   * Flush all keys and values
   * @param {function} cb
   */
  self.flush = function(cb){
    log(false, '.flush() called');
    try {
      self.db.flushAll();
      refreshKeys = {};
    } catch (err) {
      log(true, '.flush() failed for cache of type ' + this.type, err);
    }
    if(cb) cb();
  }

  /**
   ******************************************* PRIVATE FUNCTIONS *******************************************
   */

  /**
   * Initialize nodeCacheModule given the provided constructor params
   */
  function init(){
    try {
      self.db = new nodeCache();
      log(false, 'Node-cache client created with the following defaults:', {expiration: this.expiration, verbose: this.verbose, readOnly: this.readOnly});
    } catch (err) {
      log(true, 'Node-cache client not created:', err);
      self.db = false;
    }
    self.type = config.type || 'node-cache';
  }

  /**
   * Initialize background refresh
   */
  function backgroundRefreshInit(){
    if(!backgroundRefreshEnabled){
      backgroundRefreshEnabled = true;
      if(self.backgroundRefreshIntervalCheck){
        if(self.backgroundRefreshInterval > self.backgroundRefreshMinTtl){
          throw new exception('BACKGROUND_REFRESH_INTERVAL_EXCEPTION', 'backgroundRefreshInterval cannot be greater than backgroundRefreshMinTtl.');
        }
      }
      setInterval(function(){
        backgroundRefresh();
      }, self.backgroundRefreshInterval);
    }
  }

  /**
   * Refreshes all keys that were set with a refresh function
   */
  function backgroundRefresh(){
    for(key in refreshKeys){
      if(refreshKeys.hasOwnProperty(key)){
        var data = refreshKeys[key];
        if(data.expiration - Date.now() < self.backgroundRefreshMinTtl){
          data.refresh(key, function (err, response){
            if(!err){
              self.set(key, response, data.lifeSpan, data.refresh, noop);
            }
          });
        }
      }
    }
  }

  /**
   * Instantates an exception to be thrown
   * @param {string} name
   * @param {string} message
   * @return {exception}
   */
  function exception(name, message){
    this.name = name;
    this.message = message;
  }

  /**
   * Error logging logic
   * @param {boolean} isError
   * @param {string} message
   * @param {object} data
   */
  function log(isError, message, data){
    var indentifier = 'nodeCacheModule: ';
    if(self.verbose || isError){
      if(data) console.log(indentifier + message, data);
      else console.log(indentifier + message);
    }
  }

  var noop = function(){}

  init();
}

module.exports = nodeCacheModule;
