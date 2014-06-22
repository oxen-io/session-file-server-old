/**
 * Dispatcher is an internal front-facing API for all functions and services
 *
 * "Dialects" will call these functions to the data-access chain to store/retrieve data and format 
 * responses in standard way.
 */

module.exports = {
  /** posts */
  setPost: function(post,callback) {
    console.log('dispatcher.js::setPost - write me!');
    callback(null,null);
  },
  getPost: function(id,callback,params) {
    console.log('dispatcher.js::getPost - write me!');
    callback(null,null);
  },
  getGlobal: function(callback,params) {
    console.log('dispatcher.js::getGlobal - write me!');
    callback(null,null);
  },
  getUserPosts: function(userid,callback,params) {
    console.log('dispatcher.js::getUserPosts - write me!');
    callback(null,null);
  },
  getUserStars: function(userid,callback,params) {
    console.log('dispatcher.js::getUserStars - write me!');
    callback(null,null);
  },
  getHashtag: function(hashtag,callback,params) {
    console.log('dispatcher.js::getHashtag - write me!');
    callback(null,null);
  },
  /** channels */
  setChannel: function(json,ts,callback) {
    console.log('dispatcher.js::setChannel - write me!');
    callback(null,null);
  },
  getChannel: function(id,callback,params) {
    console.log('dispatcher.js::getChannel - write me!');
    callback(null,null);
  },
  /** messages */
  setMessage: function(json,ts) {
    console.log('dispatcher.js::setMessage - write me!');
  },
  getChannelMessages: function(cid,callback,params) {
    console.log('dispatcher.js::getChannelMessages - write me!');
    callback(null,null);
  },
  getChannelMessage: function(cid,mids,callback,params) {
    console.log('dispatcher.js::getChannelMessage - write me!');
    callback(null,null);
  },
  /** channel_subscription */
  setChannelSubscription: function(data, deleted, ts, callback) {
    console.log('dispatcher.js::setChannelSubscription - write me!');
    callback(null,null);
  },
  /** stream_marker */
  setStreamMakerdata: function(data) {
    console.log('dispatcher.js::setStreamMakerdata - write me!');
  },
  /** token */
  /** star (interaction) */
  setStar: function(data,deleted,id,ts,callback) {
    console.log('dispatcher.js::setStar - write me!');
    callback(null,null);
  },
  /** mute */
  /** block */
  /** user */
  updateUser: function(data,ts,callback) {
    console.log('dispatcher.js::updateUser - write me!');
    callback(null,null);
  },
  getUser: function(id,callback,params) {
    console.log('dispatcher.js::getUser - write me!');
    callback(null,null);
  },
  /** user_follow */
  setFollows: function(data, deleted, id, ts) {
    console.log('dispatcher.js::setFollows - write me!');
  },
  /** files */
  getFile: function(fileid, callback, params) {
    console.log('dispatcher.js::getFile - write me!');
    callback(null,null);
  },
  setFile: function(data, deleted, id, ts, callback) {
    console.log('dispatcher.js::setFile - write me!');
    callback(null,null);
  },
  /** text process */
  textProcess: function(text,callback,entities,postcontext) {
    console.log('dispatcher.js::textProcess - write me!');
    callback(null,null);
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
        this.setChannel(data,meta.timestamp);
      break;
      case 'message':
        // meta.timestamp is important here for channels
        this.setMessage(data,meta.timestamp);
      break;
      case 'channel_subscription':
        this.setChannelSubscription(data,meta.is_deleted,meta.timestamp);
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
        this.setStar(data,meta.is_deleted,meta.id,meta.timestamp);
      break;
      case 'mute':
        console.log('mute');
      break;
      case 'block':
        console.log('block');
      break;
      case 'user':
        this.updateUser(data,meta.timestamp);
      break;
      case 'user_follow':
        if (data) {
          this.setFollows(data,meta.is_deleted,meta.id,meta.timestamp);
        }
      break;
      default:
        console.log("dispatcher.js::dispatch - unknown appstream type ["+meta.type+"]");
      break;
    }
  }
}