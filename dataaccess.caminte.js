/**
 * real long term persistence
 * @module dataaccess_camintejs
 */

/**
 * http://www.camintejs.com / https://github.com/biggora/caminte
 * @type {Object}
 */

// caminte can support:  mysql, sqlite3, riak, postgres, couchdb, mongodb, redis, neo4j, firebird, rethinkdb, tingodb
// however AltAPI will officially support: sqlite, Redis or MySQL for long term storage
//
// @duerig wants Redis for long term storage
// however it requires the entire dataset to be in memory,
// so not all the network data could be store in it, unless you have 128gb+ of memory
// 1gb of memory in redis right now (with Jun 2014 data models) holds roughly:
// ~200k posts (204k annotations, 246k entities) ~10k users (6k follows) 2.4k interactions
//

// so MySQL is good alternative if you want a large dataset
// SQLite is a good incase the user doesn't want to install any extra software

// in memory mode, 400mb holds about 6690U 2694F 84890P 0C 0M 0s 770i 83977a 126741e
// memory mode is only good for dev, after buckets get big the API stops responding
// in sqlite3 mode, 50mb of diskspace holds 3736U 1582F 15437P 0C 0M 0s 175i 14239a 29922e

var Schema = require('caminte').Schema;
//var request = require('request');

var upstreamUserTokenModel, localUserTokenModel, oauthAppModel, clientModel,
userModel, postModel, entityModel, annotationModel, annotationValuesModel,
channelModel, messageModel, subscriptionModel, followModel, interactionModel,
starModel, noticeModel, fileModel, streamMarkersModel, emptyModel,
appStreamModel, userStreamModel, userStreamSubscriptionModel, sessionModel;

memoryUpdate = function (model, filter, data, callback) {
  'use strict';
  if ('function' === typeof filter) {
    return filter(new Error('Get parametrs undefined'), null)
  }
  if ('function' === typeof data) {
    return data(new Error('Set parametrs undefined'), null)
  }
  filter = filter.where ? filter.where : filter
  var mem = this
  //console.log('memoryUpdate - model', model, 'filter', filter, 'data', data, 'callback', callback)

  // filter input to make sure it only contains valid fields
  var cleanData = this.toDatabase(model, data)

  if (filter.id) {
    // should find one and only one
    this.exists(model, filter.id, function (err, exists) {
      if (exists) {
        mem.save(model, Object.assign(mem.cache[model][filter.id], cleanData), callback)
      } else {
        callback(err, cleanData)
      }
    })
  } else {
    //console.log('memoryUpdate - not implemented, search by?', filter, data)
    this.all(model, filter, function(err, nodes) {
      //console.log('memoryUpdate - records', nodes)
      var count = nodes.length
      if (!count) {
        return callback(false, cleanData)
      }
      nodes.forEach(function(node) {
        mem.cache[model][node.id] = Object.assign(node, cleanData)
        if (--count === 0) {
          callback(false, cleanData)
        }
      })
    })
  }
}

// set up the configureable model pools
function start(nconf) {
  // 6379 is default redis port number

  // reconfigure path

  /** schema data backend type */
  var defaultSchemaType = nconf.get('database:default:type') || 'memory';
  var defaultOptions = nconf.get('database:default:options');
  //console.log('default type', defaultSchemaType)

  /** set up where we're storing the "network data" */
  var configData = nconf.get('database:tokenModel:options') || defaultOptions;
  var schemaDataType = nconf.get('database:tokenModel:type') || defaultSchemaType;
  //console.log('configuring data', configData)
  var schemaData = new Schema(schemaDataType, configData);
  if (schemaDataType === 'memory') {
    schemaData.adapter.update = memoryUpdate
  }

  /** set up where we're storing the tokens */
  var configToken = nconf.get('database:dataModel:options') || defaultOptions;
  var schemaTokenType = nconf.get('database:tokenModel:type') || defaultSchemaType;
  //console.log('configuring token', configData)
  var schemaToken = new Schema(schemaTokenType, configToken);

  if (schemaTokenType === 'memory') {
    schemaToken.adapter.update = memoryUpdate
  }

  if (schemaDataType==='mysql') {
    //console.log('MySQL is active');
    //charset: "utf8_general_ci" / utf8mb4_general_ci
    // run a query "set names utf8"
    schemaData.client.changeUser({ charset: 'utf8mb4' }, function(err) {
      if (err) console.error('Couldnt set UTF8mb4', err);
      //console.log('Set charset to utf8mb4 on Data');
    });
    schemaToken.client.changeUser({ charset: 'utf8mb4' }, function(err) {
      if (err) console.error('Couldnt set UTF8mb4', err);
      //console.log('Set charset to utf8mb4 on Token');
    });

    // to enable emojis we need to run these
    // alter table post MODIFY `text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
    // alter table post MODIFY `html` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
    // alter table message MODIFY `text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
    // alter table message MODIFY `html` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
    // alter table annotation MODIFY `value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
    // alter table user MODIFY `name` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
  }

  // Auth models and accessors can be moved into own file?
  // so that routes.* can access them separately from everything!

  // NOTE: all models automically have a default 'id' field that's an AutoIncrement

  /**
   * Token Models
   */

  /** upstreamUserToken storage model */
  upstreamUserTokenModel = schemaToken.define('upstreamUserToken', {
    userid: { type: Number, index: true },
    /** comma separate list of scopes. Available scopes:
      'basic','stream','write_post','follow','update_profile','public_messages','messages','files' */
    scopes: { type: String, length: 255 },
    token: { type: String, length: 98, index: true },
  });
  // scopes 'public_messages','messages','files':*
  // but we can be multiple, not just one...
  //localUserTokenModel.validatesInclusionOf('scopes', { in: ['basic','stream','write_post','follow','update_profile','public_messages','messages','files']});
  upstreamUserTokenModel.validatesUniquenessOf('token', { message:'token is not unique'});

  // localTokens
  // we could add created_at,updated_at,last_used
  // move out scopes to grant and link to grants
  localUserTokenModel = schemaToken.define('localUserToken', {
    userid: { type: Number, index: true },
    token: { type: String, length: 98, index: true },
    client_id: { type: String, length: 32, index: true },
    /** comma separate list of scopes. Available scopes:
      'basic','stream','write_post','follow','update_profile','public_messages','messages','files' */
    scopes: { type: String, length: 255 },
    created_at: { type: Date },
    expires_at: { type: Date },
  });
  //  code: { type: String, length: 255 },
  //  grantid: { type: Number, index: true },
  // scopes 'public_messages','messages','files':*
  // but we can be multiple, not just one...
  //localUserTokenModel.validatesInclusionOf('scopes', { in: ['basic','stream','write_post','follow','update_profile','public_messages','messages','files']});
  // token, client_id are unique
  //localUserTokenModel.validatesUniquenessOf('token', { message:'token is not unique'});

  // local apps
  // dupcliation of clientModel
  oauthAppModel = schemaToken.define('oauthApp', {
    //accountid: { type: Number, index: true },
    client_id: { type: String, length: 32, index: true },
    secret: { type: String, length: 255 },
    shortname: { type: String, length: 255 },
    displayname: { type: String, length: 255 },
    token: { type: String, length: 255 } // app token
  });
  // authorized local app callbacks
  oauthCallbackModel = schemaToken.define('oauthCallback', {
    appid: { type: Number, index: true }, // deprecated
    clientid: { type: Number, index: true },
    url: { type: String, length: 255 }
  });
  // I think it's better we have a combined table (localUserToken)
  // we could put "code" into the localUserTokenModel
  // because we're not going to have more than one token per user
  /*
  // local app grants (could replace session?)
  var oauthGrantModel = schemaToken.define('oauthGrant', {
    appid: { type: Number, index: true },
    scope: { type: String, length: 255 },
    userid: { type: Number, index: true },
    code: { type: String, length: 255 },
  });
  */
  // well localUserToken is a combo of grants and tokens

  // Auth models and accessors can be moved into own file?
  // so that routes.* can access them separately from everything!

  // NOTE: all models automically have a default 'id' field that's an AutoIncrement

  // DEPRECATE UserTokenModel, it became localUserToken

  /** appToken storage model */
  // let's only have one app_token per client (app)
  /*
  var appTokenModel = schemaToken.define('appToken', {
    client_id: { type: String, length: 32 },
    token: { type: String, lenghh: 98 },
  });
  appTokenModel.validatesUniquenessOf('token', {message:'token is not unique'});
  */

  /**
   * Network Data Models
   */

  // this data needs to not use internal Pks
  // I'd like to be able to copy random tables from one server to another
  // to help bootstrap caches

  // local clients (upstream is set in config and we can only have one upstream)
  /** client storage model */
  clientModel = schemaData.define('client', {
    client_id: { type: String, limit: 32, index: true }, // probably should be client_id
    secret: { type: String, limit: 32 },
    userid: { type: Number },
    name: { type: String, limit: 255 },
    link: { type: String, limit: 255 },
    accountid: { type: Number, index: true },
  });
  /*
    client_id: { type: String, length: 32, index: true },
    secret: { type: String, length: 255 },

    shortname: { type: String, length: 255 },
    displayname: { type: String, length: 255 },
  */
  clientModel.validatesUniquenessOf('client_id', {message:'client_id is not unique'});

  /** user storage model */
  userModel = schemaData.define('user', {
    /* API START */
    username: { type: String, length: 21, index: true },
    name: { type: String, length: 50 },
    description: { type: schemaData.Text },
    descriptionhtml: { type: schemaData.Text }, /* cache */
    created_at: { type: Date },
    timezone: { type: String, length: 64 },
    // maybe remove this?
    locale: { type: String, length: 16 },
    // this will need to change, so we can support multiples?
    avatar_image: { type: String, length: 255 },
    avatar_width: { type: Number } ,
    avatar_height: { type: Number } ,
    cover_image: { type: String, length: 255 },
    cover_width: { type: Number } ,
    cover_height: { type: Number } ,
    // is_default?
    following: { type: Number, default: 0 }, /* cache */
    followers: { type: Number, default: 0 }, /* cache */
    posts: { type: Number, default: 0 }, /* cache */
    stars: { type: Number, default: 0 }, /* cache */
    deleted: { type: Date },
    type: { type: String, length: 32 },
    canonical_url: { type: String, length: 255 },
    verified_domain: { type: String, length: 255 },
    verified_link: { type: String, length: 255 },
    /* API END */
    last_updated: { type: Date },
    stars_updated: { type: Date },
    language: { type: String, length: 2 },
    country: { type: String, length: 2 },
  });
  userModel.validatesUniquenessOf('username', {message:'username is not unique'});

  muteModel = schemaData.define('mute', {
    userid: { type: Number, index: true },
    muteeid: { type: Number }
  });


  /** annotation storage model */
  annotationModel = schemaData.define('annotation', {
    idtype: { type: String, index: true }, // user, post, channel, message
    typeid: { type: Number, index: true }, // causing problems?
    type: { type: String, length: 255, index: true },
    value:  { type: schemaData.JSON },
  });

  // maybe not needed with JSON type
  /** annotation values storage model */
  annotationValuesModel = schemaData.define('annotationvalues', {
    annotationid: { type: Number, index: true },
    key: { type: String, length: 255, index: true },
    value: { type: schemaData.Text }, // kind of want to index this
    memberof: { type: Number, index: true }
  });

  /** file storage model */
  fileModel = schemaData.define('file', {
    /* API START */
    userid: { type: Number, index: true },
    created_at: { type: Date },
    client_id: { type: String, length: 32 },
    kind: { type: String, length: 255, index: true },
    name: { type: String, length: 255 },
    type: { type: String, length: 255, index: true }, // com.example.test
    complete: { type: Boolean },
    sha1: { type: String, length: 255 },
    url: { type: String, length: 512 },
    total_size: { type: Number },
    size: { type: Number },
    mime_type: { type: String, length: 255 },
    urlexpires: { type: Date },
    /* API END */
    last_updated: { type: Date },
  });

  // kind of a proxy cache
  // we'll it's valid to check the upstream
  // maybe a time out
  // actually downloader is in charge of refreshing, as long as we kick that off
  // we can still use this
  // we know there's no data for this
  emptyModel = schemaData.define('empty', {
    type: { type: String, length: 16, index: true }, // repost, replies
    typeid: { type: Number, index: true }, // postid
    last_updated: { type: Date },
  });

  appStreamModel = schemaData.define('app_streams', {
    client_id: { type: String, length: 32 }, // a client can have multiple appStreams
    filter: { type: schemaData.JSON, }, // JSON
    object_types: { type: String, }, // comma separated list of object types:
    // post, star, user_follow, mute, block, stream_marker, message, channel, channel_subscription, token, file, user
    //type: is always long_poll
    key: { type: String, }, // user label
  });

  userStreamModel = schemaData.define('user_streams', {
    userid: { type: Number, index: true }, // couldn't we get this through the token?
    tokenid: { type: Number, index: true },
    connection_id: { type: String, index: true },
    auto_delete: { type: Boolean, index: true },
    connection_closed_at: { type: Date },
  });
  userStreamSubscriptionModel = schemaData.define('user_streamsubscriptions', {
    user_stream_id: { type: Number, index: true },
    stream: { type: String, }, // endpoint
    params: { type: schemaData.Text, }, // params
  });

  sessionModel = schemaData.define('sessions', {
    code: { type: String, index: true },
    client_id: { type: String, }, // leave it as a string so login is optimized
    redirect_uri: { type: String, },
    response_type: { type: String, },
    requested_scopes: { type: String, },
    userid: { type: Number, index: true },
    username: { type: String, },
    state: { type: String, },
    upstream_token: { type: String, },
    local_token: { type: String, },
  });

  //if firstrun (for sqlite3, mysql)
  if (schemaDataType=='mysql' || schemaDataType=='sqlite3') {
    //schemaData.automigrate(function() {});
    //schemaToken.automigrate(function() {});
    // don't lose data
    schemaData.autoupdate(function() {});
    schemaToken.autoupdate(function() {});
  }

  // Auth Todo: localUser, localClient
  // Token Todo: userToken, appToken
  // Rate Todo: userTokenLimit, appTokenLimit
  // Data Todo: mutes, blocks, upstream_tokens

  /*
  setInterval(function() {
    if (module.exports.connection) {
      module.exports.connection.ping(function (err) {
        if (err) {
          console.log('lets_parser::monitor - reconnecting, no ping');
          ref.conn(module.exports.last.host, module.exports.last.user,
            module.exports.last.pass, module.exports.last.db);
        }
        //console.log(Date.now(), 'MySQL responded to ping');
      })
    }
  }, 60000);
  */

  /** minutely status report */
  // @todo name function and call it on startup
  var statusmonitor=function () {
    if (schemaDataType=='mysql') {
      schemaData.client.ping(function (err) {
        if (err) {
          console.log('trying to reconnect to data db');
          schemaData = new Schema(schemaDataType, configData);
        }
      })
    }
    if (schemaDataType=='mysql') {
      schemaToken.client.ping(function (err) {
        if (err) {
          console.log('trying to reconnect to token db');
          schemaToken = new Schema(schemaDataType, configToken);
        }
      })
    }

    var ts=new Date().getTime();
    // this is going to be really slow on innodb
    userModel.count({}, function(err, userCount) {
      fileModel.count({}, function(err, fileCount) {
        annotationModel.count({}, function(err, annotationCount) {
          // break so the line stands out from the instant updates
          // dispatcher's output handles this for now
          //process.stdout.write("\n");
          // if using redis
          if (schemaDataType=='sqlite3') {
            schemaData.client.get('PRAGMA page_count;', function(err, crow) {
              //console.log('dataaccess.caminte.js::status sqlite3 page_count', row);
              schemaData.client.get('PRAGMA page_size;', function(err, srow) {
                var cnt=crow['page_count'];
                var psize=srow['page_size'];
                var size=cnt*psize;
                console.log('dataaccess.caminte.js::status sqlite3 data [',cnt,'x',psize,'] size: ', size);
              });
            });
          }
          if (schemaDataType=='redis') {
            //console.dir(schemaAuth.client.server_info);
            // just need a redis info call to pull memory and keys stats
            // evicted_keys, expired_keys are interesting, keyspace_hits/misses
            // total_commands_proccesed, total_connections_received, connected_clients
            // update internal counters
            schemaData.client.info(function(err, res) {
              schemaData.client.on_info_cmd(err, res);
            });
            // then pull from counters
            console.log("dataaccess.caminte.js::status redis token "+schemaToken.client.server_info.used_memory_human+" "+schemaToken.client.server_info.db0);
            console.log("dataaccess.caminte.js::status redis data "+schemaData.client.server_info.used_memory_human+" "+schemaData.client.server_info.db0);
          }
          console.log('dataaccess.caminte.js::status '+userCount+'U '+annotationCount+'a '+fileCount+'f');
        });
      });
    });
  }
  statusmonitor();
  setInterval(statusmonitor, 60*1000);
}

// Not Cryptographically safe
function generateToken(string_length) {
  var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
  var randomstring = '';
  for (var x=0;x<string_length;x++) {
    var letterOrNumber = Math.floor(Math.random() * 2);
    if (letterOrNumber == 0) {
      var newNum = Math.floor(Math.random() * 9);
      randomstring += newNum;
    } else {
      var rnum = Math.floor(Math.random() * chars.length);
      randomstring += chars.substring(rnum, rnum+1);
    }
  }
  return randomstring;
}


// cheat macros
function db_insert(rec, model, callback) {
  console.log('dataaccess.caminte.js::db_insert - start', rec, JSON.stringify(rec));
  rec.isValid(function(valid) {
    //console.log('dataaccess.caminte.js::db_insert - Checked');
    if (valid) {
      //console.log(typeof(model)+'trying to create ',rec);
      // mysql can't handle any undefineds tbh
      //console.log('dataaccess.caminte.js::db_insert - Valid', rec, typeof(model));
      // sometimes model.create doesn't return...
      // maybe a timer to detect this (timeout) and callback
      model.create(rec, function(err) {
        //console.log('dataaccess.caminte.js::db_insert - created');
        if (err) {
          console.log(typeof(model)+" insert Error ", err);
        }
        if (callback) {
          //console.log('dataaccess.caminte.js::db_insert - callingback');
          if (rec.id) {
            // why don't we just return the entire record
            // that way we can get access to fields we don't have a getter for
            // or are generated on insert
            callback(rec, err);
          } else {
            callback(null, err);
          }
        }
      });
    } else {
      console.log(typeof(model)+" validation failure");
      console.dir(rec.errors);
      if (callback) {
        // can we tell the different between string and array?
        callback(null, rec.errors);
      }
    }
  });
}
// these macros mainly flip the callback to be consistent
function db_delete(id, model, callback) {
  model.destroyById(id, function(err, rec) {
    if (err) {
      console.log("delUser Error ", err);
    }
    if (callback) {
      callback(rec, err);
    }
  });
}
function db_get(id, model, callback) {
  id = parseInt(id);
  if (isNaN(id)) {
    console.log('dataaccess.camtine.js::db_get - id isnt number', id);
    var stack = new Error().stack
    console.log(stack);
    callback([], "id is not a number");
    return;
  }
  model.findById(id, function(err, rec) {
    if (err) {
      console.log("db_get Error ", err);
    }
    // this one is likely not optional...
    //if (callback) {
    callback(rec, err);
    //}
  });
}

// if we pass model separately
function applyParams(query, params, callback) {
  //console.log('applyParams - params', params);
  /*
  var idfield='id';
  if (query.model.modelName==='entity') {
    // typeid is usually the post
    //query=query.order('typeid', 'DESC').limit(params.count);
    idfield='typeid';
  }
  // do we need to omit deleted in the results?
  // depends on how really maxid is used
  // I really don't see it causing any harm
  var where={};
  if (query.model.modelName==='post' || query.model.modelName==='message') {
    //console.log('applyParams - params', params);
    if (params.generalParams && !params.generalParams.deleted) {
      where.is_deleted=0; // add delete param
    }
  }
  */
  // maybe optimize with all?
  //if (where) {

  // why do we need max? looks like we don't
  // it was linked to min...
  var maxid=0;
  /*
  query.model.find({ where: where, order: idfield+' DESC', limit: 1}, function(err, items) {
    if (items.length) {
      maxid=items[0][idfield];
    }
    */
    //console.log('applyParams - maxid', maxid);
    setparams(query, params, maxid, callback)
  //});
}

function setparams(query, params, maxid, callback) {
  // what if we want all, how do we ask for that if not zero?
  //if (!params.count) params.count=20;
  // can't set API defaults here because the dispatch may operate outside the API limits
  // i.e. the dispatch may want all records (Need example, well was getUserPosts of getInteractions)
  //console.log('into setparams from',params.since_id,'to',params.before_id,'for',params.count);

  // general guard
  /*
  if (maxid<20) {
    // by default downloads the last 20 posts from the id passed in
    // so use 20 so we don't go negative
    // FIXME: change to scoping in params adjustment
    maxid=20;
  }
  */
  // create a range it will exist in
  // redis should be able to decisions about how to best optimize this
  // rules out less optimal gambles
  // and since it can't use less optimal gambles on failure
  // uses the 68s system, ugh
  /*
  if (!params.since_id) {
    params.since_id=0;
  }
  */
  // well if we have a where on a field, and we ad in id
  // then we can't optimize, let's try without this
  /*
  if (!params.before_id) {
    params.before_id=maxid;
  }
  */

  // bullet 5: Remember, items are always returned from newest to oldest even If count is negative
  // if we do our math right, we won't need .limit(params.count);
  // redis maybe need the limit to be performant
  //console.log('test',query.model.modelName);
  // not all objects have id linked to their chronology
  var idfield='id';
  if (query.model.modelName==='entity') {
    // typeid is usually the post
    //query=query.order('typeid', 'DESC').limit(params.count);
    idfield='typeid';
  }
  //if (query.debug) {
    //console.log('dataaccess.caminte::setparams - model', query.model.modelName)
  //}
  if (query.model.modelName==='post' || query.model.modelName==='message') {
    //if (query.debug) {
      //console.log('dataaccess.caminte::setparams - params', params.generalParams)
    //}
    // Remember this defaults to show deleted
    if (!params.generalParams || !params.generalParams.deleted) {
      //console.log('hiding deleted')
      query.where('is_deleted', 0); // add delete param
    }
  }
  // if not already sorted, please sort it
  // but some calls request a specific sort
  // though there are cases where we need to flip order
  //console.log('setparams query order', query.q.params);
  //console.log('setparams params', params);
  var count = 20;
  if (params.pageParams) {
    if (params.pageParams.count!==undefined) {
      count = params.pageParams.count;
    }
  } else {
    console.log('dataaccess.caminte::setparams - WARNING no pageParams in params');
  }

  // items are always returned from newest to oldest even if count is negative
  if (!query.q.params.order) {
    //console.log('setparams count', count);
    //console.log('setparams params.count', params.count);
    //if (count>0) {
      //console.log('setparams sorting', idfield, 'desc');
      query=query.order(idfield, 'DESC')
    //}
    //if (count<0) {
      //console.log('setparams sorting', idfield, 'asc');
      //query=query.order(idfield, 'ASC')
    //}
  }

  // add one at the end to check if there's more
  var queryCount=Math.abs(count)+1;
  //console.log('count', count, 'queryCount', queryCount);
  query=query.limit(queryCount);

  // this count system only works if we're asking for global
  // and there's not garuntee we have all the global data locally
  /*
  if (params.before_id) {
    if (!params.since_id) {
      // only asking for before this ID, this only works for global
      //params.since_id=Math.max(params.before_id-params.count, 0);
    }
  } else if (params.since_id) {
    // no before but we have since
    // it's maxid+1 because before_id is exclusive
    // params.count was just count
    //params.before_id=Math.min(params.since_id+params.count, maxid+1);
  } else {
    // none set
    // if we have upstream enabled
    params.before_id=maxid;
    // count only works if contigeous (global)
    //params.since_id=maxid-params.count;
    // if we don't have upstream disable
    // best to proxy global...
  }
  */
  //console.log(query.model.modelName, 'from', params.since_id, 'to', params.before_id, 'should be a count of', params.count, 'test', params.before_id-params.since_id);
  // really won't limit or offset

  // count shouldn't exceed the difference between since and before
  // using Redis, querying by id range isn't fast enough (60 secs)
  //
  // I think between is broken in redis:caminte (helper::parseCond doesn't test for indexes right)
  // yea now we're only getting a CondIndex of 22
  // sunionstore - condIndex 22
  // with between we'd get
  // sunionstore - condIndex 518656
  // both are still around 68s though
  /*
  if (params.since_id && params.before_id) {
    query=query.between('id', [params.since_id, params.before_id]);
  } else {
  */
  // 0 or 1 of these will be true
  // uhm both can be true like a between
  // it's not inclusive
  if (params.pageParams) {
    if (params.pageParams.since_id) {
      query=query.gt(idfield, params.pageParams.since_id);
    }
    if (params.pageParams.before_id) {
      // if not before end
      if (params.pageParams.before_id!=-1) {
        query=query.lt(idfield, params.pageParams.before_id);
      }
    }
  }
  //}
  /*
  if (params.since_id && params.before_id) {
  } else if (params.since_id) {
    query=query.gt(params.since_id);
  } else if (params.before_id) {
    query=query.lt(params.before_id);
  }
  */
  if (query.debug) {
    console.log('dataaccess.caminte.js::setparams query', query.q);
  }
  var min_id=Number.MAX_SAFE_INTEGER, max_id=0;
  query.run({},function(err, objects) {
    if (err) {
      console.error('dataaccess.caminte.js::setparams - err', err);
    }
    //console.log('dataaccess.caminte.js::setparams -', query.model.modelName, 'query got', objects.length, 'only need', params.count);
    // first figure out "more"
    // if got less than what we requested, we may not have it cached
    // we'll have to rely on meta to know if it's proxied or not
    //console.log('dataaccess.caminte.js::setparams - got', objects.length, 'queried', queryCount, 'asked_for', count);
    var more = objects.length==queryCount;
    // restore object result set
    // which end to pop, well depends on count
    if (more) {
      // if we get 21 and we ask for 20
      //if (count>0) { // id desc
        objects.pop();
      /*
      }
      if (count<0) { // id asc
        for(var i in objects) {
          console.log('dataaccess.caminte.js::setparams - negative count', objects[i].id);
        }
        objects.pop();
      }
      */
    }
    //console.log('dataaccess.caminte.js::setparams - resultset got', objects.length, 'range:', min_id, 'to', max_id, 'more:', more);
    // generate meta, find min/max in set
    for(var i in objects) {
      var obj=objects[i];
      //console.log('dataaccess.caminte.js::setparams - idx', obj[idfield], 'min', min_id, 'max', max_id);
      if (obj[idfield]) {
        min_id=Math.min(min_id, obj[idfield]);
        max_id=Math.max(max_id, obj[idfield]);
      }
    }
    if (min_id==Number.MAX_SAFE_INTEGER) min_id=0;
    var imeta={
      code: 200,
      min_id: min_id,
      max_id: max_id,
      more: more
    };
    // was .reverse on posts, but I don't think that's right for id DESC
    //console.log('dataaccess.caminte.js::setparams -', query.model.modelName, 'query got', objects.length, 'only need', params.count);
    callback(objects, err, imeta);
  });
}

// we need to know if we have upstreaming enabled
/**
 * @constructs dataaccess
 * @variation camtinejs
 */
module.exports = {
  next: null,
  start: start,
  /*
   * users
   */
  /**
   * add User camintejs
   * @param {string} username - name of user
   * @param {string} password - unencrypted password of user
   * @param {metaCallback} callback - function to call after completion
   */
  addUser: function(username, password, callback) {
    userModel.create({
        username: username,
        //password: password,
        created_at: Date.now(),
        active: true,
      }, function(err, user) {
        if (err) {
          console.log('dataaccess.caminte.js::addUser - create err', err);
        }
        if (callback) {
          callback(user, err);
        }
      });
  },
  setUser: function(iuser, ts, callback) {
    // FIXME: check ts against last_update to make sure it's newer info than we have
    // since we have cached fields
    //console.log('camtinejs::setUser - iuser', iuser);
    // doesn't overwrite all fields
    userModel.findOne({ where: { id: iuser.id } }, function(err, user) {
      //console.log('camtinejs::setUser - got res', user);
      if (user) {
        //console.log('camtinejs::setUser - updating user', user.id);
        //console.log('camtinejs::setUser - updating data', iuser);
        // make sure this is a string..
        /*
        if (iuser.type === null) iuser.type = ''
        if (iuser.avatar_image === null) iuser.avatar_image = ''
        if (iuser.avatar_width === null) iuser.avatar_width = 0
        if (iuser.avatar_height === null) iuser.avatar_height = 0
        if (iuser.cover_image === null) iuser.cover_image = ''
        if (iuser.cover_width === null) iuser.cover_width = 0
        if (iuser.cover_height === null) iuser.cover_height = 0
        */
        if (iuser.descriptionhtml === undefined) iuser.descriptionhtml = ''
        //if (iuser.counts) delete iuser.counts
        //if (iuser.annotations) delete iuser.annotations
        //iuser.created_at =
        //console.log('camtinejs::setUser - final data', iuser);
        // wiki says we don't need where and need where at the same time...
        userModel.update({ where: { id: iuser.id } }, iuser, function(err, userRes) {
          if (err) {
            console.error('camtinejs::setUser - ', err);
          }
          // userRes is the number of updated rows I think
          if (callback) callback(user, err);
        });
      } else {
        //console.log('camtinejs::setUser - creating user');
        db_insert(new userModel(iuser), userModel, callback);
      }
    });
  },
  patchUser: function(userid, changes, callback) {
    if (JSON.stringify(changes) === '{}') {
      if (callback) {
        callback({}, '');
      }
      return
    }
    userModel.update({ where: { id: userid } }, changes, function(err, user) {
      if (err) console.error('dataaccess.caminte.js::patchUser - err', err);
      // console.log('patchUser user changes', user);
      if (callback) {
        callback(user, err);
      }
    });
  },
  delUser: function(userid, callback) {
    if (this.next) {
      this.next.delUser(userid, callback);
    } else {
      if (callback) {
        callback(null, null);
      }
    }
  },
  getUserID: function(username, callback) {
    if (!username) {
      console.log('dataaccess.caminte.js::getUserID() - username was not set');
      callback(null, 'dataaccess.caminte.js::getUserID() - username was not set');
      return;
    }
    if (username[0]==='@') {
      username=username.substr(1);
    }
    //console.log('dataaccess.caminte.js::getUserID(', username, ') - start');
    var ref=this;
    var username=username.toLowerCase();
    userModel.findOne({ where: { username: username }}, function(err, user) {
      if (user==null && err==null) {
        if (ref.next) {
          ref.next.getUserID(username, callback);
          return;
        }
      }
      callback(user, err);
    });
  },
  // callback is user, err, meta
  getUser: function(userid, callback) {
    if (userid == undefined) {
      console.trace('dataaccess.caminte.js:getUser - userid is undefined');
      callback(null, 'dataaccess.caminte.js:getUser - userid is undefined');
      return;
    }
    if (!userid) {
      console.log('dataaccess.caminte.js:getUser - userid isn\'t set');
      callback(null, 'dataaccess.caminte.js:getUser - userid isn\'t set');
      return;
    }
    if (callback == undefined) {
      console.trace('dataaccess.caminte.js:getUser - callback is undefined');
      callback(null, 'dataaccess.caminte.js:getUser - callback is undefined');
      return;
    }
    //console.log('dataaccess.caminte.js:getUser - userid', userid);
    if (userid[0]==='@') {
      //console.log('dataaccess.caminte.js:getUser - getting by username');
      this.getUserID(userid.substr(1), callback);
      return;
    }
    if (isNaN(userid)) {
      console.log('dataaccess.caminte.js:getUser - userid isn\'t a number');
      var stack = new Error().stack
      console.error(stack)
      callback(null, 'dataaccess.caminte.js:getUser - userid isn\'t a number');
      return;
    }
    var ref=this;
    //console.log('dataaccess.caminte.js:getUser - getting', userid);
    db_get(userid, userModel, function(user, err) {
      //console.log('dataaccess.caminte.js:getUser - got', user);
      if (user==null && err==null) {
        if (ref.next) {
          ref.next.getUser(userid, callback);
          return;
        }
      }
      callback(user, err);
    });
  },
  getUsers: function(userids, params, callback) {
    if (!userids.length) {
      console.log('dataaccess.caminte::getUsers - no userids passed in');
      callback([], 'did not give a list of userids');
      return;
    }
    // FIXME: make sure userids are integers for memory driver
    setparams(userModel.find().where('id', { in: userids }), params, 0, function(posts, err, meta) {
      callback(posts, err, meta);
    });
  },
  searchUsers: function(query, params, callback) {
    // username, name, description
    var userids={};
    var done={
      username: false,
      name: false,
      description: false,
    }
    function setDone(sys) {
      var ids=[]
      for(var i in userids) {
        ids.push(i)
      }
      //console.log('searchUsers', sys, ids.length);
      done[sys]=true;
      for(var i in done) {
        if (!done[i]) {
          //console.log('searchUsers -', i, 'is not done');
          return;
        }
      }
      console.log('searchUsers done', ids.length);
      if (!ids.length) {
        callback([], null, { code: 200, more: false });
        return;
      }
      // FIXME: make sure userids are integers for memory driver
      setparams(userModel.find().where('id', { in: ids }), params, 0, function(posts, err, meta) {
        callback(posts, err, meta);
      });
    }
    userModel.find({ where: { username: { like : '%' + query + '%' }} }, function(err, users) {
      for(var i in users) {
        userids[users[i].id]++;
      }
      setDone('username');
    })
    userModel.find({ where: { name: { like : '%' + query + '%' }} }, function(err, users) {
      for(var i in users) {
        userids[users[i].id]++;
      }
      setDone('name');
    })
    userModel.find({ where: { description: { like : '%' + query + '%' }} }, function(err, users) {
      for(var i in users) {
        userids[users[i].id]++;
      }
      setDone('description');
    })
    /*
    setparams(userModel.find().where('username', { like: '%' + query + '%' }), params, 0, function(posts, err, meta) {
      callback(posts, err, meta);
    });
    */
  },
  /*
   * oauth local apps / callbacks
   */
  getAppCallbacks: function(client_id, client_secret, callback) {
    if (client_id===undefined) {
      console.log('dataaccess.caminte::getAppCallbacks - no client_id passed in')
      callback(null, 'no client_id');
      return;
    }
    if (!client_secret) {
      // clientModel.findOne({ where: { client_id: client_id } }, function(err, oauthApp) {
      oauthAppModel.findOne({ where: { client_id: client_id } }, function(err, oauthApp) {
        if (err || !oauthApp) {
          console.log('getAppCallbacks - err', err)
          callback(null, 'err or app not found');
          return;
        }
        oauthCallbackModel.find({ where: { appid: oauthApp.id } }, function(err, callbacks) {
          callback(callbacks, err);
        })
      });
      return;
    }
    // clientModel.findOne({ where: { client_id: client_id, secret: client_secret } }, function(err, oauthApp) {
    // TypeError: callback is not a function?
    // calls look fine
    oauthAppModel.findOne({ where: { client_id: client_id, secret: client_secret } }, function(err, oauthApp) {
      if (err || !oauthApp) {
        if (err) console.log('getAppCallbacks - err', err)
        callback(null, 'err or app not found');
        return;
      }
      oauthCallbackModel.find({ where: { appid: oauthApp.id } }, function(err, callbacks) {
        callback(callbacks, err);
      })
    });
  },
  /*
   * session
   */
  createSession: function(client_id, redirect_uri, response_type, requested_scopes, state, callback) {
    console.log('state', state, 'requested_scopes', requested_scopes);
    var code = 'altapicode_' + generateToken(98);
    sessionModel.create({
      code: code,
      client_id: client_id,
      redirect_uri: redirect_uri,
      response_type: response_type,
      requested_scopes: requested_scopes?requested_scopes:'',
      state: state?state:'',
      userid: 0,
      username: '',
    }, function(err, obj) {
      if (err) {
        console.log('createSession - err', err);
      }
      //console.log('createSession - obj', obj);
      callback(obj);
    })
  },
  authSession: function(code, userid, username, upstream_token, localToken, callback) {
    sessionModel.find({ where: { code: code } }, function(err, sessions) {
      if (err) {
        console.log('authSession - err', err);
      }
      if (sessions) {
        if (sessions.length == 1) {
          var ses = sessions[0];
          ses.userid = userid;
          ses.username = username;
          ses.upstream_token = upstream_token;
          ses.local_token = localToken;
          ses.save(function(uErr) {
            if (uErr) {
              console.log('authSession - uErr', uErr);
            }
            callback(ses, uErr);
          });
        } else {
          console.log('authSession - too many sessions for that code');
          callback({}, 'too many sessions for that code');
          return;
        }
      } else {
        console.log('authSession - no sessions for that code');
        callback({}, 'no sessions for that code');
        return;
      }
    });
  },
  getSessionByCode: function(code, callback) {
    sessionModel.find({ where: { code: code} }, function(err, sessions) {
      if (err) {
        console.log('authSession - err', err);
      }
      if (sessions) {
        if (sessions.length == 1) {
          callback(sessions[0], err);
        } else {
          console.log('authSession - too many sessions for that code');
          callback({}, 'too many sessions for that code');
          return;
        }
      } else {
        console.log('authSession - no sessions for that code');
        callback({}, 'no sessions for that code');
        return;
      }
    });
  },
  /*
   * local user token
   */
  // should we really pass token in? it's cleaner separation if we do
  // even though this is the only implemention of the abstraction
  // probably need a set
  // probably should check scopes
  addAPIUserToken: function(userid, client_id, scopes, token, callback) {
    if (scopes===undefined) scopes='';
    // this function is really a set atm
    // FIXME: does this user already have a token?
    // every client will now have a unique token
    // so we're just checking to see if we need to update the token or create it
    //, client_id: client_id
    localUserTokenModel.findOne({ where: { token: token }}, function(err, tokenUnique) {
      if (err) {
        console.log('caminte.js::addAPIUserToken - token lookup', err);
        callback(null, 'token_lookup');
        return;
      }
      if (tokenUnique==null) {
        // try and make sure we don't already have a token for this userid/clientid
        localUserTokenModel.findOne({ where: { userid: userid, client_id: client_id }}, function(err, usertoken) {
          if (usertoken==null) {
            var usertoken=new localUserTokenModel;
            usertoken.userid=userid;
            usertoken.client_id=client_id;
            usertoken.scopes=scopes;
            usertoken.token=token;
            usertoken.created_at=new Date();
            // this doesn't output anything useful at all
            //console.log('creating localUserToken', usertoken)
            /*usertoken.save(function() {
              callback(usertoken, null);
            })*/
            // this will call callback if set
            db_insert(usertoken, localUserTokenModel, callback);
          } else {
            console.log('Already have token');
            //usertoken.userid=userid;
            //usertoken.client_id=client_id;
            // update scopes and token
            usertoken.scopes=scopes;
            usertoken.token=token;
            usertoken.save();
            // check scopes
            // do we auto upgrade scopes?
            // probably should just fail
            if (callback) {
              callback(usertoken, 'Already have token');
            }
          }
        });
      } else {
        //console.log('already had token on file', tokenUnique);
        //console.log('compare against', userid, client_id);
        // probably should check scopes
        if (userid==tokenUnique.userid && client_id==tokenUnique.client_id) {
          callback(tokenUnique, null);
        } else {
          console.log('already had token on file', tokenUnique);
          console.log('compare against', userid, client_id);
          console.log('tests', userid==tokenUnique.userid, client_id==tokenUnique.client_id);
          callback(null, 'token_inuse');
        }
      }
    })
  },
  // allow a user to have more than one token
  addUnconstrainedAPIUserToken: function(userid, client_id, scopes, token, expireInMins, callback) {
    // make sure this token is not in use
    localUserTokenModel.findOne({ where: { token: token }}, function(err, tokenUnique) {
      if (err) {
        console.log('caminte.js::addAPIUserToken - token lookup', err);
        callback(null, 'token_lookup');
        return;
      }
      // token is not in use, please create it
      var usertoken=new localUserTokenModel;
      usertoken.userid=userid;
      usertoken.client_id=client_id;
      usertoken.scopes=scopes;
      usertoken.token=token;
      usertoken.created_at=new Date();
      if (expireInMins) {
        usertoken.expires_at=new Date(Date.now() + expireInMins * 60 * 1000);
      }
      //expireInSecs
      console.log('creating localUserToken', usertoken)
      /*usertoken.save(function() {
        callback(usertoken, null);
      })*/
      // this will call callback if set
      db_insert(usertoken, localUserTokenModel, callback);
    });
  },
  createOrFindUserToken: function(userid, client_id, scopes, callback) {
    //console.log('createOrFindUserToken', userid, client_id, scopes)
    if (scopes===undefined) scopes='';
    localUserTokenModel.findOne({ where: { userid: userid, client_id: client_id }}, function(err, usertoken) {
      if (usertoken) {
        //console.log('createOrFindUserToken found token', usertoken)
        // maybe a timestamp of lastIssued
        usertoken.scopes=scopes;
        //usertoken.token=token;
        usertoken.save();
        // check scopes
        // do we auto upgrade scopes?
        // probably should just fail
        if (callback) {
          callback(usertoken, null);
        }
        return;
      }
      // no token
      function genCheckToken(cb) {
        var token=generateToken(98);
        localUserTokenModel.findOne({ where: { token: token }}, function(err, tokenUnique) {
          if (tokenUnique) {
            // try again
            genCheckToken(cb);
          } else {
            cb(token);
          }
        })
      }
      genCheckToken(function(token) {
        var usertoken=new localUserTokenModel;
        usertoken.userid=userid;
        usertoken.client_id=client_id;
        usertoken.scopes=scopes;
        usertoken.token=token;
        //console.log('dataaccess.caminte.js::createOrFindUserToken - creating localUserToken', usertoken)
        /*usertoken.save(function() {
          callback(usertoken, null);
        })*/
        //console.log('createOrFindUserToken made token', usertoken)
        // this will call callback if set
        db_insert(usertoken, localUserTokenModel, callback);
      })
    })
  },
  delAPIUserToken: function(token, callback) {
    localUserTokenModel.findOne({ where: { token: token } }, function(err, usertoken) {
      db_delete(usertoken.id, localUserTokenModel, callback);
    });
  },
  // should only be used by the admin API
  getAPITokenByUsername: function(username, callback) {
    //console.log('dataaccess.camintejs.js::getAPITokenByUsername - username:', username);
    if (username==undefined) {
      console.log('dataaccess.camintejs.js::getAPITokenByUsername - username not defined');
      return callback(null, 'username undefined');
    }
    this.getUserID(username, function(user, err) {
      if (!user) {
        return callback(null, err);
      }
      localUserTokenModel.findOne({ where: { userid: user.id }, limit: 1 }, function(err, usertoken) {
        if (err) {
          console.log('dataaccess.camintejs.js::getAPIUserToken - err', err, 'usertoken', usertoken);
        }
        //console.log('dataaccess.camintejs.js::getAPIUserToken - found:', usertoken);
        callback(usertoken, err);
      });
    });
  },
  getAPIUserToken: function(token, callback) {
    //console.log('dataaccess.camintejs.js::getAPIUserToken - Token:', token);
    if (token==undefined) {
      //console.log('dataaccess.camintejs.js::getAPIUserToken - Token not defined');
      // we shouldn't need to return here
      // why doesn't mysql handle this right? bad driver
      callback(null, 'token undefined');
      return;
    }
    //console.log('dataaccess.camintejs.js::getAPIUserToken - token:', token);
    // error but must have been connected because it could still get counts
/*
dispatcher @1494199287183 Memory+[803.9 k] Heap[23.44 M] uptime: 298756.005
dataaccess.caminte.js::status 19U 44F 375P 0C 0M 0s 77/121i 36a 144e
TypeError: Cannot read property 'model' of undefined
    at MySQL.BaseSQL.table (/tank/Users/rtharp/Sites/adn/AppDotNetAPI/node_modules/caminte/lib/sql.js:27:31)
    at MySQL.BaseSQL.tableEscaped (/tank/Users/rtharp/Sites/adn/AppDotNetAPI/node_modules/caminte/lib/sql.js:35:33)
    at MySQL.all (/tank/Users/rtharp/Sites/adn/AppDotNetAPI/node_modules/caminte/lib/adapters/mysql.js:444:53)
    at Function.all (/tank/Users/rtharp/Sites/adn/AppDotNetAPI/node_modules/caminte/lib/abstract-class.js:510:29)
    at Function.findOne (/tank/Users/rtharp/Sites/adn/AppDotNetAPI/node_modules/caminte/lib/abstract-class.js:592:18)
    at Object.getAPIUserToken (/tank/Users/rtharp/Sites/adn/AppDotNetAPI/dataaccess.caminte.js:871:25)
    at Object.getAPIUserToken (/tank/Users/rtharp/Sites/adn/AppDotNetAPI/dataaccess.base.js:90:17)
    at Object.getUserClientByToken (/tank/Users/rtharp/Sites/adn/AppDotNetAPI/dispatcher.js:1577:16)
    at Layer.handle (/tank/Users/rtharp/Sites/adn/AppDotNetAPI/app.cluster.js:262:22)
    at trim_prefix (/tank/Users/rtharp/Sites/adn/AppDotNetAPI/node_modules/express/lib/router/index.js:230:15)
    at /tank/Users/rtharp/Sites/adn/AppDotNetAPI/node_modules/express/lib/router/index.js:198:9
    at Function.proto.process_params (/tank/Users/rtharp/Sites/adn/AppDotNetAPI/node_modules/express/lib/router/index.js:253:12)
    at next (/tank/Users/rtharp/Sites/adn/AppDotNetAPI/node_modules/express/lib/router/index.js:189:19)
    at Layer.handle (/tank/Users/rtharp/Sites/adn/AppDotNetAPI/node_modules/connect-busboy/index.js:14:14)
    at trim_prefix (/tank/Users/rtharp/Sites/adn/AppDotNetAPI/node_modules/express/lib/router/index.js:230:15)
    at /tank/Users/rtharp/Sites/adn/AppDotNetAPI/node_modules/express/lib/router/index.js:198:9

dispatcher @1494199347200 Memory+[502.68 k] Heap[23.94 M] uptime: 298816.022
dataaccess.caminte.js::status 19U 44F 375P 0C 0M 0s 77/121i 36a 144e

dispatcher @1494199407211 Memory+[833.86 k] Heap[24.78 M] uptime: 298876.034
dataaccess.caminte.js::status 19U 44F 375P 0C 0M 0s 77/121i 36a 144e
*/
    // what if there more than one?
    // if we get more than one, than we callback multiple times?
    localUserTokenModel.findOne({ where: { token: token }, limit: 1 }, function(err, usertoken) {
      if (err) {
        console.log('dataaccess.camintejs.js::getAPIUserToken - err', err, 'usertoken', usertoken);
      }
      //console.log('dataaccess.camintejs.js::getAPIUserToken - found:', usertoken);
      callback(usertoken, err);
    });
  },
  /*
   * user upstream tokens
   */
  setUpstreamUserToken: function(userid, token, scopes, callback) {
    upstreamUserTokenModel.findOne({ where: { userid: userid } }, function(err, upstreamToken) {
      if (err) {
        console.log('dataaccess.camintejs.js::setUpstreamUserToken - upstreamUserTokenModel err', err);
        if (callback) {
          callback(upstreamToken, err);
          return;
        }
      }
      if (upstreamToken) {
        if (upstreamToken.token!=token) {
          console.log('dataaccess.camintejs.js::setUpstreamUserToken - new token?', token, 'old', upstreamToken.token);
        }
      } else {
        upstreamToken=new upstreamUserTokenModel;
        upstreamToken.userid=userid;
      }
      // update token and scopes for this user
      upstreamToken.scopes=scopes;
      upstreamToken.token=token;
      upstreamToken.save(function() {
        if (callback) {
          callback(upstreamToken, user);
        }
      });
    })
  },
  delUpstreamUserToken: function(token) {
    console.log('dataaccess.camintejs.js::delUpstreamUserToken - write me!');
  },
  getUpstreamUserToken: function(userid, callback) {
    upstreamUserTokenModel.findOne({ where: { userid: userid } }, function(err, upstreamToken) {
      if (err) {
        console.log('dataaccess.camintejs.js::setUpstreamUserToken - upstreamUserTokenModel err', err);
        if (callback) {
          callback(upstreamToken, err);
          return;
        }
      }
      callback(upstreamToken, null);
    });
  },
  /*
   * network clients?
   */
  addSource: function(client_id, name, link, callback) {
    var client=new clientModel;
    client.client_id=client_id;
    client.name=name;
    client.link=link;
    db_insert(client, clientModel, callback);
  },
  getClient: function(client_id, callback) {
    clientModel.findOne({ where: {client_id: client_id} }, function(err, client) {
      if (client) {
        delete client.secret;
      }
      callback(client, err);
    });
  },
  setSource: function(source, callback) {
    clientModel.findOrCreate({
      client_id: source.client_id
    }, {
      name: source.name,
      link: source.link
    }, function(err, client) {
      delete client.secret
      callback(client, err);
    });
  },
  /* client (app) tokens */
  addAPIAppToken: function(client_id, token, request) {
    console.log('api_persistent_storage::addAPIAppToken - write me!');
  },
  delAPIAppToken: function(client_id, token) {
    console.log('api_persistent_storage::delAPIAppToken - write me!');
  },
  getAPIAppToken: function(client_id, token) {
    console.log('api_persistent_storage::getAPIAppToken - write me!');
  },
  /* client upstream token */
  addUpstreamClientToken: function(token, scopes) {
    console.log('api_persistent_storage::addUpstreamClientToken - write me!');
  },
  delUpstreamClientToken: function(token) {
    console.log('api_persistent_storage::delUpstreamClientToken - write me!');
  },
  getUpstreamClientToken: function() {
    console.log('api_persistent_storage::getUpstreamClientToken - write me!');
  },
  /** user stream */
  findOrCreateUserStream: function(connectionId, tokenId, userId, autoDelete, callback) {
    //console.log('dataaccess.camintejs::findOrCreateUserStream - start', connectionId, tokenId);
    //console.log('connectionId', connectionId)
    //console.log('tokenId', tokenId)
    //console.log('userId', userId)
    //console.log('autoDelete', autoDelete)
    // I don't think this is working
    userStreamModel.find({ where: { connection_id: connectionId, tokenid: tokenId } }, function(err, streams) {
      if (err) {
        console.log('dataaccess.camintejs::findOrCreateUserStream - err', err);
      }
      if (!streams.length) {
        // create one
        var stream = { connection_id: connectionId, tokenid: tokenId, auto_delete: autoDelete, userid: userId }
        userStreamModel.create(stream, function(err, createdStream) {
          //console.log('dataaccess.camintejs::findOrCreateUserStream - created', createdStream);
          callback(createdStream, err);
        })
      } else {
        if (streams.length === 1) {
          // update it
          var stream = streams[0];
          // actually just a cache for tokenId I think
          if (stream.userid == userId) {
            // we don't need to update, only set those things on creation
            //stream.update({ id: stream.id }, {}, function(err, finalStream) {
            //console.log('dataaccess.camintejs::findOrCreateUserStream - found', stream);
            callback(stream, err);
            //})
          } else {
            console.error('dataaccess.camintejs::findOrCreateUserStream - userid', userId, 'tried to change', stream.userid, 'stream', connectionId);
            callback([], 'not your stream');
          }
        } else {
          console.error('dataaccess.camintejs::findOrCreateUserStream - too many, connectionId:', connectionId, 'tokenId', tokenId);
          callback([], 'too many');
        }
      }
    })
    /*
    userStreamModel.findOrCreate({
      connection_id: connectionId,
      tokenid: tokenId,
    }, {
      auto_delete: autoDelete,
      userid: userId
    }, function(err, userStream) {
      // if found, need to update auto_delete
      callback(userStream, err);
    });
    */
  },
  findOrCreateUserSubscription: function(connectionNumId, stream, params, callback) {
    console.log('dataaccess.camintejs::findOrCreateUserSubscription', connectionNumId, stream)
    if (connectionNumId === undefined) {
      console.log('dataaccess.camintejs::findOrCreateUserSubscription - connectionNumId is empty', connectionNumId, stream)
      callback({}, 'empty connectionNumId');
      return
    }
    // we can't scan for stream, it thinks it's a regex
    userStreamSubscriptionModel.find({ where: { user_stream_id: connectionNumId, stream: { like: stream } } }, function(err, subscriptions) {
      // subscription
      if (err) {
        console.log('dataaccess.camintejs::findOrCreateUserSubscription - err', err);
      }
      if (subscriptions.length) {
        if (subscriptions.length === 1) {
          // found
          callback(subscriptions[0], err);
        } else {
          // too many
          console.error('dataaccess.camintejs::findOrCreateUserSubscription - too many', subscriptions);
          callback({}, 'too many');
        }
      } else {
        userStreamSubscriptionModel.create({ user_stream_id: connectionNumId, stream: stream, params: params }, function(createErr, createdSub) {
          //console.log('dataaccess.camintejs::findOrCreateUserSubscription - created', createdSub);
          callback(createdSub, createErr);
        })
      }
    })
    // I'm not getting returns...
    // stream isn't matchin
    /*
    userStreamSubscriptionModel.findOrCreate({
      user_stream_id: connectionNumId,
      stream: stream,
    }, {
      params: params
    }, function(err, subscription) {
      if (err) {
        console.log('dataaccess.camintejs::findOrCreateUserSubscription - err', err);
      }
      console.log('dataaccess.camintejs::findOrCreateUserSubscription - findOrCreate', subscription)
      // if found, need to update params
      callback(subscription, err);
    });
    */
  },
  userStreamUpdate: function(connectionId, update, callback) {
    userStreamModel.update({ where: { connection_id: connectionId } }, update, function(err, result) {
      callback(result, err);
    })
  },
  deleteUserStream: function(connectionNumId, callback) {
    //console.log('deleteUserStream', connectionNumId);
    userStreamModel.destroyById(connectionNumId, function(err) {
      if (callback) callback(connectionNumId, err);
    })
  },
  getUserStream: function(connectionNumId, callback) {
    userStreamModel.findById(connectionNumId, function(err, userStream) {
      callback(userStream, err);
    })
  },
  getAllUserStreams: function(callback) {
    //console.log('dataaccess.caminte.js::getAllUserStreams - start');
    userStreamModel.all(function(err, userStreams) {
      //console.log('dataaccess.caminte.js::getAllUserStreams - result', userStreams.length);
      var ids = []
      var tokens = []
      for(var i in userStreams) {
        var userStream=userStreams[i];
        ids.push(userStream.id);
        tokens.push(userStream.tokenid);
      }
      //console.log('dataaccess.caminte.js::getAllUserStreams - tokens', tokens.length, 'ids', ids.length)
      var done = {
        subs: false,
        tokens: false,
      }
      function doneCheck(type, data) {
        //console.log('dataaccess.caminte.js::getAllUserStreams:doneCheck - ', type, data.length)
        done[type] = data;
        var complete = true;
        for(var i in done) {
          if (done[i] === false) {
            complete = false;
            break;
          }
        }
        if (complete) {
          callback({
            userStreams: userStreams,
            subs: done.subs,
            tokens: done.tokens,
          }, err)
        }
      }
      // look up subs
      // FIXME: make sure userids are integers for memory driver
      userStreamSubscriptionModel.find({ where: { user_stream_id: { in: ids } } }, function(subErr, subs) {
        doneCheck('subs', subs);
      })
      // look up tokens
      // FIXME: make sure userids are integers for memory driver
      localUserTokenModel.find({ where: { id: { in: tokens } } }, function(tokenErr, tokens) {
        doneCheck('tokens', tokens);
      })
    });
  },
  /** app stream */

  /** files */
  addFile: function(file, token, callback) {
    // if we local commit, do we also want to relay it upstream?
    if (this.next) {
      this.next.addFile(file, token, callback);
    } else {
      // if no next, then likely no upstream
      file.last_updated=new Date();
      // deal with caminte short coming on mysql
      //file.type=file.type.replace(new RegExp('\\.', 'g'), '_');
      //console.log('Checking', file.urlexpires, typeof(file.urlexpires))
      if (file.urlexpires === undefined) file.urlexpires=new Date(0);
      if (file.sha1 === undefined) file.sha1='';
      console.log('final pre file model', file);
      //file.token=randomstring(173);
      // network client_id
      // but since there's no uplink
      // our local is the network tbh
      // already done in dialect
      //ipost.client_id=tokenObj.client_id;
      db_insert(new fileModel(file), fileModel, function(rec, err) {
        //console.log('camintejs::addPost - res', rec, err);
        // process id
        /*
        if (rec.id && !rec.thread_id) {
          rec.thread_id=rec.id;
          rec.save();
        }
        */
        // deal with caminte short coming on mysql
        //rec.type=rec.type.replace(new RegExp('_', 'g'), '.');
        console.log('camintejs::addFile - final', rec);
        // set thread_id
        callback(rec, err);
      });
    }
  },
  setFile: function(file, del, ts, callback) {
    if (del) {
      db_delete(file.id, fileModel, callback);
    } else {
      //file.type=file.type.replace(new RegExp('\\.', 'g'), '_');
      fileModel.findOrCreate({
        id: file.id
      },file, function(err, ofile) {
        //ofile.type=ofile.type.replace(new RegExp('_', 'g'), '.');
        if (callback) {
          callback(ofile, err);
        }
      });
    }
  },
  getFile: function(fileId, callback) {
    //console.log('dataaccess.caminte.js::getFile - id is '+id);
    if (fileId==undefined) {
      callback(null, 'dataaccess.caminte.js::getFile - id is undefined');
      return;
    }
    var ref=this;
    db_get(fileId, fileModel, function(file, err) {
      //console.log('dataaccess.caminte.js::getFile - post, err',post,err);
      if (file==null && err==null) {
        //console.log('dataaccess.caminte.js::getFile - next?',ref.next);
        if (ref.next) {
          //console.log('dataaccess.caminte.js::getFile - next');
          ref.next.getFile(fileId, callback);
          return;
        }
      }
      callback(file, err);
    });
  },
  getFiles: function(userid, params, callback) {
    var query = fileModel.find().where('userid', userid)
    //query.debug = true
    setparams(query, params, 0, function(files, err, meta) {
      callback(files, err, meta);
    });
  },
  /**
   * Annotations
   */
  addAnnotation: function(idtype, id, type, value, callback) {
    console.log('addAnnotation idtype', idtype, 'id', id, 'type', type, 'value', value);
    // FIXME: validate input!
    if (!type) {
      callback({}, 'noType');
      return;
    }
    if (!value) {
      callback({}, 'noValue');
      return;
    }
    note=new annotationModel;
    note.idtype=idtype;
    note.typeid=id;
    note.type=type;
    note.value=value;
    db_insert(note, annotationModel, callback);
  },
  clearAnnotations: function(idtype, id, callback) {
    //console.log('dataaccess.caminte.js::clearAnnotations - idtype', idtype, 'id', id)
    annotationModel.remove({where: { idtype: idtype, typeid: id }}, function(err, oldAnnotations) {
      if (callback) {
        callback();
      }
    })
    /*
    annotationModel.find({where: { idtype: idtype, typeid: id }}, function(err, oldAnnotations) {
      for(var i in oldAnnotations) {
        var oldNote=oldAnnotations[i];
        // causes TypeError: Cannot read property 'constructor' of null
        // when using by id... ah I see wrong type of id...
        if (oldNote.id) {
          annotationModel.destroyById(oldNote.id, function(err) {
            if (err) {
              console.log('couldn\'t destory old annotation ', err);
            }
          });
        } else {
          //console.log('dataaccess.caminte.js::clearAnnotations - OldNote doesn\'t have id ',oldNote);
        }
      }
      if (callback) {
        callback();
      }
    });
    */
  },
  getAnnotations: function(idtype, id, callback) {
    // Todo: implement this.next calling
    /*
    if (this.next) {
      this.next.getAnnotations(idtype, id, callback);
    }
    */
    annotationModel.find({where: { idtype: idtype, typeid: id }}, function(err, annotations) {
      callback(annotations, err);
    });
  },
  updateUserCounts: function(userid, callback) {
    var ref=this;
    userModel.findById(userid, function(err, user) {
      if (!user) {
        console.log('updateUserCounts no user', user, 'for id', userid);
        if (callback) {
          callback();
        }
        return;
      }
      /*
      // this may only return up to 20, we'll need to set count=-1
      postModel.count({ where: { userid: userid } }, function(err, postCount) {
        if (err) console.error('updateUserCounts - posts:', err);
        user.posts = postCount;
        user.save();
      });
      followModel.count({ where: { userid: userid } }, function(err, followingCount) {
        if (err) console.error('updateUserCounts - following:', err);
        user.following = followingCount;
        user.save();
      });
      followModel.count({ where: { followsid: userid } }, function(err, followerCount) {
        if (err) console.error('updateUserCounts - follower:', err);
        user.followers = followerCount;
        user.save();
      });
      // FIXME: deleted stars? unstars?
      interactionModel.count({ where: { userid: userid, type: 'star' } }, function(err, starCount) {
        if (err) console.error('updateUserCounts - star:', err);
        user.stars=starCount;
        user.save();
      });
      */
    });
    // tight up later
    if (callback) {
      callback();
    }
  },
  getOEmbed: function(url, callback) {
    if (this.next) {
      this.next.getOEmbed(url, callback);
    } else {
      var info = {
        meta: {
          code: 200
        },
        data: {}
      };

      var ref = this
      // A URL for a post or photo on App.net.
      var alpha = url.match(/alpha.tavrn.gg/i);
      if (alpha) {
        var parts = url.split('/');
        // post vs photo?
        var type = 'post'
        if (url.match(/\/photo\//)) {
          type = 'photo'
          var postid = parts[parts.length - 3];
          var photoid = parts[parts.length - 1];
          console.log('dataaccess.camtine.js::getOEmbed -photo mode', postid, photoid)
          this.getAnnotations('post', postid, function(notes, err) {
            //console.log('post info', notes);
            var c = 0
            for(var i in notes) {
              var note = notes[i]
              if (note.type == 'net.app.core.oembed') {
                console.log('dataaccess.camtine.js::getOEmbed - found our info', note.value)
                c ++
                if (c == photoid) {
                  info.data = JSON.parse(note.value);
                  break;
                }
              }
            }
            callback(info, null);
          });
          return;
        }
        var postid = parts[parts.length - 1];
        console.log('dataaccess.camtine.js::getOEmbed - postid', postid);
        this.getPost(postid, function(post, err) {
          //console.log('post info', post);
          info.data = {
            provider_url: "https://tavrn.gg",
            version: "1.0",
            author_url: "https://tavrn.gg/u/"+post.userid,
            title: post.text,
            url: "https://tavrn.gg/u/"+post.userid+"/post/"+post.userid,
            provider_name: "Tavrn.gg",
            type: "link",
            html: post.html,
            author_name: post.userid
          }
          callback(info, null);
        });
      } else {
        callback(null, null);
      }
      //callback(null, null)
      //console.log('dataaccess.caminte.js::getOEmbed - write me!');
      // <link rel="alternate" type="application/json+oembed"
      // href="http://example.com/services/oembed?url=http%3A%2F%2Fexample.com%2Ffoo%2F&amp;format=json"
      // title="oEmbed Profile: JSON">
      // <link rel="alternate" type="application/json+oembed" href="http://api.sapphire.moe/oembed?url=http://alpha.tavrn.gg/marcodiazclone/post/607" title="App.net oEmbed" />
      /*
      request(url, function(err, resp, body) {
        var linkFilter = new RegExp('<link([^>]+)>','img');
        var links = body.match(linkFilter);
        if (links) {
          for(var i=0,imax=links.length; i<imax; i++) {
            var link = links[i]
            //console.log('link', link)
            if (link.match(/type=['"]application\/json\+oembed['"]/i)) {
              //console.log('oembed link', link)
              if (link.match(/rel=['"]alternate["']/i)) {
                //console.log('alt oembed link', link)
                var href = link.match(/href=["']([^"']+)["']/i)
                var oembedUrl = href[1]
                console.log('href', oembedUrl)
                request(oembedUrl, function(err, resp, body) {
                  console.log('body', body)
                  callback(JSON.parse(body), null);
                })
              }
            }
          }
        }
      })
      */
      /*
      oembedTools.extract(url).then((data) => {
        console.log('url', url, 'data', data)
        callback(data, null);
      }).catch((err) => {
        console.log('oembed err', err);
        callback('', 'no provider');
      });
      */
    }
  }
}
