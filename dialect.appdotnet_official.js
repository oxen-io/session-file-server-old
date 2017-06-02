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

// post structure, good enough to fool alpha
var notimplemented=[{
  id: 0,
  text: 'not implemented',
  created_at: '2014-10-24T17:04:48Z',
  source: {

  },
  user: {
    id: 0,
    username: 'notimplemented',
    created_at: '2014-10-24T17:04:48Z',
    avatar_image: {
      url: 'https://d2rfichhc2fb9n.cloudfront.net/image/5/OhYk4yhX3u0PFdMTqIrtTF6SgOB7InMiOiJzMyIsImIiOiJhZG4tdXNlci1hc3NldHMiLCJrIjoiYXNzZXRzL3VzZXIvZTEvMzIvMjAvZTEzMjIwMDAwMDAwMDAwMC5wbmciLCJvIjoiIn0?h=80&w=80'
    },
    cover_image: {
      url: 'https://d2rfichhc2fb9n.cloudfront.net/image/5/sz0h_gbdbxI14RcO12FPxO5nSbt7InMiOiJzMyIsImIiOiJhZG4tdXNlci1hc3NldHMiLCJrIjoiYXNzZXRzL3VzZXIvNjIvMzIvMjAvNjIzMjIwMDAwMDAwMDAwMC5wbmciLCJvIjoiIn0?w=862'
    },
    counts: {
      following: 0,
    }
  }
}];

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
    //console.log('dialect.*.js::/token  - looking up usertoken', req.token);
    if (req.token!==null && req.token!==undefined && req.token!='') {
      // need to translate token...
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        //console.log('usertoken', usertoken);
        //console.log('dialect.*.js::/token  - got usertoken');
        if (usertoken==null) {
          console.log('dialect.*.js::No valid token passed in to /token', req.token);
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
    dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
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
        // This endpoint accepts the interaction_actions as a query string parameter whose value
        // is a comma separated list of actions you’re interested in. For instance, if you’re
        // only interested in repost and follow interactions you could request
        // users/me/interactions?interaction_actions=repost,follow.

        // I don't think we want to pass the full token
        dispatcher.getInteractions(usertoken.userid, req.token, {}, callbacks.dataCallback(resp));
      }
    });
  });
  // Token: Any
  app.get(prefix+'/posts/:post_id/replies', function(req, resp) {
    dispatcher.getReplies(req.params.post_id, req.apiParams.pageParams, req.token, callbacks.postsCallback(resp, req.token));
  });
  app.post(prefix+'/users/:user_id/follow', function(req, resp) {
    // can also be @username
    var followsid=req.params.user_id;
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      //console.log('usertoken', usertoken);
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
        console.log('ADNO::users/ID/follow - user_id', followsid);
        // data.user.id, data.follows_user.id
        dispatcher.setFollows({
          user: { id: usertoken.userid }, follows_user: { id: followsid },
        }, 0, 0, Date.now(), callbacks.userCallback(resp, req.token));
      }
    });
  });
  app.delete(prefix+'/users/:user_id/follow', function(req, resp) {
    // can also be @username
    var followsid=req.params.user_id;
    console.log('body', req.body);
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      //console.log('usertoken', usertoken);
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
        // data.user.id, data.follows_user.id
        dispatcher.setFollows({
          user: { id: usertoken.userid }, follows_user: { id: followsid },
        }, true, 0, Date.now(), callbacks.userCallback(resp, req.token));
      }
    });
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
    };
    if (req.body.reply_to) { // this is optional
      postdata.reply_to=req.body.reply_to;
      console.log('setting reply_to', postdata.reply_to);
    }
    if (req.body.entities) {
      postdata.entities=req.body.entities;
    }
    if (req.body.annotations) {
      postdata.annotations=req.body.annotations;
    }
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      if (err) {
        console.error('ADNO::POST/posts - token err', err);
      }
      if (usertoken==null) {
        console.log('dialect.appdotnet_official.js:POST/posts - no token for', req.token);
        // could be they didn't log in through a server restart
        var res={
          "meta": {
            "code": 401,
            "error_message": "Call requires authentication: Authentication required to fetch token."
          }
        };
        resp.status(401).type('application/json').send(JSON.stringify(res));
      } else {
        //console.log('dialect.appdotnet_official.js:postsStream - usertoken', usertoken);
        // if we set here we don't really need to pass token
        postdata.userid=usertoken.userid;
        postdata.client_id=usertoken.client_id;
        console.log('ADNO::POST/posts - postObject', postdata);
        dispatcher.addPost(postdata, usertoken, callbacks.postCallback(resp, req.token));
      }
    });
  });
  app.delete(prefix+'/posts/:post_id', function(req, resp) {
    // can also be @username
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      if (usertoken==null) {
        console.log('dialect.appdotnet_official.js:DELETE/posts - no token');
        // could be they didn't log in through a server restart
        var res={
          "meta": {
            "code": 401,
            "error_message": "Call requires authentication: Authentication required to fetch token."
          }
        };
        resp.status(401).type('application/json').send(JSON.stringify(res));
      } else {
        dispatcher.delPost(req.params.post_id, usertoken, callbacks.postCallback(resp, req.token));
      }
    });
  });
  app.put(prefix+'/files', function(req, resp) {
    console.log('dialect.appdotnet_official.js:PUT/files - detect');

    resp.status(401).type('application/json').send(JSON.stringify(res));
  });
  // create file (for attachments)
  app.post(prefix+'/files', upload.single('content'), function(req, resp) {
    console.log('upload got', req.file.buffer.length, 'bytes');
    //console.log('looking for type - params:', req.params, 'body:', req.body);
    // type is in req.body.type
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      if (usertoken==null) {
        console.log('dialect.appdotnet_official.js:DELETE/posts - no token');
        // could be they didn't log in through a server restart
        var res={
          "meta": {
            "code": 401,
            "error_message": "Call requires authentication: Authentication required to fetch token."
          }
        };
        resp.status(401).type('application/json').send(JSON.stringify(res));
      } else {
        request.post({
          url: 'https://pomf.cat/upload.php',
          formData: {
            //files: fs.createReadStream(__dirname+'/git/caminte/media/mysql.png'),
            'files[]': {
              value: req.file.buffer,
              options: {
                filename: req.file.originalname,
                contentType: req.file.mimetype,
                knownLength: req.file.buffer.length
              },
            }
          }
        }, function (err, uploadResp, body) {
          if (err) {
            console.log('Error!', err);
          } else {
            //console.log('URL: ' + body);
            /*
            {"success":true,"files":[
              {
                "hash":"107df9aadaf6204789f966e1b7fcd31d75a121c1",
                "name":"mysql.png",
                "url":"https:\/\/my.mixtape.moe\/yusguk.png",
                "size":13357
              }
            ]}
            {
              success: false,
              errorcode: 400,
              description: 'No input file(s)'
            }
            */
            //console.log('body', body);
            var data=JSON.parse(body);
            //, 'from', body
            console.log('mixtape', data);
            if (data.success) {
              for(var i in data.files) {
                var file=data.files[i];
                //file.hash (md5)
                // write this to the db dude
                //file.url
                //file.size
                //file.name
                file.mime_type=req.file.mimetype;
                file.kind=req.file.mimetype.match(/image/i)?'image':'other';
                //console.log('type', req.body.type, typeof(req.body.type)); // it's string...
                file.type=req.body.type;
                dispatcher.addFile(file, usertoken, req.apiParams, callbacks.fileCallback(resp, req.token));
              }
            }
            //console.log('Regular:', fs.createReadStream(__dirname+'/git/caminte/media/mysql.png'));
          }
        });
      }
    });
  });
  app.post(prefix+'/posts/:post_id/star', function(req, resp) {
    // req.apiParams.tokenobj isn't set because IO
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      if (usertoken==null) {
        console.log('dialect.appdotnet_official.js:POST/posts/ID/star - no token');
        // could be they didn't log in through a server restart
        var res={
          "meta": {
            "code": 401,
            "error_message": "Call requires authentication: Authentication required to fetch token."
          }
        };
        resp.status(401).type('application/json').send(JSON.stringify(res));
      } else {
        //console.log('dialect.appdotnet_official.js:POST/posts/ID/star - usertoken', usertoken);
        dispatcher.addStar(req.params.post_id, usertoken, callbacks.postCallback(resp, req.token));
      }
    });
  });
  app.delete(prefix+'/posts/:post_id/star', function(req, resp) {
    // req.apiParams.tokenobj isn't set because IO
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      if (usertoken==null) {
        console.log('dialect.appdotnet_official.js:DELETE/posts/ID/star - no token');
        // could be they didn't log in through a server restart
        var res={
          "meta": {
            "code": 401,
            "error_message": "Call requires authentication: Authentication required to fetch token."
          }
        };
        resp.status(401).type('application/json').send(JSON.stringify(res));
      } else {
        //console.log('dialect.appdotnet_official.js:POST/posts/ID/star - usertoken', usertoken);
        dispatcher.delStar(req.params.post_id, usertoken, callbacks.postCallback(resp, req.token));
      }
    });
  });
  app.post(prefix+'/posts/:post_id/repost', function(req, resp) {
    // req.apiParams.tokenobj isn't set because IO
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      if (usertoken==null) {
        console.log('dialect.appdotnet_official.js:DELETE/posts/ID/star - no token');
        // could be they didn't log in through a server restart
        var res={
          "meta": {
            "code": 401,
            "error_message": "Call requires authentication: Authentication required to fetch token."
          }
        };
        resp.status(401).type('application/json').send(JSON.stringify(res));
      } else {
        dispatcher.addRepost(req.params.post_id, usertoken, callbacks.postCallback(resp, req.token));
      }
    });
  });
  app.delete(prefix+'/posts/:post_id/repost', function(req, resp) {
    // req.apiParams.tokenobj isn't set because IO
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      if (usertoken==null) {
        console.log('dialect.appdotnet_official.js:DELETE/posts/ID/star - no token');
        // could be they didn't log in through a server restart
        var res={
          "meta": {
            "code": 401,
            "error_message": "Call requires authentication: Authentication required to fetch token."
          }
        };
        resp.status(401).type('application/json').send(JSON.stringify(res));
      } else {
        dispatcher.delRepost(req.params.post_id, usertoken, callbacks.postCallback(resp, req.token));
      }
    });
  });

  // {"meta":{"code":401,"error_message":"Call requires authentication: This resource requires authentication and no token was provided."}}
  app.get(prefix+'/posts/stream', function(req, resp) {
    dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
      //console.log('usertoken',usertoken);
      if (usertoken==null) {
        console.log('dialect.appdotnet_official.js:postsStream - no token');
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
        dispatcher.getUserStream(usertoken.userid, req.apiParams.pageParams, req.token, function(err, posts, meta) {
          var func=callbacks.postsCallback(resp, req.token);
          //console.log('getUserStream',posts);
          func(err, posts, meta);
        });
      }
    });
  });
  // /posts/stream/unified
  app.get(prefix+'/posts/stream/unified', function(req, resp) {
    console.log('dialect.appdotnet_official.js:postsStreamUnified - start', req.token);
    // why bother the message pump and DB if req.token is undefined
    if (req.token==undefined) {
      console.log('dialect.appdotnet_official.js:postsStreamUnified - token not set');
      // could be they didn't log in through a server restart
      var res={
        "meta": {
          "code": 401,
          "error_message": "Call requires authentication: Authentication required to fetch token."
        }
      };
      resp.status(401).type('application/json').send(JSON.stringify(res));
    } else {
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        //console.log('usertoken',usertoken);
        if (usertoken==null) {
          console.log('dialect.appdotnet_official.js:postsStreamUnified - no token');
          // could be they didn't log in through a server restart
          var res={
            "meta": {
              "code": 401,
              "error_message": "Call requires authentication: Authentication required to fetch token."
            }
          };
          resp.status(401).type('application/json').send(JSON.stringify(res));
        } else {
          //console.log('dialect.appdotnet_official.js:postsStream - getUserStream', req.token);
          //dispatcher.getUserStream(usertoken.userid, req.apiParams.pageParams, req.token, callbacks.postsCallback(resp));
          dispatcher.getUnifiedStream(usertoken.userid, req.apiParams.pageParams, req.token, function(err, posts, meta) {
            //console.log('dialect.appdotnet_official.js:postsStream - sending');
            var func=callbacks.postsCallback(resp, req.token);
            //console.log('getUserStream',posts);
            func(err, posts, meta);
          });
        }
      });
    }
  });
  app.get(prefix+'/users/:user_id/mentions', function(req, resp) {
    dispatcher.getMentions(req.params.user_id, req.apiParams.pageParams,
      req.token, callbacks.postsCallback(resp, req.token));
  });
  /*
  app.get(prefix+'/users/:user_id/stars', function(req, resp) {
    // do we need a token, do we have a token?
    //console.log('dialect.appdotnet_official.js:usersStars - token', req.apiParams.tokenobj);
    dispatcher.getUserStars(req.params.user_id, req.apiParams.pageParams, callbacks.postsCallback(resp, req.token));
  });
  */
  app.get(prefix+'/users/:user_id/following', function(req, resp) {
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      if (usertoken===null) {
        var res={
          "meta": {
            "code": 401,
            "error_message": "Call requires authentication: Authentication required to fetch token."
          }
        };
        resp.status(401).type('application/json').send(JSON.stringify(res));
        return;
      }
      dispatcher.getFollowings(req.params.user_id, req.apiParams.pageParams,
        usertoken, callbacks.usersCallback(resp, req.token));
    });
    //var cb=callbacks.posts2usersCallback(resp, req.token);
    //cb(notimplemented, 'not implemented', { code: 200 });
  });
  app.get(prefix+'/users/:user_id/followers', function(req, resp) {
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      if (usertoken===null) {
        var res={
          "meta": {
            "code": 401,
            "error_message": "Call requires authentication: Authentication required to fetch token."
          }
        };
        resp.status(401).type('application/json').send(JSON.stringify(res));
        return;
      }
      dispatcher.getFollowers(req.params.user_id, req.apiParams.pageParams,
        usertoken, callbacks.usersCallback(resp, req.token));
    });
    //var cb=callbacks.posts2usersCallback(resp, req.token);
    //cb(notimplemented, 'not implemented', { code: 200 });
  });

  /*
   * No token endpoints
   */
  app.get(prefix+'/posts/:id', function(req, resp) {
    dispatcher.getPost(req.params.id, req.apiParams, callbacks.postCallback(resp, req.token));
  });
  app.get(prefix+'/users/:user_id', function(req, resp) {
    if (!req.token) {
      dispatcher.getUser(req.params.user_id, req.apiParams, callbacks.dataCallback(resp));
      return;
    }
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      //console.log('dialect.appdotnet_official.js:GETusers/ID - ', usertoken);
      if (usertoken!=null) {
        //console.log('dialect.appdotnet_official.js:GETusers/ID - found a token');
        req.apiParams.tokenobj=usertoken;
      }
      dispatcher.getUser(req.params.user_id, req.apiParams, callbacks.userCallback(resp));
    });
  });
  app.get(prefix+'/users/:user_id/posts', function(req, resp) {
    // we need token for stars/context
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      //console.log('usertoken', usertoken);
      if (usertoken!=null) {
        req.apiParams.pageParams.tokenobj=usertoken;
      }
      dispatcher.getUserPosts(req.params.user_id, req.apiParams.pageParams, callbacks.postsCallback(resp, req.token));
    });
  });
  app.get(prefix+'/users/:user_id/stars', function(req, resp) {
    //console.log('ADNO::usersStar');
    // we need token for stars/context
    //console.log('dialect.appdotnet_official.js:GETusers/ID/stars - token', req.token);
    if (!req.token) {
      dispatcher.getUserStars(req.params.user_id, req.apiParams.pageParams, callbacks.dataCallback(resp));
      return;
    }
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      console.log('dialect.appdotnet_official.js:GETusers/ID/stars - ', usertoken);
      if (usertoken!=null) {
        //console.log('dialect.appdotnet_official.js:GETusers/ID/stars - found a token');
        req.apiParams.pageParams.tokenobj=usertoken;
      }
      dispatcher.getUserStars(req.params.user_id, req.apiParams.pageParams, callbacks.postsCallback(resp, req.token));
    });
  });
  app.get(prefix+'/posts/tag/:hashtag', function(req, resp) {
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      console.log('dialect.appdotnet_official.js:GETusers/ID/stars - ', usertoken);
      if (usertoken!=null) {
        //console.log('dialect.appdotnet_official.js:GETusers/ID/stars - found a token');
        req.apiParams.tokenobj=usertoken;
      }
      dispatcher.getHashtag(req.params.hashtag, req.apiParams, callbacks.dataCallback(resp));
    });
  });
  app.get(prefix+'/posts/stream/global', function(req, resp) {
    // why data instead of posts?
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      req.apiParams.tokenobj=usertoken;
      dispatcher.getGlobal(req.apiParams, callbacks.postsCallback(resp, req.token));
    });
  });
  app.get(prefix+'/posts/stream/explore', function(req, resp) {
    dispatcher.getExplore(req.apiParams.pageParams, callbacks.dataCallback(resp));
  });
  app.get(prefix+'/posts/stream/explore/:feed', function(req, resp) {
    // this is just a stub hack
    //dispatcher.getGlobal(req.apiParams.pageParams, callbacks.postsCallback(resp, req.token));
    // going to get usertoken...
    dispatcher.getExploreFeed(req.params.feed, req.apiParams.pageParams, callbacks.postsCallback(resp, req.token));
    //var cb=callbacks.postsCallback(resp, req.token);
    //cb(notimplemented, 'not implemented', { code: 200 });
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
