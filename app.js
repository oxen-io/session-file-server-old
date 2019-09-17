/**
 * Based losely off ohe
 */
var path = require('path');
var nconf = require('nconf');

//var longjohn = require('longjohn');

// FIXME: need way to single out a single IP or token

// Look for a config file
var config_path = path.join(__dirname, '/config.json');
// and a model file
var config_model_path = path.join(__dirname, '/config.models.json');
nconf.argv().env('__').file({file: config_path});

/** set up express framework */
var express = require('express');
var app = express();
var Cookies = require( "cookies" );
var bodyParser = require('body-parser');
/** get file io imported */
var fs = require('fs');

/** ohe libs */
/** for getting app_token */
var auth = require('./ohe/auth');
/** for building app stream */
var adnstream = require('./ohe/adnstream');

/** pull configuration from config into variables */
var apiroot = nconf.get('uplink:apiroot') || 'https://api.app.net';

var upstream_client_id=nconf.get('uplink:client_id') || 'NotSet';
var upstream_client_secret=nconf.get('uplink:client_secret') || 'NotSet';
var webport = nconf.get('web:port') || 7070;
var api_client_id= nconf.get('web:api_client_id') || '';

var auth_base=nconf.get('auth:base') || 'https://account.app.net/oauth/';
var auth_client_id=nconf.get('auth:client_id') || upstream_client_id;
var auth_client_secret=nconf.get('auth:client_secret') || upstream_client_secret;

var admin_port=nconf.get('admin:port') || 3000;
var admin_listen=nconf.get('admin:listen') || '127.0.0.1';
var admin_modkey=nconf.get('admin:modKey');

var octets=admin_listen.split('.');
if (octets[0] != '127' && octets[0] != '10' && octets[0] != '172' && octets[0] != '192') {
  console.error('Cannot listen on',admin_listen,'private or loopback only!', octets);
  admin_listen='127.0.0.1';
}

// Todo: make these modular load modules from config file

// Todo: general parameters
// Todo: expiration models and configuration

// Todo: end error object
var proxy = null
if (upstream_client_id!='NotSet') {
  proxy = require('./dataaccess.proxy.js');
}
var db=require('./dataaccess.caminte.js');
db.start(nconf);
var cache=require('./dataaccess.base.js');
var dispatcher=require('./dispatcher.js');
var streamEngine = false
if (nconf.get('stream:host')) {
  streamEngine = require('./streams.js');
}
var dialects=[];
// Todo: message queue

// initialize chain
if (proxy) db.next=proxy;
cache.next=db;
dispatcher.cache=cache;
dispatcher.notsilent=!(nconf.get('uplink:silent') || false);
dispatcher.appConfig = {
  provider: nconf.get('pomf:provider') || 'pomf.cat',
  provider_url: nconf.get('pomf:provider_url') || 'https://pomf.cat/',
}

console.log('configuring app as', dispatcher.appConfig)
// app.net defaults
dispatcher.config=nconf.get('dataModel:config') || {
  "text": {
    "uri_template_length": {
      "post_id": 9,
      "message_id": 12
    }
  },
  "user": {
    "annotation_max_bytes": 8192,
    "text_max_length": 256
  },
  "file": {
    "annotation_max_bytes": 8192
  },
  "post": {
    "annotation_max_bytes": 8192,
    "text_max_length": 256
  },
  "message": {
    "annotation_max_bytes": 8192,
    "text_max_length": 2048
  },
  "channel": {
    "annotation_max_bytes": 8192
  }
};
console.log('configuring adn settings as', dispatcher.config)

if (proxy) {
  // set up proxy object
  proxy.apiroot=apiroot;
  proxy.dispatcher=dispatcher; // upload dispatcher
}
if (streamEngine) {
  // enable stream daemon
  dispatcher.streamEngine = streamEngine;
  streamEngine.cache = cache;
  streamEngine.dispatcher = dispatcher;
  // set up redis
  streamEngine.init({
    host: nconf.get('stream:host'),
    port: nconf.get('stream:port') || 6379,
  });
}

/** set up query parameters */
// all Boolean (0 or 1) and prefixed by include_
var generalParams=['muted','deleted','directed_posts','machine','starred_by','reposters','annotations','post_annotations','user_annotations','html','marker','read','recent_messages','message_annotations','inactive','incomplete','private','file_annotations'];
// Stream Faceting allows you to filter and query a user's personalized stream or unified stream with an interface similar to our Post Search API. If you use stream faceting, the API will only return recent posts in a user's stream.
// Boolean (0 or 1)
var streamFacetParams=['has_oembed_photo'];
var pageParams=['since_id','before_id','count','last_read','last_read_inclusive','marker','marker_inclusive'];
var channelParams=['channel_types'];
var fileParams=['file_types'];

function corsMiddleware(req, res, next){
  res.start=new Date().getTime();
  origin = req.get('Origin') || '*';
  res.set('Access-Control-Allow-Origin', origin);
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.set('Access-Control-Expose-Headers', 'Content-Length');
  res.set('Access-Control-Allow-Credentials', 'true');
  res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Authorization'); // add the list of headers your site allows.
  if (req.method === 'OPTIONS') {
    var ts=new Date().getTime();
    var diff = ts-res.start
    if (diff > 100) {
      console.log('app.js - OPTIONS requests served in', (diff)+'ms', req.path);
    }
    return res.sendStatus(200);
  }
  next();
}

/**
 * Set up middleware to check for prettyPrint
 * This is run on each incoming request
 */
var hits = 0
function adnMiddleware(req, res, next) {
  res.start=new Date().getTime();
  res.path=req.path;
  //console.dir(req); // super express debug
  var token=null;
  if (req.get('Authorization') || req.query.access_token) {
    if (req.query.access_token) {
      //console.log('app.js - Authquery',req.query.access_token);
      req.token=req.query.access_token;
      if (typeof(req.token) == 'object') {
        req.token = req.token.filter(function (x, i, a) {
          return a.indexOf(x) == i;
        });
        if (req.token.length == 1) {
          console.warn('reduced multiple similar access_token params')
          req.token = req.token[0] // deArray it
        } else {
          console.log('multiple access_tokens?!? unique list: ', req.token)
        }
      }
      // probably should validate the token here
      /*
      console.log('app.js - getUserClientByToken',req.token);
      dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
        if (usertoken==null) {
          console.log('Invalid query token (Server restarted on clients?...): '+req.query.access_token+' err: '+err);
          req.token=null;
          if (req.get('Authorization')) {
            //console.log('Authorization: '+req.get('Authorization'));
            // Authorization Bearer <YOUR ACCESS TOKEN>
            req.token=req.get('Authorization').replace('Bearer ', '');
          }
        } else {
          token=usertoken;
          console.log('token marked valid');
        }
      });
      */
    } else {
      //console.log('authheader');
      if (req.get('Authorization')) {
        //console.log('Authorization: '+req.get('Authorization'));
        // Authorization Bearer <YOUR ACCESS TOKEN>
        req.token=req.get('Authorization').replace('Bearer ', '');
        /*
        dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
          if (usertoken==null) {
            console.log('Invalid header token (Server restarted on clients?...): '+req.token);
            req.token=null;
          } else {
            token=usertoken;
          }
        });
        */
      }
    }
  }

  // debug incoming requests
  if (dispatcher.notsilent && upstream_client_id!='NotSet') {
    process.stdout.write("\n");
  }
  // not any of these
  /*
  if (!(req.path.match(/^\/channels/) || req.path.match(/^\/posts\/\d+\/replies/) ||
    req.path.match(/^\/users\/@[A-z]+\/posts/) || req.path.match(/^\/users\/\@/) ||
    req.path == '/posts/stream/global' || req.path == '/users/me/files')) {
    console.log(hits, 'Request for '+req.path);
  }
  */

  // map to bool but handle '0' and '1' just like 'true' and 'false'
  function stringToBool(str) {
    if (str === '0' || str === 'false' || str === 'null' || str === 'undefined') {
      return false;
    }
    // handle ints and bool types too
    return str?true:false;
  }
  // set defaults
  //  Defaults to false except when you specifically request a Post from a muted user or when you specifically request a muted user's stream.
  var generalParams={};
  generalParams.muted=false;
  generalParams.deleted=true; // include_deleted (posts say defaults to true)
  if (req.query.include_deleted!==undefined) {
    //console.log("Overriding include_deleted to", req.query.include_deleted);
    if (req.query.include_deleted instanceof Array) {
      generalParams.deleted=stringToBool(req.query.include_deleted.pop());
    } else {
      generalParams.deleted=stringToBool(req.query.include_deleted);
    }
  }

  // Defaults to false for "My Stream" and true everywhere else.
  generalParams.directed_posts=true;
  generalParams.machine=false;
  generalParams.starred_by=false;
  generalParams.reposters=false;

  generalParams.annotations=false;
  if (req.query.include_annotations!==undefined) {
    //console.log("Overriding include_annotations to", req.query.include_annotations);
    generalParams.annotations=stringToBool(req.query.include_annotations);
  }

  generalParams.post_annotations=false;
  if (req.query.include_post_annotations!==undefined) {
    //console.log("Overriding include_post_annotations to", req.query.include_post_annotations);
    generalParams.post_annotations=stringToBool(req.query.include_post_annotations);
  }
  generalParams.user_annotations=false;
  if (req.query.include_user_annotations!==undefined) {
    //console.log("Overriding include_user_annotations to", req.query.include_user_annotations);
    generalParams.user_annotations=stringToBool(req.query.include_user_annotations);
  }
  generalParams.html=true;
  // channel
  generalParams.marker=false;
  generalParams.read=true;
  generalParams.recent_messages=false;
  generalParams.message_annotations=false;
  generalParams.inactive=false;
  // file
  generalParams.incomplete=true;
  generalParams.private=true;
  generalParams.file_annotations=false;
  //
  var channelParams={};
  channelParams.types='';
  if (req.query.channel_types) {
    //console.log("Overriding channel_types to "+req.query.channel_types);
    channelParams.types=req.query.channel_types;
  }
  channelParams.inactive = false;
  if (req.query.include_inactive) {
    //console.log("Overriding include_inactive to "+req.query.include_inactive);
    channelParams.inactive=stringToBool(req.query.include_inactive);
  }
  var fileParams={};
  fileParams.types='';
  if (req.query.file_types) {
    //console.log("Overriding file_types to "+req.query.file_types);
    fileParams.types=req.query.channel_types;
  }
  var stremFacetParams={};
  stremFacetParams.has_oembed_photo=false;
  var pageParams={};
  pageParams.since_id=false;
  if (req.query.since_id) {
    //console.log("Overriding since_id to "+req.query.since_id);
    pageParams.since_id=parseInt(req.query.since_id);
  }
  pageParams.before_id=false;
  if (req.query.before_id) {
    //console.log("Overriding before_id to "+req.query.before_id);
    pageParams.before_id=parseInt(req.query.before_id);
  }
  pageParams.count=20;
  if (req.query.count) {
    //console.log("Overriding count to "+req.query.count);
    pageParams.count=Math.min(Math.max(req.query.count, -200), 200);
  }
  // stream marker supported endpoints only
  pageParams.last_read=false;
  pageParams.last_read_inclusive=false;
  pageParams.last_marker=false;
  pageParams.last_marker_inclusive=false;
  // put objects into request
  req.apiParams={
    generalParams: generalParams,
    channelParams: channelParams,
    fileParams: fileParams,
    stremFacetParams: stremFacetParams,
    pageParams: pageParams,
    tokenobj: token,
    token: req.token,
  }
  // configure response
  res.prettyPrint=req.get('X-ADN-Pretty-JSON') || 0;
  // non-ADN spec, ryantharp hack
  if (req.query.prettyPrint) {
    res.prettyPrint=1;
  }
  res.JSONP=req.query.callback || '';
  req.cookies = new Cookies(req, res);
  if (req.query.connection_id==="null") {
    console.log('middleware connection_id querystring is null');
  }
  if (req.query.connection_id && req.query.connection_id!=="null") {
    if (streamEngine) {
      console.log('app.js hijacking request because connection_id', req.query.connection_id, req.token, 'on', req.path);
      streamEngine.handleSubscription(req, res);
      return;
    } else {
      console.log('streamEngine is not enabled');
      var resObj={
        "meta": {
          "code": 404,
          "error_message": "Not enabled"
        }
      };
      res.status(404).type('application/json').send(JSON.stringify(resObj));
      return;
    }
  }
  next();
}

// temporary hack middleware for debugging
/*
app.all('/*', function(req, res, next) {
  console.debug('DBGrequest', req.path)
  if (req.method == 'POST') {
    //console.debug('DBGbody', req)
    var body = '';

    req.on('data', function (data) {
      body += data;

      // Too much POST data, kill the connection!
      // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
      if (body.length > 1e6)
        req.connection.destroy();
    });

    req.on('end', function () {
      console.log('post body', body)
      // use post['blah'], etc.
    });
  }
  next();
});
*/

/** need this for POST parsing */
// heard this writes to /tmp and doesn't scale.. need to confirm if current versions have this problem
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.all('/*', corsMiddleware);
app.use(adnMiddleware);

/**
 * support both styles of calling API
 */
app.apiroot=apiroot;
app.dispatcher=dispatcher;

/* load dialects from config */
var mounts=nconf.get('web:mounts') || [
  {
    "destination": "",
    "dialect": "appdotnet_official"
  },
  {
    "destination": "",
    "dialect": "loki"
  },
];
var dialects={};
for(var i in mounts) {
  var mount=mounts[i];
  if (dialects[mount.dialect]==undefined) {
    // load dialect
    console.log("Loading dialect "+mount.dialect);
    dialects[mount.dialect]=require('./dialect.'+mount.dialect+'.js');
  }
  console.log('Mounting '+mount.dialect+' at '+mount.destination+'/');
  dialects[mount.dialect](app, mount.destination);
}

// config app (express framework)
app.upstream_client_id=upstream_client_id;
app.upstream_client_secret=upstream_client_secret;
app.auth_client_id=auth_client_id;
app.auth_client_secret=auth_client_secret;
app.webport=webport;
app.apiroot=apiroot;

// only can proxy if we're set up as a client or an auth_base not app.net
console.log('upstream_client_id', upstream_client_id)

/** include homepage route */
app.get('/', function(req, resp) {
  fs.readFile(__dirname+'/templates/index.html', function(err, data) {
    if (err) {
      throw err;
    }
    var body=data.toString();
    body=body.replace('{api_client_id}', api_client_id);
    body=body.replace('{uplink_client_id}', upstream_client_id);
    resp.send(body);
  });
});

/**
 * Launch the server!
 */
app.listen(webport);


if (admin_modkey) {
  // create an internal server
  var internalServer = express();
  internalServer.use(bodyParser.json());
  internalServer.use(bodyParser.urlencoded({
    extended: true
  }));
  //internalServer.all('/*', corsMiddleware);
  internalServer.use(adnMiddleware);

  var internal_mounts={};

  internal_mounts.admin=require('./dialect.admin');
  internalServer.dispatcher=dispatcher;
  internal_mounts.admin(internalServer, '');
  console.log('Mounting admin at / on '+admin_listen+':'+admin_port);
  internalServer.listen(admin_port, admin_listen);
} else {
  console.log("admin:modKey not set in config. No admin set up!");
}

/** set up upstream */
if (upstream_client_id!='NotSet') {
  // send events into "dispatcher"
  var stream_router = require('./ohe/streamrouter').create_router(app, dispatcher);
  // this blocks the API until connected =\
  auth.get_app_token(function (token) {
      stream_router.stream(token);
  });
} else {
  console.log("uplink:client_id not set in config. No uplink set up!");
}

// if full data store
// check caches/dates since we were offline for any missing data
// hoover users (from our last max ID to appstream start (dispatcher.first_post))
// hoover posts (from our last max ID to appstream start (dispatcher.first_post))
// hoover stars for all users in db
