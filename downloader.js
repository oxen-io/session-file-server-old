/** get request http library */
var request = require('request');
var qs = require('qs');
var rateLimiter = require('./ratelimiter.js');

// backwards compatibility to allow us to do the right thing
// this doesn't give us QoS but does allow us to say put in the background
// does defer to immediate IO
require("setimmediate");

// remove 5 connections to upstream at a time
// we definitely want to burst when we need it
// though should set some type of limit, like the max ADN resets
// for what time period though? one frequency?
require('http').globalAgent.maxSockets = Infinity
require('https').globalAgent.maxSockets = Infinity

/** @todo make count configureable, low latency=20count, aggressive cache=200count */

var proxycalls=0;
var proxywrites=0;
var lcalls=0;
// minutely status report
setInterval(function () {
  var ts=new Date().getTime();
  console.log('downloader report '+(proxycalls-lcalls)+' proxy recent calls. '+proxycalls+' overall');
  // just need a redis info call to pull memory and keys stats
  lcalls=proxycalls;
}, 60*1000);

var path = require('path');
var nconf = require('nconf');
// Look for a config file
var config_path = path.join(__dirname, '/config.json');
// and a model file
var config_model_path = path.join(__dirname, '/config.models.json');
nconf.argv().env('__').file({file: config_path}).file('model', {file: config_model_path});

// pass in proxy settings or just conf it?
module.exports = {
  dispatcher: null,
  apiroot: nconf.get('uplink:apiroot') || 'https://api.app.net',
  // should utilize getReplies somehow or reverse...
  // we need a start point and a false to recurse the pages or not
  downloadThread: function(postid, token, callback) {
    var ref=this;
    console.log('proxying posts replies '+postid);
    proxycalls++;
    rateLimiter.rateLimit(token?1:0, 0, function() {
      request.get({
        url: ref.apiroot+'/posts/'+postid+'/replies?count=200',
        headers: {
          "Authorization": "Bearer "+token,
        }
      }, function(e, r, body) {
        rateLimiter.logRequest(token?1:0, 0);
        if (!e && r.statusCode == 200) {
          var res=JSON.parse(body);
          for(var i in res.data) {
            var post=res.data[i];
            console.log('downloader.js::downloadThread - got',post.id,'of',postid);
            ref.dispatcher.setPost(post);
            // hrm... if we have multiple at this level...
            //ref.downloadReplies(post.id, token, callback);
          }
          //if (res.meta.more) {
            // starting point?
            //ref.downloadThread();
          //} else {
            if (callback) {
              // will be call per post ugh
              // what about conversion back??
              callback(res.data, null, res.meta);
            }
          //}
        } else {
          console.log('downloader.js:downloadThread - request failure');
          console.log('error', e);
          console.log('statusCode', r.statusCode);
          console.log('body', body);
          callback(null, e, null);
        }
      });
    });
  },
  downloadMentions: function(userid, params, token, callback) {
    //console.log('dataaccess.proxy.js::getGlobal - write me');
    var ref=this;
    proxycalls++;
    var querystring='';
    /*
    if (params.count || params.since_id || params.before_id) {
      // convert to array/loop
      // 0 is ok, where's isset for JS?
      if (params.count!=20) { // if not equal default
        querystring+='&count='+params.count;
      }
      if (params.since_id) {
        querystring+='&since_id='+params.since_id;
      }
      if (params.before_id) {
        querystring+='&before_id='+params.before_id;
      }
    }
    */
    querystring+='&count=200';
    console.log('proxying users/'+userid+'/mentions?'+querystring);
    rateLimiter.rateLimit(token?1:0, 0, function() {
      request.get({
        url: ref.apiroot+'/users/'+userid+'/mentions?'+querystring,
        headers: {
          "Authorization": "Bearer "+token,
        }
      }, function(e, r, body) {
        rateLimiter.logRequest(token?1:0, 0);
        if (!e && r.statusCode == 200) {
          var res=JSON.parse(body);
          //console.dir(res);
          for(var i in res.data) {
            var post=res.data[i];
            //console.log('Processing post '+post.id);
            ref.dispatcher.setPost(post);
          }
          if (callback) {
            callback(res.data, null, res.meta);
          }
        } else {
          console.log('downloader.js:downloadMentions - request failure');
          console.log('error', e);
          console.log('statusCode', r.statusCode);
          console.log('body', body);
          callback(null, e, null);
        }
      });
    });
  },
  downloadStars: function(userid, callback) {
    var ref=this;
    var ts=new Date().getTime();
    console.log('proxying user/stars '+userid);
    proxycalls++;
    rateLimiter.rateLimit(1, 0, function() {
      request.get({
        url: ref.apiroot+'/users/'+userid+'/stars?count=200'
      }, function(e, r, body) {
        rateLimiter.logRequest(1, 0);
        if (!e && r.statusCode == 200) {
          var res=JSON.parse(body);
          // returns a list of posts but not what this function normally returns
          // a list of interactions
          //console.log(res);
          var actions=[];
          for(var i in res.data) {
            var post=res.data[i];
            //ref.dispatcher.setPost(post);
            if (post.user) {
              // is this right?
              ref.dispatcher.apiToPost(post, res.meta, function(apipost, err) {
                if (apipost.user) {
                  // unfortunately we won't have a true time when something is starred
                  ref.dispatcher.setStar({
                    post: apipost,
                    user: {
                      id: userid
                    }
                  }, post.deleted, 0, ts);
                } else {
                  // most no users are deleted users
                  if (!apipost.deleted && !apipost.is_deleted) {
                    console.log('downloader.js::downloadStars - no user in apipost',apipost.id,'post',apipost);
                    //console.log('downloader.js::downloadStars - deleted',apipost.deleted,'is_deleted',apipost.is_deleted);
                  }
                }
              });
            } else {
              // user is missing because post is deleted...
              // and/or the user is deleted too
              if (!post.deleted && !post.is_deleted) {
                // only really interesting if the post isn't deleted
                console.log('downloader.js::downloadStars - no user in post',post.id,'post',post);
              }
            }
            var action={
              userid: userid,
              type: 'star',
              datetime: post.created_at,
              idtype: 'post',
              typeid: post.id,
              asthisid: 0, // meta.id
            };
            actions.push(action);
          }
          if (callback) {
            callback(actions, null, res.meta);
          }
        } else {
          console.log('downloader.js:getUserStars - request failure');
          console.log('error', e);
          console.log('statusCode', r.statusCode);
          console.log('body', body);
          callback(null, e, null);
        }
      });
    });
  },
  downloadFollowing: function(user, token, callback) {
    //console.log('dataaccess.proxy.js::getUserStream - write me!');
    var ref=this;
    var ts=new Date().getTime();
    /** @todo async processing needed, so we don't lock the API. This all could be sent to a background thread*/
    // after the fact processing
    // assuming this proxy trigger means we don't have any followers for user
    // let's get some users
    var need=0, added=0;
    var downloadfollowings=function(start, ts, self) {
      console.log('proxying user '+user+' following before '+start);
      proxycalls++;
      var str='';
      if (start) {
        str+='&before_id='+start;
      }
      var startdelay=0;
      var startdelay2=0;
      var counter=0;
      // if we lower the count, we maybe more responsive...
      //console.log('apitroot', ref.apiroot);
      rateLimiter.rateLimit(token?1:0, 0, function() {
        request.get({
          url: ref.apiroot+'/users/'+user+'/following?count=200'+str,
          headers: {
            "Authorization": "Bearer "+token,
          }
        }, function(e, r, body) {
          rateLimiter.logRequest(token?1:0, 0);
          if (!e && r.statusCode == 200) {
            var res=JSON.parse(body);
            console.log('retrieved followings '+res.data.length);
            // post process
            // 200 setFollow subprocess takes a huge toll on node
            // really slows the whole thing down...
            // this can lock for more than 35s
            // and then events/triggers really pile up
            for(var i in res.data) {
              var follow={
                user: self,
                follows_user: res.data[i]
              };
              //console.log('follow is ',follow);
              //ref.dispatcher.setPost(post);
              // ok, let's not spam our workers, we'll slowly deal out this work.
              // 100 is too slow on my machine
              // 200 is fine
              // at 150, we can sync 900 users & follows in under 60s
              // probably can be an issue if multiple users are calling this...
              // though at 150 starting to see hangs towards the end
              //
              // if we move to a fork then there is no reason to background
              // the downloading but until we do, we need to yeild
              // and let getUserStream process while we do our thing
              startdelay2+=200;
              var func2=function(follow) {
                // this put it high on the QoS list but delayed...
                // so we get some what of a medium priority (not current but not low)
                // doesn't the delay cancel whether it's high or low?
                // probably...
                setTimeout(function() {
                  // if we can skip the self update, that may help performance
                  ref.dispatcher.setFollows(follow, 0, 0, ts);
                  process.stdout.write(' ');
                  counter++;
                  added++;
                  if (counter==res.data.length) {
                    console.log('Following batch complete',counter,added+'/'+need);
                    if (added==need) {
                      console.log('downloader.js::downloadFollowing - done');
                      ref.dispatcher.getFollowings(user, null, function(followings, err) {
                        console.log('getFollowing',followings.length);
                        if (callback) {
                          callback([], null);
                        }
                      });
                    }
                  }
                }, startdelay2);
              };
              func2(follow);
              /** @todo we need to track usage rate/limits on each token */
              // we could also queue up their last 20 posts too...
              // it's a little agressive, we have want we need for the user stream
              // burns through our token limits and puts unneeded stress on the network
              // well as long as we have an upstream we don't need this
              // even if we didn't, we'd have to poll global anyways to get all new posts efficently
              /*
              startdelay+=10*1000; // we get about 20 reads/minute
              // 10*200=over 20 minutes to d/l everything
              var userid=res.data[i].id;
              //console.log('at '+startdelay+'s get user\'s '+userid+' posts');
              // scope hacks...
              var func=function(userid) {
                setTimeout(function() {
                  ref.getUserPosts(userid, null, function() {});
                }, startdelay);
              };
              func(userid);
              */
            }
            console.log('Processed all '+res.data.length+' followings in this batch');
            need+=res.data.length;

            // dispatcher next io call asap
            // need to page results too...
            if (res.meta && res.meta.more) {
              // in 1s
              console.log('downloader.js::downloadFollowing - getting more followings',res.meta.min_id,res.meta.max_id);
              // in one second continue
              //setTimeout(function() {
              // should help the stack, right? we don't need to return any faster here
              // lets block until we're done
              // but it does yeild for a second
              // doesn't work like that in v10
              // we don't want to yeild, it's a high priority we get all these
              //setImmediate(function() {
                downloadfollowings(res.meta.min_id, ts, self);
              //});
              //}, 1000);
            } else {
              console.log('downloader.js::downloadFollowing - retrieved all followings',res.meta);
            }
          } else {
            console.log('downloader.js:downloadFollowing followings download - request failure');
            // e can be { [Error: socket hang up] code: 'ECONNRESET' }
            console.log('error');
            console.dir(e);
            if (r) {
              console.log('statusCode', r.statusCode);
            }
            console.log('body', body);
          }
        });
      });
    }
    // background but at top of queue
    // so we get a tick of yeild in there, let's not starve other's requests
    // uhm there is no rush to download all the followers
    // we've already served the stream
    // ah but you can't update the stream until we know everyone that you're following
    // so there is a rush
    setTimeout(function() {
      ref.dispatcher.getUser(user, null, function(userSelf, err) {
        //console.log('self',self);
        downloadfollowings(0, ts, userSelf);
      });
    }, 0);
  },
}
/*
download - request failure
error
{ [Error: socket hang up] code: 'ECONNRESET', sslError: undefined }
body undefined
*/