/** get request http library */
var request = require('request');

// pass in proxy settings or just conf it?
module.exports = {
  next: null,
  /*
   * users
   */
  addUser: function(username, password, callback) {
    if (this.next) {
      this.next.addUser(username,password,callback);
    }
  },
  setUser: function(iuser, ts, callback) {
    if (this.next) {
      this.next.setUser(iuser, ts, callback);
    }
  },
  delUser: function(userid, callback) {
    if (this.next) {
      this.next.delUser(userid, callback);
    }
  },
  getUserID: function(username, callback) {
    if (this.next) {
      this.next.getUserID(username, callback);
    }
  },
  // callback is user,err,meta
  getUser: function(userid, callback) {
    if (this.next) {
      this.next.getUser(username, callback);
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
    if (this.next) {
      this.next.getClient(client_id, callback);
    }
  },
  setSource: function(source, callback) {
    if (this.next) {
      this.next.setSource(client_id, callback);
    }
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
    if (this.next) {
      this.next.setPost(ipost, callback);
    }
  },
  getPost: function(id, callback) {
    if (this.next) {
      this.next.getPost(id, callback);
    }
  },
  getUserPosts: function(userid, callback) {
    if (this.next) {
      this.next.getUserPosts(userid, callback);
    }
  },
  getGlobal: function(callback) {
    if (this.next) {
      this.next.getGlobal(callback);
    }
  },
  /** channels */
  setChannel: function (chnl, ts, callback) {
    if (this.next) {
      this.next.setChannel(chnl, ts, callback);
    }
  },
  getChannel: function(id, callback) {
    if (this.next) {
      this.next.getChannel(id, callback);
    }
  },
  /** messages */
  setMessage: function (msg, callback) {
    if (this.next) {
      this.next.setMessage(msg, callback);
    }
  },
  getMessage: function(id, callback) {
    if (this.next) {
      this.next.getMessage(id, callback);
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
    }
  },
  getUserSubscriptions: function(userid, callback) {
    if (this.next) {
      this.next.getUserSubscriptions(userid, callback);
    }
  },
  getChannelSubscriptions: function(channelid, callback) {
    if (this.next) {
      this.next.getChannelSubscriptions(channelid, callback);
    }
  },
  /** files */
  /** entities */
  // should this model more closely follow the annotation model?
  // not really because entities are immutable (on posts not users)
  extractEntities: function(type, id, entities, entitytype, callback) {
    if (this.next) {
      this.next.extractEntities(type, id, entities, entitytype, callback);
    }
  },
  getEntities: function(type, id, callback) {
    if (this.next) {
      this.next.getEntities(type, id, callback);
    }
  },
  // more like getHashtagEntities
  getHashtagEntities: function(hashtag, callback) {
    if (this.next) {
      this.next.getHashtagEntities(hashtag, callback);
    }
  },
  /**
   * Annotations
   */
  addAnnotation: function(idtype, id, type, value, callback) {
    if (this.next) {
      this.next.addAnnotation(idtype, id, type, value, callback);
    }
  },
  clearAnnotations: function(idtype,id,callback) {
    if (this.next) {
      this.next.clearAnnotations(idtype, id, callback);
    }
  },
  getAnnotations: function(idtype, id, callback) {
    if (this.next) {
      this.next.getAnnotations(idtype, id, callback);
    }
  },
  /** follow */
  setFollow: function (srcid, trgid, id, del, ts, callback) {
    if (this.next) {
      this.next.setFollow(srcid, trgid, id, del, ts, callback);
    }
  },
  getFollows: function(userid, callback) {
    if (this.next) {
      this.next.getFollows(userid, callback);
    }
  },
  /** Star/Interactions */
  setInteraction: function(userid, postid, type, metaid, deleted, ts, callback) {
    if (this.next) {
      this.next.setInteraction(userid, postid, type, metaid, deleted, ts, callback);
    }
  },
  // getUserInteractions, remember reposts are stored here too
  // if we're going to use one table, let's keep the code advantages from that
  // getUserStarPosts
  getInteractions: function(type, userid, callback) {
    if (this.next) {
      this.next.getInteractions(type, userid, callback);
    }
  },
}