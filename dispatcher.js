/**
 * Dispatcher is an internal front-facing API for all functions and services
 *
 * "Dialects" will call these functions to the data-access chain to store/retrieve data and format 
 * responses in standard way.
 */

module.exports = {
  /** posts */
  setPost: function(post, callback) {
    console.log('dispatcher.js::setPost - write me!');
    if (callback) {
      callback(null, null);
    }
  },
  // convert DB format to API structure
  postToAPI: function(post,callback,meta) {
    console.log('dispatcher.js::postToAPI - write me!');
    callback(post, null);
  },
  getPost: function(id, params, callback) {
    // probably should just exception and backtrace
    if (callback==undefined) {
      console.log('dispatcher.js::getPost - callback undefined');
      return;
    }
    if (id==undefined) {
      callback(null,'dispatcher.js::getPost - id is undefined');
    }
    var ref=this;
    this.cache.getPost(id, function(post, err, meta) {
      ref.postToAPI(post, callback, meta)
    });
  },
  getGlobal: function(params, callback) {
    var ref=this;
    this.cache.getGlobal(function(posts,err) {
      // data is an array of entities
      var apiposts=[];
      //console.log('dispatcher.js:getGlobal - mapping '+posts.length);
      if (posts.length) {
        posts.map(function(current,idx,Arr) {
          //console.log('dispatcher.js:getGlobal - map postid: '+current.id);
          // get the post in API foromat
          ref.postToAPI(current,function(post,err,meta) {
            apiposts.push(post);
            // join
            //console.log(apiposts.length+'/'+entities.length);
            if (apiposts.length==posts.length) {
              //console.log('dispatcher.js::getGlobal - finishing');
              callback(apiposts);
            }
          });
        },ref);
      } else {
        // no posts
        callback(null,'no posts for global',meta);
      }
    });
  },
  getUserPosts: function(userid, params, callback) {
    var ref=this;
    this.cache.getUserPosts(userid, function(posts, err, meta) {
      // data is an array of entities
      var apiposts=[];
      //console.log('dispatcher.js:getGlobal - mapping '+posts.length);
      if (posts && posts.length) {
        posts.map(function(current,idx,Arr) {
          //console.log('dispatcher.js:getGlobal - map postid: '+current.id);
          // get the post in API foromat
          ref.postToAPI(current,function(post,err,meta) {
            apiposts.push(post);
            // join
            //console.log(apiposts.length+'/'+entities.length);
            if (apiposts.length==posts.length) {
              //console.log('dispatcher.js::getGlobal - finishing');
              callback(apiposts);
            }
          });
        },ref);
      } else {
        // no posts
        callback([],'no posts for global',meta);
      }
    });
  },
  getUserStars: function(userid, params, callback) {
    //console.log('dispatcher.js::getUserStars start');
    var ref=this;
    this.cache.getInteractions('star', userid, function(interactions, err, meta) {
      //console.log('dispatcher.js::getUserStars - ',interactions);
      // data is an array of interactions
      if (interactions.length) {
        var apiposts=[];
        interactions.map(function(current,idx,Arr) {
          // we're a hasMany, so in theory I should be able to do
          // record.posts({conds});
          // get the post in API foromat
          ref.getPost(current.typeid, null, function(post, err, meta) {
            apiposts.push(post);
            // join
            //console.log(apiposts.length+'/'+interactions.length);
            if (apiposts.length==interactions.length) {
              //console.log('dispatcher.js::getUserStars - finishing');
              callback(apiposts);
            }
          });
        });
      } else {
        callback(interactions, err, meta);
      }
    });
  },
  getHashtag: function(hashtag, params, callback) {
    var ref=this;
    //console.log('dispatcher.js:getHashtag - start #'+hashtag);
    this.cache.getHashtagEntities(hashtag,function(entities,err,meta) {
      // data is an array of entities
      var apiposts=[];
      //console.log('dispatcher.js:getHashtag - mapping '+entities.length);
      if (entities.length) {
        entities.map(function(current,idx,Arr) {
          // get the post in API foromat
          ref.getPost(current.typeid, null, function(post,err,meta) {
            apiposts.push(post);
            // join
            //console.log(apiposts.length+'/'+entities.length);
            if (apiposts.length==entities.length) {
              //console.log('dispatcher.js::getHashtag - finishing');
              callback(apiposts);
            }
          });
        },ref);
      } else {
        // no entities
        callback(null,'no entities for '+hashtag,meta);
      }
    });
  },
  /** channels */
  setChannel: function(json, ts, callback) {
    console.log('dispatcher.js::setChannel - write me!');
    callback(null, null);
  },
  getChannel: function(id, params, callback) {
    this.cache.getChannel(id, callback);
  },
  /** messages */
  setMessage: function(json, ts) {
    console.log('dispatcher.js::setMessage - write me!');
  },
  getChannelMessages: function(cid, params, callback) {
    this.cache.getChannelMessages(cid, callback);
  },
  getChannelMessage: function(cid, mids, params, callback) {
    console.log('dispatcher.js::getChannelMessage - write me!');
    callback(null, null);
  },
  /** channel_subscription */
  setChannelSubscription: function(data, deleted, ts, callback) {
    console.log('dispatcher.js::setChannelSubscription - write me!');
    callback(null, null);
  },
  /** stream_marker */
  setStreamMakerdata: function(data) {
    console.log('dispatcher.js::setStreamMakerdata - write me!');
  },
  /** token */
  /** star (interaction) */
  setStar: function(data, deleted, id, ts, callback) {
    console.log('dispatcher.js::setStar - write me!');
    callback(null, null);
  },
  /** mute */
  /** block */
  /** user */
  updateUser: function(data, ts, callback) {
    console.log('dispatcher.js::updateUser - write me!');
    callback(null, null);
  },
  userToAPI: function(user,callback,meta) {
    console.log('dispatcher.js::userToAPI - write me!');
    callback(user, null);
  },
  getUser: function(id, params, callback) {
    console.log('dispatcher.js::getUser - write me!');
    callback(null, null);
  },
  /** user_follow */
  setFollows: function(data, deleted, id, ts) {
    console.log('dispatcher.js::setFollows - write me!');
  },
  /** files */
  getFile: function(fileid, params, callback) {
    console.log('dispatcher.js::getFile - write me!');
    callback(null, null);
  },
  setFile: function(data, deleted, id, ts, callback) {
    console.log('dispatcher.js::setFile - write me!');
    callback(null, null);
  },
  /** text process */
  textProcess: function(text, entities, postcontext, callback) {
    console.log('dispatcher.js::textProcess - write me!');
    callback(null, null);
  },
  /** dispatcher for streamrouter */
  dispatch: function(userid, json) {
    // remember json is in app streaming format!
    //console.dir(json);
    var data=json.data;
    var meta=json.meta;
    // the missing meta is going to be an issue
    /*
     { meta:
       { suppress_notifications_all: false,
         timestamp: 1399812206341,
         type: 'post',
         id: '30224684',
         suppress_notifications: [] },
    */
    switch(meta.type) {
      case 'post':
        // transfer stream encoding over to normal post structure
        if (meta && meta.is_deleted) {
          if (data==undefined) data={};
          data.is_deleted=true;
        }
        if (data.id) {
          this.setPost(data);
        }
      break;
      case 'channel':
        this.setChannel(data, meta.timestamp);
      break;
      case 'message':
        // meta.timestamp is important here for channels
        this.setMessage(data, meta.timestamp);
      break;
      case 'channel_subscription':
        this.setChannelSubscription(data, meta.is_deleted, meta.timestamp);
      break;
      case 'file':
        console.log('file');
      break;
      case 'stream_marker':
        console.log('stream_marker');
      break;
      case 'token':
        console.log('token');
      break;
      case 'star':
        this.setStar(data, meta.is_deleted, meta.id, meta.timestamp);
      break;
      case 'mute':
        console.log('mute');
      break;
      case 'block':
        console.log('block');
      break;
      case 'user':
        this.updateUser(data, meta.timestamp);
      break;
      case 'user_follow':
        if (data) {
          this.setFollows(data, meta.is_deleted, meta.id, meta.timestamp);
        }
      break;
      default:
        console.log("dispatcher.js::dispatch - unknown appstream type ["+meta.type+"]");
      break;
    }
  }
}