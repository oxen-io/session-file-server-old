
function sendresponse(json, resp) {
  var ts=new Date().getTime();
  var diff = ts-resp.start;
  if (diff > 1000) {
    // this could be to do the client's connection speed
    // how because we stop the clock before we send the response...
    console.log(resp.path+' served in '+(ts-resp.start)+'ms');
  }
  if (resp.prettyPrint) {
    json=JSON.stringify(JSON.parse(json),null,4);
  }
  //resp.set('Content-Type', 'text/javascript');
  resp.type('application/json');
  resp.setHeader("Access-Control-Allow-Origin", "*");
  resp.send(json);
}

function sendObject(obj, resp) {
  var ts=new Date().getTime();
  var diff = ts-resp.start;
  if (diff > 1000) {
    // this could be to do the client's connection speed
    // how because we stop the clock before we send the response...
    console.log(resp.path+' served in '+(ts-resp.start)+'ms');
  }

  if (obj.meta==undefined) {
    obj.meta={ code: 200 };
  }

  if (obj.meta && obj.meta.code) {
    resp.status(obj.meta.code);
  }

  resp.type('application/json');
  resp.setHeader("Access-Control-Allow-Origin", "*");

  resp.send(JSON.stringify(obj,null,resp.prettyPrint?4:null));
}

function ISODateString(d) {
  if (!d || !d.getUTCFullYear) {
    //console.log('created_at is type (!date): ',d,typeof(d));
    return d;
  }
  function pad(n){return n<10 ? '0'+n : n}
  return d.getUTCFullYear()+'-'
    + pad(d.getUTCMonth()+1)+'-'
    + pad(d.getUTCDate())+'T'
    + pad(d.getUTCHours())+':'
    + pad(d.getUTCMinutes())+':'
    + pad(parseInt(d.getUTCSeconds()))+'Z';
}

function formattoken(token) {
  // TODO: write me
  if (token.user) {
    token.user=formatuser(token.user, token);
  }
  /*
    app: {
      client_id: "m89LnrxQBWt3SgwHaGdDreym2fJuJnvA",
      link: "http://foo.example.com",
      name: "Test app",
    },
    scopes: [
      "stream",
      "messages",
      "export",
      "write_post",
      "follow"
    ],
    limits: {
      "following": 40,
      "max_file_size": 10000000
    },
    "storage": {
      "available": 8787479688,
      "used": 1212520312
    },
    user: formatuser(user, token),
    "invite_link": "https://join.app.net/from/notareallink"
  */
  return token;
}

function formatuser(user, token) {
  if (user) {
    user.id=''+user.id;
    user.username=''+user.username; // 530 was cast as an int
    user.created_at=ISODateString(user.created_at);
    if (!user.counts) {
      // usually caused by call user instead of users callback
      console.log('dialect.appdotnet_official.callback.js::formatuser - no user counts object')
      user.counts={}
    }
    user.counts.following=parseInt(0+user.counts.following);
    user.counts.posts=parseInt(0+user.counts.posts);
    user.counts.followers=parseInt(0+user.counts.followers);
    user.counts.stars=parseInt(0+user.counts.stars);
    if (user.name) {
      user.name=''+user.name;
    }
    if (token) {
      // boolean (and what about the non-existent state?)
      user.follows_you=user.follows_you?true:false;
      user.you_blocked=user.you_blocked?true:false;
      user.you_follow=user.you_follow?true:false;
      user.you_muted=user.you_muted?true:false;
      user.you_can_subscribe=user.you_can_subscribe?true:false;
      user.you_can_follow=user.you_can_follow?true:true;
    }
  }
  return user;
}

module.exports = {
  'usersCallback' : function(resp, token) {
    return function(unformattedUsers, err, meta) {
      var users=[];
      for(var i in unformattedUsers) {
        // filter out nulls, it's convenient to filter here
        if (formatuser(unformattedUsers[i])) {
          users.push(formatuser(unformattedUsers[i], token));
        }
      }
      // meta order: min_id, code, max_id, more
      var res={
        meta: meta,
        data: users
      };
      //console.log('ADNO.CB::usersCallback - res', res);
      sendObject(res, resp);
    }
  },

  'userCallback' : function(resp, token) {
    return function(user, err, meta) {
      // meta order: min_id, code, max_id, more
      if (!user) {
        user={
          id: 0,
          username: 'notfound',
          created_at: '2014-10-24T17:04:48Z',
          avatar_image: {
            url: 'http://cdn.discordapp.com/icons/235920083535265794/a0f48aa4e45d17d1183a563b20e15a54.png'
          },
          cover_image: {
            url: 'http://cdn.discordapp.com/icons/235920083535265794/a0f48aa4e45d17d1183a563b20e15a54.png'
          },
          counts: {
            following: 0,
          }
        };
      }
      var res={
        meta: meta,
        data: formatuser(user, token)
      };
      sendObject(res, resp);
    }
  },

  'tokenCallback' : function(resp, token) {
    return function(data, err, meta) {
      err = typeof err !== 'undefined' ? err : undefined;
      meta = typeof meta !== 'undefined' ? meta : undefined;
      var res={
        meta: meta,
        data: formattoken(data)
      };
      sendObject(res, resp);
    }
  },

  // what's the difference between this and post?
  'dataCallback' : function(resp) {
    return function(data, err, meta) {
      err = typeof err !== 'undefined' ? err : undefined;
      meta = typeof meta !== 'undefined' ? meta : undefined;
      var res={
        meta: meta,
        data: data
      };
      sendObject(res, resp);
    }
  },

  'fileCallback': function(resp, token) {
    return function(data, err, meta) {
      console.log('fileCallback', data, 'err', err, 'meta', meta);
      err = typeof err !== 'undefined' ? err : undefined;
      meta = typeof meta !== 'undefined' ? meta : undefined;
      var res={
        meta: meta,
        data: data
      };
      sendObject(res, resp);
    }
  },

  'oembedCallback' : function(resp) {
    return function(oembed, err) {
      // there's no data/meta envelope for oembed
      //console.log('ADNO::oembed got ',oembed);
      sendresponse(JSON.stringify(oembed), resp);
    }
  },
}
