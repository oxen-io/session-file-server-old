// http://www.camintejs.com / https://github.com/biggora/caminte
var Schema = require('caminte').Schema;

// caminte can support:  mysql, sqlite3, riak, postgres, couchdb, mongodb, redis, neo4j, firebird, rethinkdb, tingodb
// however AltAPI will officially support: sqlite, Redis or MySQL for long term storage
//
// @duerig wants Redis for long term storage
// however it requires the entire dataset to be in memory, so not all the network data
// could be store in it, unless you have 128gb+ of memory
//
// so MySQL is good alternative if you want a large dataset
// SQLite is a good incase the user doesn't want to install any extra software

// set up the (eventually configureable) model pools
// 6379 is default redis port number
var schemaData = new Schema('redis', {port: 6379}); //port number depends on your configuration

// Auth models and accessors can be moved into own file?
// so that routes.* can access them separately from everything!

// NOTE: all models automically have a default 'id' field that's an AutoIncrement

/*
 * Data Models
 */

// this data needs to not use internal Pks
// I'd like to be able to copy random tables from one server to another
// to help bootstrap caches

var clientModel = schemaData.define('Client', {
  client_id: { type: String, limit: 32, index: true }, // probably should be client_id
  secret: { type: String, limit: 32 },
  userid: { type: Number },
  name: { type: String, limit: 255 },
  link: { type: String, limit: 255 }
});
clientModel.validatesUniquenessOf('client_id', {message:'client_id is not unique'});

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

var postModel = schemaData.define('post', {
  userid: { type: Number, index: true },
  text: { type: schemaData.Text },
  html: { type: schemaData.Text }, /* cache */
  machine_only: { type: Boolean, default: false, index: true },
  reply_to: { type: Number }, // kind of want to index this
  thread_id: { type: Number, index: true },
  is_deleted: { type: Boolean, default: false, index: true },
  created_at: { type: Date, index: true },
  client_id: { type: String, length: 32, index: true },
  repost_of: { type: Number, default: 0, index: true },
  canonical_url: { type: String },
  num_replies: { type: Number, default: 0 },
  num_reposts: { type: Number, default: 0 },
  num_stars: { type: Number, default: 0 }
});

// total cache table, we'll have an option to omitted its use
// though we need it for hashtag look ups
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

var annotationModel = schemaData.define('annotation', {
  idtype: { type: String, index: true }, // user, post, channel, message
  typeid: { type: Number, index: true }, // causing problems?
  type: { type: String, length: 255, index: true },
  value:  { type: schemaData.JSON },
});

// maybe not needed with JSON type
var annotationValuesModel = schemaData.define('annotationvalues', {
  annotationid: { type: Number, index: true },
  key: { type: String, length: 255, index: true },
  value: { type: schemaData.Text }, // kind of want to index this
  memberof: { type: Number, index: true }
});

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

var subscriptionModel = schemaData.define('subscriptions', {
  channelid: { type: Number, index: true },
  userid: { type: Number, index: true },
  created_at: { type: Date, index: true },
  active: { type: Boolean, index: true },
  last_updated: { type: Date },
});

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
var interactionModel = schemaData.define('interaction', {
  userid: { type: Number, index: true },
  type: { type: String, length: 8, index: true }, // star,unstar,repost,unrepost
  datetime: { type: Date },
  idtype: { type: String, index: true }, // post (what about chnl,msg,user? not for existing types)
  typeid: { type: Number, index: true }, // causing problems?
  asthisid: { type: Number } // meta.id
});

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

// Auth Todo: localUser, localClient
// Token Todo: userToken, appToken
// Rate Todo: userTokenLimit, appTokenLimit
// Data Todo: mutes, blocks, upstream_tokens

// minutely status report
setInterval(function () {
  var ts=new Date().getTime();
  userModel.count({},function(err,userCount) {
    followModel.count({},function(err,followCount) {
      postModel.count({},function(err,postCount) {
        channelModel.count({},function(err,channelCount) {
          messageModel.count({},function(err,messageCount) {
            subscriptionModel.count({},function(err,subscriptionCount) {
              interactionModel.count({},function(err,interactionCount) {
                annotationModel.count({},function(err,annotationCount) {
                  entityModel.count({},function(err,entityCount) {
                    // break so the line stands out from the instant updates
                    // dispatcher's output handles this for now
                    //process.stdout.write("\n");
                    // if using redis
                    if (1) {
                      //console.dir(schemaAuth.client.server_info);
                      // just need a redis info call to pull memory and keys stats
                      // evicted_keys, expired_keys are interesting, keyspace_hits/misses
                      // total_commands_proccesed, total_connections_received, connected_clients
                      // update internal counters
                      schemaData.client.info(function(err,res) {
                        schemaData.client.on_info_cmd(err,res);
                      });
                      // then pull from counters
                      console.log("persistence redis "+schemaData.client.server_info.used_memory_human+" "+schemaData.client.server_info.db0);
                    }
                    console.log('persistence '+userCount+'U '+followCount+'F '+postCount+'P '+channelCount+'C '+messageCount+'M '+subscriptionCount+'s '+interactionCount+'i '+annotationCount+'a '+entityCount+'e');
                  });
                });
              });
            });
          });
        });
      });
    });
  });
},60*1000);



// cheat macros
function db_insert(rec,model,callback) {
  rec.isValid(function(valid) {
    if (valid) {
      model.create(rec, function(err) {
        if (err) {
          console.log(typeof(model)+" insert Error ",err);
        }
        if (callback) {
          if (rec.id) {
            // why don't we just return the entire record
            // that way we can get access to fields we don't have a getter for
            // or are generated on insert
            callback(rec,err);
          } else {
            callback(null,err);
          }
        }
      });
    } else {
      console.log(typeof(model)+" validation failure");
      console.dir(rec.errors);
      if (callback) {
        // can we tell the different between string and array?
        callback(null,rec.errors);
      }
    }
  });
}
// these macros mainly flip the callback to be consistent
function db_delete(id,model,callback) {
  model.destroyById(id,function(err,rec) {
    if (err) {
      console.log("delUser Error ",err);
    }
    if (callback) {
      callback(rec,err);
    }
  });
}
function db_get(id, model, callback) {
  model.findById(id, function(err, rec) {
    if (err) {
      console.log("db_get Error ",err);
    }
    // this one is likely not optional...
    //if (callback) {
    callback(rec, err);
    //}
  });
}

// we need to know if we have upstreaming enabled
module.exports = {
  next: null,
  /*
   * users
   */
  addUser: function(username, password, callback) {
    if (this.next) {
      this.next.addUser(username,password,callback);
    } else {
      if (callback) {
        callback(null, null);
      }
    }
  },
  setUser: function(iuser, ts, callback) {
    // FIXME: check ts against last_update to make sure it's newer info than we have
    // since we have cached fields
    userModel.findOrCreate({ id: iuser.id }, iuser, function(err,user) {
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
      callback(user,err);
    });
  },
  // callback is user,err,meta
  getUser: function(userid, callback) {
    if (userid==undefined) {
      callback(null,'dataaccess.caminte.js:getUser - userid is undefined');
      return;
    }
    if (!userid) {
      callback(null,'dataaccess.caminte.js:getUser - userid isn\'t set');
      return;
    }
    if (callback==undefined) {
      callback(null,'dataaccess.caminte.js:getUser - callback is undefined');
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
    if (this.next) {
      this.next.addAPIUserToken(userid, client_id, scopes, token, callback);
    }
  },
  delAPIUserToken: function(token, callback) {
    if (this.next) {
      this.next.delAPIUserToken(token, callback);
    }
  },
  getAPIUserToken: function(token, callback) {
    if (this.next) {
      this.next.getAPIUserToken(token, callback);
    }
  },
  /*
   * user upstream tokens
   */
  setUpstreamUserToken: function(userid, token, scopes, upstreamUserId, callback) {
    if (this.next) {
      this.next.setUpstreamUserToken(userid, token, scopes, upstreamUserId, callback);
    }
  },
  /*
   * local clients
   */
  addLocalClient: function(userid, callback) {
    if (this.next) {
      this.next.addLocalClient(userid, callback);
    }
  },
  getLocalClient: function(client_id, callback) {
    if (this.next) {
      this.next.getLocalClient(client_id, callback);
    }
  },
  delLocalClient: function(client_id,callback) {
    if (this.next) {
      this.next.delLocalClient(client_id, callback);
    }
  },
  /*
   * clients
   */
  addSource: function(client_id, name, link, callback) {
    if (this.next) {
      this.next.addSource(client_id, name, link, callback);
    }
  },
  getClient: function(client_id, callback) {
    clientModel.findOne({ where: {client_id: client_id} }, function(err, client) {
      callback(client,err);
    });
  },
  setSource: function(source, callback) {
    clientModel.findOrCreate({
      client_id: source.client_id
    },{
      name: source.name,
      link: source.link
    },function(err,client) {
      callback(client,err);
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
  addPost: function(ipost, callback) {
    if (this.next) {
      this.next.addPost(ipost, callback);
    }
  },
  setPost:  function(ipost, callback) {
    // oh these suck the worst!
    postModel.findOrCreate({
      id: ipost.id
    }, ipost, function(err,post) {
      if (callback) {
        callback(post,err);
      }
    });
    //db_insert(new postModel(ipost), postModel, callback);
    // maybe call to check garbage collection?
  },
  getPost: function(id, callback) {
    //console.log('dataaccess.caminte.js::getPost - id is '+id);
    if (id==undefined) {
      callback(null,'dataaccess.caminte.js::getPost - id is undefined');
      return;
    }
    var ref=this;
    db_get(id, postModel, function(post,err) {
      //console.log('dataaccess.caminte.js::getPost - post, err',post,err);
      if (post==null && err==null) {
        //console.log('dataaccess.caminte.js::getPost - next?',ref.next);
        if (ref.next) {
          //console.log('dataaccess.caminte.js::getPost - next');
          ref.next.getPost(id, callback);
          return;
        }
      }
      callback(post,err);
    });
  },
  getUserPosts: function(userid, params, callback) {
    var ref=this;
    postModel.find({ where: { userid: userid} }, function(err, posts) {
      if (err==null && posts==null) {
        if (ref.next) {
          ref.next.getUserPosts(userid, params, callback);
          return;
        }
      }
      callback(posts,err);
    });
  },
  getGlobal: function(params, callback) {
    var ref=this;
    //console.dir(params);
    // make sure count is positive
    var count=Math.abs(params.count);
    var maxid=null;
    postModel.find().order('id','DESC').limit(1).run({},function(err,posts) {
      maxid=posts[0].id;
      //console.log('max post id in data store is '+maxid);
      
      if (params.before_id) {
        if (!params.since_id) {
          params.since_id=Math.max(params.before_id-count,0);
        }
      } else if (params.since_id) {
        // no before but we have since
        // it's maxid+1 because before_id is exclusive
        params.before_id=Math.min(params.since_id+count,maxid+1);
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
            if (posts.length==inlist.length) {
              // if negative count, we need to reverse the results
              if (params.count<0) {
                posts.reverse();
              }
              /*
              for(var i in posts) {
                var post=posts[i];
                console.log('got '+post.id);
              }
              */
              callback(posts, null, meta);
            }
          });
        }, ref);
      } else {
        callback([], null, meta);
      }
    });
  },
  /** channels */
  setChannel: function (chnl, ts, callback) {
    // created_at vs last_update
    channelModel.findOrCreate({
      id: chnl.id
    }, chnl, function(err,ochnl) {
      if (callback) {
        callback(ochnl,err);
      }
    });
  },
  getChannel: function(id, callback) {
    if (id==undefined) {
      callback(null,'dataaccess.caminte.js::getChannel - id is undefined');
      return;
    }
    var ref=this;
    db_get(id,channelModel,function(channel,err) {
      if (channel==null && err==null) {
        if (ref.next) {
          ref.next.getChannel(id, callback);
          return;
        }
      }
      callback(channel,err);
    });  },
  /** messages */
  setMessage: function (msg, callback) {
    // If a Message has been deleted, the text, html, and entities properties will be empty and may be omitted.
    messageModel.findOrCreate({
      id: msg.id
    }, msg, function(err,omsg) {
      if (callback) {
        callback(omsg,err);
      }
    });
  },
  getMessage: function(id, callback) {
    if (id==undefined) {
      callback(null,'dataaccess.caminte.js::getMessage - id is undefined');
      return;
    }
    var ref=this;
    db_get(id,messageModel,function(message,err) {
      if (message==null && err==null) {
        if (ref.next) {
          ref.next.getMessage(id, callback);
          return;
        }
      }
      callback(message,err);
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
    }, msg, function(err,omsg) {
      if (callback) {
        callback(omsg,err);
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
    callback(null,null);
  },
  getChannelSubscriptions: function(channelid, params, callback) {
    if (id==undefined) {
      callback(null,'dataaccess.caminte.js::getChannelSubscriptions - id is undefined');
      return;
    }
    if (this.next) {
      this.next.getChannelSubscriptions(channelid, params, callback);
      return;
    }
    callback(null,null);
  },
  /** files */
  setFile: function(file, del, ts, callback) {
    if (del) {
      db_delete(file.id,fileModel,callback);
    } else {
      fileModel.findOrCreate({
        id: file.id
      },file, function(err,ofile) {
        if (callback) {
          callback(ofile,err);
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
    // delete (type & idtype & id)
    entityModel.find({where: { idtype: type, typeid: id, type: entitytype }},function(err,oldEntities) {
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
          entityModel.destroyById(oldEntity.id,function(err) {
            if (err) {
              console.log('couldn\'t destory old entity ',err);
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
        entity=new entityModel(entities[i]);
        entity.typeid=id;
        entity.idtype=type;
        entity.type=entitytype;
        entity.text=entities[i].name?entities[i].name:entities[i].text;
        entity.alt=entities[i].url?entities[i].url:entities[i].id;
        entity.altnum=entities[i].is_leading?entities[i].is_leading:entities[i].amended_len;
        //console.log('Insert entity '+entitytype+' #'+i+' '+type);
        db_insert(entity,entityModel);
      }
      if (callback) {
        callback(null,null);
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
          //console.log('et '+entity.type);
          if (res[entity.type+'s']) {
            res[entity.type+'s'].push(entities[i]);
          } else {
            console.log('getEntities unknown type '+entity.type+' for '+type+' '+id);
          }
        }
      }
      callback(res,null);
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
      callback(entities,err);
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
    db_insert(note,annotationModel,callback);
  },
  clearAnnotations: function(idtype, id, callback) {
    annotationModel.find({where: { idtype: idtype, typeid: id }},function(err,oldAnnotations) {
      for(var i in oldAnnotations) {
        var oldNote=oldAnnotations[i];
        // causes TypeError: Cannot read property 'constructor' of null
        // when using by id... ah I see wrong type of id...
        if (oldNote.id) {
          annotationModel.destroyById(oldNote.id,function(err) {
            if (err) {
              console.log('couldn\'t destory old annotation ',err);
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
    annotationModel.find({where: { idtype: idtype, typeid: id }},function(err,annotations) {
      callback(annotations,err);
    });
  },
  /** follow */
  setFollow: function (srcid, trgid, id, del, ts, callback) {
    // FIXME: ORM issues here...
    // create vs update fields?
    if (srcid && trgid) {
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
      }, function(err,users) {
        if (callback) {
          callback(users,err);
        }
      });
    } else {
      // FIXME: write me
      // search by referenceid, likely delete it
      console.log('dataaccess.caminte.js::setFollow - no data, write me... deleted? '+del);
      if (callback) {
        callback(null,null);
      }
    }
    // find (id and status, dates)
    // update or insert
  },
  getFollows: function(userid, params, callback) {
    if (id==undefined) {
      callback(null,'dataaccess.caminte.js::getFollows - userid is undefined');
      return;
    }
    if (this.next) {
      this.next.getFollows(userid, params, callback);
      return;
    }
    callback(null, null);
  },
  /** Star/Interactions */
  setInteraction: function(userid, postid, type, metaid, deleted, ts, callback) {
    // is there an existing match for this key (userid,postid,type)
    interactionModel.find({ where: { userid: userid, typeid: postid, type: type } },function(err,foundInteraction) {
      // is this new action newer
      interaction=new interactionModel();
      interaction.userid=userid;
      interaction.type=type;
      interaction.datetime=ts;
      interaction.idtype='post';
      interaction.typeid=postid;
      interaction.asthisid=metaid;
      if (foundInteraction.id==null) {
        db_insert(interaction,interactionModel,callback);
      } else {
        console.log('setInteraction found dupe',foundInteraction,interaction);
      }
    });
  },
  // getUserInteractions, remember reposts are stored here too
  // if we're going to use one table, let's keep the code advantages from that
  // getUserStarPosts
  getInteractions: function(type, userid, params, callback) {
    //console.log('Getting '+type+' for '+userid);
    var ref=this;
    interactionModel.find({ where: { userid: userid, type: type, idtype: 'post' } },function(err, interactions) {
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
      callback(interactions,err);
    });
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