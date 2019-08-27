/**
This module takes the API and communicates with the front-end internal API (dispatcher)
to provide data
this file is responsible for the dialect for the associate mountpoint

we're responsible for filteirng models to make sure we only return what matches the dialect's spec
*/
var callbacks = require('./dialect.appdotnet_official.callbacks.js');
// for pomf support
var request=require('request');
var multer  = require('multer');
var storage = multer.memoryStorage()
var upload = multer({ storage: storage, limits: {fileSize: 100*1024*1024} });

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
      dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
        //console.log('usertoken',usertoken);
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
          //console.log('dialect.*.js::got token for /token { userid:',usertoken.userid,'client_id:',usertoken.client_id);
          // FIXME: pass params
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
  app.post(prefix+'/posts/marker', function(req, resp) {
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
        return;
      }
      console.log('dialect.*.js::POSTpostsMarker', req.body);
      dispatcher.setStreamMarker(req.body.name, req.body.id, req.body.percentage, usertoken, req.apiParams, callbacks.dataCallback(resp));
    });
  })
  app.get(prefix+'/users/:user_id/interactions', function(req, resp) {
    // req.token
    // req.token convert into userid/sourceid
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
        // This endpoint accepts the interaction_actions as a query string parameter whose value
        // is a comma separated list of actions you’re interested in. For instance, if you’re
        // only interested in repost and follow interactions you could request
        // users/me/interactions?interaction_actions=repost,follow.

        // I don't think we want to pass the full token
        // wut? why not?
        dispatcher.getInteractions(req.params.user_id, usertoken, req.apiParams, callbacks.dataCallback(resp));
      }
    });
  });
  // Token: Any
  app.get(prefix+'/posts/:post_id/replies', function(req, resp) {
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      dispatcher.getReplies(req.params.post_id, req.apiParams, usertoken, callbacks.postsCallback(resp, req.token));
    });
  });

  // Token: User, Scope: files
  app.get(prefix+'/users/me/files', function(req, resp) {
    // req.token
    // req.token convert into userid/sourceid
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
        // This endpoint accepts the interaction_actions as a query string parameter whose value
        // is a comma separated list of actions you’re interested in. For instance, if you’re
        // only interested in repost and follow interactions you could request
        // users/me/interactions?interaction_actions=repost,follow.

        // I don't think we want to pass the full token
        // wut? why not?

        dispatcher.getFiles(usertoken.userid, req.apiParams, callbacks.dataCallback(resp));
      }
    });
  });

  // Token: Any, Scope: no specified
  // app tokens can use user_id query to specify which users
  app.get(prefix+'/users/:user_id/muted', function(req, resp) {
    // req.token
    // req.token convert into userid/sourceid
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
        dispatcher.getMutes(req.params.user_id, req.apiParams, usertoken, callbacks.dataCallback(resp));
      }
    });
  });

  app.post(prefix+'/users/:user_id/mute', function(req, resp) {
    // req.token
    // req.token convert into userid/sourceid
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
        dispatcher.addMute(req.params.user_id, req.apiParams, usertoken, callbacks.dataCallback(resp));
      }
    });
  });


  app.delete(prefix+'/users/:user_id/mute', function(req, resp) {
    // req.token
    // req.token convert into userid/sourceid
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
        dispatcher.deleteMute(req.params.user_id, req.apiParams, usertoken, callbacks.dataCallback(resp));
      }
    });
  });

  // Token: Any, Scope: none in the docs
  app.get(prefix+'/users/search', function(req, resp) {
    // req.token
    // req.token convert into userid/sourceid
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
        // q or query?
        dispatcher.userSearch(req.query.q, req.apiParams, usertoken, callbacks.usersCallback(resp, req.token));
      }
    });
  });

  function followHandler(req, resp) {
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
        //console.log('ADNO::users/ID/follow - user_id', followsid);
        // data.user.id, data.follows_user.id
        dispatcher.setFollows({
          user: { id: usertoken.userid }, follows_user: { id: followsid },
        }, 0, 0, Date.now(), callbacks.userCallback(resp, req.token));
      }
    });
  }

  app.post(prefix+'/users/:user_id/follow', followHandler);
  app.put(prefix+'/users/:user_id/follow', followHandler);

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
    console.log('ADNO::POST/posts - params', req.body);
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
    if (req.file) {
      console.log('POSTfiles - file upload got', req.file.buffer.length, 'bytes');
    } else {
      // no files uploaded
      var res={
        "meta": {
          "code": 400,
          "error_message": "No file uploaded"
        }
      };
      resp.status(400).type('application/json').send(JSON.stringify(res));
      return
    }
    if (!req.file.buffer.length) {
      // no files uploaded
      var res={
        "meta": {
          "code": 400,
          "error_message": "No file uploaded"
        }
      };
      resp.status(400).type('application/json').send(JSON.stringify(res));
      return
    }
    //console.log('looking for type - params:', req.params, 'body:', req.body);
    // type is in req.body.type
    //console.log('POSTfiles - req token', req.token);
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      if (err) {
        console.log('dialect.appdotnet_official.js:POSTfiles - token err', err);
      }
      if (usertoken==null) {
        console.log('dialect.appdotnet_official.js:POSTfiles - no token');
        // could be they didn't log in through a server restart
        var res={
          "meta": {
            "code": 401,
            "error_message": "Call requires authentication: Authentication required to fetch token."
          }
        };
        resp.status(401).type('application/json').send(JSON.stringify(res));
      } else {
        if (req.body.type === undefined) {
          // spec doesn't say required
          req.body.type = ''
        }
        console.log('dialect.appdotnet_official.js:POSTfiles - uploading to pomf');
        var uploadUrl = dispatcher.appConfig.provider_url + '/upload.php'
        request.post({
          url: uploadUrl,
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
            console.log('dialect.appdotnet_official.js:POSTfiles - pomf upload Error!', err);
            var res={
              "meta": {
                "code": 500,
                "error_message": "Could not save file (Could not POST to POMF)"
              }
            };
            resp.status(res.meta.code).type('application/json').send(JSON.stringify(res));
            return;
          } else {
            //console.log('URL: ' + body);
            /*
            {"success":true,"files":[
              {
                "hash":"107df9aadaf6204789f966e1b7fcd31d75a121c1",
                "name":"mysql.png",
                "url":"https:\/\/my.pomf.cat\/yusguk.png",
                "size":13357
              }
            ]}
            {
              success: false,
              errorcode: 400,
              description: 'No input file(s)'
            }
            */
            var data = {};
            try {
              data=JSON.parse(body);
            } catch(e) {
              console.log('couldnt json parse body', body);
              var res={
                "meta": {
                  "code": 500,
                  "error_message": "Could not save file (POMF did not return JSON as requested)"
                }
              };
              resp.status(res.meta.code).type('application/json').send(JSON.stringify(res));
              return;
            }
            if (!data.success) {
              var res={
                "meta": {
                  "code": 500,
                  "error_message": "Could not save file (POMF did not return success)"
                }
              };
              resp.status(res.meta.code).type('application/json').send(JSON.stringify(res));
              return;
            }
            //, 'from', body
            console.log('dialect.appdotnet_official.js:POSTfiles - pomf result', data);
            for(var i in data.files) {
              var file=data.files[i];
              // write this to the db dude
              // dispatcher.appConfig.provider_url+
              // maybe pomf.cat doesn't add the prefix
              // but mixtape does
              // just normalize it (add and strip it, it'll make sure it's always there)
              //file.url = dispatcher.appConfig.provider_url + file.url.replace(dispatcher.appConfig.provider_url, '');
              // that probably won't be the download URL
              file.url = file.url
              //file.url <= passes through
              //file.size <= passes through
              //file.name <= passes through
              file.sha1 = file.hash; // hash is sha1
              file.mime_type=req.file.mimetype;
              // there's only image or other
              file.kind=req.file.mimetype.match(/image/i)?'image':'other';
              // if it's an image or video, we should get w/h
              //console.log('type', req.body.type, typeof(req.body.type)); // it's string...
              // warn if body.type is empty because it'll crash the server
              file.type = req.body.type;
              dispatcher.addFile(file, usertoken, req.apiParams, callbacks.fileCallback(resp, req.token));
            }
          }
            //console.log('Regular:', fs.createReadStream(__dirname+'/git/caminte/media/mysql.png'));
        });
      }
    });
  });


  function starHandler(req, resp) {
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
  }
  app.post(prefix+'/posts/:post_id/star', starHandler);
  app.put(prefix+'/posts/:post_id/star', starHandler);
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

  function repostHandler(req, resp) {
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
  }

  app.post(prefix+'/posts/:post_id/repost', repostHandler);
  app.put(prefix+'/posts/:post_id/repost', repostHandler);
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
    //console.log('dialect.appdotnet_official.js:postsStream - start', req.token);
    // don't we already handle this in the middleware
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
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
        //console.log('dialect.appdotnet_official.js:postsStream - getUserStream', req.token);
        //dispatcher.getUserStream(usertoken.userid, req.apiParams.pageParams, req.token, callbacks.postsCallback(resp));
        dispatcher.getUserStream(usertoken.userid, req.apiParams,
            usertoken, function(posts, err, meta) {
          //console.log('dialect.appdotnet_official.js:postsStream - sending');
          var func=callbacks.postsCallback(resp, req.token);
          //console.log('getUserStream', posts);
          func(posts, err, meta);
        });
      }
    });
  });

  // search for posts (Token: Any)
  app.get(prefix+'/posts/search', function(req, resp) {
    //console.log('dialect.appdotnet_official.js:postsSearch - start', req.token);
    // don't we already handle this in the middleware
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      //console.log('dialect.appdotnet_official.js:postsSearch - ',usertoken);
      if (usertoken==null) {
        //console.log('dialect.appdotnet_official.js:postsSearch - no token');
        // could be they didn't log in through a server restart
        var res={
          "meta": {
            "code": 401,
            "error_message": "Call requires authentication: Authentication required to fetch token."
          }
        };
        resp.status(401).type('application/json').send(JSON.stringify(res));
      } else {
        // q or query?
        dispatcher.postSearch(req.query.q, req.apiParams, usertoken, callbacks.usersCallback(resp, req.token));
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
      dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
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
          dispatcher.getUnifiedStream(usertoken.userid, req.apiParams, req.token, function(posts, err, meta) {
            //console.log('dialect.appdotnet_official.js:postsStream - sending');
            var func=callbacks.postsCallback(resp, req.token);
            //console.log('getUserStream',posts);
            func(posts, err, meta);
          });
        }
      });
    }
  });
  app.get(prefix+'/users/:user_id/mentions', function(req, resp) {
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      if (usertoken!=null) {
        //console.log('dialect.appdotnet_official.js:GETchannels - found a token', usertoken);
        req.apiParams.tokenobj=usertoken;
        //userid=usertoken.userid;
      }
      dispatcher.getMentions(req.params.user_id, req.apiParams,
        req.apiParams.tokenobj, callbacks.postsCallback(resp, req.token));
    });
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
      dispatcher.getFollowings(req.params.user_id, req.apiParams,
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
      dispatcher.getFollowers(req.params.user_id, req.apiParams,
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

  // retreive multiple users (Token: any)
  // /reference/resources/user/lookup/#retrieve-multiple-users
  // ids are usually numeric but also can be @username
  app.get(prefix+'/users', function(req, resp) {
    if (!req.token) {
      var ids = req.query.ids
      if (ids && ids.match(/,/)) {
        ids = ids.split(/,/)
      }
      dispatcher.getUsers(ids, req.apiParams, callbacks.usersCallback(resp));
      return;
    }
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      //console.log('dialect.appdotnet_official.js:GETusers/ID - ', usertoken);
      if (usertoken!=null) {
        //console.log('dialect.appdotnet_official.js:GETusers/ID - found a token');
        req.apiParams.tokenobj=usertoken;
      }
      if (!req.query.ids) {
        var res={
          "meta": {
            "code": 400,
            "error_message": "Call requires and id to lookup"
          }
        };
        resp.status(401).type('application/json').send(JSON.stringify(res));
        return;
      }
      dispatcher.getUsers(req.query.ids.split(/,/), req.apiParams, callbacks.usersCallback(resp));
    });
  });

  app.get(prefix+'/users/:user_id', function(req, resp) {
    //console.log('dialect.appdotnet_official.js:GETusersX - token', req.token);
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

  // Token: User Scope: update_profile
  app.put(prefix+'/users/me', function updateUser(req, resp) {
    //console.log('dialect.appdotnet_official.js:PUTusersX - token', req.token)
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      //console.log('dialect.appdotnet_official.js:PUTusersX - usertoken', usertoken)
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
      req.apiParams.tokenobj=usertoken;
      console.log('dialect.appdotnet_official.js:PUTusersXx - body', req.body);
      //console.log('dialect.appdotnet_official.js:PUTusersX - creating channel of type', req.body.type);
      if (req.body.name === undefined || req.body.locale  === undefined ||
        req.body.timezone  === undefined || req.body.description === undefined ||
        req.body.description.text === undefined) {
        var res={
          "meta": {
            "code": 400,
            "error_message": "Requires name, locale, timezone, and description to change (JSON encoded)"
          }
        };
        resp.status(400).type('application/json').send(JSON.stringify(res));
        return;
      }
      //console.log('dialect.appdotnet_official.js:PUTusersXx - description.text', req.body.description.text)
      // user param to load everything
      //console.log('dialect.appdotnet_official.js:PUTusersXx - userid', usertoken.userid)
      dispatcher.getUser(usertoken.userid, { generalParams: { annotations: true, include_html: true } }, function(userObj, err) {
        // These are required fields
        /*
        var userobj={
          name: req.body.name,
          locale: req.body.locale,
          timezone: req.body.timezone,
          description: {
            text: req.body.description.text,
          },
        };
        */
        userObj.name = req.body.name;
        userObj.locale = req.body.locale;
        userObj.timezone = req.body.timezone;
        userObj.description.text = req.body.description.text;
        // optional fields
        if (req.body.annotations) {
          // spec says we need to add/update (delete if set/blank)
          // actually there'll be a type but no value
          // deletes / preprocess
          for(var i in req.body.annotations) {
            var note = req.body.annotations[i]
            if (note.type && note.value === undefined) {
              console.log('dialect.appdotnet_official.js:PUTusersXx - need to delete', note.type);
            }
          }
          userObj.annotations = req.body.annotations;
        }
        //userObj.id = usertoken.userid;
        console.log('dialect.appdotnet_official.js:PUTusersXx - userobj', userObj);
        dispatcher.updateUser(userObj, Date.now()/1000, callbacks.dataCallback(resp));
      });
      //dispatcher.addChannel(channel, req.apiParams, usertoken, callbacks.dataCallback(resp));
    });
  });
  // partially update a user (Token: User Scope: update_profile)
  app.patch(prefix+'/users/me', function updateUser(req, resp) {
    //console.log('dialect.appdotnet_official.js:PATCHusersX - token', req.token)
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      //console.log('dialect.appdotnet_official.js:PATCHusersX - usertoken', usertoken)
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
      req.apiParams.tokenobj=usertoken;
      //console.log('dialect.appdotnet_official.js:PATCHusersX - bodyType['+req.body+']');
      //console.log('dialect.appdotnet_official.js:PATCHusersX - body ', req.body);
      //var bodyObj = JSON.parse(req.body)
      var bodyObj = req.body
      /*
      for(var i in req.body) {
        console.log('dialect.appdotnet_official.js:PATCHusersX -', i, '=', req.body[i]);
      }
      */
      //console.log('dialect.appdotnet_official.js:PATCHusersX - test', req.body.annotations);
      var request={
        //name: req.body.name,
        //locale: req.body.locale,
        //timezone: req.body.timezone,
        //description: req.body.description,
      }
      if (bodyObj.name) {
        request.name = bodyObj.name
      }
      if (bodyObj.locale) {
        request.locale = bodyObj.locale
      }
      if (bodyObj.timezone) {
        request.timezone = bodyObj.timezone
      }
      if (bodyObj.description) {
        request.description = bodyObj.description
      }
      // optional fields
      if (req.body.annotations) {
        request.annotations = req.body.annotations;
      }
      console.log('dialect.appdotnet_official.js:PATCHusersX - request', request);
      //console.log('dialect.appdotnet_official.js:PATCHusersX - creating channel of type', req.body.type);
      dispatcher.patchUser(request, req.apiParams, usertoken, callbacks.dataCallback(resp));
    });
  });

  app.get(prefix+'/users/:user_id/posts', function(req, resp) {
    // we need token for stars/context
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      //console.log('usertoken', usertoken);
      if (usertoken!=null) {
        req.apiParams.pageParams.tokenobj=usertoken;
      }
      dispatcher.getUserPosts(req.params.user_id, req.apiParams, callbacks.postsCallback(resp, req.token));
    });
  });
  app.get(prefix+'/users/:user_id/stars', function(req, resp) {
    //console.log('ADNO::usersStar');
    // we need token for stars/context
    //console.log('dialect.appdotnet_official.js:GETusers/ID/stars - token', req.token);
    if (!req.token) {
      dispatcher.getUserStars(req.params.user_id, req.apiParams, callbacks.dataCallback(resp));
      return;
    }
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      //console.log('dialect.appdotnet_official.js:GETusers/ID/stars - ', usertoken);
      if (usertoken!=null) {
        //console.log('dialect.appdotnet_official.js:GETusers/ID/stars - found a token');
        req.apiParams.tokenobj=usertoken;
      }
      dispatcher.getUserStars(req.params.user_id, req.apiParams, callbacks.postsCallback(resp, req.token));
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
    dispatcher.getExplore(req.apiParams, callbacks.dataCallback(resp));
  });
  app.get(prefix+'/posts/stream/explore/:feed', function(req, resp) {
    // this is just a stub hack
    //dispatcher.getGlobal(req.apiParams.pageParams, callbacks.postsCallback(resp, req.token));
    // going to get usertoken...
    dispatcher.getExploreFeed(req.params.feed, req.apiParams, callbacks.postsCallback(resp, req.token));
    //var cb=callbacks.postsCallback(resp, req.token);
    //cb(notimplemented, 'not implemented', { code: 200 });
  });

  // get current user's subscribed channels (token: user)
  // also Retrieve multiple Channels (token: any)
  app.get(prefix+'/channels', function(req, resp) {
    //console.log('dialect.appdotnet_official.js:GETchannels - token:', req.token);
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      //console.log('dialect.appdotnet_official.js:GETchannels - got token:', usertoken);
      var userid='';
      if (usertoken!=null) {
        //console.log('dialect.appdotnet_official.js:GETchannels - found a token', usertoken);
        req.apiParams.tokenobj=usertoken;
        userid=usertoken.userid;
      }
      var ids=null;
      if (req.query.ids) {
        ids=req.query.ids.split(/,/);
        //console.log('dialect.appdotnet_official.js:GETchannels - getting list of channels', ids);
        dispatcher.getChannel(ids, req.apiParams, callbacks.dataCallback(resp));
        return;
      }
      if (usertoken===null) {
        console.log('dialect.appdotnet_official.js:GETchannels - failed to get token:', req.token);
        var res={
          "meta": {
            "code": 401,
            "error_message": "Call requires authentication: Authentication required to fetch token."
          }
        };
        resp.status(401).type('application/json').send(JSON.stringify(res));
        return;
      }
      console.log('dialect.appdotnet_official.js:GETchannels - getting list of user subs for', userid);
      dispatcher.getUserSubscriptions(userid, req.apiParams, callbacks.dataCallback(resp));
    });
  });

  // token: user, scope: public_messages or messages
  app.get(prefix+'/users/me/channels', function(req, resp) {
    //console.log('dialect.appdotnet_official.js:GETusersMEchannels - token:', req.token);
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      //console.log('dialect.appdotnet_official.js:GETusersMEchannels - got token:', usertoken);
      if (usertoken===null) {
        console.log('dialect.appdotnet_official.js:GETchannels - failed to get token:', req.token, typeof(req.token));
        var res={
          "meta": {
            "code": 401,
            "error_message": "Call requires authentication: Authentication required to fetch token."
          }
        };
        resp.status(401).type('application/json').send(JSON.stringify(res));
        return;
      }
      //console.log('dialect.appdotnet_official.js:GETusersMEchannels - found a token', usertoken);
      req.apiParams.tokenobj=usertoken;
      //console.log('dialect.appdotnet_official.js:GETusersMEchannels - getting list of user subs for', usertoken.userid);
      dispatcher.getUserChannels(req.apiParams, usertoken, callbacks.dataCallback(resp));
    });
  });

  // Create a channel (token: user)
  app.post(prefix+'/channels', function(req, resp) {
    console.log('dialect.appdotnet_official.js:POSTchannels - token', req.token)
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      console.log('dialect.appdotnet_official.js:POSTchannels - usertoken', usertoken)
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
      req.apiParams.tokenobj=usertoken;
      //console.log('dialect.appdotnet_official.js:POSTchannels - creating channel of type', req.body.type);
      if (!req.body.type) {
        var res={
          "meta": {
            "code": 400,
            "error_message": "Require a type (JSON encoded)"
          }
        };
        resp.status(400).type('application/json').send(JSON.stringify(res));
        return;
      }
      // Currently, the only keys we use from your JSON will be readers, writers, annotations, and type.
      var channel={
        type: req.body.type,
        readers: req.body.readers?req.body.readers:{},
        writers: req.body.writers?req.body.writers:{},
        editors: {},
        annotations: req.body.annotations
      }
      dispatcher.addChannel(channel, req.apiParams, usertoken, callbacks.dataCallback(resp));
    });
  });

  // search for channels (Token: User, Scope: public_messages or messages)
  app.get(prefix+'/channels/search', function(req, resp) {
    //console.log('dialect.appdotnet_official.js:channelsSearch - start', req.token);
    // don't we already handle this in the middleware
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      //console.log('usertoken',usertoken);
      if (usertoken==null) {
        //console.log('dialect.appdotnet_official.js:channelsSearch - no token');
        // could be they didn't log in through a server restart
        var res={
          "meta": {
            "code": 401,
            "error_message": "Call requires authentication: Authentication required to fetch token."
          }
        };
        resp.status(401).type('application/json').send(JSON.stringify(res));
        return;
      }
      //console.log('dialect.appdotnet_official.js:channelsSearch - getUserStream', req.token);
      //dispatcher.getUserStream(usertoken.userid, req.apiParams.pageParams, req.token, callbacks.postsCallback(resp));
      var critera = {
      }
      if (req.query.type) {
        critera.type = req.query.type;
      }
      if (req.query.creator_id) {
        critera.ownerid = req.query.creator_id;
      }
      dispatcher.channelSearch(critera, req.apiParams, usertoken,
          function(channels, err, meta) {
        //console.log('dialect.appdotnet_official.js:channelsSearch - sending');
        var func=callbacks.dataCallback(resp, req.token);
        //console.log('getUserStream', posts);
        func(channels, err, meta);
      });
    });
  });

  app.get(prefix+'/channels/messages', function(req, resp) {
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      //console.log('dialect.appdotnet_official.js:GETchannelsMESSAGES - got token:', usertoken);
      var userid='';
      if (usertoken!=null) {
        //console.log('dialect.appdotnet_official.js:GETchannelsMESSAGES - found a token', usertoken);
        req.apiParams.tokenobj=usertoken;
        userid=usertoken.userid;
      }
      //console.log('dialect.appdotnet_official.js:GETchannelsMESSAGES - ids', req.query.ids);
      dispatcher.getMessage(req.query.ids.split(/,/), req.apiParams, usertoken, callbacks.dataCallback(resp));
    });
  })

  // channel_id 1383 was always good for testing
  // Retrieve a Channel && Retrieve multiple Channels
  app.get(prefix+'/channels/:channel_id', function(req, resp) {
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      //console.log('dialect.appdotnet_official.js:GETchannels - got token:', usertoken);
      var userid='';
      if (usertoken!=null) {
        //console.log('dialect.appdotnet_official.js:GETchannels - found a token', usertoken);
        req.apiParams.tokenobj=usertoken;
        userid=usertoken.userid;
      }
      //console.log('dialect.appdotnet_official.js:GETchannels - channel_id', req.params.channel_id);
      dispatcher.getChannel(req.params.channel_id, req.apiParams, callbacks.dataCallback(resp));
    });
  });

  // update channel (Token: User / Scope: public_messages or messages)
  // maybe a app.patch that calls this too?
  app.put(prefix+'/channels/:channel_id', function(req, resp) {
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      //console.log('dialect.appdotnet_official.js:PUTchannels - got token:', usertoken);
      var userid='';
      if (usertoken==null) {
        var res={
          "meta": {
            "code": 401,
            "error_message": "Call requires authentication: Authentication required to fetch token."
          }
        };
        resp.status(401).type('application/json').send(JSON.stringify(res));
        return;
      }
      //console.log('dialect.appdotnet_official.js:PUTchannels - found a token', usertoken);
      req.apiParams.tokenobj=usertoken;
      //userid=usertoken.userid;
      //console.log('dialect.appdotnet_official.js:PUTchannels - body', typeof(req.body), Object.keys(req.body));
      // The only keys that can be updated are annotations, readers, and writers
      var updates = {};
      if (req.body.writers) {
        updates.writers = req.body.writers;
      }
      if (req.body.readers) {
        updates.readers = req.body.readers;
      }
      if (req.body.annotations) {
        updates.annotations = req.body.annotations;
      }
      /*
      { auto_subscribe: true,
        writers: { immutable: false, any_user: true },
        readers: { immutable: false, public: true },
        annotations:
         [ { type: 'net.patter-app.settings', value: [Object] },
           { type: 'net.app.core.fallback_url', value: [Object] } ] }
      */
      console.log('dialect.appdotnet_official.js:PUTchannels - updates', updates, 'notes', updates.annotations);
      // updateChannel: function(channelid, update, params, token, callback) {
      dispatcher.updateChannel(req.params.channel_id, updates, req.apiParams, usertoken, callbacks.dataCallback(resp));
    });
  });

  app.delete(prefix+'/channels/:channel_id', function(req, resp) {
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      //console.log('dialect.appdotnet_official.js:DELETEchannels - got token:', usertoken);
      var userid='';
      if (usertoken==null) {
        var res={
          "meta": {
            "code": 401,
            "error_message": "Call requires authentication: Authentication required to fetch token."
          }
        };
        resp.status(401).type('application/json').send(JSON.stringify(res));
        return;
      }
      //console.log('dialect.appdotnet_official.js:DELETEchannels - found a token', usertoken);
      req.apiParams.tokenobj=usertoken;
      // FIXME: enforce that req.params.channel_id is numeric
      //console.log('dialect.appdotnet_official.js:DELETEchannels - channel_id', req.params.channel_id);
      // deactiveChannel: function(channelid, params, token, callback) {
      dispatcher.deactiveChannel(req.params.channel_id, req.apiParams, usertoken, callbacks.dataCallback(resp));
    });
  });

  // subscribe to a channel (token: user / scope: public_messages or messages)
  app.post(prefix+'/channels/:channel_id/subscribe', function(req, resp) {
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      //console.log('dialect.appdotnet_official.js:POSTchannelsXsubscribe - got token:', usertoken);
      var userid='';
      if (usertoken==null) {
        var res={
          "meta": {
            "code": 401,
            "error_message": "Call requires authentication: Authentication required to fetch token."
          }
        };
        resp.status(401).type('application/json').send(JSON.stringify(res));
        return;
      }
      req.apiParams.tokenobj=usertoken;
      console.log('dialect.appdotnet_official.js:POSTchannelsXsubscribe - user:', usertoken.userid, 'channel:', req.params.channel_id);
      //addChannelSubscription: function(token, channel_id, params, callback)
      dispatcher.addChannelSubscription(usertoken, req.params.channel_id, req.apiParams, callbacks.dataCallback(resp));
    });
  });

  // unsubscribe to a channel (token: user / scope: public_messages or messages)
  app.delete(prefix+'/channels/:channel_id/subscribe', function(req, resp) {
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      //console.log('dialect.appdotnet_official.js:DELETEchannelsXsubscribe - got token:', usertoken);
      var userid='';
      if (usertoken==null) {
        var res={
          "meta": {
            "code": 401,
            "error_message": "Call requires authentication: Authentication required to fetch token."
          }
        };
        resp.status(401).type('application/json').send(JSON.stringify(res));
        return;
      }
      req.apiParams.tokenobj=usertoken;
      console.log('dialect.appdotnet_official.js:DELETEchannelsXsubscribe - user:', usertoken.userid, 'channel:', req.params.channel_id);
      //delChannelSubscription: function(token, channel_id, params, callback)
      dispatcher.delChannelSubscription(usertoken, req.params.channel_id, req.apiParams, callbacks.dataCallback(resp));
    });
  });


  // Retrieve users subscribed to a Channel (Token: Any, Scope: public_messages or messages)
  app.get(prefix+'/channels/:channel_id/subscribers', function(req, resp) {
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      var userid='';
      if (usertoken==null) {
        var res={
          "meta": {
            "code": 401,
            "error_message": "Call requires authentication: Authentication required to fetch token."
          }
        };
        resp.status(401).type('application/json').send(JSON.stringify(res));
        return;
      }
      req.apiParams.tokenobj=usertoken;
      dispatcher.getChannelSubscriptions(req.params.channel_id, req.apiParams, callbacks.dataCallback(resp));
    });
  });

  // Retrieve multiple Messages (Token: User, Scope: public_messages or messages)
  // how do you receive public messages in a public channel?
  app.get(prefix+'/channels/:channel_id/messages', function(req, resp) {
    if (!req.token) {
      dispatcher.getChannelMessages(req.params.channel_id, req.apiParams, callbacks.dataCallback(resp));
      return;
    }
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      if (usertoken) {
        req.apiParams.tokenobj=usertoken;
      }
      dispatcher.getChannelMessages(req.params.channel_id, req.apiParams, callbacks.dataCallback(resp));
    });
  });
  // create message (token: user)
  app.post(prefix+'/channels/:channel_id/messages', function(req, resp) {
    //console.log('dialect.appdotnet_official.js:POSTchannelsXmessages - token', req.token)
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      //console.log('dialect.appdotnet_official.js:POSTchannelsXmessages - got token:', usertoken, 'for', req.token);
      var userid='';
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
      //console.log('dialect.appdotnet_official.js:GETchannels - found a token', usertoken);
      req.apiParams.tokenobj=usertoken;
      req.apiParams.client_id=usertoken.client_id; // is this needed?
      if (!req.body.text) {
        var res={
          "meta": {
            "code": 500,
            "error_message": "Call requires text to be defined in JSON body"
          }
        };
        resp.status(500).type('application/json').send(JSON.stringify(res));
        return;
      }
      var postdata={
        text: req.body.text,
      };
      if (req.body.reply_to) { // this is optional
        postdata.reply_to=req.body.reply_to;
        console.log('setting reply_to', postdata.reply_to);
      }
      if (req.body.entities) {
        // parse_link: 1, parse_markdown_links: 1
        postdata.entities=req.body.entities;
      }
      if (req.body.annotations) {
        //console.log('dialect.appdotnet_official.js:POSTchannelsXmessages - detected annotations', req.body.annotations)
        postdata.annotations=req.body.annotations;
      }
      if (req.body.destinations) {
        postdata.destinations=req.body.destinations;
        // we have to make sure we're here...
        postdata.destinations.push(usertoken.userid);
        // FIXME: also need to dedup this
      }
      console.log('dialect.appdotnet_official.js:POSTchannelsXmessages - creating message in channel', req.params.channel_id);
      //addMessage: function(channel_id, postdata, params, token, callback) {
      dispatcher.addMessage(req.params.channel_id, postdata, req.apiParams, usertoken, callbacks.dataCallback(resp));
    });
  });

  // delete message in channel
  app.delete(prefix+'/channels/:channel_id/messages/:message_id', function(req, resp) {
    //console.log('dialect.appdotnet_official.js:DELETEmessages - channel', req.params.channel_id, 'message', req.params.message_id);
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      //console.log('dialect.appdotnet_official.js:DELETEmessages - got token:', usertoken);
      var userid='';
      if (usertoken==null) {
        var res={
          "meta": {
            "code": 401,
            "error_message": "Call requires authentication: Authentication required to fetch token."
          }
        };
        resp.status(401).type('application/json').send(JSON.stringify(res));
        return;
      }
      //console.log('dialect.appdotnet_official.js:DELETEmessages - found a token', usertoken);
      req.apiParams.tokenobj=usertoken;
      //console.log('dialect.appdotnet_official.js:DELETEmessages - channel_id', req.params.channel_id);
      dispatcher.deleteMessage(req.params.message_id, req.params.channel_id, req.apiParams, usertoken, callbacks.dataCallback(resp));
    });
  });

  // Retrieve the Messages in a Channel
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
