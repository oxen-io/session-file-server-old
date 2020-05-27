var redis = require('redis');
var nconf = require('nconf');

//require('longjohn')

module.exports = {
  cache: null,
  // we still need to be able to communicate pumps
  dispatcher: null,
  redisClient: null,
  redisListenClient: null,
  reloadTimer: null,
  openPings: {},
  // needs to happen after cache is set
  init: function(redisClientOptions) {
    // FIXME: support
    this.redisClient = redis.createClient(redisClientOptions);
    this.redisListenClient = redis.createClient(redisClientOptions);
    var ref = this;
    ref.redisListenClient.subscribe("AppDotNetWS"); // WS to altapi
    ref.redisListenClient.subscribe("AppDotNetAPI"); // altapi to altpi communication
    ref.redisListenClient.on("message", ref.handleEvent);
    // set up initial listeners (wait for the camintejs connect)
    setTimeout(function() {
      ref.loadSubscriptions();
    }, 1000);
    /*
    setInterval(function() {
      // just incase another thread updates
      // maybe check database count
      // or we can have a scoreboard
      // we just plug into the redis bus
      ref.loadSubscriptions();
    }, 30*1000)
    */
  },
  checkConnections: function() {
    var ref = this;
    this.cache.getAllUserStreams(function(res) {
      // send pings
      var wrap = {
        meta: {
          //connection_id: stream.connection_id,
          type: 'ping'
        },
        data: { id: Date.now() }
      }
      for(var i in res.userStreams) {
        var stream = res.userStreams[i];
        ref.checkConnection(stream, wrap);
      }
    })
  },
  expireConnections: function() {
    var ref = this;
    this.cache.getAllUserStreams(function(res) {
      for(var i in res.userStreams) {
        var stream = res.userStreams[i];
        ref.checkExpire(stream);
      }
    })
  },
  loadSubscriptions: function() {
    //console_wrapper.log('streams::loadSubscriptions - start');
    // query user_streamsubscriptions for all listeners
    // update our dispatcher data structure that our general pump uses
    // we need to make a key, so it's easy for pump to look up if there's any connections we need to send to
    // we need to do the heavy lifting here..
    var ref = this;
    this.cache.getAllUserStreams(function(res) {
      //console_wrapper.log('streams::loadSubscriptions - res', res);
      var tokenLookup = {};
      for(var i in res.tokens) {
        var tokenObj = res.tokens[i];
        tokenLookup[tokenObj.id] = tokenObj;
      }
      var subLookup = {};
      for(var i in res.subs) {
        var sub = res.subs[i];
        if (subLookup[sub.user_stream_id] === undefined) {
          subLookup[sub.user_stream_id] = [];
        }
        subLookup[sub.user_stream_id].push(sub);
      }
      ref.dispatcher.pumps = {};
      console_wrapper.log('streams::loadSubscriptions -', res.userStreams.length, 'streams');
      for(var i in res.userStreams) {
        var stream = res.userStreams[i];
        //console_wrapper.log('streams::loadSubscriptions -', subLookup[stream.id].length, 'subcriptions for', stream.id, 'streamid');
        // FIXME: remove any existing listeners for this connection
        // FIXME: set up new listeners for this connection
        // send a ping too
        for(var j in subLookup[stream.id]) {
          var sub = subLookup[stream.id][j];
          // threaded doesn't generate multiple events
          // because the creation only happens on one thread
          switch(sub.stream) {
            case '/posts/stream':
              // we can listen to user posts
              // so lets get a list of everyone we're following
              // FIXME: update this list when we follow/unfollow a user
              // subscribe this connection_string_id to all user_posts we need
              ref.cache.getFollowing(stream.userid, {}, function(followings, err) {
                console_wrapper.log('streams::loadSubscriptions -', stream.userid, 'is following', followings.length, 'users', stream.connection_id);
                for(var k in followings) {
                  var following = followings[k];
                  var key = 'user.'+following.followsid+'.post';
                  if (ref.dispatcher.pumps[key] === undefined) {
                    ref.dispatcher.pumps[key] = [];
                  }
                  ref.dispatcher.pumps[key].push(stream.connection_id);
                }
              });
            break;
            case '/channels':
              // get a list of channels you're subbged to
              ref.cache.getUserSubscriptions(stream.userid, {}, function(subscriptions, err) {
                for(var k in subscriptions) {
                  var sub = subscriptions[k];
                  var key = 'channel.'+sub.channelid;
                  if (ref.dispatcher.pumps[key] === undefined) {
                    ref.dispatcher.pumps[key] = [];
                  }
                  ref.dispatcher.pumps[key].push(stream.connection_id);
                }
              });
            break;
            case '/users/me/posts':
              var key = 'user.'+stream.userid+'.post';
              if (ref.dispatcher.pumps[key] === undefined) {
                ref.dispatcher.pumps[key] = [];
              }
              ref.dispatcher.pumps[key].push(stream.connection_id);
            break;
            default:
              if (sub.stream.match(/^\/channels\/\d+\/messages/)) {
                var match = sub.stream.match(/^\/channels\/(\d+)\/messages/);
                var channelid = match[1];
                //console_wrapper.log('streams::loadSubscriptions - \/channels\/\d+\/messages channelid', channelid);
                var key = 'channel.'+channelid+'.message';
                if (ref.dispatcher.pumps[key] === undefined) {
                  ref.dispatcher.pumps[key] = [];
                }
                ref.dispatcher.pumps[key].push(stream.connection_id);
              } else {
                console_wrapper.log('streams::loadSubscriptions - implement me', sub.stream);
              }
            break;
          }
        }
      }
      // , ref.dispatcher.pumps
      var keys = []
      for(var key in ref.dispatcher.pumps) {
        keys.push([key, ref.dispatcher.pumps[key].length])
      }
      console_wrapper.log('streams::loadSubscriptions - final keys', keys.length);
      ref.checkConnections();
      ref.expireConnections();
    });
  },
  loadSubscription: function(stream) {

  },
  checkConnection: function(stream, wrap) {
    var ref=this;
    wrap.meta.connection_id = stream.connection_id;
    if (ref.openPings[stream.connection_id] === undefined) {
      ref.openPings[stream.connection_id] = []
    }
    ref.openPings[stream.connection_id].push(wrap.data.id)
    var idx = ref.openPings[stream.connection_id].indexOf(wrap.data.id)
    ref.handlePublish(stream.connection_id, wrap);
    setTimeout(function() {
      //console_wrapper.log('checking pings for', stream.connection_id, ref.openPings[stream.connection_id].length);
      var cur = ref.openPings[stream.connection_id].indexOf(wrap.data.id);
      if (cur != -1) {
        //console_wrapper.log(wrap.data.id, 'ping is still outstanding for', stream.connection_id, 'state', stream.connection_closed_at);
        if (stream.connection_closed_at == null) {
          console_wrapper.log('streams::checkConnections - marking offline', stream.connection_id);
          module.exports.cache.userStreamUpdate(stream.connection_id, {
            connection_closed_at: new Date()
          }, function(userStream, err) {
            //console_wrapper.log('userStream updated')
          })
        }
      } else {
        // if has connection_closed_at, we need to clear it
        //console_wrapper.log('streams::checkConnections - ', stream.connection_id, 'state', stream.connection_closed_at);
        if (stream.connection_closed_at != null) {
          console_wrapper.log('streams::checkConnections - marking online', stream.connection_id);
          module.exports.cache.userStreamUpdate(stream.connection_id, {
            connection_closed_at: null
          }, function(userStream, err) {
            //console_wrapper.log('userStream updated')
          })
        }
      }
    }, 30*1000);
  },
  checkExpire: function(stream) {
    // ignore if no auto or online
    if (!stream.auto_delete || stream.connection_closed_at == null) {
      //console_wrapper.log('stream::checkExpire - skipping, AD:', stream.auto_delete, 'state', stream.connection_closed_at);
      return;
    }
    var now = Date.now();
    var thenD = new Date(stream.connection_closed_at);
    var then = thenD.getTime();
    var diff = now - then;
    //console_wrapper.log('streams::checkExpire - diff', diff, 'ms')
    if (diff < 10*60*1000) {
      return;
    }
    console_wrapper.log('streams::checkExpire - disconnected over 10mins ago', stream.connection_id, '@', stream.id);
    this.cache.deleteUserStream(stream.id);
  },
  handlePublish: function(connectionId, data) {
    //console_wrapper.log('streams::handlePublish - start', connectionId, data);
    //try {
    this.redisClient.publish(connectionId, JSON.stringify(data));
    /*
    } catch(e) {
      console_wrapper.log('cant publish', e)
    } */
  },
  pendingReloads: 0,
  handleEvent: function(channel, message) {
    // these could be HTTP requests
    //console_wrapper.log('streams::handleEvent - chan', channel, 'msg', message);
    var ref = module.exports
    if (channel == 'AppDotNetAPI') {
      var pkt = JSON.parse(message)
      //console_wrapper.log('streams::handleEvent - AppDotNetAPI - message', pkt)
      if (pkt.act == 'sub') {
        // uid,sid,sub {
        //   user_stream_id
        //   stream
        //   params
        //   id
        // }
        // time delay this for Xms just incase more come in
        ref.pendingReloads++
        //console_wrapper.log('streams::handleEvent - AppDotNetAPI - ask for reload')
        // cancel any pending timer, add another Xms
        if (ref.reloadTimer !== null) clearTimeout(ref.reloadTimer)
        ref.reloadTimer = setTimeout(function() {
          console_wrapper.log('streams::handleEvent - AppDotNetAPI - reloading, estimated new subs:', ref.pendingReloads)
          ref.loadSubscriptions()
          ref.pendingReloads = 0
        }, 100)
      }
      return
    }
    if (message.match(/^disconnect_/)) {
      var parts = message.split(/_/);
      var connectionId = parts[1];
      //console_wrapper.log(connectionId, 'disconnected, write to cache');
      module.exports.cache.userStreamUpdate(connectionId, {
        connection_closed_at: new Date()
      }, function() {
        //console_wrapper.log('userStream updated')
      })
    } else if (message.match(/^pong_/)){
      var parts = message.split(/_/);
      var connectionId = parts[1];
      var timestamp = parts[2];
      if (!module.exports.openPings[connectionId]) {
        // not really an error, just means we restarted...
        //console_wrapper.log('streams::handleEvent - cant find any open pings for', connectionId);
        return;
      }
      var idx = module.exports.openPings[connectionId].indexOf(timestamp);
      if (idx) {
        module.exports.openPings[connectionId].splice(idx, 1);
        //console_wrapper.log('streams::handleEvent -', connectionId, 'is connected');
      } else {
        console_wrapper.error('streams::handleEvent - no openping for', timestamp, 'for', connectionId, 'we have', module.exports.openPings[connectionId]);
      }
    } else {
      console_wrapper.error('streams::handleEvent - chan', channel, 'msg', message);
    }
  },
  // called in middleware
  handleSubscription: function(req, res) {
    var connId = req.query.connection_id;
    var accessToken = req.token;
    var connToken = null;
    var ref = this;

    function sendErrResponse(code, err) {
      var resObj={
        "meta": {
          "code": code,
          "error_message": err
        }
      };
      res.status(code).type('application/json').send(JSON.stringify(resObj));
    }

    //console_wrapper.log('streams::handleSubscription - handling',req.path);
    this.redisClient.get("token_"+connId, function(err, reply) {
      if (!reply) {
        sendErrResponse(500, "no such connection")
        console_wrapper.log('streams::handleSubscription - reply is empty', reply);
        return;
      }
      connToken = reply.toString();
      //console_wrapper.log('connToken', connToken);
      if (connToken != accessToken) {
        console_wrapper.log('streams::handleSubscription - connToken does not match accessToken', connToken, accessToken);
        sendErrResponse(401, "token mismatch")
        return;
      }
      ref.redisClient.get("autoDelete_"+connId, function(err, reply) {
        var autoDel = reply.toString(); // FIXME: look up in redis
        // convert string to token numeric id and get user id
        ref.cache.getAPIUserToken(accessToken, function(tokenObj, err) {
          //console_wrapper.log('app::handleSubscription - tokenObj', tokenObj);
          if (err || !tokenObj) {
            sendErrResponse(401, "invalid token")
            console_wrapper.log('streams::handleSubscription - token not found', accessToken, err);
            return;
          }
          ref.cache.findOrCreateUserStream(connId, tokenObj.id, tokenObj.userid, autoDel, function(userStream, err) {
            if (err || !userStream) {
              sendErrResponse(500, "cant create userStream")
              console_wrapper.log('streams::handleSubscription - userStream could not be created', connId, tokenObj.id, tokenObj.userid, autoDel, err);
              return;
            }
            //console_wrapper.log('app::handleSubscription - userStream', userStream);
            //console_wrapper.log('app::handleSubscription - userStream.id', userStream.id);
            // FIXME: apply/adjust to all mount points
            // update auto_delete state
            var userStreamSubscriptionEndpoints = {
              //'/users/me/following': {},
              //'/users/me/followers': {},
              '/users/me/posts': {},
              //'/users/me/mentions': {},
              '/posts/stream': {},
              //'/posts/stream/unified': {},
              '/channels': {}, // (includes new messages for channels you're subscribed to)
              //'/users/me/files': {},
              //'/token': {}, // (includes updates for both the token and the user objects of the current user)
              //'/posts/:post_id/replies': {},
              //'/channels/:post_id/subscribers': {},
              '/channels/:post_id/messages': {},
            }
            var matchedPoint = req.path
            /*
            if (req.path.match(/^\/posts\/\d+\/replies/)) {
              matchedPoint = '/posts/:post_id/replies'
            } else
            if (req.path.match(/^\/channels\/\d+\/subscribers/)) {
              matchedPoint = '/channels/:post_id/subscribers'
            } else
            */
            if (req.path.match(/^\/channels\/\d+\/messages/)) {
              matchedPoint = '/channels/:post_id/messages'
            }
            var validEndpoint = userStreamSubscriptionEndpoints[matchedPoint]
            if (!validEndpoint) {
              console_wrapper.log('app::handleSubscription - endpoint', matchedPoint, 'is not subscribable/implemented yet');
              sendErrResponse(500, "unsubscribable endpoint")
              return;
            }
            //console_wrapper.log('app::handleSubscription - checking for subscribable endpoints', req.path, userStream);
            // check user_streamsubscriptions

            // make sure user_stream_id, stream doesn't already exist
            // if exists make sure params are updated
            // otherwise create it
            //console_wrapper.log('app::handleSubscription - streamId', userStream.id);
            ref.cache.findOrCreateUserSubscription(userStream.id, req.path, JSON.stringify(req.apiParams), function(subscription, err) {
              if (err || !subscription) {
                console_wrapper.log('streams::handleSubscription - subscription could not be created', userStream.id, req.path, err);
                sendErrResponse(500, "cant create subscription")
                return;
              }
              if (subscription.stream != req.path) {
                console_wrapper.log('streams::handleSubscription - subscription could not be created, path doesnt match', subscription.stream, '!=', req.path);
              }
              //console_wrapper.log('streams::handleSubscription - connection', connId, 'endpoint', req.path, 'subscription', subscription)
              // poke the dispatch engine to reload state from db

              //ref.loadSubscriptions();
              //console_wrapper.log('streams::handleSubscription - publish');
              var data = {
                act: "sub",
                uid: tokenObj.userid,
                sid: userStream.id,
                sub: subscription
              }
              ref.redisClient.publish('AppDotNetAPI', JSON.stringify(data));

              var resObj={
                "meta": {
                  "code": 200,
                  "error_message": "Implemented"
                }
              };
              res.status(200).type('application/json').send(JSON.stringify(resObj));
            })
          });
        });
      });

    })
  }
};
