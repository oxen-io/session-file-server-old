
function sendrepsonse(json, resp) {
  if (resp.prettyPrint) {
    json=JSON.stringify(JSON.parse(json),null,4);
  }
  //resp.set('Content-Type', 'text/javascript');
  resp.type('application/json');
  resp.send(json);
}

function ISODateString(d) {
  if (!d.getUTCFullYear) {
    console.log('created_at is type (!date): ',d,typeof(d));
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

function formatpost(post, token) {
  // cast fields to make sure they're the correct type

  // Now to cast
  if (post) {
    post.id=''+post.id; // cast to String
    post.num_replies=parseInt(0+post.num_replies); // cast to Number
    post.num_reposts=parseInt(0+post.num_reposts); // cast to Number
    post.num_stars=parseInt(0+post.num_stars); // cast to Number
    post.machine_only=post.machine_only?true:false;
    post.thread_id=''+post.thread_id; // cast to String (Number is too big for js?)
    if (post.reply_to) {
      post.reply_to=''+post.reply_to; // cast to String (Number is too big for js?)
    }
    // remove microtime
    post.created_at=ISODateString(post.created_at);
    if (token) {
      // boolean (and what about the non-existent state?)
      post.you_reposted=post.you_reposted?true:false;
      post.you_starred=post.you_starred?true:false;
    }
  }
  return post;
}

module.exports = {
  'postsCallback' : function(resp, token) {
    return function(posts, err, meta) {
      for(var i in posts) {
        var post=posts[i];
        posts[i]=formatpost(post, token);
        if (post.repost_of) {
          // this is an object...
          post.repost_of.user=formatuser(post.repost_of.user, token);
          post.repost_of=formatpost(post.repost_of, token)
        }
        if (typeof(post.user)=='undefined') {
          console.log('dialect.appdotnet_official.callback.js::postsCallback - missing user for post '+i);
          posts[i].user={};
        }
        posts[i].user=formatuser(post.user, token);
      }
      // meta order: min_id, code, max_id, more
      var res={
        meta: meta,
        data: posts
      };
      if (res.meta==undefined) {
        res.meta={ code: 200 };
      }
      sendrepsonse(JSON.stringify(res), resp);
    }
  },

  'usersCallback' : function(resp, token) {
    // posts is a hack, we're converting things like global to user lists
    // we need to not do this...
    return function(posts, err, meta) {
      var users=[];
      for(var i in posts) {
        users.push(formatuser(posts[i].user, token));
      }
      // meta order: min_id, code, max_id, more
      var res={
        meta: meta,
        data: users
      };
      if (res.meta==undefined) {
        res.meta={ code: 200 };
      }
      sendrepsonse(JSON.stringify(res), resp);
    }
  },

  'postCallback' : function(resp, token) {
    return function(post, err, meta) {
      var res={
        meta: { code: 200 },
        data: formatpost(post, token)
      };
      if (post && post.user) {
        res.data.user=formatuser(post.user, token);
      }
      if (meta) {
        res.meta=meta;
      }
      sendrepsonse(JSON.stringify(res), resp);
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
      if (res.meta==undefined) {
        res.meta={ code: 200 };
      }
      sendrepsonse(JSON.stringify(res), resp);
    }
  },

  'dataCallback' : function(resp) {
    return function(data, err, meta) {
      err = typeof err !== 'undefined' ? err : undefined;
      meta = typeof meta !== 'undefined' ? meta : undefined;
      var res={
        meta: meta,
        data: data
      };
      if (res.meta==undefined) {
        res.meta={ code: 200 };
      }
      sendrepsonse(JSON.stringify(res), resp);
    }
  },

  'oembedCallback' : function(resp) {
    return function(oembed, err) {
      // there's no data/meta envelope for oembed
      //console.log('ADNO::oembed got ',oembed);
      sendrepsonse(JSON.stringify(oembed), resp);
    }
  },
}
