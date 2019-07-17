/**
 * real long term persistence
 * @module dataaccess_camintejs
 */

/**
 * http://www.camintejs.com / https://github.com/biggora/caminte
 * @type {Object}
 */
var Schema = require('caminte').Schema;

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

// set up the (eventually configureable) model pools
// 6379 is default redis port number
/** schema data backend type */
var schemaDataType = 'mysql';
/** set up where we're storing the "network data" */
var configData = { database: '', host: '', username: '', password: '' };
var schemaData = new Schema(schemaDataType, configData); //port number depends on your configuration
/** set up where we're storing the tokens */
var configToken = { database: '', host: '', username: '', password: '' }
var schemaToken = new Schema(schemaDataType, configToken); //port number depends on your configuration

if (schemaDataType==='mysql') {
  //console.log('MySQL is active');
  //charset: "utf8_general_ci"
  // run a query "set names utf8"
  schemaData.client.changeUser({ charset: 'utf8mb4' }, function(err) {
    if (err) console.error('Couldnt set UTF8mb4', err);
    //console.log('Set charset to utf8mb4 on Data');
  });
  schemaToken.client.changeUser({ charset: 'utf8mb4' }, function(err) {
    if (err) console.error('Couldnt set UTF8mb4', err);
    //console.log('Set charset to utf8mb4 on Token');
  });
}

// Auth models and accessors can be moved into own file?
// so that routes.* can access them separately from everything!

// NOTE: all models automically have a default 'id' field that's an AutoIncrement

/**
 * Token Models
 */

/** upstreamUserToken storage model */
var upstreamUserTokenModel = schemaToken.define('upstreamUserToken', {
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
var localUserTokenModel = schemaToken.define('localUserToken', {
  userid: { type: Number, index: true },
  token: { type: String, length: 98, index: true },
  client_id: { type: String, length: 32, index: true },
  /** comma separate list of scopes. Available scopes:
    'basic','stream','write_post','follow','update_profile','public_messages','messages','files' */
  scopes: { type: String, length: 255 },
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
var oauthAppModel = schemaToken.define('oauthApp', {
  //accountid: { type: Number, index: true },
  client_id: { type: String, length: 32, index: true },
  secret: { type: String, length: 255 },
  shortname: { type: String, length: 255 },
  displayname: { type: String, length: 255 },
  token: { type: String, length: 255 } // app token
});
// authorized local app callbacks
var oauthCallbackModel = schemaToken.define('oauthCallback', {
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


// DEPRECATE UserTokenModel, it became localUserToken

/** appToken storage model */
var appTokenModel = schemaToken.define('appToken', {
  client_id: { type: String, length: 32 },
  token: { type: String, lenghh: 98 },
});
appTokenModel.validatesUniquenessOf('token', {message:'token is not unique'});

/**
 * Network Data Models
 */

// this data needs to not use internal Pks
// I'd like to be able to copy random tables from one server to another
// to help bootstrap caches

// local clients (upstream is set in config and we can only have one upstream)
/** client storage model */
var clientModel = schemaData.define('client', {
  client_id: { type: String, limit: 32, index: true }, // probably should be client_id
  secret: { type: String, limit: 32 },
  userid: { type: Number },
  name: { type: String, limit: 255 },
  link: { type: String, limit: 255 },
  accountid: { type: Number, index: true },
});
clientModel.validatesUniquenessOf('client_id', {message:'client_id is not unique'});

/** user storage model */
var userModel = schemaData.define('user', {
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

var muteModel = schemaData.define('mute', {
  userid: { type: Number, index: true },
  muteeid: { type: Number }
});

/** post storage model
 * @constructs postModel
 */
var postModel = schemaData.define('post',
  /** @lends postModel */
  {
  /** id of user */
  userid: { type: Number, index: true },
  /** text of post */
  text: { type: schemaData.Text },
  /** html of post */
  html: { type: schemaData.Text }, /* cache */
  /** post flagged as machine_only
   * @type boolean */
  machine_only: { type: Boolean, default: false, index: true },
  /** id of post that it's a reply to
   * @type {postid} */
  reply_to: { type: Number }, // kind of want to index this
  /** root id of post all replies are children of
   * @type {postid} */
  thread_id: { type: Number, index: true },
  /** post flagged as deleted
   * @type boolean */
  is_deleted: { type: Boolean, default: false, index: true },
  /** date/time post was created at
   * @type Date */
  created_at: { type: Date },
  /** apparently we're string the client_id string here, may want an id here in the future */
  client_id: { type: String, length: 32, index: true },
  /** id of post it is a repost of
   * @type {postid} */
  repost_of: { type: Number, default: 0, index: true },
  /** posts.app.net url */
  canonical_url: { type: String },
  /** num of replies */
  num_replies: { type: Number, default: 0 },
  /** num of reposts */
  num_reposts: { type: Number, default: 0 },
  /** num of stars */
  num_stars: { type: Number, default: 0 }
});

// total cache table (since I think we can extract from text),
// we'll have an option to omitted its use
// though we need it for hashtag look ups
/** entity storage model */
var entityModel = schemaData.define('entity', {
  idtype: { type: String, length: 16, index: true }, // user, post, channel, message
  typeid: { type: Number, index: true }, // causing problems?
  type: { type: String, length: 16, index: true }, // link, hashtag, mention
  pos: { type: Number },
  len: { type: Number },
  text: { type: String, length: 255, index: true }, // hashtag is stored here
  alt: { type: String, length: 255, index: true },
  altnum: { type: Number },
});

/** annotation storage model */
var annotationModel = schemaData.define('annotation', {
  idtype: { type: String, index: true }, // user, post, channel, message
  typeid: { type: Number, index: true }, // causing problems?
  type: { type: String, length: 255, index: true },
  value:  { type: schemaData.JSON },
});

// maybe not needed with JSON type
/** annotation values storage model */
var annotationValuesModel = schemaData.define('annotationvalues', {
  annotationid: { type: Number, index: true },
  key: { type: String, length: 255, index: true },
  value: { type: schemaData.Text }, // kind of want to index this
  memberof: { type: Number, index: true }
});

// inactive?
/** channel storage model */
var channelModel = schemaData.define('channel', {
  ownerid: { type: Number, index: true },
  type: { type: String, length: 255, index: true },
  reader: { type: Number }, // 0=public,1=loggedin,2=selective
  writer: { type: Number }, // 1=loggedin,2=selective
  // editors are always seletcive
  readedit: { type: Boolean, default: true }, // immutable?
  writeedit: { type: Boolean, default: true }, // immutable?
  editedit: { type: Boolean, default: true }, // immutable?
  // could be store as json, since we're parsing either way...
  readers: { type: schemaData.Text }, // comma separate list
  // can't index because text (, index: true)
  writers: { type: schemaData.Text }, // comma separate list (need index for PM channel lookup)
  editors: { type: schemaData.Text }, // comma separate list
  created_at: { type: Date }, // created_at isn't in the API
  inactive: { type: Date }, // date made inactive
  last_updated: { type: Date },
});

/** message storage model */
var messageModel = schemaData.define('message', {
  channel_id: { type: Number, index: true },
  html: { type: schemaData.Text }, /* cache */
  text: { type: schemaData.Text },
  machine_only: { type: Boolean, index: true },
  client_id: { type: String, length: 32 },
  thread_id: { type: Number, index: true },
  userid: { type: Number, index: true },
  reply_to: { type: Number }, // kind of want to index this
  is_deleted: { type: Boolean, index: true },
  created_at: { type: Date },
});

/** subscription storage model */
var subscriptionModel = schemaData.define('subscriptions', {
  channelid: { type: Number, index: true },
  userid: { type: Number, index: true },
  created_at: { type: Date },
  active: { type: Boolean, index: true },
  last_updated: { type: Date },
});

/** follow storage model */
var followModel = schemaData.define('follow', {
  userid: { type: Number, index: true },
  followsid: { type: Number, index: true }, // maybe not index this
  active: { type: Boolean, index: true },
  // aka pagenationid, we'll need this for meta.id too
  referenceid: { type: Number, index: true }, // this only exists in meta.id and is required for deletes for app streaming
  created_at: { type: Date }, // or this
  last_updated: { type: Date },
});

// split up?
// we don't need reposts here becauses have all that info with a repost_of column
// since an entire post is created on repost
// though repost could also write here in the future, making it easier to pull
// stars are recorded only here
/** interaction storage model */
var interactionModel = schemaData.define('interaction', {
  userid: { type: Number, index: true },
  type: { type: String, length: 8, index: true }, // star,unstar,repost,unrepost
  datetime: { type: Date },
  idtype: { type: String, index: true }, // post (what about chnl,msg,user? not for existing types)
  typeid: { type: Number, index: true }, // causing problems?
  asthisid: { type: Number } // meta.id
});

/** star storage model */
// not currently used
var starModel = schemaData.define('star', {
  userid: { type: Number, index: true },
  created_at: { type: Date },
  postid: { type: Number, index: true },
  // I don't think we need soft delets for fars
  //is_deleted: { type: Boolean, default: false, index: true },
});

// intermediate cache table for querying (a view of interactionModel)
// we have to denormalize this for performance
// takes more memory/storage but required if you want responsive interactions
var noticeModel = schemaData.define('notice', {
  event_date: { type: Date, index: true },
  notifyuserid: { type: Number, index: true }, // who should be notified
  actionuserid: { type: Number }, // who took an action (star)
  type: { type: String, length: 18 }, // welcome,star,repost,reply,follow,broadcast_create,broadcast_subscribe,broadcast_unsubscribe
  typeid: { type: Number }, // postid(star,respot,reply),userid(follow)
  altnum: { type: Number }, // postid(star,respot,reply),userid(follow)
});


/** file storage model */
var fileModel = schemaData.define('file', {
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

var streamMarkersModel = schemaData.define('stream_markers', {
  user_id: { type: Number, index: true },
  top_id: { type: Number },
  last_read_id: { type: Number },
  name: { type: String, length: 32 },
  percentage: { type: Number },
  last_updated: { type: Date },
  version: { type: Number },
});

// kind of a proxy cache
// we'll it's valid to check the upstream
// maybe a time out
// actually downloader is in charge of refreshing, as long as we kick that off
// we can still use this
// we know there's no data for this
var emptyModel = schemaData.define('empty', {
  type: { type: String, length: 16, index: true }, // repost, replies
  typeid: { type: Number, index: true }, // postid
  last_updated: { type: Date },
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
    followModel.count({}, function(err, followCount) {
      postModel.count({}, function(err, postCount) {
        channelModel.count({}, function(err, channelCount) {
          messageModel.count({}, function(err, messageCount) {
            subscriptionModel.count({}, function(err, subscriptionCount) {
              interactionModel.count({}, function(err, interactionCount) {
                annotationModel.count({}, function(err, annotationCount) {
                  entityModel.count({}, function(err, entityCount) {
                    noticeModel.count({}, function(err, noticeCount) {
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
                      console.log('dataaccess.caminte.js::status '+userCount+'U '+followCount+'F '+postCount+'P '+channelCount+'C '+messageCount+'M '+subscriptionCount+'s '+interactionCount+'/'+noticeCount+'i '+annotationCount+'a '+entityCount+'e');
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
};
statusmonitor();
setInterval(statusmonitor, 60*1000);

// Not Cryptographically safe
// FIXME: probably need more of a UUID style generator here...
function generateUUID(string_length) {
  var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz';
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
  //console.log('dataaccess.caminte.js::db_insert - start');
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
  if (query.model.modelName==='post' || query.model.modelName==='message') {
    if (!params.generalParams || !params.generalParams.deleted) {
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

  if (!query.q.params.order) {
    //console.log('setparams params.count', params.count);
    if (count>0) {
      //console.log('setparams sorting', idfield, 'desc');
      query=query.order(idfield, 'DESC')
    }
    if (count<0) {
      //console.log('setparams sorting', idfield, 'asc');
      query=query.order(idfield, 'ASC')
    }
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
      if (count>0) { // id desc
        objects.pop();
      }
      if (count<0) { // id asc
        for(var i in objects) {
          console.log('dataaccess.caminte.js::setparams - negative count', objects[i].id);
        }
        objects.pop();
      }
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
    if (this.next) {
      this.next.addUser(username, password, callback);
    } else {
      if (callback) {
        callback(null, null);
      }
    }
  },
  setUser: function(iuser, ts, callback) {
    // FIXME: check ts against last_update to make sure it's newer info than we have
    // since we have cached fields
    //console.log('camtinejs::setUser - iuser', iuser);
    // doesn't overwrite all fields
    userModel.findOne({ where: { id: iuser.id } }, function(err, user) {
      //console.log('camtinejs::setUser - got res', user);
      if (user) {
        console.log('camtinejs::setUser - updating user', user.id);
        userModel.update({ where: { id: iuser.id } }, iuser, function(err, user) {
          if (callback) callback(user,err);
        });
      } else {
        //console.log('camtinejs::setUser - creating user');
        db_insert(new userModel(iuser), userModel, callback);
      }
    });
  },
  patchUser: function(userid, changes, callback) {
    userModel.update({ where: { id: userid } }, changes, function(err, user) {
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
    if (userid==undefined) {
      console.log('dataaccess.caminte.js:getUser - userid is undefined');
      callback(null, 'dataaccess.caminte.js:getUser - userid is undefined');
      return;
    }
    if (!userid) {
      console.log('dataaccess.caminte.js:getUser - userid isn\'t set');
      callback(null, 'dataaccess.caminte.js:getUser - userid isn\'t set');
      return;
    }
    if (callback==undefined) {
      console.log('dataaccess.caminte.js:getUser - callback is undefined');
      callback(null, 'dataaccess.caminte.js:getUser - callback is undefined');
      return;
    }
    //console.log('dataaccess.caminte.js:getUser - userid', userid);
    if (userid[0]==='@') {
      //console.log('dataaccess.caminte.js:getUser - getting by username');
      this.getUserID(userid.substr(1), callback);
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
            console.log('creating localUserToken', usertoken)
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
    // if this is local, no need to chain
    /*
    if (this.next) {
      this.next.addAPIUserToken(userid, client_id, scopes, token, callback);
    }
    */
  },
  delAPIUserToken: function(token, callback) {
    localUserTokenModel.findOne({ where: { token: token } }, function(err, usertoken) {
      db_delete(usertoken.id, localUserTokenModel, callback);
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
    // why is there more than one?
    // if we get more than one, than we callback multiple times
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
      callback(upstreamToken, user);
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
  /** app stream */

  /**
   * posts
   */
  // doesn't require an id
  // tokenObj isn't really used at this point...
  // required fields: userid, clientid, text
  addPost: function(ipost, tokenObj, callback) {
    // if we local commit, do we also want to relay it upstream?
    if (this.next) {
      this.next.addPost(ipost, tokenObj, callback);
    } else {
      var ref=this;
      if (ipost.text===undefined) {
        console.log('camintejs::addPost - no text', ipost);
        callback(null, 'no_text', null);
        return;
      }
      /*
      if (ipost.html===undefined) {
        console.log('camintejs::addPost - no html', ipost);
        callback(null, 'no_html', null);
        return;
      }
      */
      // if no next, then likely no upstream
      //console.log('camintejs::addPost - token', tokenObj);
      //console.log('camintejs::addPost - ipost', ipost);
      // need to deal with clientid stuffs
      // can't put in dispatcher because it shouldn't have to detect my next..
      // well it could...
      //this.getLocalClient(client_id, function(client, err) {
        ipost.created_at=new Date();
        if (!ipost.html) {
          ipost.html=ipost.text;
        }
        // final step
        function doCB(rec, err) {
          if (ipost.thread_id) {
            ref.updatePostCounts(ipost.thread_id);
          }
          // can support a cb but we don't need one atm
          ref.updateUserCounts(ipost.userid)
          if (ipost.reply_to) {
            if (ipost.reply_to!=ipost.thread_id) { // optimization to avoid this twice
              ref.updatePostCounts(ipost.reply_to);
            }
          }
          if (callback) {
            callback(rec, err);
          }
        }
        // network client_id
        // but since there's no uplink
        // our local is the network tbh
        // already done in dialect
        //ipost.client_id=tokenObj.client_id;
        db_insert(new postModel(ipost), postModel, function(rec, err) {
          //console.log('camintejs::addPost - res', rec);
          if (err) {
            console.error('camintejs::addPost - insert err', err);
          }
          // get id
          if (rec.id) {
            //console.log('have id');
            var saveit=0;
            if (!rec.thread_id) {
              rec.thread_id=rec.id;
              saveit=1;
            }
            if (rec.text.match(/{post_id}/)) {
              rec.text=rec.text.replace(new RegExp('{post_id}', 'g'), rec.id);
              saveit=1;
            }
            // we dont need to even bother, this field needs to be nuked
            if (rec.html.match(/{post_id}/)) {
              // needs to be reparsed tbh
              // hack
              // doesn't really matter, the entities need to be redone too
              // yea alpha reads txt and entities
              //rec.html=rec.html.replace(new RegExp('https://photo.app.net/">https://photo.app.net/</a>{post_id}/1', 'g'),
              //  'https://photo.app.net/'+rec.id+'/1">https://photo.app.net/'+rec.id+'/1</a>');
              // proper
              // so textProcess is in dispatcher and we can't access it...
              // we'll just filter and trigger above
              rec.html=rec.html.replace(new RegExp('{post_id}', 'g'), rec.id);
              saveit=1;
            }
            //console.log('text', rec.text);
            //console.log('html', rec.html);
            //console.log('saveit', saveit);
            if (saveit) {
              rec.save(function() {
                // new thread or {post_id}
                //console.log('camintejs::addPost - rewrote, final', rec);
                doCB(rec, err);
              });
            } else {
              //console.log('camintejs::addPost - success, final', rec);
              doCB(rec, err);
            }
          } else {
            //console.log('camintejs::addPost - non success, final', rec);
            // set thread_id
            doCB(rec, err);
          }
        });
      //});
    }
  },
  delPost: function(postid, callback) {
    //function db_delete(id, model, callback) {
    //db_delete(postid, postModel, callback);
    var ref = this;
    postModel.findById(postid, function(err, post) {
      if (err) {
        var meta={
          code: 500
        };
        callback(post, err, meta);
        return;
      }
      post.is_deleted=true;
      post.save(function(err2) {
        var meta={
          code: 200
        };
        console.log('camintejs::delPost - cleaning reposts of', postid);
        // now we have to mark any reposts as deleted
        postModel.update({ where: { repost_of: postid } },
        { is_deleted: 1 }, function(repostErr, post) {
          console.log('camintejs::delPost - postModel.update returned', post);
          callback(post, err2, meta);
        });
      });
    });
  },
  updatePostHTML: function(postid, html, callback) {
    postModel.findById(postid, function(err, post) {
      post.html=html;
      post.save(function(err) {
        if (callback) {
          callback(post, err);
        }
      });
    });
  },
  updatePostCounts: function(postid, callback) {
    var ref=this;
    // get a handle on the post we want to modify
    postModel.findById(postid, function(err, post) {
      // num_replies, num_stars, num_reposts
      // getReplies: function(postid, params, token, callback) {
      ref.getReplies(postid, {}, {}, function(replies, err, meta) {
        if (err) console.error('updatePostCounts - replies:', err);
        if (!replies) replies=[];
        post.num_replies=replies.length ? replies.length - 1 : 0; // -1 for the original which is included in replies
        post.save();
      });
      // getPostStars: function(postid, params, callback) {
      ref.getPostStars(postid, {}, function(interactions, err, meta) {
        if (err) console.error('updatePostCounts - stars:', err);
        if (!interactions) interactions=[];
        post.num_stars=interactions.length;
        post.save();
      });
      //getReposts: function(postid, params, token, callback) {
      ref.getReposts(postid, {}, {}, function(posts, err, meta) {
        if (err) console.error('updatePostCounts - reposts:', err);
        if (!posts) posts=[];
        post.num_reposts=posts.length;
        post.save();
      });
    });
    // tight up later
    if (callback) {
      callback();
    }
  },
  // requires that we have an id
  setPost: function(ipost, callback) {
    /*
    delete ipost.source;
    delete ipost.user;
    delete ipost.annotations;
    delete ipost.entities;
    */
    if (!ipost) {
      console.log('caminte::setPost - no post passed');
      if (callback) {
        callback(null, 'no post');
      }
      return;
    }
    if (ipost.repost_of && ipost.userid) {
      // look up the parent post
      this.getPost(ipost.repost_of, function(post, err) {
        notice=new noticeModel();
        notice.event_date=ipost.created_at;
        notice.notifyuserid=post.userid; // who should be notified
        notice.actionuserid=ipost.userid; // who took an action
        notice.type='repost'; // star,repost,reply,follow
        notice.typeid=ipost.id; // postid(star,respot,reply),userid(follow)
        db_insert(notice, noticeModel);
      });
    }
    if (ipost.reply_to) {
      // look up the parent post
      this.getPost(ipost.reply_to, function(post, err) {
        notice=new noticeModel();
        notice.event_date=ipost.created_at;
        notice.notifyuserid=post.userid; // who should be notified
        notice.actionuserid=ipost.userid; // // who took an action
        notice.type='reply'; // star,repost,reply,follow
        // riposte is showing the original post
        notice.typeid=ipost.id; // postid(star,respot,reply),userid(follow)
        notice.altnum = post.id;
        db_insert(notice, noticeModel);
      });
    }
    var ref=this;
    // oh these suck the worst!
    postModel.findOrCreate({
      id: ipost.id
    }, ipost, function(err, post) {
      if (ipost.thread_id) {
        ref.updatePostCounts(ipost.thread_id);
      }
      if (ipost.reply_to) {
        if (ipost.reply_to!=ipost.thread_id) { // optimization to avoid this twice
          ref.updatePostCounts(ipost.reply_to);
        }
      }
      if (callback) {
        callback(post, err);
      }
    });
    //db_insert(new postModel(ipost), postModel, callback);
    // maybe call to check garbage collection?
  },
  addRepost: function(postid, originalPost, tokenObj, callback) {
    if (this.next) {
      this.next.addRepost(postid, originalPost, token, callback);
    } else {
      //console.log('dataaccess.camintejs.js::addRepost - write me!');
      // we need to add a post stub
      var ipost={
        text: '',
        userid: tokenObj.userid,
        client_id: tokenObj.client_id,
        thread_id: originalPost,
        // adn spec says reposts cannot be reposted
        repost_of: postid
      }
      //console.log('dataaccess.camintejs.js::addRepost - ', ipost);
      // then return post
      this.addPost(ipost, tokenObj, callback);
    }
  },
  delRepost: function(postid, token, callback) {
    if (this.next) {
      this.next.delRepost(postid, token, callback);
    } else {
      console.log('dataaccess.base.js::delRepost - write me!');
      // we need to locate the post where we made this
      // and then just run delete post
      this.delPost(postid, callback);
    }
  },
  getPost: function(id, callback) {
    //console.log('dataaccess.caminte.js::getPost - id is '+id);
    if (id==undefined) {
      callback(null, 'dataaccess.caminte.js::getPost - id is undefined');
      return;
    }
    var ref=this;
    db_get(id, postModel, function(post, err) {
      //console.log('dataaccess.caminte.js::getPost - post, err',post,err);
      if (post==null && err==null) {
        //console.log('dataaccess.caminte.js::getPost - next?',ref.next);
        if (ref.next) {
          //console.log('dataaccess.caminte.js::getPost - next');
          ref.next.getPost(id, callback);
          return;
        }
      }
      callback(post, err);
    });
  },
  // why do we need token here? we don't need it
  getReposts: function(postid, params, token, callback) {
    //console.log('dataaccess.caminte.js::getReposts - postid', postid);
    var ref=this;
    // needs to also to see if we definitely don't have any
    // FIXME: is_deleted
    postModel.all({ where: { repost_of: postid } }, function(err, posts) {
      // what if it just doesn't have any, how do we store that?
      if ((posts==null || posts.length==0) && err==null) {
        // before we hit proxy, check empties
        // if there is one, there should only ever be one
        // uhm shit changes
        emptyModel.findOne({ where: { type: 'repost', typeid: postid } }, function(err, empties) {
          //console.log('dataaccess.caminte.js::getPost - empties got',empties);
          if (empties===null) {
            // if empties turns up not set
            if (ref.next) {
              //console.log('dataaccess.caminte.js::getPost - next');
              ref.next.getReposts(postid, params, token, function(pdata, err, meta) {
                // set empties
                //console.log('dataaccess.caminte.js::getPost - proxy.getReposts got',pdata);
                if (pdata.length==0) {
                  // no reposts
                  //console.log('dataaccess.caminte.js::getPost - proxy.getReposts got none');
                  // createOrUpdate? upsert?
                  var empty=new emptyModel;
                  empty.type='repost';
                  empty.typeid=postid;
                  // .getTime();
                  empty.last_updated=new Date();
                  db_insert(empty, emptyModel);
                }
                callback(pdata, err, meta);
              });
              return;
            } else {
              // no way to get data
              callback(null, null);
            }
          } else {
            //console.log('dataaccess.caminte.js::getPost - used empty cache');
            // we know it's empty
            callback([], null);
          }
        });
      } else {
        //console.log('dataaccess.caminte.js::getReposts - reposts count:', posts.length);
        callback(posts, err);
      }
    });
  },
  getUserRepostPost(userid, thread_id, callback) {
    // did we repost any version of this repost
    //console.log('camintejs::getUserRepostPost - userid', userid, 'repost_of', repost_of);
    postModel.findOne({ where: { userid: userid, thread_id: thread_id, repost_of: { ne: 0 }, is_deleted: 0 } }, function(err, post) {
      //console.log('camintejs::getUserRepostPost - ', userid, postid, posts)
      callback(post, err);
    });
  },
  // why do we need token?
  getReplies: function(postid, params, token, callback) {
    //console.log('dataaccess.caminte.js::getReplies - id is '+postid);
    var ref=this;
    // thread_id or reply_to?
    //, id: { ne: postid }
    // FIXME: make pageable
    setparams(postModel.find().where('thread_id', postid).where('repost_of', 0), params, 0, function(posts, err, meta) {
    //postModel.find({ where: { thread_id: postid, repost_of: { ne: postid } }, limit: params.count, order: "id DESC" }, function(err, posts) {
      //console.log('found '+posts.length,'err',err);
      if ((posts==null || posts.length==0) && err==null) {
        // before we hit proxy, check empties
        // if there is one, there should only ever be one
        emptyModel.findOne({ where: { type: 'replies', typeid: postid } }, function(err, empties) {
          //console.log('dataaccess.caminte.js::getReplies - empties got',empties);
          if (empties===null) {

            if (ref.next) {
              //console.log('dataaccess.caminte.js::getReplies - next');
              ref.next.getReplies(postid, params, token, function(pdata, err, meta) {
                // set empties
                console.log('dataaccess.caminte.js::getReplies - proxy.getReposts got length',pdata.length,'postid',postid);
                // 0 or the original post
                if (pdata.length<2) {
                  // no reposts
                  console.log('dataaccess.caminte.js::getReplies - proxy.getReposts got none');
                  // createOrUpdate? upsert?
                  var empty=new emptyModel;
                  empty.type='replies';
                  empty.typeid=postid;
                  // .getTime();
                  empty.last_updated=new Date();
                  db_insert(empty, emptyModel);
                }
                callback(pdata, err, meta);
              });
              return;
            } else {
              // no way to get data
              callback(null, null);
            }
          } else {
            console.log('dataaccess.caminte.js::getReplies - used empty cache');
            // we know it's empty
            callback([], null);
          }
        });
      } else {
        callback(posts, err);
      }
    });
  },
  getUserStream: function(userid, params, token, callback) {
    var ref=this;
    //var finalfunc=function(userid) {
      // get a list of followings
    followModel.find({ where: { active: 1, userid: userid } }, function(err, follows) {
      //console.log('dataaccess.caminte.js::getUserStream - got '+follows.length+' for user '+user, 'follows', follows);
      /*
      if (err==null && follows!=null && follows.length==0) {
        //console.log('User follows no one?');
        if (ref.next) {
          //console.log('check upstream');
          ref.next.getUserStream(user, params, token, callback);
          return;
        }
        callback([], null);
      } else {
      */
        // we have some followings
        // for each following
        var userids=[userid];
        for(var i in follows) {
          // follow.followsid
          userids.push(follows[i].followsid);
        }

        // get a list of their posts
        //console.log('dataaccess.caminte.js::getUserStream - getting posts for '+userids.length+' users');
        // could use this to proxy missing posts
        // what about since_id??

        // get a list of our reposts (OPTIMIZE ME: not dependent on followings)
        postModel.find({ where: { userid: userid, repost_of: { ne: '0' } } }, function(err, ourReposts) {
          var removePosts=[]
          for(var i in ourReposts) {
            removePosts.push(ourReposts[i].id);
          }
          var maxid=0;
          /*
          postModel.all({ order: 'id DESC', limit: 1}, function(err, posts) {
            if (posts.length) {
              maxid=posts[0].id;
            }
            */
            //console.log('our reposts', ourRepostIds);

            // get a list of reposts in this criteria
            // check the thread_id for original to get user id
            // or
            // for everyone we following, get a list of their posts (that are reposted: num_reposts)
            // and exclude those reposts
            // well a repost can be of a repost
            // can either single out thread_id or recurse on reposts
            // thread_id in notRepostsOf and repost_of=0
            postModel.find({ where: { userid: { in: userids }, repost_of: 0, num_reposts: { gt: 0 } } }, function(err, theirPostsThatHaveBeenReposted) {
              var notRepostsOf=[]
              for(var i in theirPostsThatHaveBeenReposted) {
                notRepostsOf.push(theirPostsThatHaveBeenReposted[i].id);
              }
              // get a list of posts where their reposts of reposts
              //postModel.find({ where: { thread_id: { in: notRepostsOf }, repost_of: { ne: 0  } } }, function(err, repostsOfRepostsOfFollowingPosts) {
              //console.log('notRepostsOf', notRepostsOf);
              setparams(postModel.find().where('id', { nin: removePosts }).where('repost_of', { nin: notRepostsOf }).where('userid',{ in: userids }), params, maxid, callback);
              //})
            });
          //});
        });
        /*
        postModel.find({ where: { userid: { in: userids } }, order: 'created_at DESC', limit: params.count, offset: params.before_id }, function(err, posts) {
          if (err) {
            console.log('dataaccess.caminte.js::getUserStream - post find err',err);
            callback([], err);
          } else {
            console.log('dataaccess.caminte.js::getUserStream - Found '+posts.length+' posts',err);
            callback(posts, null);
          }
        })
        */
      //}
    });
    /*
    };
    if (user=='me') {
      this.getAPIUserToken(token, function(tokenobj, err) {
        finalfunc(tokenobj.userid);
      })
    } else if (user[0]=='@') {
      // uhm I don't think posts has a username field...
      this.getUserID(user.substr(1), function(userobj, err) {
        finalfunc(userobj.id);
      });
    } else {
      finalfunc(user);
    }
    */
  },
  // we don't need token
  getUnifiedStream: function(userid, params, callback) {
    var ref=this;
    // get a list of followers
    followModel.find({ where: { active: 1, userid: userid } }, function(err, follows) {
      //console.log('dataaccess.caminte.js::getUserStream - got '+follows.length+' for user '+userid);
      if (err==null && follows!=null && follows.length==0) {
        //console.log('User follows no one?');
        if (ref.next) {
          //console.log('check upstream');
          ref.next.getUserStream(userid, params, token, callback);
          return;
        }
        callback([], null);
      } else {
        // we have some followings
        // for each follower
        var userids=[];
        for(var i in follows) {
          // follow.followsid
          userids.push(follows[i].followsid);
        }
        // get list of mention posts
        var postids=[]
        entityModel.find().where('idtype', 'post').where('type', 'mention').where('alt', userid).run({}, function(err, entities) {
          console.log('dataaccess.caminte.js::getUnifiedStream - user', userid, 'has', entities.length, 'mentions')
          for(var i in entities) {
            postids.push(entities[i].typeid)
          }
          // get a list of posts in my stream
          postModel.find({ where: { userid: { in: userids } } }, function(err, posts) {
            console.log('dataaccess.caminte.js::getUnifiedStream - user', userid, 'has', posts.length, 'posts')
            for(var i in posts) {
              postids.push(posts[i].id)
            }
            // call back with paging
            setparams(postModel.find().where('id', { in: postids} ), params, 0, callback);
          });
        });
        //console.log('dataaccess.caminte.js::getUnifiedStream - write me, mention posts');
        // get the list of posts from followings and mentions
        //console.log('dataaccess.caminte.js::getUserStream - getting posts for '+userids.length+' users');
        // could use this to proxy missing posts
        /*
        postModel.find({ where: { userid: { in: userids } }, order: 'created_at DESC', limit: 20 }, function(err, posts) {
          if (err) {
            console.log('dataaccess.caminte.js::getUnifiedStream - post find err',err);
            callback([], err);
          } else {
            //console.log('Found '+posts.length+' posts',err);
            callback(posts, null);
          }
        })
        */
        //setparams(postModel.find().where('userid', { in: userids} ), params, 0, callback);
      }
    });
  },
  getUserPosts: function(userid, params, callback) {
    //console.log('dataaccess.caminte.js::getUserPosts - start');
    var ref=this;

    //applyParams(query, params, callback)
    //.where('active', true)
    var query=postModel.find().where('userid', userid);
    applyParams(query, params, function(posts, err, meta) {
      if (err==null && (posts==null || !posts.length)) {
        if (ref.next) {
          ref.next.getUserPosts(user, params, callback);
          return;
        }
      }
      callback(posts, err, meta);
    });

    /*
    // params.generalParams.deleted <= defaults to true
    var maxid=0;
    // get the highest post id in posts
    postModel.all({ order: 'id DESC', limit: 1}, function(err, posts) {
      //console.log('dataaccess.caminte.js::getUserPosts - back',posts);
      if (posts.length) {
        maxid=posts[0].id;
      }
      console.log('dataaccess.caminte.js::getUserPosts - max', maxid);
      // .where('is_deleted', 0) set params doesn't need this
      setparams(postModel.find().where('userid', userid), params, maxid, function(posts, err, meta) {
      });
    });
    */
  },
  getMentions: function(user, params, callback) {
    if (user=='me') {
      callback([], 'cant pass me to dataaccess.getMentions');
      return;
    }
    var ref=this;
    //var search={ idtype: 'post', type: 'mention' };
    var k='',v='';
    if (user[0]=='@') {
      //search.text=user.substr(1);
      k='text'; v=user.substr(1);
    } else {
      //search.alt=user;
      k='alt'; v=user;
    }
    var count=params.count;
    //console.log('mention/entity search for ',search);
    //console.log('dataaccess.camtine.js::getMentions - mention/entity search for',k, v);
    // , limit: count, order: 'id desc'
    // 41,681,824
    // to
    // 41,686,219
    // faster?? nope
    //postModel.findOne({ where: {}, order: 'id DESC'}, function(err, post) {
    //postModel.find().order('id', 'DESC').limit(1).run({},function(err, posts) {
    //postModel.all().order('id', 'DESC').limit(1).run({},function(err, posts) {
    //console.log('dataaccess.caminte.js::getMentions - start');
    var maxid=0;
    // get the highest post id in entities
    /*
    entityModel.all({ order: 'typeid DESC', limit: 1}, function(err, entities) {
      //console.log('dataaccess.caminte.js::getMentions - back',posts);
      if (entities.length) {
        maxid=entities[0].typeid;
      }
      */
      //maxid=post.id;
      //if (maxid<20) {
        // by default downloads the last 20 posts from the id passed in
        // so use 20 so we don't go negative
        // FIXME: change to scoping in params adjustment
        //maxid=20;
      //}
      //console.log('maxid',maxid);
      // this didn't work
      // this does work
      //setparams(entityModel.find().where(search), params, maxid, callback);
      // this gave error
      //console.log('dataaccess.caminte.js::getMentions - max', maxid);
      setparams(entityModel.find().where('idtype', 'post').where('type', 'mention').where(k, v),
        params, 0, callback);
    //});
    /*
    entityModel.find({ where: search, limit: count, order: 'id DESC' }, function(err, entities) {
      callback(entities.reverse(), err);
    });
    */
  },
  getGlobal: function(params, callback) {
    var ref=this;
    //console.dir(params);
    // make sure count is positive
    //var count=Math.abs(params.count);
    var maxid=null;
    //postModel.find().order('id', 'DESC').limit(1).run({},function(err, posts) {
    //postModel.all({ order: 'id DESC', limit: 1 }, function(err, posts) {
      //console.log('getGlobal - posts',posts);
      //if (posts.length) {
        //maxid=posts[0].id;
        //console.log('getGlobal - maxid becomes',maxid);
      //}
      // we could consider filtering out reposts
      setparams(postModel.all(), params, maxid, callback);
      // this optimized gets a range
      /*
      if (posts.length) {
        maxid=posts[0].id;
      }
      if (maxid<20) {
        // by default downloads the last 20 posts from the id passed in
        // so use 20 so we don't go negative
        // FIXME: change to scoping in params adjustment
        maxid=20;
      }
      //console.log('getGlobal - max post id in data store is '+maxid);

      if (params.before_id) {
        if (!params.since_id) {
          params.since_id=Math.max(params.before_id-count, 0);
        }
      } else if (params.since_id) {
        // no before but we have since
        // it's maxid+1 because before_id is exclusive
        params.before_id=Math.min(params.since_id+count, maxid+1);
      } else {
        // if we have upstream enabled
        // none set
        params.before_id=maxid;
        params.since_id=maxid-count;
        // if we don't have upstream disable
        // best to proxy global...
      }
      var inlist=[];
      //console.log("from "+params.since_id+' to '+params.before_id);
      var meta={ code: 200, more: true };
      // I haven't see params on the global stream that don't include more
      // unless it's a 404
      if (params.since_id>maxid) {
        meta.more=false;
      }
      if (params.before_id<1) {
        meta.more=false;
      }
      if (params.count>=0) {
        // count is positive
        var apiposts=[];
        for(var pid=params.before_id-1; pid>params.since_id && inlist.length<count; pid--) {
          inlist.push(pid);
        }
        if (inlist.length) {
          meta.min_id=inlist[inlist.length-1];
          meta.max_id=inlist[0];
        }
        if (inlist.length==count && pid>params.since_id) {
          meta.more=true;
        }
      } else {
        // count is negative
        for(var pid=params.since_id+1; pid<params.before_id && inlist.length<count; pid++) {
          inlist.push(pid);
        }
        if (inlist.length) {
          meta.min_id=inlist[0];
          meta.max_id=inlist[inlist.length-1];
        }
        if (inlist.length==count && pid<params.before_id) {
          meta.more=true;
        }
      }
      //console.log(meta);
      //console.dir(inlist);
      if (inlist.length) {
        var posts=[];
        inlist.map(function(current, idx, Arr) {
          // get the post
          ref.getPost(current, function(post, err, postMeta) {
            posts.push(post);
            //console.log('posts',posts.length,'inlist',inlist.length);
            if (posts.length==inlist.length) {
              // if negative count, we need to reverse the results
              if (params.count<0) {
                posts.reverse();
              }
              //for(var i in posts) {
                //var post=posts[i];
                //console.log('got '+post.id);
              //}
              //console.log('sending',posts.length);
              callback(posts, null, meta);
            }
          });
        }, ref);
      } else {
        callback([], null, meta);
      }
      */
    //});
  },
  getExplore: function(params, callback) {
    if (this.next) {
      this.next.getExplore(params, callback);
    } else {
      //console.log('dataaccess.base.js::getExplore - write me!');
      var res={"meta":{"code":200},
        "data":[
          {"url":"/posts/stream/explore/conversations", "description":"New conversations just starting on App.net", "slug":"conversations", "title":"Conversations"},
          {"url":"/posts/stream/explore/photos", "description":"Photos uploaded to App.net", "slug":"photos", "title":"Photos"},
          {"url":"/posts/stream/explore/trending", "description":"Posts trending on App.net", "slug":"trending", "title":"Trending"},
          //{"url":"/posts/stream/explore/checkins", "description":"App.net users in interesting places", "slug":"checkins", "title":"Checkins"}
          //{"url":"/posts/stream/explore/subtweets", "description":"memes", "slug":"subtweets", "title":"Drybones Subtweets"}
          {"url":"/posts/stream/explore/moststarred", "description":"Posts that people have starred", "slug":"moststarred", "title":"Starred Posts"}
        ]
      };
      callback(res.data, null, res.meta);
    }
  },
  getExploreFeed: function(feed, params, callback) {
    //console.log('dataaccess.camtinte.js::getExploreFeed(', feed, ',..., ...) - start');
    if (this.next) {
      this.next.getExploreFeed(feed, params, callback);
    } else {
      // get list of posts && return
      var posts=[];
      var ref=this;
      switch(feed) {
        case 'photos':
          // we need to convert to setParams
          annotationModel.find({ where: { idtype: 'post', type: 'net.app.core.oembed' }, order: 'typeid DESC' }, function(err, dbNotes) {
            if (!dbNotes.length) callback(posts, null, { "code": 200 });
            var posts = []
            for(var i in dbNotes) {
              posts.push(dbNotes[i].typeid)
            }
            var maxid=0;
            setparams(postModel.find().where('id', { in: posts }), params, maxid, callback);
          });
        break;
        case 'checkins':
          // we need to convert to setParams
          annotationModel.find({ where: { idtype: 'post', type: 'ohai' }, order: 'typeid DESC' }, function(err, dbNotes) {
            if (!dbNotes.length) callback(posts, null, { "code": 200 });
            for(var i in dbNotes) {
              ref.getPost(dbNotes[i].typeid, function(post, err, meta) {
                posts.push(post);
                //console.log(posts.length, '/', dbNotes.length);
                if (posts.length===dbNotes.length) {
                  callback(posts, null, { "code": 200 });
                }
              });
            }
          });
        break;
        case 'moststarred':
          // so "conversations", is just going to be a list of any posts with a reply (latest at top)
          // maybe the thread with the latest reply would be good
          // params.generalParams.deleted <= defaults to true
          var maxid=0;
          // get the highest post id in posts
          postModel.all({ order: 'id DESC', limit: 1}, function(err, posts) {
            //console.log('dataaccess.caminte.js::getUserPosts - back',posts);
            if (posts.length) {
              maxid=posts[0].id;
            }
            console.log('dataaccess.caminte.js::moststarred - max', maxid);
            // order is fucked here...
            setparams(postModel.find().where('num_stars', { ne: 0 }).order('num_stars DESC, id DESC'), params, maxid, function(dbPosts, err, meta) {
              /*
              if (!dbPosts.length) {
                callback(dbPosts, null, { "code": 200 });
              }
              */
              callback(dbPosts, null, { "code": 200 });
            });
          });
        break;
        case 'conversations':
          // so "conversations", is just going to be a list of any posts with a reply (latest at top)
          // maybe the thread with the latest reply would be good
          // params.generalParams.deleted <= defaults to true
          var maxid=0;
          // get the highest post id in posts
          postModel.all({ order: 'id DESC', limit: 1}, function(err, posts) {
            //console.log('dataaccess.caminte.js::getUserPosts - back',posts);
            if (posts.length) {
              maxid=posts[0].id;
            }
            console.log('dataaccess.caminte.js::conversations - max', maxid);
            // this alone makes the order much better but not perfect
            setparams(postModel.find().where('reply_to', { ne: 0}).order('thread_id DESC'), params, maxid, function(dbPosts, err, meta) {
            //postModel.find({ where: { reply_to: { ne: 0 } }, order: 'thread_id DESC' }, function(err, dbPosts) {
              if (!dbPosts.length) callback(dbPosts, null, { "code": 200 });
              var started={};
              var starts=0;
              var dones=0;
              for(var i in dbPosts) {
                if (started[dbPosts[i].thread_id]) continue;
                started[dbPosts[i].thread_id]=true;
                starts++;
                ref.getPost(dbPosts[i].thread_id, function(post, err, meta) {
                  posts.push(post);
                  dones++;
                  //console.log(posts.length, '/', dbNotes.length);
                  //if (posts.length===dbPosts.length) {
                  if (starts===dones) {
                    // FIXME: order
                    callback(posts, null, { "code": 200 });
                  }
                });
              }
            });
          });
        break;
        case 'trending':
          // so "trending" will be posts with hashtags created in the last 48 hours, sorted by most replies
          entityModel.find({ where: { idtype: 'post', type: 'hashtag' }, order: 'typeid DESC' }, function(err, dbEntities) {
            if (!dbEntities.length) callback(posts, null, { "code": 200 });
            var posts = []
            for(var i in dbEntities) {
              posts.push(dbEntities[i].typeid)
            }
            var maxid=0;
            setparams(postModel.find().where('id', { in: posts }), params, maxid, callback);
            /*
            var started={};
            var starts=0;
            var dones=0;
            for(var i in dbEntities) {
              if (started[dbEntities[i].typeid]) continue;
              started[dbEntities[i].typeid]=true;
              starts++;
              ref.getPost(dbEntities[i].typeid, function(post, err, meta) {
                posts.push(post);
                dones++;
                if (starts===dones) {
                  callback(posts, null, { "code": 200 });
                }
              });
            }
            */
          });
        break;
        case 'subtweets':
          postModel.find({ where: { text: { like: '%drybones%' } }, order: 'id DESC' }, function(err, dbPosts) {
            if (!dbPosts.length) callback(posts, null, { "code": 200 });
            for(var i in dbPosts) {
              ref.getPost(dbPosts[i].id, function(post, err, meta) {
                posts.push(post);
                //console.log(posts.length, '/', dbNotes.length);
                if (posts.length===dbPosts.length) {
                  callback(posts, null, { "code": 200 });
                }
              });
            }
          })
        break;
        default:
          console.log('dataaccess.caminte.js::getExploreFeed(', feed, ') - write me!');
          callback(posts, null, { "code": 200 });
        break;
      }
    }
  },
  searchPosts: function(query, params, callback) {
    setparams(postModel.find().where('text', { like: '%'+query+'%' }), params, 0, function(posts, err, meta) {
      callback(posts, err, meta);
    });
  },
  /** channels */
  setChannel: function (chnl, ts, callback) {
    // created_at vs last_update
    // this only add, does not update
    // findOrCreate
    // updateOrCreate doesn't seem to work on MySQL
    chnl.last_updated=new Date();
    channelModel.updateOrCreate({
      id: chnl.id
    }, chnl, function(err, ochnl) {
      if (callback) {
        callback(ochnl, err);
      }
    });
  },
  updateChannel: function (channelid, chnl, callback) {
    console.log('dataaccess.caminte.js::updateChannel - ', channelid, chnl);
    // FIXME: maybe only update channels that are active
    channelModel.update({ id: channelid }, chnl, function(err, channel) {
      if (callback) {
        callback(channel, err);
      }
    });
  },
  addChannel: function(userid, channel, callback) {
    //console.log('dataaccess.caminte.js::addChannel - ', userid, channel);
    var now=new Date();
    var obj={
      ownerid: userid,
      created_at: now,
      last_updated: now,
      type: channel.type,
      reader: channel.reader,
      writer: channel.writer,
      readers: channel.readers,
      writers: channel.writers,
      editors: channel.editors,
    };
    if (channel.readedit) {
      obj.readedit=channel.readedit;
    }
    if (channel.writeedit) {
      obj.writeedit=channel.writeedit;
    }
    if (channel.editedit) {
      obj.editedit=channel.editedit;
    }
    console.log('dataaccess.caminte.js::addChannel - final obj', obj)
    channelModel.create(obj, function(err, ochnl) {
      if (err) {
        console.log('dataaccess.caminte.js::addChannel - create err', err);
      }
      subscriptionModel.create({
        channelid: ochnl.id,
        userid: userid,
        created_at: now,
        active: true,
        last_updated: now,
      }, function(err, nsub) {
        if (err) {
          console.log('dataaccess.caminte.js::addChannel - subscribe err', err);
        }
        if (callback) {
          callback(ochnl, err);
        }
      });
    });
  },
  // FIXME: call getChannels always return an array
  getChannel: function(id, params, callback) {
    if (id==undefined) {
      console.log('dataaccess.caminte.js::getChannel - id is undefined');
      callback(null, 'dataaccess.caminte.js::getChannel - id is undefined');
      return;
    }
    var ref=this;
    var criteria={ where: { id: id, inactive: null } };
    if (params.channelParams && params.channelParams.types) {
      criteria.where['type']={ in: params.channelParams.types.split(/,/) };
      //console.log('dataaccess.caminte.js::getChannel - types', criteria.where['type']);
    }
    if (id instanceof Array) {
      criteria.where['id']={ in: id };
    }
    if (params.channelParams && params.channelParams.inactive) {
      criteria.where['inactive']= { ne: null }
    }
    //console.log('dataaccess.caminte.js::getChannel - criteria', criteria);
    channelModel.find(criteria, function(err, channels) {
      //console.log('dataaccess.caminte.js::getChannel - found', channels.length)
      if (channels==null && err==null) {
        if (ref.next) {
          ref.next.getChannel(id, callback);
          return;
        }
      }
      //console.log('dataaccess.caminte.js::getChannel - channels', channels)
      if (id instanceof Array) {
        callback(channels, err);
      } else {
        callback(channels[0], err);
      }
    });
    return;
  },
  // group is an array of user IDs
  // shouldn't it be dispatchers job to do the user lookup
  // so it can hit any caching layer
  getPMChannel: function(group, callback) {
    var ref=this;
    function processGroup(group) {
      //console.log('dataaccess.caminte.js::getPMChannel - processGroup group in', group.length)
      var groupStr=group.join(',');
      channelModel.find({ where: { type: 'net.app.core.pm', writers: groupStr } }, function(err, channels) {
        if (err) {
          console.log('dataaccess.caminte.js::getPMChannel - err', err);
          callback(0, 'couldnt query existing PM channels');
          return;
        }
        if (channels.length > 1) {
          console.log('dataaccess.caminte.js::getPMChannel - too many PM channels for', group);
          callback(0, 'too many PM channels');
          return;
        }
        if (channels.length == 1) {
          callback(channels[0].id, '');
          return;
        }
        // create
        ref.addChannel(group[0], 'net.app.core.pm', function(channel, createErr) {
          channel.writers=groupStr;
          channel.save(function() {
            for(var i in group) {
              var user=group[i];
              subscriptionModel.findOrCreate({ channelid: channel.id, userid: user });
            }
            callback(channel.id, '');
          });
        });
      });
    }
    //console.log('dataaccess.caminte.js::getPMChannel - group in', group.length)
    var groupids=[];
    for(var i in group) {
      var user=group[i];
      if (user[0]=='@') {
        // username look up
        this.getUserID(user, function(userObj, err) {
          //console.log('dataaccess.caminte.js::getPMChannel - username lookup', userObj, err);
          if (userObj) {
            groupids.push(userObj.id);
          } else {
            groupids.push(null);
          }
          if (groupids.length == group.length) {
            processGroup(groupids);
          }
        });
      } else {
        groupids.push(user);
        if (groupids.length == group.length) {
          processGroup(groupids);
        }
      }
    }
  },
  /** messages */
  setMessage: function (msg, callback) {
    // If a Message has been deleted, the text, html, and entities properties will be empty and may be omitted.
    //console.log('setMessage - id', msg.id, 'updates', msg)
    // findOrCreate didn't work
    // updateOrCreate expects a full object
    messageModel.findOne({ where: { id: msg.id } }, function(err, omsg) {
      function doCallback(err, fMsg) {
        if (err) {
          console.log('setMessage:::doCallback - err', err);
        }
        // if it's an update fMsg is number of rows affected
        //console.log('setMessage:::doCallback - ', fMsg);
        if (callback) {
          callback(fMsg, err);
        }
      }
      if (omsg) {
        // update
        messageModel.update({ where: { id: msg.id } }, msg, doCallback);
      } else {
        // create
        messageModel.create(msg, doCallback);
      }
    });
  },
  addMessage: function(message, callback) {
    messageModel.create(message, function(err, omsg) {
      if (err) {
        console.log('dataaccess.camtine.js::addMessage - err', err)
      }
      if (callback) {
        callback(omsg, err);
      }
    });
  },
  getMessage: function(id, callback) {
    if (id==undefined) {
      callback(null,'dataaccess.caminte.js::getMessage - id is undefined');
      return;
    }
    var ref=this;
    db_get(id, messageModel, function(message, err) {
      if (message==null && err==null) {
        if (ref.next) {
          ref.next.getMessage(id, callback);
          return;
        }
      }
      callback(message, err);
    });
  },
  getChannelMessages: function(channelid, params, callback) {
    var ref=this;
    var query=messageModel.find().where('channel_id', channelid);
    //console.log('getChannelMessages - params', params);
    applyParams(query, params, function(messages, err, meta) {
      callback(messages, err);
    });
  },
  /** subscription */
  /*
    channelid: { type: Number, index: true },
    userid: { type: Number, index: true },
    created_at: { type: Date, index: true },
    active: { type: Boolean, index: true },
    last_updated: { type: Date },
  */
  addSubscription: function (channel_id, userid, callback) {
    //console.log('dataaccess.camintejs::addSubscription - channel_id', channel_id, 'userid', userid);
    subscriptionModel.findOne({ where : {
      channelid: channel_id,
      userid: userid,
    } }, function(err, subscription) {
      if (err) {
        console.log('dataaccess.camintejs::addSubscription - err', err);
      }
      //console.log('dataaccess.camintejs::addSubscription - subscription', subscription);
      // if you have a null created_at, we'll just keep making new records with this
      // || !subscription.created_at
      if (!subscription) {
        subscription = new subscriptionModel
        subscription.created_at=new Date();
        subscription.channelid=channel_id;
        subscription.userid=userid;
      }
      if (subscription.created_at == null) {
        subscription.created_at=new Date();
      }
      subscription.active=true;
      subscription.last_updated=new Date();
      subscription.save(function() {
        if (callback) {
          //console.log('dataaccess.camintejs::addSubscription result', subscription);
          callback(subscription, err);
        }
      });
    });
  },
  setSubscription: function (channel_id, userid, del, ts, callback) {
    subscriptionModel.updateOrCreate({
      channelid: channel_id,
      userid: userid
    }, {
      active: !del?true:false,
      last_updated: ts
    }, function(err, subscription) {
      if (callback) {
        callback(subscription, err);
      }
    });
  },
  /*
  delSubscription: function (channel_id, userid, callback) {
    subscriptionModel.remove({
      channelid: channel_id,
      userid: userid,
    }, function(err, subscription) {
      if (callback) {
        callback(subscription, err);
      }
    });
  },
  */
  getUserSubscriptions: function(userid, params, callback) {
    //console.log('dataaccess.caminte.js::getUserSubscriptions - userid is', userid);
    if (userid==undefined) {
      console.log('dataaccess.caminte.js::getUserSubscriptions - userid is undefined');
      callback([], 'userid is undefined');
      return;
    }
    if (userid=='') {
      console.log('dataaccess.caminte.js::getUserSubscriptions - userid is empty');
      callback([], 'userid is empty');
      return;
    }
    var ref=this;
    userid=parseInt(userid); // ensure it's a number at this point
    if (isNaN(userid)) {
      console.log('dataaccess.caminte.js::getUserSubscriptions - userid is NaN');
      callback([], 'userid is NaN');
      return;
    }
    //console.log('dataaccess.caminte.js::getUserSubscriptions - userid', userid);

    // we actually not sort by id but by the "most recent post first"

    //applyParams(query, params, callback)
    var query=subscriptionModel.find().where('userid', userid).where('active', true);
    applyParams(query, params, callback);

    /*function(subs, err, meta) {
    //setparams(postModel.find().where('id', { nin: ourRepostIds }).where('userid',{ in: userids }), params, maxid, callback);
    //subscriptionModel.find({ where: { userid: userid, active: true } }, function(err, subs) {
      callback(subs, err, meta); */
      /*
      // FIXME: lookup should be in dispatcher for caching reasons
      // and that means we need to do the sorting in dispatcher
      var channelids=[];
      for(var i in subs) {
        var sub=subs[i];
        channelids.push(sub.channelid);
      }
      //console.log('dataaccess.caminte.js::getUserSubscriptions - channelids are', channelids);
      if (channelids.length) {
        //console.log('dataaccess.caminte.js::getUserSubscriptions - channelids is', channelids);
        var channelCriteria={ where: { id: { in: channelids } } };
        if (params.types) {
          channelCriteria.where['type']={ in: params.types.split(/,/) };
          //console.log('dataaccess.caminte.js::getUserSubscriptions - types', channelCriteria.where['type']);
        }
        channelModel.find(channelCriteria, function (err, channels) {
          callback(channels, err, meta);
        });
      } else {
        // no subs
        callback([], '', meta);
      }
      */
    //});
  },
  getChannelSubscriptions: function(channelid, params, callback) {
    if (id==undefined) {
      callback(null, 'dataaccess.caminte.js::getChannelSubscriptions - id is undefined');
      return;
    }
    if (this.next) {
      this.next.getChannelSubscriptions(channelid, params, callback);
      return;
    }
    callback(null, null);
  },
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
  /** entities */
  // should this model more closely follow the annotation model?
  // not really because entities are immutable (on posts not users)
  extractEntities: function(type, id, entities, entitytype, callback) {
    // Todo: implement this.next calling
    /*
    if (this.next) {
      this.next.extractEntities(type, id, entities, entitytype, callback);
    }
    */
    if (type===null) {
      // don't let it write type nulls
      console.log('dataaccess.caminte.js::extractEntities - extracted bad entity type',type);
      callback(null,'badtype');
      return;
    }
    // delete (type & idtype & id)
    entityModel.find({where: { idtype: type, typeid: id, type: entitytype }},function(err, oldEntities) {
      //console.dir(oldEntities);

      // why do we have empty entity records in the DB?
      /*
        dataaccess.caminte.js::extractEntities - OldEntity doesn't have id  { idtype: null,
          typeid: null,
          type: null,
          pos: null,
          len: null,
          text: null,
          alt: null,
          altnum: null,
          id: null }
      */
      // I think find returns an empty record if nothing is found...
      // how to test this?

      for(var i in oldEntities) {
        var oldEntity=oldEntities[i];
        if (oldEntity.id) {
          entityModel.destroyById(oldEntity.id, function(err) {
            if (err) {
              console.log('couldn\'t destroy old entity ',err);
            }
          });
        } else {
          //console.log('dataaccess.caminte.js::extractEntities - OldEntity doesn\'t have id ',oldEntity);
        }
      }
      // delete all oldEntities
      //console.log('uploading '+entities.length+' '+type+' '+entitytype);
      // foreach entities
      for(var i in entities) {
        //console.dir(entities[i]);
        // insert
        // ok we don't want to copy/reference here, this stomps id
        entity=new entityModel(entities[i]);
        // well maybe if we clean up well enough
        entity.id=null;
        entity.typeid=id;
        entity.idtype=type;
        entity.type=entitytype;
        entity.text=entities[i].name?entities[i].name:entities[i].text;
        entity.alt=entities[i].url?entities[i].url:entities[i].id;
        entity.altnum=entities[i].is_leading?entities[i].is_leading:entities[i].amended_len;
        if (!entity.alt) {
          entity.alt='';
        }
        if (!entity.altnum) {
          entity.altnum=0;
        }
        //console.log('Insert entity '+entitytype+' #'+i+' '+type,'alt',entity.alt,'userid',entities[i].id);
        db_insert(entity, entityModel);
      }
      if (callback) {
        callback(null, null);
      }
    });

  },
  getEntities: function(type, id, callback) {
    //console.log('type: '+type+' id: '+id);
    if (!type) {
      console.log('dataaccess.caminte.js::getEntities - type', type, 'id', id);
      console.trace('dataaccess.caminte.js::getEntities - no type');
      callback([], 'invalid type', {
        code: 500
      });
      return;
    }
    if (!id) {
      console.log('dataaccess.caminte.js::getEntities - type', type, 'id', id);
      console.trace('dataaccess.caminte.js::getEntities - no id');
      callback([], 'invalid type', {
        code: 500
      });
      return;
    }
    var res={
      mentions: [],
      hashtags: [],
      links: [],
    };
    // count is always 0 or 1...
    // with find or all
    var ref=this;
    entityModel.find({ where: { idtype: type, typeid: id } }, function(err, entities) {
      if (entities==null && err==null) {
        if (ref.next) {
          ref.next.getEntities(type, id, callback);
          return;
        }
      } else {
        //console.log('dataaccess.caminte.js::getEntities '+type+' '+id+' - count ',entities.length);
        for(var i in entities) {
          var entity=entities[i];
          // why is find returning empty sets...
          if (entity.id===null) continue;
          //console.log('entity',entity,'i',i);
          //console.log('et '+entity.type);
          if (res[entity.type+'s']) {
            res[entity.type+'s'].push(entities[i]);
          } else {
            // temp disabled, just makes debugging other things harder
            // you're data is bad I get it
            console.log('getEntities unknown type ['+entity.type+'] for ['+type+'] ['+id+'] test['+entity.id+']');
            // we need to delete it
            //entity.destroy();
            //entityModel.destroy(entity);
            entityModel.destroyById(entity.id);
          }
        }
      }
      callback(res, null);
    });
  },
  // more like getHashtagEntities
  getHashtagEntities: function(hashtag, params, callback) {
    // Todo: implement this.next calling
    /*
    if (this.next) {
      this.next.getHashtagEntities(hashtag, params, callback);
    }
    */
    // sorted by post created date...., well we have post id we can use
    entityModel.find({ where: { type: 'hashtag', text: hashtag }, order: 'typeid DESC' }, function(err, entities) {
      callback(entities, err);
    });
  },
  /**
   * Annotations
   */
  addAnnotation: function(idtype, id, type, value, callback) {
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
    });
    // tight up later
    if (callback) {
      callback();
    }
  },
  /** follow */
  // is del bool or 1/0? <= doesn't matter
  setFollow: function (srcid, trgid, id, del, ts, callback) {
    // FIXME: ORM issues here...
    // create vs update fields?
    if (srcid && trgid) {

      // do notify
      // could guard but then we'd need more indexes
      // i think we'll be ok if we don't guard for now
      //noticeModel.noticeModel( { where: { created_at: ts, type: type } }, function(err, notify)
      //
      if (del) {
        // remove any evidence of a follow
        noticeModel.find({ where: { type: 'follow', actionuserid: srcid, typeid: trgid} }, function(err, noticies) {
          for(var i in noticies) {
            var notice=noticies[i]
            notice.destroy(function(err) {
            });
          }
        });
      } else {
        notice=new noticeModel();
        notice.event_date=ts;
        // notify target
        notice.notifyuserid=trgid; // who should be notified
        notice.actionuserid=srcid; // who took an action
        notice.type='follow'; // star,repost,reply,follow
        notice.typeid=trgid; // postid(star,respot,reply),userid(follow)
        db_insert(notice, noticeModel);
      }

      console.log('setFollow active - del:', del, 'active:', del?0:1);
      var ref=this;
      // FIXME; we need to manually detect if it existed, so we can set created_at
      // as that's the main date field that's part of the api
      followModel.updateOrCreate({
        userid: srcid,
        followsid: trgid
      }, {
        userid: srcid,
        followsid: trgid,
        active: del?0:1,
        referenceid: id,
        //created_at: ts,
        last_updated: ts
      }, function(err, users) {
        // now recalculate target user counts
        // maybe even get a count
        // download target user records
        ref.updateUserCounts(srcid, function() {})
        ref.updateUserCounts(trgid, function() {})
        // make changes
        if (callback) {
          callback(users, err);
        }
      });
    } else {
      // FIXME: write me
      // search by referenceid, likely delete it
      console.log('dataaccess.caminte.js::setFollow - no data, write me... deleted? '+del);
      if (callback) {
        callback(null, null);
      }
    }
    // find (id and status, dates)
    // update or insert
  },
  // who is this user following
  getFollowing: function(userid, params, callback) {
    if (userid==undefined) {
      callback(null, 'dataaccess.caminte.js::getFollowing - userid is undefined');
      return;
    }
    // FIXME: active
    followModel.find({ where: { userid: userid } }, function(err, followings) {
      //console.dir(followings);
      if (followings==undefined) {
        if (this.next) {
          this.next.getFollowing(userid, params, callback);
          return;
        }
      } else {
        //console.log('got', followings.length, 'followings for', userid);
        callback(followings, err);
      }
    })
  },
  follows: function(src, trg, callback) {
    //console.log('dataaccess.caminte.js::follows - src/trg', src, trg);
    if (src==undefined) {
      callback(null, 'dataaccess.caminte.js::follows - undefined src');
      return;
    }
    if (trg==undefined) {
      callback(null, 'dataaccess.caminte.js::follows - undefined trg');
      return;
    }
    followModel.findOne({ where: { userid: src, followsid: trg } }, function(err, followings) {
      callback(followings, err);
    })
  },
  // who follows this user
  getFollows: function(userid, params, callback) {
    if (userid==undefined) {
      callback(null, 'dataaccess.caminte.js::getFollows - userid is undefined');
      return;
    }
    //, limit: params.count, order: "last_updated DESC"
    followModel.find({ where: { followsid: userid, active: 1 } }, function(err, followers) {
      if (followers==undefined) {
        if (this.next) {
          this.next.getFollows(userid, params, callback);
          return;
        }
      } else {
        callback(followers, null);
      }
    });
  },
  /** Star/Interactions */
  addStar: function(postid, token, callback) {
    if (this.next) {
      this.next.addStar(postid, token, callback);
    } else {
      //console.log('dataaccess.caminte.js::addStar - write me!');
      // nope
      console.log('dataaccess.caminte.js::addStar - token: ', token); // obj?
      this.setInteraction(token.userid, postid, 'star', 0, 0, Date.now());
      // we're supposed to return the post
      callback(null, null);
    }
  },
  delStar: function(postid, token, callback) {
    if (this.next) {
      this.next.delStar(postid, token, callback);
    } else {
      //console.log('dataaccess.caminte.js::delStar - write me!');
      console.log('dataaccess.caminte.js::delStar - token: ', token); // obj?
      this.setInteraction(token.userid, postid, 'star', 0, 1, Date.now());
      // we're supposed to return the post
      callback(null, null);
    }
  },
  setInteraction: function(userid, postid, type, metaid, deleted, ts, callback) {
    // is there an existing match for this key (userid, postid, type)
    // wouldn't find or create be better here?
    var ref=this;
    console.log('caminte::setInteractions', userid, postid, type, metaid, deleted);
    interactionModel.find({ where: { userid: userid, typeid: postid, type: type } }, function(err, foundInteractions) {

      function doFinalCheck(interactions, err, meta) {
        var postDone=false;
        var userDone=false;
        function checkDone() {
          if (postDone && userDone) {
            if (callback) {
              callback(interactions, err, meta);
            }
          }
        }
        if (type==='star') {
          // update num_stars
          ref.updatePostCounts(postid, function() {
            postDone=true;
            checkDone();
          });
          // update counts.stars
          ref.updateUserCounts(userid, function() {
            userDone=true;
            checkDone();
          });
        } else {
          postDone=true;
          userDone=true;
          checkDone();
        }
      }
      // already set dude
      console.log('caminte::setInteractions - find', foundInteractions)
      if (foundInteractions && foundInteractions.length) {
        //console.log('caminte::setInteractions - already in db')
        if (deleted) {
          // nuke it
          var done=0
          for(var i in foundInteractions) {
            foundInteractions[i].destroy(function (err) {
              done++;
              if (done===foundInteractions.length) {
                // hiding all errors previous to last one
                doFinalCheck('', err);
              }
            })
          }
        } else {
          doFinalCheck('', null);
        }
        return;
      }

      // ok star,repost
      console.log('camintejs::setInteraction - type',type);
      if (type=='star') {
        // is this the src or trg?
        //console.log('setInteraction - userid',userid);
        // do notify
        // could guard but then we'd need more indexes
        // i think we'll be ok if we don't guard for now
        //noticeModel.noticeModel( { where: { created_at: ts, type: type } }, function(err, notify)

        // first who's object did we interact with
        ref.getPost(postid, function(post, err, meta) {
          notice=new noticeModel();
          notice.event_date=ts;
          // owner of post should be notified
          notice.notifyuserid=post.userid; // who should be notified
          notice.actionuserid=userid; // who took an action
          notice.type=type; // star,repost,reply,follow
          notice.typeid=postid; // postid(star,respot,reply),userid(follow)
          //notice.asthisid=metaid;
          db_insert(notice, noticeModel, function() {
          });
        });
      }

      // is this new action newer
      interaction=new interactionModel();
      interaction.userid=userid;
      interaction.type=type;
      interaction.datetime=ts;
      interaction.idtype='post';
      interaction.typeid=postid;
      interaction.asthisid=metaid;
      //if (foundInteraction.id==null) {
      console.log('camintejs:setInteraction - inserting', interactionModel);
      db_insert(interaction, interactionModel, function(interactions, err, meta) {
        doFinalCheck(interactions, err, meta);
      });
      /*
      } else {
        console.log('setInteraction found dupe', foundInteraction, interaction);
        if (callback) {
          callback('', 'duplicate')
        }
      }
      */
    });
  },
  getUserStarPost: function(userid, postid, callback) {
    // did this user star this post
    //, limit: params.count
    //console.log('camintejs::getUserStarPost', userid, postid);
    interactionModel.find({ where: { userid: userid, type: 'star', typeid: postid, idtype: 'post' } }, function(err, interactions) {
      callback(interactions[0], err);
    });
  },
  // get a list of posts starred by this user (Retrieve Posts starred by a User)
  // https://api.app.net/users/{user_id}/stars
  // getUserStarPosts
  //
  // get a list of users that have starred this post
  // getPostStars
  getPostStars: function(postid, params, callback) {
    interactionModel.find({ where: { type: 'star', typeid: postid, idtype: 'post' }, limit: params.count }, function(err, interactions) {
      /*
      if (interactions==null && err==null) {
        callback(interactions, err);
      } else {
        callback(interactions, err);
      }
      */
      callback(interactions, err);
    });
  },
  // user: userid
  getNotices: function(user, params, tokenObj, callback) {
    //console.log('dataaccess.caminte.js::getNotices - user', user, 'params', params, 'tokenObj', typeof(tokenObj), 'callback', typeof(callback));
    /*
    if (typeof(callback)!=='function') {
      console.log('dataaccess.caminte.js::getNotices - called without a callback', user, params, tokenObj);
      return;
    }
    */
    function finalfunc(userid) {
      setparams(noticeModel.find().where('notifyuserid', userid), params, 0, function(notices, err, meta) {
        callback(notices, err, meta);
      });

      // , limit: params.count
      /*
      noticeModel.find({ where: { notifyuserid: userid }, order: "event_date DESC" }, function(err, notices) {
        //console.log('dataaccess.caminte.js::gotNotices');
        callback(notices, err);
      });
      */
    }

    if (user=='me') {
      //this.getAPIUserToken(tokenStr, function(tokenobj, err) {
      finalfunc(tokenObj.userid);
      //})
    } else if (user[0]=='@') {
      // uhm I don't think posts has a username field...
      this.getUserID(user.substr(1), function(userobj, err) {
        finalfunc(userobj.id);
      });
    } else {
      finalfunc(user);
    }
  },
  // USERS DONT INTERACT WITH EACH OTHER (except follows)
  // THEY (mostly) INTERACT WITH POSTS
  // and we'll need to deference the post.user as a user can have 10k posts
  // and we need to be able to query by user without looking up 10k and joining that set
  //
  // getUserInteractions, remember reposts are stored here too
  // if we're going to use one table, let's keep the code advantages from that
  //
  // this isn't good enough
  // we will rarely query by user
  // idtype and type are highly likely
  // can be in context of token/user
  getInteractions: function(type, user, params, callback) {
    //console.log('Getting '+type+' for '+userid);
    var ref=this;
    var finishfunc=function(userid) {
      //console.log('caminte::getInteractions', type, params, user, '=>', userid);
      interactionModel.find({ where: { userid: userid, type: type, idtype: 'post' }, limit: params.count, order: "datetime DESC" }, function(err, interactions) {
        if (interactions==null && err==null) {
          // none found
          //console.log('dataaccess.caminte.js::getStars - check proxy?');
          // user.stars_updated vs appstream start
          // if updated>appstream start, we can assume it's up to date
          if (ref.next) {
            ref.next.getInteractions(type, userid, params, callback);
            return;
          }
        }
        //console.dir(interactions);
        callback(interactions, err);
      });
    };
    if (user[0]=='@') {
      var username=user.substr(1);
      this.getUserID(username, function(userobj, err) {
        finishfunc(userobj.id);
      });
    } else {
      finishfunc(user);
    }
  },
  getOEmbed: function(url, callback) {
    if (this.next) {
      this.next.getOEmbed(url, callback);
    } else {
      console.log('dataaccess.caminte.js::getOEmbed - write me!');
      callback(null, null);
    }
  }
}
