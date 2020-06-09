/**
This module takes the API and communicates with the front-end internal API (dispatcher)
to provide data
this file is responsible for the dialect for the associate mountpoint

we're responsible for filteirng models to make sure we only return what matches the dialect's spec
*/
const callbacks = require('./dialect.appdotnet_official.callbacks.js');
const ratelimiter = require('./ratelimiter.js');

// for pomf support
const request = require('request');
const multer  = require('multer');
const storage = multer.memoryStorage();

/**
 * Set up defined API routes at prefix
 */
module.exports=function(app, prefix) {
  const dispatcher=app.dispatcher;

  // console_wrapper.log('limits', dispatcher.limits);
  // FIXME: loop through all limits and find largest...
  console_wrapper.log('default limits', dispatcher.limits.default);

  const max_fup_size = dispatcher.limits.default.max_file_size;
  console_wrapper.log('setting max file upload to', max_fup_size.toLocaleString());
  const upload  = multer({ storage: storage, limits: {fileSize: max_fup_size } });

  /*
   * Authenticated endpoints
   */
  app.get(prefix+'/token', function(req, resp) {
    // req.token convert into userid/sourceid
    //console_wrapper.log('dialect.*.js::/token  - looking up usertoken', req.token);
    if (req.token!==null && req.token!==undefined && req.token!='') {
      // need to translate token...
      dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
        //console_wrapper.log('usertoken',usertoken);
        //console_wrapper.log('dialect.*.js::/token  - got usertoken');
        if (usertoken==null) {
          console_wrapper.log('dialect.*.js::No valid token passed in to /token', req.token);
          var res={
            "meta": {
              "code": 401,
              "error_message": "Call requires authentication: Authentication required to fetch token."
            }
          };
          resp.status(401).type('application/json').send(JSON.stringify(res));
        } else {
          //console_wrapper.log('dialect.*.js::got token for /token { userid:',usertoken.userid,'client_id:',usertoken.client_id);
          // FIXME: pass params
          dispatcher.getToken(usertoken.userid, usertoken.client_id, callbacks.tokenCallback(resp, req.token));
        }
      });
    } else {
      console_wrapper.log('dialect.*.js::No token passed in to /token');
      var res={
        "meta": {
          "code": 401,
          "error_message": "Call requires authentication: Authentication required to fetch token."
        }
      };
      resp.status(401).type('application/json').send(JSON.stringify(res));
    }
  });

  // Token: Any, Scope: none in the docs
  app.get(prefix+'/users/search', function(req, resp) {
    // req.token
    // req.token convert into userid/sourceid
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      //console_wrapper.log('usertoken', usertoken);
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

  // retreive multiple users (Token: any)
  // /reference/resources/user/lookup/#retrieve-multiple-users
  // ids are usually numeric but also can be @username
  app.get(prefix+'/users', function(req, resp) {
    if (!req.token) {
      var ids = req.query.ids
      if (ids && ids.match(/, */)) {
        ids = ids.split(/, */);
      }
      if (typeof(ids) === 'string') {
        ids = [ ids ];
      }
      console_wrapper.log('dialect.appdotnet_official.js:GETusers/ID - ids', ids)
      dispatcher.getUsers(ids, req.apiParams, callbacks.usersCallback(resp));
      return;
    }
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      //console_wrapper.log('dialect.appdotnet_official.js:GETusers/ID - ', usertoken);
      if (usertoken!=null) {
        //console_wrapper.log('dialect.appdotnet_official.js:GETusers/ID - found a token');
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
    //console_wrapper.log('dialect.appdotnet_official.js:GETusersX - token', req.token);
    if (!req.token) {
      dispatcher.getUser(req.params.user_id, req.apiParams, callbacks.dataCallback(resp));
      return;
    }
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      //console_wrapper.log('dialect.appdotnet_official.js:GETusers/ID - ', usertoken);
      if (usertoken!=null) {
        //console_wrapper.log('dialect.appdotnet_official.js:GETusers/ID - found a token');
        req.apiParams.tokenobj=usertoken;
      }
      dispatcher.getUser(req.params.user_id, req.apiParams, callbacks.userCallback(resp));
    });
  });

  // Token: User Scope: update_profile
  app.put(prefix+'/users/me', function updateUser(req, resp) {
    //console_wrapper.log('dialect.appdotnet_official.js:PUTusersX - token', req.token)
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      //console_wrapper.log('dialect.appdotnet_official.js:PUTusersX - usertoken', usertoken)
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
      console_wrapper.log('dialect.appdotnet_official.js:PUTusersXx - body', req.body);
      //console_wrapper.log('dialect.appdotnet_official.js:PUTusersX - creating channel of type', req.body.type);
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
      //console_wrapper.log('dialect.appdotnet_official.js:PUTusersXx - description.text', req.body.description.text)
      // user param to load everything
      //console_wrapper.log('dialect.appdotnet_official.js:PUTusersXx - userid', usertoken.userid)
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
        if (userObj.description === undefined) userObj.description = {}
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
              console_wrapper.log('dialect.appdotnet_official.js:PUTusersXx - need to delete', note.type);
            }
          }
          userObj.annotations = req.body.annotations;
        }
        //userObj.id = usertoken.userid;
        console_wrapper.log('dialect.appdotnet_official.js:PUTusersXx - userobj', userObj);
        dispatcher.updateUser(userObj, Date.now()/1000, callbacks.dataCallback(resp));
      });
      //dispatcher.addChannel(channel, req.apiParams, usertoken, callbacks.dataCallback(resp));
    });
  });

  app.post(prefix+'/users/me/avatar', upload.single('avatar'), function updateUserAvatar(req, resp) {
    if (!req.file) {
      // no files uploaded
      var res={
        "meta": {
          "code": 400,
          "error_message": "No file uploaded"
        }
      };
      resp.status(400).type('application/json').send(JSON.stringify(res));
      return;
    }
    console_wrapper.log('POSTavatar - file upload got', req.file.buffer.length, 'bytes');
    if (!req.file.buffer.length) {
      // no files uploaded
      var res={
        "meta": {
          "code": 400,
          "error_message": "No file uploaded"
        }
      };
      resp.status(400).type('application/json').send(JSON.stringify(res));
      return;
    }
    //console_wrapper.log('looking for type - params:', req.params, 'body:', req.body);
    // type is in req.body.type
    //console_wrapper.log('POSTfiles - req token', req.token);
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      if (err) {
        console_wrapper.log('dialect.appdotnet_official.js:POSTavatar - token err', err);
      }
      if (usertoken==null) {
        console_wrapper.log('dialect.appdotnet_official.js:POSTavatar - no token');
        // could be they didn't log in through a server restart
        var res={
          "meta": {
            "code": 401,
            "error_message": "Call requires authentication: Authentication required to fetch token."
          }
        };
        return resp.status(401).type('application/json').send(JSON.stringify(res));
      }
      //console_wrapper.log('dialect.appdotnet_official.js:POSTavatar - usertoken', usertoken);
      //console_wrapper.log('dialect.appdotnet_official.js:POSTavatar - uploading to pomf');
      var uploadUrl = dispatcher.appConfig.provider_url + 'api/upload';
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
          console_wrapper.log('dialect.appdotnet_official.js:POSTavatar - pomf upload Error!', err);
          var res={
            "meta": {
              "code": 500,
              "error_message": "Could not save file (Could not POST to POMF)"
            }
          };
          resp.status(res.meta.code).type('application/json').send(JSON.stringify(res));
          return;
        }
        //console_wrapper.log('URL: ' + body);
        /*
        {"success":true,"files":[
          {
            // lolisafe doesn't have hash
            //"hash":"107df9aadaf6204789f966e1b7fcd31d75a121c1",
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
          console_wrapper.log('couldnt json parse body', body);
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
        if (!data.files.length) {
          var res={
            "meta": {
              "code": 500,
              "error_message": "Could not save file (POMF did not return files)"
            }
          };
          resp.status(res.meta.code).type('application/json').send(JSON.stringify(res));
          return;
        }
        if (data.files.length > 1) {
          console_wrapper.warn('dialect.appdotnet_official.js:POSTavatar - Multiple files!', data);
        }
        //for(var i in data.files) {
        var file=data.files[0];
        //console_wrapper.log('dialect.appdotnet_official.js:POSTavatar - setting', file.url);
        dispatcher.updateUserAvatar(file.url, req.apiParams, usertoken, callbacks.userCallback(resp, req.token));
        //}
      });
    });
  });

  // partially update a user (Token: User Scope: update_profile)
  app.patch(prefix+'/users/me', function updateUser(req, resp) {
    //console_wrapper.log('dialect.appdotnet_official.js:PATCHusersX - token', req.token)
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      //console_wrapper.log('dialect.appdotnet_official.js:PATCHusersX - usertoken', usertoken)
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
      //console_wrapper.log('dialect.appdotnet_official.js:PATCHusersX - bodyType['+req.body+']');
      //console_wrapper.log('dialect.appdotnet_official.js:PATCHusersX - body ', req.body);
      //var bodyObj = JSON.parse(req.body)
      var bodyObj = req.body
      /*
      for(var i in req.body) {
        console_wrapper.log('dialect.appdotnet_official.js:PATCHusersX -', i, '=', req.body[i]);
      }
      */
      //console_wrapper.log('dialect.appdotnet_official.js:PATCHusersX - test', req.body.annotations);
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
      console_wrapper.log('dialect.appdotnet_official.js:PATCHusersX - request', request);
      //console_wrapper.log('dialect.appdotnet_official.js:PATCHusersX - creating channel of type', req.body.type);
      dispatcher.patchUser(request, req.apiParams, usertoken, callbacks.dataCallback(resp));
    });
  });

  // Token: User, Scope: files
  app.get(prefix+'/users/me/files', function(req, resp) {
    // req.token
    // req.token convert into userid/sourceid
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      //console_wrapper.log('usertoken', usertoken);
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


  app.put(prefix+'/files', function(req, resp) {
    console_wrapper.log('dialect.appdotnet_official.js:PUT/files - detect');
    resp.status(401).type('application/json').send(JSON.stringify({
      meta: {
        code: 401,
        error: "not implemented",
      }
    }));
  });

  // create file (for attachments)
  app.post(prefix+'/files', upload.single('content'), function(req, resp) {
    if (req.file) {
      console_wrapper.log('POSTfiles - file upload got', req.file.buffer.length, 'bytes');
    } else {
      // no files uploaded
      var res={
        meta: {
          code: 400,
          error_message: "No file uploaded"
        }
      };
      console_wrapper.warn('no file attached');
      resp.status(res.meta.code).type('application/json').send(JSON.stringify(res));
      return
    }
    if (!req.file.buffer.length) {
      // no file data
      var res={
        meta: {
          code: 400,
          error_message: "No file data"
        }
      };
      console_wrapper.warn('empty file attached');
      resp.status(res.meta.code).type('application/json').send(JSON.stringify(res));
      return
    }
    console_wrapper.log('FUP SIZE', req.file.buffer.length.toLocaleString());
    if (req.file.buffer.length >= max_fup_size) {
      //
      var res={
        meta: {
          code: 400,
          error_message: "File is too big"
        }
      };
      console_wrapper.warn('file too large, max size', max_fup_size);
      resp.status(res.meta.code).type('application/json').send(JSON.stringify(res));
      return
    }
    //console_wrapper.log('looking for type - params:', req.params, 'body:', req.body);
    // type is in req.body.type
    //console_wrapper.log('POSTfiles - req token', req.token);
    dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
      if (err) {
        console_wrapper.log('dialect.appdotnet_official.js:POSTfiles - token err', err);
      }
      if (usertoken==null) {
        console_wrapper.log('dialect.appdotnet_official.js:POSTfiles - no token');
        // could be they didn't log in through a server restart
        var res={
          meta: {
            code: 401,
            error_message: "Call requires authentication: Authentication required to fetch token."
          }
        };
        resp.status(res.meta.code).type('application/json').send(JSON.stringify(res));
      } else {
        if (req.body.type === undefined) {
          // spec doesn't say required
          req.body.type = ''
        }
        var uploadUrl = dispatcher.appConfig.provider_url
        console_wrapper.log('dialect.appdotnet_official.js:POSTfiles - uploading to pomf', uploadUrl);
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
            console_wrapper.log('dialect.appdotnet_official.js:POSTfiles - pomf upload Error!', err);
            var res={
              meta: {
                code: 500,
                error_message: "Could not save file (Could not POST to POMF)"
              }
            };
            resp.status(res.meta.code).type('application/json').send(JSON.stringify(res));
            return;
          } else {
            //console_wrapper.log('URL: ' + body);
            // which pomf software is this ;^p
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
              console_wrapper.log('couldnt json parse body', body);
              var res={
                meta: {
                  code: 500,
                  error_message: "Could not save file (POMF did not return JSON as requested)"
                }
              };
              resp.status(res.meta.code).type('application/json').send(JSON.stringify(res));
              return;
            }
            if (!data.success) {
              var res={
                meta: {
                  code: 500,
                  error_message: "Could not save file (POMF did not return success)"
                }
              };
              resp.status(res.meta.code).type('application/json').send(JSON.stringify(res));
              return;
            }
            //, 'from', body
            console_wrapper.log('dialect.appdotnet_official.js:POSTfiles - pomf result', data);
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
              //console_wrapper.log('type', req.body.type, typeof(req.body.type)); // it's string...
              // warn if body.type is empty because it'll crash the server
              file.type = req.body.type;
              dispatcher.addFile(file, usertoken, req.apiParams, callbacks.fileCallback(resp, req.token));
            }
          }
            //console_wrapper.log('Regular:', fs.createReadStream(__dirname+'/git/caminte/media/mysql.png'));
        });
      }
    });
  });

  app.get(prefix+'/config', function(req, resp) {
    // just call the callback directly. err and meta are optional params
    callbacks.dataCallback(resp)(dispatcher.getConfig())
  });
  app.get(prefix+'/oembed', function(req, resp) {
    // never any meta
    dispatcher.getOEmbed(req.query.url, callbacks.oembedCallback(resp));
  });
}
