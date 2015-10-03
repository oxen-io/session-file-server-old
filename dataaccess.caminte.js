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
var schemaDataType = 'memory';
/** set up where we're storing the "network data" */
var schemaData = new Schema(schemaDataType, {database: 'data', port: 6379}); //port number depends on your configuration
/** set up where we're storing the tokens */
var schemaToken = new Schema(schemaDataType, {database: 'token', port: 6379}); //port number depends on your configuration

// Auth models and accessors can be moved into own file?
// so that routes.* can access them separately from everything!

// NOTE: all models automically have a default 'id' field that's an AutoIncrement

/**
 * Token Models
 */
/** userToken storage model */
var userTokenModel = schemaToken.define('userToken', {
  userid: { type: Number, index: true },
  client_id: { type: String, length: 32, index: true },
  /** comma separate list of scopes. Available scopes:
    'basic','stream','write_post','follow','update_profile','public_messages','messages','files' */
  scopes: { type: String, length: 255 },
  token: { type: String, length: 98, index: true },
});
// scopes 'public_messages','messages','files':*
// but we can be multiple, not just one...
//userTokenModel.validatesInclusionOf('scopes', { in: ['basic','stream','write_post','follow','update_profile','public_messages','messages','files']});
userTokenModel.validatesUniquenessOf('token', { message:'token is not unique'});
//userTokenModel.validatesUniquenessOf(['userid','client_id'], { message:'user/client is not unique'});

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

/** client storage model */
var clientModel = schemaData.define('Client', {
  client_id: { type: String, limit: 32, index: true }, // probably should be client_id
  secret: { type: String, limit: 32 },
  userid: { type: Number },
  name: { type: String, limit: 255 },
  link: { type: String, limit: 255 }
});
clientModel.validatesUniquenessOf('client_id', {message:'client_id is not unique'});

/** user storage model */
var userModel = schemaData.define('User', {
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
  created_at: { type: Date, index: true },
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
  writers: { type: schemaData.Text }, // comma separate list
  editors: { type: schemaData.Text }, // comma separate list
  created_at: { type: Date }, // created_at isn't in the API
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
  created_at: { type: Date, index: true },
});

/** subscription storage model */
var subscriptionModel = schemaData.define('subscriptions', {
  channelid: { type: Number, index: true },
  userid: { type: Number, index: true },
  created_at: { type: Date, index: true },
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
  created_at: { type: Date, index: true }, // or this
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
var starModel = schemaData.define('star', {
  userid: { type: Number, index: true },
  created_at: { type: Date, index: true },
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
});


/** file storage model */
var fileModel = schemaData.define('file', {
  /* API START */
  userid: { type: Number, index: true },
  client_id: { type: String, length: 32 },
  kind: { type: String, length: 255, index: true },
  name: { type: String, length: 255 },
  type: { type: Number, index: true }, // com.example.test
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

/** minutely status report */
// @todo name function and call it on startup
var statusmonitor=function () {
  var ts=new Date().getTime();
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
  rec.isValid(function(valid) {
    if (valid) {
      model.create(rec, function(err) {
        if (err) {
          console.log(typeof(model)+" insert Error ", err);
        }
        if (callback) {
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
function setparams(query, params, maxid, callback) {
  // what if we want all, how do we ask for that if not zero?
  //if (!params.count) params.count=20;
  // can't set API defaults here because the dispatch may operate outside the API limits
  // i.e. the dispatch may want all records (Need example, well was getUserPosts of getInteractions)
  console.log('into setparams from',params.since_id,'to',params.before_id,'for',params.count);

  // general guard
  if (maxid<20) {
    // by default downloads the last 20 posts from the id passed in
    // so use 20 so we don't go negative
    // FIXME: change to scoping in params adjustment
    maxid=20;
  }
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
  query=query.order(idfield, 'DESC').limit(params.count);

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
  console.log('from',params.since_id,'to',params.before_id,'should be a count of',params.count,'test',params.before_id-params.since_id);
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
  if (params.since_id) {
    query=query.gte(idfield, params.since_id);
  }
  if (params.before_id) {
    query=query.lte(idfield, params.before_id);
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
  var min_id=maxid+200,max_id=0;
  query.run({},function(err, objects) {
    //console.log('got',posts.length);
    // generate meta, find min/max in set
    for(var i in objects) {
      var obj=objects[i];
      if (obj[idfield]) {
        min_id=Math.min(min_id,obj[idfield]);
        max_id=Math.max(max_id,obj[idfield]);
      }
    }
    // if got less than what we requested, we may not have it cached
    console.log('dataaccess.caminte.js::setparams query got',objects.length,'range:',min_id,'to',max_id,'more:',objects.length==params.count);
    var imeta={
      code: 200,
      min_id: min_id,
      max_id: max_id,
      more: objects.length==params.count
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
    userModel.findOrCreate({ id: iuser.id }, iuser, function(err, user) {
      if (callback) callback(user,err);
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
      callback(null,'dataaccess.caminte.js::getUserID() - username was not set');
      return;
    }
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
      callback(null, 'dataaccess.caminte.js:getUser - userid is undefined');
      return;
    }
    if (!userid) {
      callback(null, 'dataaccess.caminte.js:getUser - userid isn\'t set');
      return;
    }
    if (callback==undefined) {
      callback(null, 'dataaccess.caminte.js:getUser - callback is undefined');
      return;
    }
    var ref=this;
    db_get(userid, userModel, function(user, err) {
      if (user==null && err==null) {
        if (ref.next) {
          ref.next.getUser(userid, callback);
          return;
        }
      }
      callback(user, err);
    });
  },
  /*
   * local user token
   */
  // should we really pass token in? it's cleaner separation if we do
  // even though this is the only implemention of the abstraction
  addAPIUserToken: function(userid, client_id, scopes, token, callback) {
    // does this user already have a token?
    userTokenModel.findOne({ where: { userid: userid, client_id: client_id }}, function(err, usertoken) {
      if (usertoken==null) {
        var usertoken=new userTokenModel;
        usertoken.userid=userid;
        usertoken.client_id=client_id;
        usertoken.scopes=scopes;
        usertoken.token=token;
        // this will call callback if set
        db_insert(usertoken, userTokenModel, callback);
      } else {
        console.log('Already have token');
        // check scopes
        // do we auto upgrade scopes?
        // probably should just fail
        if (callback) {
          callback(usertoken, 'Already have token');
        }
      }
    });
    // if this is local, no need to chain
    /*
    if (this.next) {
      this.next.addAPIUserToken(userid, client_id, scopes, token, callback);
    }
    */
  },
  delAPIUserToken: function(token, callback) {
    userTokenModel.findOne({ where: { token: token }}, function(err, usertoken) {
      db_delete(usertoken.id, userTokenModel, callback);
    });
  },
  getAPIUserToken: function(token, callback) {
    //console.log('dataaccess.camintejs.js::getAPIUserToken - Token: ',token);
    if (token==undefined) {
      console.log('dataaccess.camintejs.js::getAPIUserToken - Token not defined');
      // we shouldn't need to return here
      // why doesn't mysql handle this right? bad driver
      callback(null, 'token undefined');
      return;
    }
    userTokenModel.findOne({ where: { token: token }}, function(err, usertoken) {
      //console.log('dataaccess.camintejs.js::getAPIUserToken - err',err,'usertoken',usertoken);
      callback(usertoken, err);
    });
  },
  /*
   * user upstream tokens
   */
  setUpstreamUserToken: function(userid, token, scopes, upstreamUserId, callback) {
    // does this user exist
    userModel.findOne({ where: { userid: userid }}, function(err, user) {
      if (err) {
      } else {
        user.upstream_token=token;
        user.upstream_scopes=scopes;
        user.upstream_userid=upstreamUserId;
        user.save();
      }
      if (callback) {
        callback(user, err);
      }
    });
  },
  delUpstreamUserToken: function(token) {
    console.log('dataaccess.camintejs.js::delUpstreamUserToken - write me!');
  },
  getUpstreamUserToken: function(userid) {
    // does this user exist
    userModel.findOne({ where: { userid: userid }}, function(err, user) {
      if (err) {
      } else {
      }
      if (callback) {
        callback(user, err);
      }
    });

    console.log('dataaccess.camintejs.js::getUpstreamUserToken - write me!');
  },
  /*
   * local clients
   */
  addLocalClient: function(userid, callback) {
    var client=new localClientModel;
    client.client_id=generateUUID(32);
    client.secret=generateUUID(32);
    client.userid=userid;
    db_insert(client, localClientModel, callback);
  },
  getLocalClient: function(client_id, callback) {
    clientModel.findOne({ where: {client_id: client_id} }, function(err, client) {
      callback(client, err);
    });
  },
  delLocalClient: function(client_id, callback) {
    clientModel.findOne({ where: {client_id: client_id} }, function(err, client) {
      db_delete(client.id, clientModel, callback);
    });
  },
  /*
   * clients
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
      callback(client,err);
    });
  },
  setSource: function(source, callback) {
    clientModel.findOrCreate({
      client_id: source.client_id
    }, {
      name: source.name,
      link: source.link
    }, function(err, client) {
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
  addPost: function(ipost, token, callback) {
    // if we local commit, do we also want to relay it upstream?
    if (this.next) {
      this.next.addPost(ipost, token, callback);
    }
  },
  // requires that we have an id
  setPost:  function(ipost, callback) {
    /*
    delete ipost.source;
    delete ipost.user;
    delete ipost.annotations;
    delete ipost.entities;
    */
    if (ipost.repost_of) {
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
        db_insert(notice, noticeModel);
      });
    }

    // oh these suck the worst!
    postModel.findOrCreate({
      id: ipost.id
    }, ipost, function(err, post) {
      if (callback) {
        callback(post, err);
      }
    });
    //db_insert(new postModel(ipost), postModel, callback);
    // maybe call to check garbage collection?
  },
  addRepost: function(postid, token, callback) {
    if (this.next) {
      this.next.addRepost(postid, token, callback);
    } else {
      console.log('dataaccess.base.js::addRepost - write me!');
      callback(null, null);
    }
  },
  delRepost: function(postid, token, callback) {
    if (this.next) {
      this.next.delRepost(postid, token, callback);
    } else {
      console.log('dataaccess.base.js::delRepost - write me!');
      callback(null, null);
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
  getReposts: function(postid, params, token, callback) {
    var ref=this;
    // needs to also to see if we definitely don't have any
    postModel.all({ where: { repost_of: postid } }, function(err, posts) {
      // what if it just doesn't have any, how do we store that?
      if ((posts==null || posts.length==0) && err==null) {
        // before we hit proxy, check empties
        // if there is one, there should only ever be one
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
        callback(posts, err);
      }
    });
  },
  getReplies: function(postid, params, token, callback) {
    //console.log('dataaccess.caminte.js::getReplies - id is '+postid);
    var ref=this;
    // thread_id or reply_to?
    postModel.find({ where: { thread_id: postid}, limit: params.count }, function(err, posts) {
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
  getUserStream: function(user, params, token, callback) {
    var ref=this;
    var finalfunc=function(userid) {
      // get a list of followings
      followModel.find({ where: { active: 1, userid: user } }, function(err, follows) {
        //console.log('dataaccess.caminte.js::getUserStream - got '+follows.length+' for user '+user);
        if (err==null && follows!=null && follows.length==0) {
          //console.log('User follows no one?');
          if (ref.next) {
            //console.log('check upstream');
            ref.next.getUserStream(user, params, token, callback);
            return;
          }
          callback([], null);
        } else {
          // we have some followings
          // for each following
          var userids=[];
          for(var i in follows) {
            // follow.followsid
            userids.push(follows[i].followsid);
          }
          // get a list of their posts
          console.log('dataaccess.caminte.js::getUserStream - getting posts for '+userids.length+' users');
          // could use this to proxy missing posts
          // what about since_id??
          var maxid=0;
          postModel.all({ order: 'id DESC', limit: 1}, function(err, posts) {
            if (posts.length) {
              maxid=posts[0].id;
            }
            setparams(postModel.find().where('userid',{ in: userids }), params, maxid, callback);
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
        }
      });
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
  },
  getUnifiedStream: function(user, params, token, callback) {
    var ref=this;
    var finalfunc=function(userid) {
      // get a list of followers
      followModel.find({ where: { active: 1, userid: user } }, function(err, follows) {
        //console.log('dataaccess.caminte.js::getUserStream - got '+follows.length+' for user '+user);
        if (err==null && follows!=null && follows.length==0) {
          //console.log('User follows no one?');
          if (ref.next) {
            //console.log('check upstream');
            ref.next.getUserStream(user, params, token, callback);
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
          // WRITE ME
          console.log('dataaccess.caminte.js::getUnifiedStream - write me, mention posts');
          // get the list of posts from followings and mentions
          //console.log('dataaccess.caminte.js::getUserStream - getting posts for '+userids.length+' users');
          // could use this to proxy missing posts
          postModel.find({ where: { userid: { in: userids } }, order: 'created_at DESC', limit: 20 }, function(err, posts) {
            if (err) {
              console.log('dataaccess.caminte.js::getUnifiedStream - post find err',err);
              callback([], err);
            } else {
              //console.log('Found '+posts.length+' posts',err);
              callback(posts, null);
            }
          })
        }
      });
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
  },
  getUserPosts: function(user, params, callback) {
    var ref=this;
    /*
    postModel.find({ where: { userid: userid}, order: "id asc", limit: 1}, function(err, posts) {
      console.log('First User '+userid+' Post '+posts[0].id);
    });
    postModel.find({ where: { userid: userid}, order: "id desc", limit: 1}, function(err, posts) {
      console.log('Last User '+userid+' Post '+posts[0].id);
    });
    */
    var search={};
    if (user[0]=='@') {
      // uhm I don't think posts has a username field...
      search.username=user.substr(1);
    } else {
      search.userid=user;
    }
    postModel.find({ where: search, limit: params.count }, function(err, posts) {
      if (err==null && posts==null) {
        if (ref.next) {
          ref.next.getUserPosts(user, params, callback);
          return;
        }
      }
      callback(posts, err);
    });
  },
  getMentions: function(user, params, callback) {
    var ref=this;
    var search={ idtype: 'post', type: 'mention' };
    var k='',v='';
    if (user[0]=='@') {
      search.text=user.substr(1);
      k='text'; v=user.substr(1);
    } else {
      search.alt=user;
      k='alt'; v=user;
    }
    var count=params.count;
    console.log('mention/entity search for ',search);
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
    entityModel.all({ order: 'typeid DESC', limit: 1}, function(err, entities) {
      //console.log('dataaccess.caminte.js::getMentions - back',posts);
      if (entities.length) {
        maxid=entities[0].typeid;
      }
      //maxid=post.id;
      //if (maxid<20) {
        // by default downloads the last 20 posts from the id passed in
        // so use 20 so we don't go negative
        // FIXME: change to scoping in params adjustment
        //maxid=20;
      //}
      //console.log('maxid',maxid);
      // this didn't work
      //setparams(entityModel.find().where(search), params, maxid, callback);
      // this gave error
      setparams(entityModel.find(search), params, maxid, callback);
    });
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
    postModel.all({ order: 'id DESC', limit: 1 }, function(err, posts) {
      //console.log('getGlobal - posts',posts);
      if (posts.length) {
        maxid=posts[0].id;
        //console.log('getGlobal - maxid becomes',maxid);
      }
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
    });
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
          {"url":"/posts/stream/explore/checkins", "description":"App.net users in interesting places", "slug":"checkins", "title":"Checkins"}
        ]
      };
      callback(res.data, null, res.meta);
    }
  },
  getExploreFeed: function(feed, params, callback) {
    if (this.next) {
      this.next.getExploreFeed(feed, params, callback);
    } else {
      console.log('dataaccess.caminte.js::getExploreFeed - write me!');
      callback(null, null, null);
    }
  },
  /** channels */
  setChannel: function (chnl, ts, callback) {
    // created_at vs last_update
    channelModel.findOrCreate({
      id: chnl.id
    }, chnl, function(err, ochnl) {
      if (callback) {
        callback(ochnl, err);
      }
    });
  },
  getChannel: function(id, callback) {
    if (id==undefined) {
      callback(null, 'dataaccess.caminte.js::getChannel - id is undefined');
      return;
    }
    var ref=this;
    db_get(id, channelModel, function(channel, err) {
      if (channel==null && err==null) {
        if (ref.next) {
          ref.next.getChannel(id, callback);
          return;
        }
      }
      callback(channel, err);
    });  },
  /** messages */
  setMessage: function (msg, callback) {
    // If a Message has been deleted, the text, html, and entities properties will be empty and may be omitted.
    messageModel.findOrCreate({
      id: msg.id
    }, msg, function(err, omsg) {
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
    messageModel.find({ where: { channel_id: channelid } }, function(err, messages) {
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
  setSubscription: function (chnlid, userid, del, ts, callback) {
    subscriptionModel.findOrCreate({
      id: msg.id
    }, msg, function(err, omsg) {
      if (callback) {
        callback(omsg, err);
      }
    });
  },
  getUserSubscriptions: function(userid, params, callback) {
    if (id==undefined) {
      callback(null,'dataaccess.caminte.js::getUserSubscriptions - id is undefined');
      return;
    }
    if (this.next) {
      this.next.getUserSubscriptions(userid, params, callback);
      return;
    }
    callback(null, null);
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
  setFile: function(file, del, ts, callback) {
    if (del) {
      db_delete(file.id, fileModel, callback);
    } else {
      fileModel.findOrCreate({
        id: file.id
      },file, function(err, ofile) {
        if (callback) {
          callback(ofile, err);
        }
      });
    }
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
    entityModel.find({ where: { type: 'hashtag', text: hashtag }, order: 'typeid' }, function(err, entities) {
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
    annotationModel.find({where: { idtype: idtype, typeid: id }},function(err,oldAnnotations) {
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
  },
  getAnnotations: function(idtype, id, callback) {
    // Todo: implement this.next calling
    /*
    if (this.next) {
      this.next.getAnnotations(idtype, id, callback);
    }
    */
    annotationModel.find({where: { idtype: idtype, typeid: id }},function(err, annotations) {
      callback(annotations, err);
    });
  },
  /** follow */
  setFollow: function (srcid, trgid, id, del, ts, callback) {
    // FIXME: ORM issues here...
    // create vs update fields?
    if (srcid && trgid) {

      // do notify
      // could guard but then we'd need more indexes
      // i think we'll be ok if we don't guard for now
      //noticeModel.noticeModel( { where: { created_at: ts, type: type } }, function(err, notify)
      //
      notice=new noticeModel();
      notice.event_date=ts;
      notice.notifyuserid=trgid; // who should be notified
      notice.actionuserid=srcid; // who took an action
      notice.type='follow'; // star,repost,reply,follow
      notice.typeid=srcid; // postid(star,respot,reply),userid(follow)
      db_insert(notice, noticeModel);

      console.log('setFollow active test',del?0:1,'del',del);
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
  getFollowing: function(userid, params, callback) {
    if (userid==undefined) {
      callback(null, 'dataaccess.caminte.js::getFollowing - userid is undefined');
      return;
    }
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
  // who is following this user
  getFollows: function(userid, params, callback) {
    if (userid==undefined) {
      callback(null, 'dataaccess.caminte.js::getFollows - userid is undefined');
      return;
    }
    followModel.find({ where: { followsid: userid }, limit: params.count, order: "last_updated DESC" }, function(err, followers) {
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
      console.log('dataaccess.caminte.js::addStar - write me!');
      callback(null, null);
    }
  },
  delStar: function(postid, token, callback) {
    if (this.next) {
      this.next.delStar(postid, token, callback);
    } else {
      console.log('dataaccess.caminte.js::delStar - write me!');
      callback(null, null);
    }
  },
  setInteraction: function(userid, postid, type, metaid, deleted, ts, callback) {
    // is there an existing match for this key (userid, postid, type)
    // wouldn't find or create be better here?
    var ref=this;
    interactionModel.find({ where: { userid: userid, typeid: postid, type: type } }, function(err,foundInteraction) {

      // ok star,repost
      //console.log('setInteraction - type',type);
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
          notice.notifyuserid=post.userid; // who should be notified
          notice.actionuserid=userid; // who took an action
          notice.type=type; // star,repost,reply,follow
          notice.typeid=postid; // postid(star,respot,reply),userid(follow)
          //notice.asthisid=metaid;
          db_insert(notice, noticeModel);
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
      if (foundInteraction.id==null) {
        db_insert(interaction, interactionModel, callback);
      } else {
        console.log('setInteraction found dupe', foundInteraction, interaction);
      }
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
  getNotices: function(userid, params, callback) {
    //console.log('dataaccess.caminte.js::getNotices');
    noticeModel.find({ where: { notifyuserid: userid }, limit: params.count, order: "event_date DESC" }, function(err, notices) {
      //console.log('dataaccess.caminte.js::gotNotices');
      callback(notices, err);
    });
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
      interactionModel.find({ where: { userid: userid, type: type, idtype: 'post' }, limit: params.count }, function(err, interactions) {
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