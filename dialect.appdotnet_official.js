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
  app.get(prefix+'/token', function(req, resp) {
    // req.token convert into userid/sourceid
    console.log('dialect.*.js::/token  - looking up usertoken');
    if (req.token) {
      // need to translate token...
      dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
        //console.log('usertoken',usertoken);
        console.log('dialect.*.js::/token  - got usertoken');
        if (usertoken==null) {
          console.log('dialect.*.js::No valid token passed in to /token');
          var res={
            "meta": {
              "code": 401,
              "error_message": "Call requires authentication: Authentication required to fetch token."
            }
          };
          resp.status(401).type('application/json').send(JSON.stringify(res));
        } else {
          console.log('dialect.*.js::getting token for usertoken { userid:',usertoken.userid,'client_id:',usertoken.client_id);
          dispatcher.getToken(usertoken.userid, usertoken.client_id, callbacks.tokenCallback(resp, req.token));
        }
      });
    } else {
      console.log('dialect.*.js::No token passed in to /token');
      var res={
        "meta": {
          "code": 401,
          "error_message": "Call requires authentication: Authentication required to fetch token."
        }
      };
      resp.status(401).type('application/json').send(JSON.stringify(res));
    }
  });
  app.get(prefix+'/users/:user_id/interactions', function(req, resp) {
    // req.token
    // req.token convert into userid/sourceid
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      console.log('usertoken',usertoken);
      if (usertoken==null) {
        // could be they didn't log in through a server restart
        var res={
          "meta": {
            "code": 401,
            "error_message": "Call requires authentication: Authentication required to fetch token."
          }
        };
        resp.status(401).type('application/json').send(JSON.stringify(res));
      } else {
        dispatcher.getInteractions(usertoken.userid, callbacks.dataCallback(resp));
      }
    });
  });
  app.get(prefix+'/posts/:post_id/replies', function(req, resp) {
    dispatcher.getReplies(req.params.post_id, req.apiParams.pageParams, req.token, callbacks.postsCallback(resp, req.token));
  });
  app.post(prefix+'/posts', function(req, resp) {
    /*
    {
      reply_to: null,
      text: 'adsf',
      entities: {
        parse_links: true,
        parse_markdown_links: true,
        links: []
      }
    }
    */
    var postdata={
      text: req.body.text,
      reply_to: req.body.reply_to
    };
    if (req.body.entities) {
      postdata.entities=req.body.entities;
    }
    if (req.body.annotations) {
      postdata.annotations=req.body.annotations;
    }
    dispatcher.addPost(postdata, req.token, callbacks.postCallback(resp, req.token));
  });
  app.post(prefix+'/posts/:post_id/star', function(req, resp) {
    dispatcher.addStar(req.params.post_id, req.token, callbacks.postCallback(resp, req.token));
  });
  app.delete(prefix+'/posts/:post_id/star', function(req, resp) {
    dispatcher.delStar(req.params.post_id, req.token, callbacks.postCallback(resp, req.token));
  });
  app.post(prefix+'/posts/:post_id/repost', function(req, resp) {
    dispatcher.addRepost(req.params.post_id, req.token, callbacks.postCallback(resp, req.token));
  });
  app.delete(prefix+'/posts/:post_id/repost', function(req, resp) {
    dispatcher.delRepost(req.params.post_id, req.token, callbacks.postCallback(resp, req.token));
  });

  // {"meta":{"code":401,"error_message":"Call requires authentication: This resource requires authentication and no token was provided."}}
  app.get(prefix+'/posts/stream', function(req, resp) {
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      //console.log('usertoken',usertoken);
      if (usertoken==null) {
        // could be they didn't log in through a server restart
        var res={
          "meta": {
            "code": 401,
            "error_message": "Call requires authentication: Authentication required to fetch token."
          }
        };
        resp.status(401).type('application/json').send(JSON.stringify(res));
      } else {
        //dispatcher.getUserStream(usertoken.userid, req.apiParams.pageParams, req.token, callbacks.postsCallback(resp));
        dispatcher.getUserStream(usertoken.userid, req.apiParams.pageParams, req.token, function(posts, err, meta) {
          var func=callbacks.postsCallback(resp, req.token);
          //console.log('getUserStream',posts);
          func(posts, err, meta);
        });
      }
    });
  });
  app.get(prefix+'/users/:user_id/mentions', function(req, resp) {
    dispatcher.getMentions(req.params.user_id, req.apiParams.pageParams, callbacks.postsCallback(resp, req.token));
  });
  app.get(prefix+'/users/:user_id/stars', function(req, resp) {
    dispatcher.getUserStars(req.params.user_id, req.apiParams.pageParams, callbacks.postsCallback(resp, req.token));
  });
  app.get(prefix+'/users/:user_id/following', function(req, resp) {
    // req.params.user_id,
    dispatcher.getGlobal(req.apiParams.pageParams, callbacks.usersCallback(resp, req.token));
  });
  app.get(prefix+'/users/:user_id/followers', function(req, resp) {
    // req.params.user_id,
    dispatcher.getGlobal(req.apiParams.pageParams, callbacks.usersCallback(resp, req.token));
  });
  /*
   * No token endpoints
   */
  app.get(prefix+'/posts/:id', function(req, resp) {
    dispatcher.getPost(req.params.id, req.apiParams, callbacks.postCallback(resp, req.token));
  });
  app.get(prefix+'/users/:user_id', function(req, resp) {
    dispatcher.getUser(req.params.user_id, req.apiParams, callbacks.dataCallback(resp));
  });
  app.get(prefix+'/users/:user_id/posts', function(req, resp) {
    dispatcher.getUserPosts(req.params.user_id, req.apiParams.pageParams, callbacks.postsCallback(resp, req.token));
  });
  app.get(prefix+'/users/:user_id/stars', function(req, resp) {
    //console.log('ADNO::usersStar');
    dispatcher.getUserStars(req.params.user_id, req.apiParams.pageParams, callbacks.dataCallback(resp));
  });
  app.get(prefix+'/posts/tag/:hashtag', function(req, resp) {
    dispatcher.getHashtag(req.params.hashtag, req.apiParams.pageParams, callbacks.dataCallback(resp));
  });
  app.get(prefix+'/posts/stream/global', function(req, resp) {
    // why data instead of posts?
    dispatcher.getGlobal(req.apiParams.pageParams, callbacks.postsCallback(resp, req.token));
  });
  app.get(prefix+'/posts/stream/explore', function(req, resp) {
    dispatcher.getExplore(req.apiParams.pageParams, callbacks.dataCallback(resp));
  });
  app.get(prefix+'/posts/stream/explore/:feed', function(req, resp) {
    // this is just a stub hack
    dispatcher.getGlobal(req.apiParams.pageParams, callbacks.postsCallback(resp, req.token));
  });
  // channel_id 1383 is always good for testing
  app.get(prefix+'/channels/:channel_id', function(req, resp) {
    dispatcher.getChannel(req.params.channel_id, req.apiParams, callbacks.dataCallback(resp));
  });
  app.get(prefix+'/channels/:channel_id/messages', function(req, resp) {
    dispatcher.getChannelMessages(req.params.channel_id, req.apiParams.pageParams, callbacks.dataCallback(resp));
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
