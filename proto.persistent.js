api_persistent_storage.prototype = {
  /** users */
  addUser: function(username, password) {
  },
  getUserID: function(userid) {
  },
  /** user token */
  getAPIUserToken: function(token) {
  },
  addAPIUserToken: function(userid, token, scopes) {
  },
  delAPIUserToken: function(token) {
  },
  /** user upstream tokens */
  getUpstreamUserToken: function(userid) {
  },
  addUpstreamUserToken: function(userid, token, scopes) {
  },
  delUpstreamUserToken: function(token) {
  },
  /** clients */
  addClient: function(userid) {
  },
  getClient: function(clientid) {
  },
  /** client tokens */
  getAPIAppToken: function(clientid, token) {
  },
  addAPIAppToken: function(clientid, token, request) {
  },
  delAPIAppToken: function(clientid, token) {
  },
  /** client upstream token */
  getUpstreamClientToken: function() {
  },
  addUpstreamClientToken: function(token, scopes) {
  },
  delUpstreamClientToken: function(token) {
  },

  /** posts */
  /** channels */
  /** messages */
  /** files */
  /** user stream */
  /** app stream */
}