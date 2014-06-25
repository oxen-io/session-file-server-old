/**
 * Based losely off ohe
 */
var path = require('path');
var nconf = require('nconf');

function clone(o) {
  var ret = {};
  Object.keys(o).forEach(function (val) {
    ret[val] = o[val];
  });
  return ret;
}

// Look for a config file
var config_path = path.join(__dirname, '/config.json');
// and a model file
var config_model_path = path.join(__dirname, '/config.models.json');
nconf.argv().env('__').file({file: config_path}).file('model', {file: config_model_path});

/** set up express framework */
var express = require('express');
var app = express();
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
var webport = nconf.get('web:port') || 7070;
var api_client_id= nconf.get('web:api_client_id') || '';

// Todo: make these modular load modules from config file

// Todo: general parameters
// Todo: expiration models and configuration

// Todo: end error object
var proxy=require('./dataaccess.proxy.js');
var db=require('./dataaccess.caminte.js');
var cache=require('./dataaccess.base.js');
var dispatcher=require('./dispatcher.js');
var dialects=[];
// Todo: message queue

// initialize chain
db.next=proxy;
cache.next=db;
dispatcher.cache=cache;
dispatcher.notsilent=!(nconf.get('uplink:silent') || false);
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

// set up proxy object
proxy.apiroot=apiroot;
proxy.dispatcher=dispatcher; // upload dispatcher

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
    "destination": "/stream/0",
    "dialect": "appdotnet_official"
  }
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