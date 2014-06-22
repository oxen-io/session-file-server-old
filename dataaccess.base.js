// if next object is set, pass it through to next object
// otherwise end chain
module.exports = {
  next: null,
  /*
   * users
   */
  addUser: function(username, password, callback) {
    if (this.next) {
      this.next.addUser(username,password,callback);
    } else {
      console.log('dataaccess.base.js::addUser - write me!');
      callback(null, null);
    }
  },
  setUser: function(iuser, ts, callback) {
    if (this.next) {
      this.next.setUser(iuser, ts, callback);
    } else {
      console.log('dataaccess.base.js::setUser - write me!');
      callback(null, null);
    }
  },
  delUser: function(userid, callback) {
    if (this.next) {
      this.next.delUser(userid, callback);
    } else {
      console.log('dataaccess.base.js::delUser - write me!');
      callback(null, null);
    }
  },
  getUserID: function(username, callback) {
    if (this.next) {
      this.next.getUserID(username, callback);
    } else {
      console.log('dataaccess.base.js::getUserID - write me!');
      callback(null, null);
    }
  },
  // callback is user,err,meta
  getUser: function(userid, callback) {
    if (this.next) {
      this.next.getUser(username, callback);
    } else {
      console.log('dataaccess.base.js::getUser - write me!');
      callback(null, null);
    }
  },
  /*
   * local user token
   */
  // should we really pass token in? it's cleaner separation if we do
  // even though this is the only implemention of the abstraction
  addAPIUserToken: function(userid, client_id, scopes, token, callback) {
    if (this.next) {
      this.next.addAPIUserToken(userid, client_id, scopes, token, callback);
    } else {
      console.log('dataaccess.base.js::addAPIUserToken - write me!');
      callback(null, null);
    }
  },
  delAPIUserToken: function(token, callback) {
    if (this.next) {
      this.next.delAPIUserToken(token, callback);
    } else {
      console.log('dataaccess.base.js::delAPIUserToken - write me!');
      callback(null, null);
    }
  },
  getAPIUserToken: function(token, callback) {
    if (this.next) {
      this.next.getAPIUserToken(token, callback);
    } else {
      console.log('dataaccess.base.js::getAPIUserToken - write me!');
      callback(null, null);
    }
  },
  /*
   * user upstream tokens
   */
  setUpstreamUserToken: function(userid, token, scopes, upstreamUserId, callback) {
    if (this.next) {
      this.next.setUpstreamUserToken(userid, token, scopes, upstreamUserId, callback);
    } else {
      console.log('dataaccess.base.js::setUpstreamUserToken - write me!');
      callback(null, null);
    }
  },
  /*
   * local clients
   */
  addLocalClient: function(userid, callback) {
    if (this.next) {
      this.next.addLocalClient(userid, callback);
    } else {
      console.log('dataaccess.base.js::addLocalClient - write me!');
      callback(null, null);
    }
  },
  getLocalClient: function(client_id, callback) {
    if (this.next) {
      this.next.getLocalClient(client_id, callback);
    } else {
      console.log('dataaccess.base.js::getLocalClient - write me!');
      callback(null, null);
    }
  },
  delLocalClient: function(client_id,callback) {
    if (this.next) {
      this.next.delLocalClient(client_id, callback);
    } else {
      console.log('dataaccess.base.js::delLocalClient - write me!');
      callback(null, null);
    }
  },
  /*
   * clients
   */
  addSource: function(client_id, name, link, callback) {
    if (this.next) {
      this.next.addSource(client_id, name, link, callback);
    } else {
      console.log('dataaccess.base.js::addSource - write me!');
      callback(null, null);
    }
  },
  getClient: function(client_id, callback) {
    if (this.next) {
      this.next.getClient(client_id, callback);
    } else {
      console.log('dataaccess.base.js::getClient - write me!');
      callback(null, null);
    }
  },
  setSource: function(source, callback) {
    if (this.next) {
      this.next.setSource(source, callback);
    } else {
      console.log('dataaccess.base.js::setSource - write me!');
      callback(null, null);
    }
  },
  /* client (app) tokens */
  addAPIAppToken: function(client_id, token, request) {
    console.log('dataaccess.base.js::addAPIAppToken - write me!');
  },
  delAPIAppToken: function(client_id, token) {
    console.log('dataaccess.base.js::delAPIAppToken - write me!');
  },
  getAPIAppToken: function(client_id, token) {
    console.log('dataaccess.base.js::getAPIAppToken - write me!');
  },
  /* client upstream token */
  addUpstreamClientToken: function(token, scopes) {
    console.log('dataaccess.base.js::addUpstreamClientToken - write me!');
  },
  delUpstreamClientToken: function(token) {
    console.log('dataaccess.base.js::delUpstreamClientToken - write me!');
  },
  getUpstreamClientToken: function() {
    console.log('dataaccess.base.js::getUpstreamClientToken - write me!');
  },
  /** user stream */
  /** app stream */

  /**
   * posts
   */
  addPost: function(ipost, callback) {
    if (this.next) {
      this.next.addPost(ipost, callback);
    } else {
      console.log('dataaccess.base.js::addPost - write me!');
      callback(null, null);
    }
  },
  setPost:  function(ipost, callback) {
    if (this.next) {
      this.next.setPost(ipost, callback);
    } else {
      console.log('dataaccess.base.js::setPost - write me!');
      callback(null, null);
    }
  },
  getPost: function(id, callback) {
    if (this.next) {
      this.next.getPost(id, callback);
    } else {
      console.log('dataaccess.base.js::getPost - write me!');
      callback(null, null);
    }
  },
  getUserPosts: function(userid, callback) {
    if (this.next) {
      this.next.getUserPosts(userid, callback);
    } else {
      console.log('dataaccess.base.js::getUserPosts - write me!');
      callback(null, null);
    }
  },
  getGlobal: function(callback) {
    if (this.next) {
      this.next.getGlobal(callback);
    } else {
      console.log('dataaccess.base.js::getGlobal - write me!');
      callback(null, null);
    }
  },
  /** channels */
  setChannel: function (chnl, ts, callback) {
    if (this.next) {
      this.next.setChannel(chnl, ts, callback);
    } else {
      console.log('dataaccess.base.js::setChannel - write me!');
      callback(null, null);
    }
  },
  getChannel: function(id, callback) {
    if (this.next) {
      this.next.getChannel(id, callback);
    } else {
      console.log('dataaccess.base.js::getChannel - write me!');
      callback(null, null);
    }
  },
  /** messages */
  setMessage: function (msg, callback) {
    if (this.next) {
      this.next.setMessage(msg, callback);
    } else {
      console.log('dataaccess.base.js::setMessage - write me!');
      callback(null, null);
    }
  },
  getMessage: function(id, callback) {
    if (this.next) {
      this.next.getMessage(id, callback);
    } else {
      console.log('dataaccess.base.js::getMessage - write me!');
      callback(null, null);
    }
  },
  getChannelMessages: function(channelid, callback) {
    if (this.next) {
      this.next.getChannelMessages(channelid, callback);
    } else {
      console.log('dataaccess.base.js::getChannelMessages - write me!');
      callback(null, null);
    }
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
    if (this.next) {
      this.next.setSubscription(chnlid, userid, del, ts, callback);
    } else {
      console.log('dataaccess.base.js::setSubscription - write me!');
      callback(null, null);
    }
  },
  getUserSubscriptions: function(userid, callback) {
    if (this.next) {
      this.next.getUserSubscriptions(userid, callback);
    } else {
      console.log('dataaccess.base.js::getUserSubscriptions - write me!');
      callback(null, null);
    }
  },
  getChannelSubscriptions: function(channelid, callback) {
    if (this.next) {
      this.next.getChannelSubscriptions(channelid, callback);
    } else {
      console.log('dataaccess.base.js::getChannelSubscriptions - write me!');
      callback(null, null);
    }
  },
  /** files */
  /** entities */
  // should this model more closely follow the annotation model?
  // not really because entities are immutable (on posts not users)
  extractEntities: function(type, id, entities, entitytype, callback) {
    if (this.next) {
      this.next.extractEntities(type, id, entities, entitytype, callback);
    } else {
      console.log('dataaccess.base.js::extractEntities - write me!');
      callback(null, null);
    }
  },
  getEntities: function(type, id, callback) {
    if (this.next) {
      this.next.getEntities(type, id, callback);
    } else {
      console.log('dataaccess.base.js::getEntities - write me!');
      callback(null, null);
    }
  },
  // more like getHashtagEntities
  getHashtagEntities: function(hashtag, callback) {
    if (this.next) {
      this.next.getHashtagEntities(hashtag, callback);
    } else {
      console.log('dataaccess.base.js::getHashtagEntities - write me!');
      callback(null, null);
    }
  },
  /**
   * Annotations
   */
  addAnnotation: function(idtype, id, type, value, callback) {
    if (this.next) {
      this.next.addAnnotation(idtype, id, type, value, callback);
    } else {
      console.log('dataaccess.base.js::addAnnotation - write me!');
      callback(null, null);
    }
  },
  clearAnnotations: function(idtype,id,callback) {
    if (this.next) {
      this.next.clearAnnotations(idtype, id, callback);
    } else {
      console.log('dataaccess.base.js::clearAnnotations - write me!');
      callback(null, null);
    }
  },
  getAnnotations: function(idtype, id, callback) {
    if (this.next) {
      this.next.getAnnotations(idtype, id, callback);
    } else {
      console.log('dataaccess.base.js::getAnnotations - write me!');
      callback(null, null);
    }
  },
  /** follow */
  setFollow: function (srcid, trgid, id, del, ts, callback) {
    if (this.next) {
      this.next.setFollow(srcid, trgid, id, del, ts, callback);
    } else {
      console.log('dataaccess.base.js::setFollow - write me!');
      callback(null, null);
    }
  },
  getFollows: function(userid, callback) {
    if (this.next) {
      this.next.getFollows(userid, callback);
    } else {
      console.log('dataaccess.base.js::getFollows - write me!');
      callback(null, null);
    }
  },
  /** Star/Interactions */
  setInteraction: function(userid, postid, type, metaid, deleted, ts, callback) {
    if (this.next) {
      this.next.setInteraction(userid, postid, type, metaid, deleted, ts, callback);
    } else {
      console.log('dataaccess.base.js::setInteraction - write me!');
      callback(null, null);
    }
  },
  // getUserInteractions, remember reposts are stored here too
  // if we're going to use one table, let's keep the code advantages from that
  // getUserStarPosts
  getInteractions: function(type, userid, callback) {
    if (this.next) {
      this.next.getInteractions(type, userid, callback);
    } else {
      console.log('dataaccess.base.js::getInteractions - write me!');
      callback(null, null);
    }
  },
}