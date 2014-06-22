var api_persistent_storage = {
  /** users */
  addUser: function(username, password) {
    console.log('api_persistent_storage::addUser - write me!');
  },
  getUserID: function(userid) {
    console.log('api_persistent_storage::getUserID - write me!');
  },
  /** user token */
  getAPIUserToken: function(token) {
    console.log('api_persistent_storage::getAPIUserToken - write me!');
  },
  addAPIUserToken: function(userid, token, scopes) {
    console.log('api_persistent_storage::addAPIUserToken - write me!');
  },
  delAPIUserToken: function(token) {
    console.log('api_persistent_storage::delAPIUserToken - write me!');
  },
  /** user upstream tokens */
  getUpstreamUserToken: function(userid) {
    console.log('api_persistent_storage::getUpstreamUserToken - write me!');
  },
  addUpstreamUserToken: function(userid, token, scopes) {
    console.log('api_persistent_storage::addUpstreamUserToken - write me!');
  },
  delUpstreamUserToken: function(token) {
    console.log('api_persistent_storage::delUpstreamUserToken - write me!');
  },
  /** clients */
  addClient: function(userid) {
    console.log('api_persistent_storage::addClient - write me!');
  },
  getClient: function(clientid) {
    console.log('api_persistent_storage::getClient - write me!');
  },
  /** client tokens */
  getAPIAppToken: function(clientid, token) {
    console.log('api_persistent_storage::getAPIAppToken - write me!');
  },
  addAPIAppToken: function(clientid, token, request) {
    console.log('api_persistent_storage::addAPIAppToken - write me!');
  },
  delAPIAppToken: function(clientid, token) {
    console.log('api_persistent_storage::delAPIAppToken - write me!');
  },
  /** client upstream token */
  getUpstreamClientToken: function() {
    console.log('api_persistent_storage::getUpstreamClientToken - write me!');
  },
  addUpstreamClientToken: function(token, scopes) {
    console.log('api_persistent_storage::addUpstreamClientToken - write me!');
  },
  delUpstreamClientToken: function(token) {
    console.log('api_persistent_storage::delUpstreamClientToken - write me!');
  },

  /** posts */
  /** channels */
  /** messages */
  /** files */
  /** user stream */
  /** app stream */
}