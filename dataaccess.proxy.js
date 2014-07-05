/** get request http library */
var request = require('request');

var proxycalls=0;
var lcalls=0;
// minutely status report
setInterval(function () {
  var ts=new Date().getTime();
  process.stdout.write("\n");
  console.log('data.proxy report '+(proxycalls-lcalls)+' proxy recent calls. '+proxycalls+' overall');
  // just need a redis info call to pull memory and keys stats
  lcalls=proxycalls;
},60*1000);

// pass in proxy settings or just conf it?
module.exports = {
  next: null,
  /*
   * users
   */
  addUser: function(username, password, callback) {
    if (this.next) {
      this.next.addUser(username,password,callback);
    }
  },
  setUser: function(iuser, ts, callback) {
    if (this.next) {
      this.next.setUser(iuser, ts, callback);
    }
  },
  delUser: function(userid, callback) {
    if (this.next) {
      this.next.delUser(userid, callback);
    }
  },
  getUserID: function(username, callback) {
    if (!username) {
      callback(null, 'dataccess.proxy.js::getUserID() - username was not set');
      return;
    }
    var ref=this;
    console.log('proxying user @'+username);
    proxycalls++;
    request.get({
      url: ref.apiroot+'/users/@'+username
    }, function(e, r, body) {
      var res=JSON.parse(body);
      // upload fresh proxy data back into dataSource
      ref.dispatcher.updateUser(res.data,new Date().getTime(),function(user,err) {
        if (user==null & err==null) {
          if (this.next) {
            this.next.getUserID(username, callback);
            return;
          }
        } else if (err) {
          console.log("dataccess.proxy.js - User get err: ",err);
        //} else {
          //console.log("User Updated");
        }
        // finally reutrn
        callback(user,err,res.meta);
      });
    });
  },
  // callback is user,err,meta
  getUser: function(userid, callback) {
    if (userid==undefined) {
      callback(null, 'dataccess.proxy.js:getUser - userid is undefined');
      return;
    }
    if (!userid) {
      callback(null, 'dataccess.proxy.js:getUser - userid isn\'t set');
      return;
    }
    var ref=this;
    console.log('proxying user '+userid);
    proxycalls++;
    request.get({
      url: ref.apiroot+'/users/'+userid
    }, function(e, r, body) {
      var res=JSON.parse(body);
      // upload fresh proxy data back into dataSource
      ref.dispatcher.updateUser(res.data, new Date().getTime(), function(user,err) {
        if (user==null & err==null) {
          if (this.next) {
            this.next.getUser(userid, callback);
            return;
          }
        } else if (err) {
          console.log("dataccess.proxy.js - User Update err: ",err);
        //} else {
          //console.log("User Updated");
        }
        // finally reutrn
        callback(user,err,res.meta);
      });
    });
  },
  /*
   * local user token
   */
  // should we really pass token in? it's cleaner separation if we do
  // even though this is the only implemention of the abstraction
  addAPIUserToken: function(userid, client_id, scopes, token, callback) {
    if (this.next) {
      this.next.addAPIUserToken(userid, client_id, scopes, token, callback);
    }
  },
  delAPIUserToken: function(token, callback) {
    if (this.next) {
      this.next.delAPIUserToken(token, callback);
    }
  },
  getAPIUserToken: function(token, callback) {
    if (this.next) {
      this.next.getAPIUserToken(token, callback);
    }
  },
  /*
   * user upstream tokens
   */
  setUpstreamUserToken: function(userid, token, scopes, upstreamUserId, callback) {
    if (this.next) {
      this.next.setUpstreamUserToken(userid, token, scopes, upstreamUserId, callback);
    }
  },
  /*
   * local clients
   */
  addLocalClient: function(userid, callback) {
    if (this.next) {
      this.next.addLocalClient(userid, callback);
    }
  },
  getLocalClient: function(client_id, callback) {
    if (this.next) {
      this.next.getLocalClient(client_id, callback);
    }
  },
  delLocalClient: function(client_id,callback) {
    if (this.next) {
      this.next.delLocalClient(client_id, callback);
    }
  },
  /*
   * clients
   */
  addSource: function(client_id, name, link, callback) {
    if (this.next) {
      this.next.addSource(client_id, name, link, callback);
    }
  },
  getClient: function(client_id, callback) {
    if (this.next) {
      this.next.getClient(client_id, callback);
    }
  },
  setSource: function(source, callback) {
    if (this.next) {
      this.next.setSource(source, callback);
    }
  },
  /* client (app) tokens */
  addAPIAppToken: function(client_id, token, request) {
    console.log('dataccess.proxy.js::addAPIAppToken - write me!');
  },
  delAPIAppToken: function(client_id, token) {
    console.log('dataccess.proxy.js::delAPIAppToken - write me!');
  },
  getAPIAppToken: function(client_id, token) {
    console.log('dataccess.proxy.js::getAPIAppToken - write me!');
  },
  /* client upstream token */
  addUpstreamClientToken: function(token, scopes) {
    console.log('dataccess.proxy.js::addUpstreamClientToken - write me!');
  },
  delUpstreamClientToken: function(token) {
    console.log('dataccess.proxy.js::delUpstreamClientToken - write me!');
  },
  getUpstreamClientToken: function() {
    console.log('dataccess.proxy.js::getUpstreamClientToken - write me!');
  },
  /** user stream */
  /** app stream */

  /**
   * posts
   */
  addPost: function(ipost, callback) {
    if (this.next) {
      this.next.addPost(ipost, callback);
    }
  },
  setPost:  function(ipost, callback) {
    if (this.next) {
      this.next.setPost(ipost, callback);
    }
  },
  getPost: function(id, callback) {
    if (id==undefined) {
      callback(null, 'dataccess.proxy.js::getPost - id is undefined');
      return;
    }
    if (callback==undefined) {
      callback(null, 'dataccess.proxy.js::getPost - callback is undefined');
      return;
    }
    var ref=this;
    console.log('proxying post '+id);
    proxycalls++;
    request.get({
      url: ref.apiroot+'/posts/'+id
    }, function(e, r, body) {
      var res=JSON.parse(body);
      ref.dispatcher.setPost(res.data, function(post,err) {
        //console.log('dataccess.proxy.js::getPost - setPost: '+post+','+err);
        if (post==null && err==null) {
          if (this.next) {
            this.next.getPost(id, callback);
          } else {
            callback(res.data, null, res.meta);
          }
        } else {
          callback(post, err, res.meta);
        }
      });
    });
  },
  getUserPosts: function(userid, params, callback) {
    if (userid==undefined) {
      callback(null, 'dataccess.proxy.js::getUserPosts - userid is undefined');
      return;
    }
    if (userid==='') {
      callback(null, 'dataccess.proxy.js::getUserPosts - userid is empty');
      return;
    }
    var ref=this;
    console.log('proxying user posts '+userid);
    proxycalls++;
    request.get({
      url: ref.apiroot+'/users/'+userid+'/posts'
    }, function(e, r, body) {
      var res=JSON.parse(body);
      for(var i in res.data) {
        var post=res.data[i];
        ref.dispatcher.setPost(post);
      }
      callback(res.data, null, res.meta);
    });
  },
  getGlobal: function(params, callback) {
    //console.log('dataaccess.proxy.js::getGlobal - write me');
    var ref=this;
    proxycalls++;
    var querystring='';
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
    console.log('proxying global?'+querystring);
    request.get({
      url: ref.apiroot+'/posts/stream/global?'+querystring
    }, function(e, r, body) {
      var res=JSON.parse(body);
      //console.dir(res);
      for(var i in res.data) {
        var post=res.data[i];
        //console.log('Processing post '+post.id);
        ref.dispatcher.setPost(post);
      }
      callback(res.data, null, res.meta);
    });
  },
  getExplore: function(params, callback) {
    //console.log('dataaccess.proxy.js::getGlobal - write me');
    var ref=this;
    proxycalls++;
    var querystring='';
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
    console.log('proxying explore?'+querystring);
    request.get({
      url: ref.apiroot+'/posts/stream/explore?'+querystring
    }, function(e, r, body) {
      var res=JSON.parse(body);
      callback(res.data, null, res.meta);
    });
  },  
  /** channels */
  setChannel: function (chnl, ts, callback) {
    if (this.next) {
      this.next.setChannel(chnl, ts, callback);
    }
  },
  getChannel: function(id, callback) {
    if (id==undefined) {
      callback(null, 'dataccess.proxy.js::getChannel - id is undefined');
      return;
    }
    var ref=this;
    console.log('proxying channel '+id);
    proxycalls++;
    request.get({
      url: ref.apiroot+'/channels/'+id
    }, function(e, r, body) {
      var res=JSON.parse(body);
      var ts=new Date().getTime();
      ref.dispatcher.setChannel(res.data, ts, function(chnl,err) {
        if (chnl==null && err==null) {
          if (this.next) {
            this.next.getChannel(id, callback);
          } else {
            callback(res.data,null,res.meta);
          }
        } else {
          callback(chnl,err,res.meta);
        }
      });
    });
  },
  /** messages */
  setMessage: function (msg, callback) {
    if (this.next) {
      this.next.setMessage(msg, callback);
    }
  },
  getMessage: function(id, callback) {
    if (id==undefined) {
      callback(null, 'dataccess.proxy.js::getMessage - id is undefined');
      return;
    }
    var ref=this;
    console.log('proxying message '+id);
    proxycalls++;
    request.get({
      url: ref.apiroot+'/channels/messages?ids='+id
    }, function(e, r, body) {
      var res=JSON.parse(body);
      ref.dispatcher.setMessage(res.data,function(msg,err) {
        if (msg==null && err==null) {
          if (this.next) {
            this.next.getMessage(id, callback);
          }
        } else {
          callback(msg,err,res.meta);
        }
      });
    });
  },
  getChannelMessages: function(channelid, params, callback) {
    if (channelid==undefined) {
      callback(null, 'dataccess.proxy.js::getChannelMessages - channelid is undefined');
      return;
    }
    var ref=this;
    console.log('proxying messages in channel '+channelid);
    proxycalls++;
    request.get({
      url: ref.apiroot+'/channels/'+channelid+'/messages'
    }, function(e, r, body) {
      var res=JSON.parse(body);
      for(var i in res.data) {
        var msg=res.data[i];
        ref.dispatcher.setMessage(msg);
      }
      callback(res.data, null, res.meta);
    });

  },
  /** subscription */
  /*
    channelid: { type: Number, index: true },
    userid: { type: Number, index: true },
    created_at: { type: Date, index: true },
    active: { type: Boolean, index: true },
    last_updated: { type: Date },
  */
  setSubscription: function (chnlid, userid, del, ts, callback) {
    if (this.next) {
      this.next.setSubscription(chnlid, userid, del, ts, callback);
    }
  },
  getUserSubscriptions: function(userid, params, callback) {
    if (id==undefined) {
      callback(null, 'dataccess.proxy.js::getUserSubscriptions - id is undefined');
      return;
    }
    if (this.next) {
      this.next.getUserSubscriptions(userid, params, callback);
    }
  },
  getChannelSubscriptions: function(channelid, params, callback) {
    if (id==undefined) {
      callback(null, 'dataccess.proxy.js::getChannelSubscriptions - id is undefined');
      return;
    }
    if (this.next) {
      this.next.getChannelSubscriptions(channelid, params, callback);
    }
  },
  /** files */
  /** entities */
  // should this model more closely follow the annotation model?
  // not really because entities are immutable (on posts not users)
  extractEntities: function(type, id, entities, entitytype, callback) {
    if (this.next) {
      this.next.extractEntities(type, id, entities, entitytype, callback);
    }
  },
  getEntities: function(type, id, callback) {
    if (this.next) {
      this.next.getEntities(type, id, callback);
    } else {
      callback(null, null);
    }
  },
  getHashtagEntities: function(hashtag, params, callback) {
    if (hashtag==undefined) {
      callback(null, 'dataccess.proxy.js::getHashtagEntities - hashtag is undefined');
      return;
    }
    if (hashtag==='') {
      callback(null, 'dataccess.proxy.js::getHashtagEntities - hashtag is empty');
      return;
    }
    var ref=this;
    console.log('proxying hashtag posts '+hashtag);
    proxycalls++;
    request.get({
      url: ref.apiroot+'/posts/tag/'+hashtag
    }, function(e, r, body) {
      var res=JSON.parse(body);
      var entries=[];
      for(var i in res.data) {
        var post=res.data[i];
        ref.dispatcher.setPost(post);
        var entry={
          idtype: 'post',
          typeid: post.id,
          type: 'hashtag',
          text: hashtag
        };
        entries.push(entry);
      }
      callback(entries, null, res.meta);
    });
  },
  /**
   * Annotations
   */
  addAnnotation: function(idtype, id, type, value, callback) {
    //console.log('dataccess.proxy.js::addAnnotation - write me!');
    if (this.next) {
      this.next.addAnnotation(idtype, id, type, value, callback);
    }
  },
  clearAnnotations: function(idtype, id, callback) {
    //console.log('dataccess.proxy.js::clearAnnotations - write me!');
    if (this.next) {
      this.next.clearAnnotations(idtype, id, callback);
    }
  },
  getAnnotations: function(idtype, id, callback) {
    console.log('dataccess.proxy.js::getAnnotations - write me!');
    if (this.next) {
      this.next.getAnnotations(idtype, id, callback);
    }
  },
  /** follow */
  setFollow: function (srcid, trgid, id, del, ts, callback) {
    if (this.next) {
      this.next.setFollow(srcid, trgid, id, del, ts, callback);
    }
  },
  getFollows: function(userid, params, callback) {
    if (id==undefined) {
      callback(null, 'dataccess.proxy.js::getFollows - userid is undefined');
      return;
    }
    if (this.next) {
      this.next.getFollows(userid, params, callback);
    }
  },
  /** Star/Interactions */
  setInteraction: function(userid, postid, type, metaid, deleted, ts, callback) {
    if (this.next) {
      this.next.setInteraction(userid, postid, type, metaid, deleted, ts, callback);
    }
  },
  // getUserInteractions, remember reposts are stored here too
  // if we're going to use one table, let's keep the code advantages from that
  // getUserStarPosts
  getInteractions: function(type, userid, params, callback) {
    if (type=='star') {
      var ref=this;
      console.log('proxying user/stars '+userid);
      proxycalls++;
      request.get({
        url: ref.apiroot+'/users/'+userid+'/stars'
      }, function(e, r, body) {
        var res=JSON.parse(body);
        // returns a list of posts but not what this function normally returns
        // a list of interactions
        //console.log(res);
        var actions=[];
        for(var i in res.data) {
          var post=res.data[i];
          ref.dispatcher.setPost(post);
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
        callback(actions, null, res.meta);
      });

    } else {
      console.log('dataccess.proxy.js::getInteractions - write me! type: '+type);
    }
    if (this.next) {
      this.next.getInteractions(type, userid, params, callback);
    }
  },
  getOEmbed: function(url, callback) {
    var ref=this;
    console.log('proxying oembed url '+url);
    proxycalls++;
    request.get({
      url: ref.apiroot+'/oembed?url='+url
    }, function(e, r, body) {
      var data=JSON.parse(body); // no data container, weird...
      //console.log('dataccess.proxy.js::getOEmbed - got ',res);
      callback(data, null);
    });
  }
}