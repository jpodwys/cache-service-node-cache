var nodeCache = require('node-cache');

/**
 * nodeCacheModule constructor
 * @constructor
 * @param config: {
 *    type:                 {string | 'node-cache-standalone'}
 *    verbose:              {boolean | false},
 *    expiration:           {integer | 900},
 *    readOnly:             {boolean | false},
 *    checkOnPreviousEmpty  {boolean | true}
 * }
 */
function nodeCacheModule(config){
  var self = this;
  config = config || {};
  self.verbose = config.verbose || false;
  self.expiration = config.defaultExpiration || 900;
  self.readOnly = (typeof config.readOnly === 'boolean') ? config.readOnly : false;
  self.checkOnPreviousEmpty = (typeof config.checkOnPreviousEmpty === 'boolean') ? config.checkOnPreviousEmpty : true;

  /**
   * Get the value associated with a given key
   * @param {string} key
   * @param {function} cb
   * @param {string} cleanKey
   */
  self.get = function(key, cb, cleanKey){
    log(false, 'Attempting to get key:', {key: key});
    try {
      cacheKey = (cleanKey) ? cleanKey : key;
      log(false, 'Attempting to get key:', {key: cacheKey});
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
    log(false, 'Attempting to mget keys:', {keys: keys});
    self.db.mget(keys, function (err, response){
      cb(err, response, index);
    });
  }

  /**
   * Associate a key and value and optionally set an expiration
   * @param {string} key
   * @param {string | object} value
   * @param {integer} expiration
   * @param {function} cb
   */
  self.set = function(key, value, expiration, cb){
    log(false, 'Attempting to set key:', {key: key, value: value});
    try {
      if(!self.readOnly){
        expiration = expiration || self.expiration;
        cb = cb || noop;
        self.db.set(key, value, expiration, cb);
      }
    } catch (err) {
      log(true, 'Set failed for cache of type ' + self.type, {name: 'NodeCacheSetException', message: err});
    }
  }

  /**
   * Associate multiple keys with multiple values and optionally set expirations per function and/or key
   * @param {object} obj
   * @param {integer} expiration
   * @param {function} cb
   */
  self.mset = function(obj, expiration, cb){
    log(false, 'Attempting to mset data:', {data: obj});
    for(key in obj){
      if(obj.hasOwnProperty(key)){
        var tempExpiration = expiration || self.expiration;
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
   * Flush all keys and values
   * @param {function} cb
   */
  self.flushAll = function(cb){
    log(false, 'Attempting to flush all data:');
    try {
      self.db.flushAll();
      log(false, 'Flushing all data from cache of type ' + this.type);
    } catch (err) {
      log(true, 'Flush failed for cache of type ' + this.type, err);
    }
    if(cb) cb();
  }

  /**
   * Delete the provided keys and their associated values
   * @param {array} keys
   * @param {function} cb
   */
  self.del = function(keys, cb){
    log(false, 'Attempting to delete keys:', {keys: keys});
    try {
      self.db.del(keys, function (err, count){
        if(cb){
          cb(err, count);
        }
      });
    } catch (err) {
      log(true, 'Delete failed for cache of type ' + this.type, err);
    }
  }

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
    self.type = config.type || 'node-cache-standalone';
  }

  /**
   * Error logging logic
   * @param {boolean} isError
   * @param {string} message
   * @param {object} data
   */
  function log(isError, message, data){
    var indentifier = 'cacheService: ';
    if(self.verbose || isError){
      if(data) console.log(indentifier + message, data);
      else console.log(indentifier + message);
    }
  }

  var noop = function(){}

  init();
}

module.exports = nodeCacheModule;
