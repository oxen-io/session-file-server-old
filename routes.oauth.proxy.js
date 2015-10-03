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

// /oauth/authorize?scope=stream+follow+write_post&state=DxxTFga7Dm32wiOvVw3285AAxydNt8fc&
// redirect_uri=http%3A%2F%2F206.81.100.17%3A8000%2Fcomplete%2Fappdotnet%2F%3Fredirect_state%3DDxxTFga7Dm32wiOvVw3285AAxydNt8fc&
// response_type=code&client_id=D7vDLagx2fyBrqvGRyH6qZkdQAFvETv9
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
      id: generateToken(98), // token
      client_id: req.query.client_id,
      redirect_uri: req.query.redirect_uri,
      response_type: req.query.response_type,
      requested_scopes: req.query.scope,
      userid: 0, // not logged in yet
      username: '',
      upstream_token: null
    };
    // FIXME: state parameter, adnview=appstore
    if (req.query.state) {
      ses.state=req.query.state;
      console.log('session state: '+ses.state);
    }
    //console.log("States "+req.query.scope);
    //console.log("SesStates "+ses.requested_scopes);
    console.log("Created new session ID "+ses.id);
    sessions[ses.id]=ses; // store it
    // still need this until we use state right...
    resp.cookie('altapi', ses.id);
    //console.log('server name test: '+req.headers.host);
    //console.log('client_id: '+this.upstream_client_id);
    var url='http://'+req.headers.host+'/oauth/redirect_uri';
    //console.log('redirect url: '+url);
    console.log('sending out to '+'https://account.app.net/oauth/'+type+'?respone_type=code&scope='+ses.requested_scopes+'&redirect_uri='+url+'&client_id='+app.upstream_client_id);
    resp.redirect('https://account.app.net/oauth/'+type+'?response_type=code&scope='+ses.requested_scopes+'&redirect_uri='+url+'&client_id='+app.upstream_client_id);
    //resp.send(body);
  }
}

module.exports.setupoauthroutes=function(app, db) {

  // require authorize each time
  app.get('/oauth/authorize', authmakecallback('authorize', app));
  // check scopes to make sure their up to date?
  app.get('/oauth/authenticate', authmakecallback('authenticate', app));

  // http://api.adnfutrure.net:7070/oauth/redirect_uri?code=AQAAAAAACwWVE3wNk4oxgRNeQtvmJkN-5e_3w0gKOujmS9SVg6L94wJip-N3xflgAklIfde4B21USqJ20-bBee--WhVma-GI-x148I02rGVayOvsjUFnz_H8lwIb0CCD16sf0SUruK6q
  // translate ?code into acces_token and pass back a code for client to pick up accesstoken
  // this call is coming from ADN, so there will be no cookie
  // uhm no it seems to be the browser redirected back to us
  // requires cookies to work
  app.get('/oauth/redirect_uri', function(req, resp) {
    var ses_id=req.cookies.get('altapi');
    //console.log('ses_id: '+ses_id);
    var ses=sessions[ses_id];
    //console.log('ses_id: '+ses.id);
    //console.log('redirect_uri: '+ses.redirect_uri);
    console.log('received code: '+req.query.code);
    var postdata={
      client_id: app.upstream_client_id,
      client_secret: app.upstream_client_secret,
      grant_type: 'authorization_code',
      redirect_uri: 'http://'+req.headers.host+'/oauth/redirect_uri',
      code: req.query.code
    };
    //console.log('redirect url: '+data.redirect_uri);
    //console.log('req.headers.host',req.headers.host)
    //console.log('test',qs.stringify(data));
    console.log('requesting access_token from ADN');
    request({
      url: 'https://account.app.net/oauth/access_token',
      method: 'POST',
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: qs.stringify(postdata)
    }, function(e, r, body) {
      console.log('received access_token from ADN',r.statusCode);
      // token object.. probably want to save it...
      //console.log("response body ",body);
      if (!e && r.statusCode == 200) {
        var data=JSON.parse(body);
        //console.dir(data);
        /*
          { access_token: 'AQAAAAAACwWVTnVpmWTzzCT1ZI-9LVa2kz_8dt4uA9wA-DszAfROag0Xui9T_ICCrg9jXoF-1oXQdquwc3T_2DoVZep1VxKFew',
            username: 'ryantharp',
            token:
             { scopes: [ 'follow', 'write_post', 'stream', 'basic' ],
               limits: { max_file_size: 100000000, available_invites: 110 },
               app:
                { link: 'http://beta.adn.customwebapps.com',
                  name: 'Beta',
                  client_id: 'm89LnrxQBWt3SgwHaGdDreym2fJuJnvA' },
               storage: { available: 10178742820, used: 21257180 },
               user:
                { username: 'ryantharp',
                  avatar_image: [Object],
                  description: [Object],
                  locale: 'en_US',
                  created_at: '2012-08-17T23:55:35Z',
                  id: '7314',
                  cover_image: [Object],
                  timezone: 'America/Los_Angeles',
                  counts: [Object],
                  type: 'human',
                  canonical_url: 'https://alpha.app.net/ryantharp',
                  name: 'Ryan Tharp' },
               client_id: 'm89LnrxQBWt3SgwHaGdDreym2fJuJnvA',
               invite_link: 'https://join.app.net/from/mryzxdmrdr' },
            user_id: 7314 }
        */
        // how do we know what ses this goes back to?
        // they'll have a cookie when ADN redirecs back
        var ses_id=req.cookies.get('altapi');
        //console.log('ses_id: '+ses_id);
        var ses=sessions[ses_id];
        //console.log('ses_id: '+ses.id);
        // no we'll need to give them a code
        if (ses) {
          //ses.code=generateToken(98); // or we could use req.query.code
          //console.log(data.token.user);
          ses.userid=data.token.user.id;
          ses.username=data.username;
          ses.code=ses.id;
          app.dispatcher.setToken(ses.userid, ses.client_id, ses.requested_scopes, data.access_token, function(usertoken, err) {
            console.log('cookie sesid: '+ses.id);
            console.log('token query: '+data.access_token);
            if (usertoken) {
              console.log('final token: '+usertoken.token);
            } else {
              console.log('WARNING: couldn\'t set token');
            }
            // we should start priming the UserStream here, so by the time they hit the stream, it'll be ready
            // getUserStream: function(user, params, token, callback) {
            //app.dispatcher.getUserStream(ses.userid, null, usertoken.token, function() {});
            // correct access_token is now
            // uhm, we can't pass back the real access token
            // this needs to be the ses id!
            //ses.code=usertoken.token
            ses.upstream_token=usertoken.token;
            // AQAAAAAACwWVi0o24tACuR-UTtxhvy0GNxZfXSymfflA7TWR9pqhjppip-N3xflgAklIfde4B21UMuSGTusySqyAmOc5ZeY9XDENJrkBcYQj05mE5GC0DabtrYvJS9uwEz0OHG0b-rLV
            //console.log('adn code '+req.query.code);
            console.log('redir to '+ses.redirect_uri+'&code='+ses.code);
            if (ses.response_type=='code') {
              resp.redirect(ses.redirect_uri+'&code='+ses.code);
            } else
            if (ses.response_type=='token') {
              // code is only in memory not db
              // code is not the token
              // token is how things are looked up
              resp.redirect(ses.redirect_uri+'#access_token='+ses.upstream_token);
            } else {
              console.log('unknown response_type '+ses.response_type);
            }

          });
        } else {
          console.log('no session in redirect_uri for cookie altapi: '+ses_id);
          // could be they didn't log in through a server restart
          var res={
            "meta": {
              "code": 401,
              "error_message": "Call requires authentication: Authentication required to fetch token."
            }
          };
          resp.status(401).type('application/json').send(JSON.stringify(res));
        }
      } else {
        console.log('error', e);
        console.log('statusCode', r.statusCode);
        console.log('body', body);
      }
    });
  });

  app.get('/oauth/access_token', function(req, resp) {
    console.log('browser debugging?? write me... (calling get instead of posting)');
  });

  // translate local code into local access_toekn
  app.post('/oauth/access_token', function(req, resp) {
    // we get posted: client_id, client_secret, grant_type=authorization_code
    // redirect_uri and code
    // no cookie, because it's not always a browser (i.e. python...)
    var ses=sessions[req.body.code];
    if (ses) {
      // code is valid
      // return token object
      app.dispatcher.getToken(ses.userid, ses.client_id, function(tokenobj, err) {
        if (tokenobj==null) {
          console.log('no token for userid,clientid ',ses,'err: ',err);
        } else {
          console.log('token lookup complete and is valid! ');
          var res={
            access_token: ses.upstream_token, // we shouldn't use the upstream token but a locally translated one
          };
          res.token=tokenobj;
          res.username=ses.username;
          //console.log('Sending complete token',res);
          resp.type('application/json');
          resp.send(res);
        }
      });
    } else {
      console.log('session doesn\'t exist ['+req.body.code+']');
      resp.status(404).send('Not found');
    }
  });
}