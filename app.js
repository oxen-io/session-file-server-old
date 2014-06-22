/**
 * Based losely off ohe
 */
var path = require('path');
var nconf = require('nconf');

// Look for a config file
var config_path = path.join(__dirname, '/config.json');
nconf.argv().env('__').file({file: config_path});

/** set up express framework */
var express = require('express');
var app = express();
/** get request http library */
var request = require('request');
/** get file io imported */
var fs = require('fs');

/** pull configuration from config into variables */
var apiroot = nconf.get('uplink:apiroot') || 'https://api.app.net';
var upstream_client_id=nconf.get('uplink:client_id') || 'NotSet';
var webport = nconf.get('web:port') || 7070;
var api_client_id= nconf.get('web:api_client_id') || '';

// Todo: make these modular load modules from config file

// Todo: general parameters
// Todo: expiration models and configuration

// Todo: end error object
// Todo: proxy
// Todo: persistence
// Todo: cache
// Todo: dispatcher
// Todo: message queue
// Todo: api dialects
// Todo: Rate Limiting?

/**
 * Create simple ADN Proxy handler for requests
 */
var adnproxy=function(url, response) {
  console.log("Requesting "+url+" from "+apiroot);
  request.get({
    url: apiroot+'/'+url
  }, function(e, r, body) {
    // When using JSONP, our servers will return a 200 status code in the HTTP response, regardless of the effective status code.
    if (response.JSONP) {
      if (response.prettyPrint) {
        body=JSON.stringify(JSON.parse(body),null,4);
      }
      response.send(JSONP+'({'+body+'})');
    } else {
      if (!e && r.statusCode === 200) {
        console.log("200");
        if (response.prettyPrint) {
          body=JSON.stringify(JSON.parse(body),null,4);
        }
        response.send(body);
      } else {
        // 204,302,400,401,403,404,405,429,500,507
        console.log("Error ",e,"status",r.statusCode,'body',body);
        response.send(body);
      }
    }
  });
}

/**
 * Set up middleware to check for prettyPrint
 * This is run on each incoming request
 */
app.use(function(req, res, next) {
  if (req.get('Authorization')) {
    // Authorization Bearer <YOUR ACCESS TOKEN>
    //console.log('Authorization '+req.get('Authorization'));
  }
  // configure response
  res.prettyPrint=req.get('X-ADN-Pretty-JSON') || 0;
  res.JSONP=req.query.callback || '';
  next();
});


/**
 * Set up defined API routes at prefix
 */
function setupapiwithprefix(app,prefix) {
  app.get(prefix+'/posts/:id',function(req,resp) {
    adnproxy('posts/'+req.params.id,resp);
  });
  app.get(prefix+'/users/:user_id/posts',function(req,resp) {
    adnproxy('users/'+req.params.user_id+'/posts',resp);
  });
  app.get(prefix+'/users/:user_id/stars',function(req,resp) {
    adnproxy('users/'+req.params.user_id+'/stars',resp);
  });
  app.get(prefix+'/posts/tag/:hashtag',function(req,resp) {
    adnproxy('posts/tag/'+req.params.hashtag,resp);
  });
  app.get(prefix+'/posts/stream/global',function(req,resp) {
    adnproxy('posts/stream/global',resp);
  });
  // channel_id 1383 is always good for testing
  app.get(prefix+'/channels/:channel_id',function(req,resp) {
    adnproxy('channels/'+req.params.channel_id,resp);
  });
  app.get(prefix+'/channels/:channel_id/messages',function(req,resp) {
    adnproxy('channels/'+req.params.channel_id+'/messages',resp);
  });
  app.get(prefix+'/channels/:channel_id/messages/:message_id',function(req,resp) {
    adnproxy('channels/'+req.params.channel_id+'/messages/'+req.params.message_id,resp);
  });
  app.get(prefix+'/config',function(req,resp) {
    adnproxy('config',resp);
  });
  app.get(prefix+'/oembed',function(req,resp) {
    adnproxy('oembed?url='+req.query.url,resp);
  });
  app.post(prefix+'/text/process',function(req,resp) {
    // not quite sure how to get post data from express yet
    //adnproxy('text/process'+req.query.text,resp);
  });
}

/**
 * support both styles of calling API
 */
setupapiwithprefix(app,'');
setupapiwithprefix(app,'/stream/0');

function generateToken(len) {
  var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
  var string_length = 98;
  var randomstring = '';
  for (var x=0;x<string_length;x++) {
    var letterOrNumber = Math.floor(Math.random() * 2);
    if (letterOrNumber == 0) {
      var newNum = Math.floor(Math.random() * 9);
      randomstring += newNum;
    } else {
      var rnum = Math.floor(Math.random() * chars.length);
      randomstring += chars.substring(rnum,rnum+1);
    }
  }
  return randomstring;
}

app.get('/oauth/authenticate',function(req,resp) {
  resp.redirect(req.query.redirect_uri+'#access_token='+generateToken());
});

app.get('/signup',function(req,resp) {
  fs.readFile(__dirname+'/templates/signup.html', function(err,data) {
    if (err) {
      throw err;
    }
    resp.send(data.toString());
  });
});

/** include homepage route */
app.get('/', function(req,resp) {
  fs.readFile(__dirname+'/templates/index.html', function(err,data) {
    if (err) {
      throw err;
    }
    var body=data.toString();
    body=body.replace('{api_client_id}',api_client_id);
    body=body.replace('{uplink_client_id}',upstream_client_id);
    resp.send(body);
  });
});

/**
 * Launch the server!
 */
app.listen(webport);

// if full data store
// check caches/dates since we were offline for any missing data
// hoover users (from our last max ID to appstream start (dispatcher.first_post))
// hoover posts (from our last max ID to appstream start (dispatcher.first_post))
// hoover stars for all users in db