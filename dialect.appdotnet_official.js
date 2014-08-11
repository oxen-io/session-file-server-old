/**
This module takes the API and communicates with the front-end internal API (dispatcher)
to provide data
this file is responsible for the dialect for the associate mountpoint

we're responsible for filteirng models to make sure we only return what matches the dialect's spec
*/
/** get request http library */
var request = require('request');
require('http').globalAgent.maxSockets = Infinity
require('https').globalAgent.maxSockets = Infinity

var callbacks = require('./dialect.appdotnet_official.callbacks.js');

/**
 * Set up defined API routes at prefix
 */
module.exports=function(app, prefix) {
  var dispatcher=app.dispatcher;
  /*
   * Authenticated endpoints
   */
  // {"meta":{"code":401,"error_message":"Call requires authentication: This resource requires authentication and no token was provided."}}
  app.get(prefix+'/posts/stream', function(req, resp) {
    dispatcher.getGlobal(req.pageParams, callbacks.postsCallback(resp));
  });
  app.get(prefix+'/users/:user_id/mentions', function(req, resp) {
    dispatcher.getGlobal(req.pageParams, callbacks.postsCallback(resp));
  });
  app.get(prefix+'/users/:user_id/stars', function(req, resp) {
    dispatcher.getGlobal(req.pageParams, callbacks.postsCallback(resp));
  });
  app.get(prefix+'/users/:user_id/following', function(req, resp) {
    dispatcher.getGlobal(req.pageParams, callbacks.usersCallback(resp));
  });
  app.get(prefix+'/users/:user_id/followers', function(req, resp) {
    dispatcher.getGlobal(req.pageParams, callbacks.usersCallback(resp));
  });
  /*
   * No token endpoints
   */
  app.get(prefix+'/posts/:id', function(req, resp) {
    dispatcher.getPost(req.params.id, req.apiParams, callbacks.postCallback(resp));
  });
  app.get(prefix+'/users/:user_id', function(req, resp) {
    dispatcher.getUser(req.params.user_id, req.apiParams, callbacks.dataCallback(resp));
  });
  app.get(prefix+'/users/:user_id/posts', function(req, resp) {
    dispatcher.getUserPosts(req.params.user_id, req.pageParams, callbacks.postsCallback(resp));
  });
  app.get(prefix+'/users/:user_id/stars', function(req, resp) {
    //console.log('ADNO::usersStar');
    dispatcher.getUserStars(req.params.user_id, req.pageParams, callbacks.dataCallback(resp));
  });
  app.get(prefix+'/posts/tag/:hashtag', function(req, resp) {
    dispatcher.getHashtag(req.params.hashtag, req.pageParams, callbacks.dataCallback(resp));
  });
  app.get(prefix+'/posts/stream/global', function(req, resp) {
    dispatcher.getGlobal(req.pageParams, callbacks.dataCallback(resp));
  });
  app.get(prefix+'/posts/stream/explore', function(req, resp) {
    dispatcher.getExplore(req.pageParams, callbacks.dataCallback(resp));
  });
  app.get(prefix+'/posts/stream/explore/:feed', function(req, resp) {
    dispatcher.getGlobal(req.pageParams, callbacks.postsCallback(resp));
  });
  // channel_id 1383 is always good for testing
  app.get(prefix+'/channels/:channel_id', function(req, resp) {
    dispatcher.getChannel(req.params.channel_id, req.apiParams, callbacks.dataCallback(resp));
  });
  app.get(prefix+'/channels/:channel_id/messages', function(req, resp) {
    dispatcher.getChannelMessages(req.params.channel_id, req.pageParams, callbacks.dataCallback(resp));
  });
  app.get(prefix+'/channels/:channel_id/messages/:message_id', function(req, resp) {
    dispatcher.getChannelMessage(req.params.channel_id, req.params.message_id, req.apiParams, callbacks.dataCallback(resp));
  });
  app.get(prefix+'/config', function(req, resp) {
    // just call the callback directly. err and meta are optional params
    callbacks.dataCallback(resp)(dispatcher.getConfig())
  });
  app.get(prefix+'/oembed', function(req, resp) {
    // never any meta
    dispatcher.getOEmbed(req.query.url, callbacks.oembedCallback(resp));
  });
  app.post(prefix+'/text/process', function(req, resp) {
    dispatcher.textProcess(req.body.text, null, null, callbacks.dataCallback(resp));
  });
}
