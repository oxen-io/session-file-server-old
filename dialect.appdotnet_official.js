/**
This module takes the API and communicates with the front-end internal API (dispatcher)
to provide data
this file is responsible for the dialect for the associate mountpoint

we're responsible for filteirng models to make sure we only return what matches the dialect's spec
*/
var callbacks = require('./dialect.appdotnet_official.callbacks.js');
var ratelimiter = require('./ratelimiter.js');

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

  app.get(prefix+'/config', function(req, resp) {
    // just call the callback directly. err and meta are optional params
    callbacks.dataCallback(resp)(dispatcher.getConfig())
  });
  app.get(prefix+'/oembed', function(req, resp) {
    // never any meta
    dispatcher.getOEmbed(req.query.url, callbacks.oembedCallback(resp));
  });
}
