/**
 * interface for dataaccess
 * serves as base class as well as end in chain
 * @module dataaccess_base
 */
// TODO: convert to prototype
//
// if next object is set, pass it through to next object
// otherwise end chain
/** @constructs dataaccess */
module.exports = {
  /**
   * if not found locally, what data access object to query next
   * @type {dataaccess}
   */
  next: null,
  /*
   * users
   */
  /**
   * add User base
   * @param {string} username - name of user
   * @param {string} password - unencrypted password of user
   * @param {metaCallback} callback - function to call after completion
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
  patchUser: function(userid, changes, callback) {
    if (this.next) {
      this.next.patchUser(userid, changes, callback);
    } else {
      console.log('dataaccess.base.js::patchUser - write me!');
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
  // callback is user, err, meta
  getUser: function(userid, callback) {
    if (this.next) {
      this.next.getUser(userid, callback);
    } else {
      console.log('dataaccess.base.js::getUser - write me!');
      callback(null, null);
    }
  },
  getUsers: function(users, params, callback) {
    if (this.next) {
      this.next.getUsers(users, params, callback);
    } else {
      console.log('dataaccess.base.js::getUsers - write me!');
      callback(null, null);
    }
  },
  searchUsers: function(query, params, callback) {
    if (this.next) {
      this.next.searchUsers(query, params, callback);
    } else {
      console.log('dataaccess.base.js::searchUsers - write me!');
      callback(null, null);
    }
  },
  /*
   * user mutes
   */
  getMutes: function(userid, params, callback) {
    if (this.next) {
      this.next.getMutes(userid, params, callback);
    } else {
      console.log('dataaccess.base.js::getMutes - write me!');
      callback(null, null);
    }
  },
  addMute: function(userid, muteeid, params, callback) {
    console.log('dataaccess.base::addMute', muteeid, 'for', userid, typeof(callback));
    if (this.next) {
      this.next.addMute(userid, muteeid, params, callback);
    } else {
      console.log('dataaccess.base.js::addMute - write me!');
      callback(null, null);
    }
  },
  delMute: function(userid, muteeid, params, callback) {
    console.log('dataaccess.base::delMute', muteeid, 'for', userid, typeof(callback));
    if (this.next) {
      this.next.delMute(userid, muteeid, params, callback);
    } else {
      console.log('dataaccess.base.js::delMute - write me!');
      callback(null, null);
    }
  },
  /*
   * oauth local app / callbacks
   */
  getAppCallbacks: function(client_id, client_secret, callback) {
    if (this.next) {
      this.next.getAppCallbacks(client_id, client_secret, callback);
    } else {
      console.log('dataaccess.base.js::getAppCallbacks - write me!');
      callback(null, null);
    }
  },
  createSession: function(client_id, redirect_uri, response_type, requested_scopes, state, callback) {
    if (this.next) {
      this.next.createSession(client_id, redirect_uri, response_type, requested_scopes, state, callback);
    } else {
      console.log('dataaccess.base.js::createSession - write me!');
      callback(null, null);
    }
  },
  authSession: function(code, userid, username, upstream_token, localToken, callback) {
    if (this.next) {
      this.next.authSession(code, userid, username, upstream_token, localToken, callback);
    } else {
      console.log('dataaccess.base.js::authSession - write me!');
      callback(null, null);
    }
  },
  getSessionByCode: function(code, callback) {
    if (this.next) {
      this.next.getSessionByCode(code, callback);
    } else {
      console.log('dataaccess.base.js::getSessionByCode - write me!');
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
  createOrFindUserToken: function(userid, client_id, scopes, callback) {
    if (this.next) {
      this.next.createOrFindUserToken(userid, client_id, scopes, callback);
    } else {
      console.log('dataaccess.base.js::createOrFindUserToken - write me!');
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
  delUpstreamUserToken: function(token) {
    if (this.next) {
      this.next.delUpstreamUserToken(token);
    } else {
      console.log('dataaccess.base.js::delUpstreamUserToken - write me!');
      callback(null, null);
    }
  },
  getUpstreamUserToken: function(userid, callback) {
    if (this.next) {
      this.next.getUpstreamUserToken(userid, callback);
    } else {
      console.log('dataaccess.base.js::getUpstreamUserToken - write me!');
      callback(null, null);
    }
  },
  /*
   * stream markers
   */
  getStreamMarker: function(userid, name, callback) {
    if (this.next) {
      this.next.getStreamMarker(userid, name, callback);
    } else {
      console.log('dataaccess.base.js::getStreamMarker - write me!');
      callback(null, null);
    }
  },
  setStreamMarker: function(userid, name, id, percentage, params, callback) {
    if (this.next) {
      this.next.setStreamMarker(userid, name, id, percentage, params, callback);
    } else {
      console.log('dataaccess.base.js::setStreamMarker - write me!');
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
  findOrCreateUserStream: function(connectionId, tokenId, userId, autoDelete, callback) {
    if (this.next) {
      this.next.findOrCreateUserStream(connectionId, tokenId, userId, autoDelete, callback);
    } else {
      console.log('dataaccess.base.js::findOrCreateUserStream - write me!');
      callback(null, null, null);
    }
  },
  findOrCreateUserSubscription: function(connectionNumId, stream, params, callback) {
    if (this.next) {
      this.next.findOrCreateUserSubscription(connectionNumId, stream, params, callback);
    } else {
      console.log('dataaccess.base.js::findOrCreateUserSubscription - write me!');
      callback(null, null, null);
    }
  },
  userStreamUpdate: function(connectionId, update, callback) {
    if (this.next) {
      this.next.userStreamUpdate(connectionId, update, callback);
    } else {
      console.log('dataaccess.base.js::userStreamUpdate - write me!');
      callback(null, null, null);
    }
  },
  deleteUserStream: function(connectionNumId, callback) {
    if (this.next) {
      this.next.deleteUserStream(connectionNumId, callback);
    } else {
      console.log('dataaccess.base.js::deleteUserStream - write me!');
      callback(null, null, null);
    }
  },
  getUserStream: function(connectionNumId, callback) {
    if (this.next) {
      this.next.getUserStream(connectionNumId, callback);
    } else {
      console.log('dataaccess.base.js::getUserStream - write me!');
      callback(null, null, null);
    }
  },
  getAllUserStreams: function(callback) {
    if (this.next) {
      this.next.getAllUserStreams(callback);
    } else {
      console.log('dataaccess.base.js::getAllUserStreams - write me!');
      callback(null, null, null);
    }
  },
  /** user stream */
  /** app stream */

  /**
   * posts
   */
  addPost: function(ipost, token, callback) {
    if (this.next) {
      this.next.addPost(ipost, token, callback);
    } else {
      console.log('dataaccess.base.js::addPost - write me!');
      callback(null, null, null);
    }
  },
  delPost: function(postid, token, callback) {
    if (this.next) {
      this.next.delPost(postid, token, callback);
    } else {
      console.log('dataaccess.base.js::delPost - write me!');
      callback(null, null, null);
    }
  },
  updatePostHTML: function(postid, html, callback) {
    if (this.next) {
      this.next.updatePostHTML(postid, html, callback);
    } else {
      console.log('dataaccess.base.js::updatePostHTML - write me!');
      callback(null, null);
    }
  },
  updatePostCounts: function(postid, callback) {
    if (this.next) {
      this.next.updatePostCounts(postid, callback);
    } else {
      console.log('dataaccess.base.js::updatePostCounts - write me!');
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
  addRepost: function(postid, originalPost, token, callback) {
    if (this.next) {
      this.next.addRepost(postid, originalPost, token, callback);
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
    if (this.next) {
      this.next.getPost(id, callback);
    } else {
      console.log('dataaccess.base.js::getPost - write me!');
      callback(null, null);
    }
  },
  getReposts: function(postid, params, token, callback) {
    if (this.next) {
      this.next.getReposts(postid, params, token, callback);
    } else {
      console.log('dataaccess.base.js::getReposts - write me!');
      callback(null, null);
    }
  },
  getReplies: function(postid, params, token, callback) {
    if (this.next) {
      this.next.getReplies(postid, params, token, callback);
    } else {
      console.log('dataaccess.base.js::getReplies - write me!');
      callback(null, null);
    }
  },
  getUserRepostPost: function(userid, repost_of, callback) {
    if (this.next) {
      this.next.getUserRepostPost(userid, repost_of, callback);
    } else {
      console.log('dataaccess.base.js::getUserReportPost - write me!');
      callback(null, null);
    }
  },
  getUserPostStream: function(user, params, token, callback) {
    if (this.next) {
      this.next.getUserPostStream(user, params, token, callback);
    } else {
      console.log('dataaccess.base.js::getUserPostStream - write me!');
      callback(null, null);
    }
  },
  getUnifiedStream: function(userid, params, callback) {
    if (this.next) {
      this.next.getUnifiedStream(userid, params, callback);
    } else {
      console.log('dataaccess.base.js::getUnifiedStream - write me!');
      callback(null, null);
    }
  },
  // user can be an id or @username
  getUserPosts: function(user, params, callback) {
    if (this.next) {
      this.next.getUserPosts(user, params, callback);
    } else {
      console.log('dataaccess.base.js::getUserPosts - write me!');
      callback(null, null);
    }
  },
  getMentions: function(user, params, callback) {
    if (this.next) {
      this.next.getMentions(user, params, callback);
    } else {
      console.log('dataaccess.base.js::getMentions - write me!');
      callback(null, null);
    }
  },
  getGlobal: function(params, callback) {
    if (this.next) {
      this.next.getGlobal(params, callback);
    } else {
      console.log('dataaccess.base.js::getGlobal - write me!');
      callback(null, null, null);
    }
  },
  getExplore: function(params, callback) {
    if (this.next) {
      this.next.getExplore(params, callback);
    } else {
      console.log('dataaccess.base.js::getExplore - write me!');
      callback(null, null, null);
    }
  },
  getExploreFeed: function(feed, params, callback) {
    if (this.next) {
      this.next.getExploreFeed(feed, params, callback);
    } else {
      console.log('dataaccess.base.js::getExploreFeed - write me!');
      callback(null, null, null);
    }
  },
  searchPosts: function(query, params, callback) {
    if (this.next) {
      this.next.searchPosts(query, params, callback);
    } else {
      console.log('dataaccess.base.js::searchPosts - write me!');
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
  updateChannel: function (channelid, chnl, callback) {
    if (this.next) {
      this.next.updateChannel(channelid, chnl, callback);
    } else {
      console.log('dataaccess.base.js::updateChannel - write me!');
      callback(null, null);
    }
  },
  addChannel: function(userid, type, callback) {
    //console.log('dataaccess.base.js::addChannel - hit!');
    if (this.next) {
      //console.log('dataaccess.base.js::addChannel - calling', this.next.name);
      this.next.addChannel(userid, type, callback);
    } else {
      console.log('dataaccess.base.js::addChannel - write me!');
      callback(null, null);
    }
  },
  getChannel: function(id, params, callback) {
    if (this.next) {
      this.next.getChannel(id, params, callback);
    } else {
      console.log('dataaccess.base.js::getChannel - write me!');
      callback(null, null);
    }
  },
  searchChannels: function(query, params, callback) {
    if (this.next) {
      this.next.searchChannels(query, params, callback);
    } else {
      console.log('dataaccess.base.js::searchChannels - write me!');
      callback(null, null);
    }
  },
  getUserChannels: function(userid, params, callback) {
    if (this.next) {
      this.next.getUserChannels(userid, params, callback);
    } else {
      console.log('dataaccess.base.js::getUserChannels - write me!');
      callback(null, null);
    }
  },
  getPMChannel: function(group, callback) {
    if (this.next) {
      this.next.getPMChannel(group, callback);
    } else {
      console.log('dataaccess.base.js::getPMChannel - write me!');
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
  addMessage: function (msg, callback) {
    if (this.next) {
      this.next.addMessage(msg, callback);
    } else {
      console.log('dataaccess.base.js::addMessage - write me!');
      callback(null, null);
    }
  },
  deleteMessage: function (message_id, callback) {
    if (this.next) {
      this.next.deleteMessage(message_id, callback);
    } else {
      console.log('dataaccess.base.js::deleteMessage - write me!');
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
  getChannelMessages: function(channelid, params, callback) {
    if (this.next) {
      this.next.getChannelMessages(channelid, params, callback);
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
  addSubscription: function (channel_id, userid, callback) {
    if (this.next) {
      this.next.addSubscription(channel_id, userid, callback);
    } else {
      console.log('dataaccess.base.js::addSubscription - write me!');
      callback(null, null);
    }
  },
  setSubscription: function (chnlid, userid, del, ts, callback) {
    if (this.next) {
      this.next.setSubscription(chnlid, userid, del, ts, callback);
    } else {
      console.log('dataaccess.base.js::setSubscription - write me!');
      callback(null, null);
    }
  },
  delSubscription: function (channel_id, userid, callback) {
    if (this.next) {
      this.next.delSubscription(channel_id, userid, callback);
    } else {
      console.log('dataaccess.base.js::delSubscription - write me!');
      callback(null, null);
    }
  },
  getSubscription: function(channel_id, user_id, callback) {
    if (this.next) {
      this.next.getSubscription(channel_id, user_id, callback);
    } else {
      console.log('dataaccess.base.js::getSubscription - write me!');
      callback(null, null);
    }
  },
  getUserSubscriptions: function(userid, params, callback) {
    if (this.next) {
      this.next.getUserSubscriptions(userid, params, callback);
    } else {
      console.log('dataaccess.base.js::getUserSubscriptions - write me!');
      callback(null, null);
    }
  },
  getChannelSubscriptions: function(channelid, params, callback) {
    if (this.next) {
      this.next.getChannelSubscriptions(channelid, params, callback);
    } else {
      console.log('dataaccess.base.js::getChannelSubscriptions - write me!');
      callback(null, null);
    }
  },
  /** files */
  addFile: function(file, token, callback) {
    if (this.next) {
      this.next.addFile(file, token, callback);
    } else {
      console.log('dataaccess.base.js::addFile - write me!');
      callback(null, null);
    }
  },
  setFile: function(file, del, ts, callback) {
    if (this.next) {
      this.next.setFile(file, del, ts, callback);
    } else {
      console.log('dataaccess.base.js::setFile - write me!');
      callback(null, null);
    }
  },
  getFile: function(fileId, callback) {
    if (this.next) {
      this.next.getFile(fileId, callback);
    } else {
      console.log('dataaccess.base.js::getFile - write me!');
      callback(null, null);
    }
  },
  getFiles: function(userid, params, callback) {
    if (this.next) {
      this.next.getFiles(userid, params, callback);
    } else {
      console.log('dataaccess.base.js::getFiles - write me!');
      callback(null, null);
    }
  },
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
  getHashtagEntities: function(hashtag, params, callback) {
    if (this.next) {
      this.next.getHashtagEntities(hashtag, params, callback);
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
  updateUserCounts: function(userid, callback) {
    if (this.next) {
      this.next.updateUserCounts(userid, callback);
    } else {
      console.log('dataaccess.base.js::updateUserCounts - write me!');
      callback(null, null);
    }
  },
  setFollow: function (srcid, trgid, id, del, ts, callback) {
    if (this.next) {
      this.next.setFollow(srcid, trgid, id, del, ts, callback);
    } else {
      console.log('dataaccess.base.js::setFollow - write me!');
      callback(null, null);
    }
  },
  getFollowing: function(userid, params, callback) {
    if (this.next) {
      this.next.getFollowing(userid, params, callback);
    } else {
      console.log('dataaccess.base.js::getFollowing - write me!');
      callback(null, null);
    }
  },
  follows: function(src, trg, callback) {
    if (this.next) {
      this.next.follows(src, trg, callback);
    } else {
      console.log('dataaccess.base.js::follows - write me!');
      callback(null, null);
    }
  },
  getFollows: function(userid, params, callback) {
    if (this.next) {
      this.next.getFollows(userid, params, callback);
    } else {
      console.log('dataaccess.base.js::getFollows - write me!');
      callback(null, null);
    }
  },
  /** Star/Interactions */
  addStar: function(postid, token, callback) {
    if (this.next) {
      this.next.addStar(postid, token, callback);
    } else {
      console.log('dataaccess.base.js::addStar - write me!');
      callback(null, null);
    }
  },
  delStar: function(postid, token, callback) {
    if (this.next) {
      this.next.delStar(postid, token, callback);
    } else {
      console.log('dataaccess.base.js::addStar - write me!');
      callback(null, null);
    }
  },
  setInteraction: function(userid, postid, type, metaid, deleted, ts, callback) {
    if (this.next) {
      this.next.setInteraction(userid, postid, type, metaid, deleted, ts, callback);
    } else {
      console.log('dataaccess.base.js::setInteraction - write me!');
      callback(null, null);
    }
  },
  getUserStarPost: function(userid, postid, callback) {
    if (this.next) {
      this.next.getUserStarPost(userid, postid, callback);
    } else {
      console.log('dataaccess.base.js::getPostStar - write me!');
      callback(null, null);
    }
  },
  getPostStars: function(postid, params, callback) {
    if (this.next) {
      this.next.getPostStars(postid, params, callback);
    } else {
      console.log('dataaccess.base.js::getPostStars - write me!');
      callback(null, null);
    }
  },
  getNotices: function(userid, params, tokenObj, callback) {
    if (this.next) {
      this.next.getNotices(userid, params, tokenObj, callback);
    } else {
      console.log('dataaccess.base.js::getNotices - write me!');
      callback(null, null);
    }
  },
  // getUserInteractions, remember reposts are stored here too
  // if we're going to use one table, let's keep the code advantages from that
  // getUserStarPosts
  getInteractions: function(type, userid, params, callback) {
    if (this.next) {
      this.next.getInteractions(type, userid, params, callback);
    } else {
      console.log('dataaccess.base.js::getInteractions - write me!');
      callback(null, null);
    }
  },
  getOEmbed: function(url, callback) {
    if (this.next) {
      this.next.getOEmbed(url, callback);
    } else {
      console.log('dataaccess.base.js::getOEmbed - write me!');
      callback(null, null);
    }
  }
}
