// oauth proxy routes

// should this be a dialect??

/** get request http library */
var request = require('request');
// remove 5 connections to upstream at a time
require('http').globalAgent.maxSockets = Infinity
require('https').globalAgent.maxSockets = Infinity
var qs = require('qs');

// Not Cryptographically safe
function generateToken(string_length) {
  var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
  var randomstring = '';
  for (var x=0;x<string_length;x++) {
    var letterOrNumber = Math.floor(Math.random() * 2);
    if (letterOrNumber == 0) {
      var newNum = Math.floor(Math.random() * 9);
      randomstring += newNum;
    } else {
      var rnum = Math.floor(Math.random() * chars.length);
      randomstring += chars.substring(rnum, rnum+1);
    }
  }
  return randomstring;
}

var sessions={};

// This set ups a new session and redirects to oauth server
//
// client_id = replace
// response_type=code (constant)
// redirect_uri = save for later and replace
// scopes = pass through
var authmakecallback=function(type, app) {
  return function(req, resp) {
    // function(userid, client_id, scopes, token) {
    /** @todo make a session model and use that */
    /** we should talk to dispatcher which talks to storage */
    var ses={
      code: 'altapicode_'+generateToken(98), // session key
      client_id: req.query.client_id,
      redirect_uri: req.query.redirect_uri,
      response_type: req.query.response_type,
      // these should be loaded from the config file (not passed in)
      requested_scopes: req.query.scope,
      userid: 0, // not logged in yet
      username: '',
      upstream_token: null
    };
    if (ses.requested_scopes === undefined) ses.requested_scopes = '';
    // FIXME: state parameter, adnview=appstore
    if (req.query.state) {
      ses.state=req.query.state;
      console.log('session state:', ses.state);
    }
    //console.log("States "+req.query.scope);
    //console.log("SesStates "+ses.requested_scopes);
    console.log("routes.oauth.proxy::authmakecallback - Created new session "+ses.code);
    sessions[ses.code]=ses; // store it
    // still need this until we use state right...
    resp.cookie('altapi', ses.code);
    //console.log('server name test: '+req.headers.host);
    //console.log('client_id: '+this.auth_client_id);
    var url='http://'+req.headers.host+'/oauth/redirect_uri';
    //console.log('redirect url: '+url);
    console.log('routes.oauth.proxy::authmakecallback - sending out to '+module.exports.auth_base+type+'?respone_type=code&scope='+ses.requested_scopes+'&redirect_uri='+encodeURIComponent(url)+'&client_id='+app.auth_client_id);
    //resp.redirect(module.exports.auth_base+type+'?response_type=code&scope='+ses.requested_scopes+'&redirect_uri='+encodeURIComponent(url)+'&client_id='+app.auth_client_id);
    resp.writeHead(302, { "Location": module.exports.auth_base+type+'?response_type=code&scope='+ses.requested_scopes+'&redirect_uri='+encodeURIComponent(url)+'&client_id='+app.auth_client_id });
    resp.end("Please wait, redirecting to accounts.sapphire.moe. If you're seeing this for long, it's possible your ISP has CloudFlare or Accounts.Sapphire.moe blocked.")
    //resp.send(body);
  }
}

function checkApp(dispatcher, client_id, client_secret, redirect_uri, callback) {
  console.log('routes.oauth.proxy::OauthAccess_Token - reqBodyClient_id:', client_id, 'reqBodyClient_secret', client_secret, 'redirect_uri', redirect_uri);
  if (!redirect_uri) {
    console.log('routes.oauth.proxy::checkApp - no redirect_uri passed in');
    callback(false);
    return;
  }
  dispatcher.getAppCallbacks(client_id, client_secret, function(callbacks, err) {
    if (callbacks == null) {
      // no such app or err
      console.log('routes.oauth.proxy::checkApp - not such app or err');
      return;
    }
    //console.log('routes.oauth.proxy::checkApp - look for1', redirect_uri);
    var redirectURI = redirect_uri;
    if (redirectURI.match(/\?/)) {
      var parts = redirectURI.split(/\?/);
      redirectURI = parts[0];
      delete parts;
    }
    //console.log('routes.oauth.proxy::checkApp - look for2', redirectURI);
    //console.log('routes.oauth.proxy::checkApp - callbacks', callbacks);
    var valid = false;
    for(var i in callbacks) {
      var cbrow = callbacks[i];
      if (cbrow.url == redirectURI) {
        valid = true;
        break;
      }
    }
    console.log('routes.oauth.proxy::checkApp - callback valid', valid)
    callback(valid);
  })
}

module.exports.setupoauthroutes=function(app, db) {

  // start here
  // require authorize each time
  app.get('/oauth/authorize', authmakecallback('authorize', app));
  app.post('/oauth/authorize', authmakecallback('authorize', app));
  // check scopes to make sure their up to date?
  app.get('/oauth/authenticate', authmakecallback('authenticate', app));
  app.post('/oauth/authenticate', authmakecallback('authenticate', app));

  // comes back here
  // http://api.adnfuture.net:7070/oauth/redirect_uri?code=
  // translate ?code into acces_token and pass back a code for client to pick up accesstoken
  // this call is coming from our uplink, so there will be no cookie
  // uhm no it seems to be the browser redirected back to us
  // requires cookies to work
  app.get('/oauth/redirect_uri', function(req, resp) {
    var ses_id=req.cookies.get('altapi');
    //console.log('ses_id: '+ses_code);
    var ses=sessions[ses_id];
    //console.log('ses_id: '+ses.code);
    //console.log('redirect_uri: '+ses.redirect_uri);
    console.log('received code: '+req.query.code);
    // we should translate the received code into the upstream code in the session
    var postdata={
      client_id: app.auth_client_id, // upstream
      client_secret: app.auth_client_secret, // upstream
      grant_type: 'authorization_code',
      redirect_uri: 'http://'+req.headers.host+'/oauth/redirect_uri',
      code: req.query.code
    };
    //console.log('redirect url: '+data.redirect_uri);
    //console.log('req.headers.host',req.headers.host)
    //console.log('test',qs.stringify(data));
    console.log('routes.oauth.proxy::OauthRedirect_uri - requesting access_token from oauth server');
    // reach out to our upstream server to convert code to an upstream token
    request({
      url: module.exports.auth_base+'/access_token',
      method: 'POST',
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: qs.stringify(postdata)
    }, function(e, r, body) {
      console.log('routes.oauth.proxy::OauthRedirect_uri - received access_token from oauth server', r.statusCode);
      // token object.. probably want to save it...
      //console.log("response body ",body);
      if (!e && r.statusCode == 200) {
        var data
        try {
          data=JSON.parse(body);
        } catch (e) {
          console.log('routes.oauth.proxy::OauthRedirect_uri - cant parse JSON:', body);
          var res={
            "meta": {
              "code": 500,
              "error_message": "Couldnt read token."+e.toString()
            }
          };
          resp.status(500).type('application/json').send(JSON.stringify(res));
          return;
        }
        console.log('routes.oauth.proxy::OauthRedirect_uri - access_token info');
        console.dir(data);
        // how do we know what ses this goes back to?
        // they'll have a cookie when ADN redirecs back
        var ses_id=req.cookies.get('altapi');
        //console.log('ses_id: '+ses_id);
        var ses=sessions[ses_id];
        //console.log('ses_id: '+ses.code);
        // no we'll need to give them a code
        if (!ses) {
          console.log('no session in redirect_uri for cookie altapi: '+ses_id);
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
        //console.log(data.token.user);
        ses.userid=data.token.user.id;
        ses.username=data.username;
        ses.local_token=generateToken(98);

        // we should start priming the UserStream here, so by the time they hit the stream, it'll be ready
        // getUserStream: function(user, params, token, callback) {
        //app.dispatcher.getUserStream(ses.userid, null, usertoken.token, function() {});
        ses.upstream_token=data.access_token;

        // we need to see if this users exists
        // and if it doesn't, we need to create it with the info from the token
        //
        //app.dispatcher.cache.setUser(data.token.user, Date.now(), function(user, err) {
        // FIXME: make sure token is good first tbh...
        console.log('routes.oauth.proxy::OauthRedirect_uri - token.user', data.token.user);
        app.dispatcher.apiToUser(data.token.user, function(apiUser, err) {
          app.dispatcher.updateUser(data.token.user, Date.now(), function(user, err) {
            console.log('routes.oauth.proxy::OauthRedirect_uri - User checked');
          })
        });

        // set upstream token for this user
        app.dispatcher.setUpstreamToken(ses.userid, data.access_token, data.token.scopes);
        // convert out local session into a save localUserToken
        app.dispatcher.setToken(ses.userid, ses.client_id, ses.requested_scopes, ses.local_token, function(usertoken, err) {
          console.log('routes.oauth.proxy::OauthRedirect_uri - set local_token:', usertoken);
          console.log('routes.oauth.proxy::OauthRedirect_uri - convert cookie sesid into a LocalToken:', ses.code);
          console.log('routes.oauth.proxy::OauthRedirect_uri - upstream token:', data.access_token);
          console.log('routes.oauth.proxy::OauthRedirect_uri - local token:', ses.local_token);
          if (!usertoken) {
            console.log('routes.oauth.proxy::OauthRedirect_uri - WARNING: couldn\'t set token', err);
            var res={
              "meta": {
                "code": 500,
                "error_message": "Couldnt fetch token."+err.toString()
              }
            };
            resp.status(500).type('application/json').send(JSON.stringify(res));
            return;
          }
          //console.log('adn code '+req.query.code);
          console.log('routes.oauth.proxy::OauthRedirect_uri - redir to', ses.redirect_uri+'&code='+ses.code);
          if (ses.response_type=='code') {
            // client_secret isn't provided
            //app.dispatcher.getAppCallbacks(req.body.client_id, false, function(callbacks, err) {
              // we'll have to use callback for security
            //})
            checkApp(app.dispatcher, ses.client_id, '', ses.redirect_uri, function(valid) {
              console.log('routes.oauth.proxy::OauthAccess_Token - callback valid', valid)
            });

            if (ses.redirect_uri.match(/\?/)) {
              resp.redirect(ses.redirect_uri+'&code='+ses.code);
            } else {
              resp.redirect(ses.redirect_uri+'?code='+ses.code);
            }
          } else
          if (ses.response_type=='token') {
            // code is only in memory not db
            // code is not the token
            // token is how things are looked up
            // was upstream_token but we don't want to expose that anymore
            resp.redirect(ses.redirect_uri+'#access_token='+ses.local_token);
          } else {
            console.log('routes.oauth.proxy::OauthRedirect_uri - unknown response_type '+ses.response_type);
          }
        });
      } else {
        console.log('routes.oauth.proxy::OauthRedirect_uri - error', e);
        console.log('routes.oauth.proxy::OauthRedirect_uri - statusCode', r.statusCode);
        console.log('routes.oauth.proxy::OauthRedirect_uri - body', body);
      }
    });
  });

  app.get('/oauth/access_token', function(req, resp) {
    console.log('routes.oauth.proxy::OauthAccess_Token - browser debugging?? write me... (calling get instead of posting)');
    resp.status(405).send('Method Not Allowed');
  });

  // and finally translate local code into local access_token
  // this talks to our local clients
  app.post('/oauth/access_token', function(req, resp) {
    // we get posted: client_id, client_secret, grant_type=authorization_code
    // redirect_uri and code
    // no cookie, because it's not always a browser (i.e. python...)
    console.log('routes.oauth.proxy::OauthAccess_Token - code:', req.body.code);
    var ses=sessions[req.body.code];
    if (ses) {
      console.log('routes.oauth.proxy::OauthAccess_Token - ses:', ses);
      // validate app
      //console.log('routes.oauth.proxy::OauthAccess_Token - reqBodyClient_id:', req.body.client_id, 'reqBodyClient_secret', req.body.client_secret);
      checkApp(app.dispatcher, req.body.client_id, req.body.client_secret, req.body.redirect_uri, function(valid) {
        console.log('routes.oauth.proxy::OauthAccess_Token - callback valid', valid)
      });

      // code is valid
      // return token object
      // and what if user dne?
      app.dispatcher.getToken(ses.userid, ses.client_id, function(tokenobj, err) {
        if (tokenobj==null) {
          console.log('routes.oauth.proxy::OauthAccess_Token - no token for userid,clientid ',ses,'err: ',err);
        } else {
          console.log('routes.oauth.proxy::OauthAccess_Token - token lookup complete and is valid! ');

          var res={
            //access_token: 'altapitoken_'+generateToken(98),
            access_token: ses.local_token,
            token: tokenobj,
            username: ses.username,
          };
          //console.log('Sending complete token',res);
          resp.type('application/json');
          resp.send(res);
        }
      });
    } else {
      console.log('routes.oauth.proxy::OauthAccess_Token - session doesn\'t exist ['+req.body.code+']');
      resp.status(404).send('Not found');
    }
  });
}
