
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

function formatuser(user) {
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
  }
  return user;
}

function formatpost(post) {
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
  }
  return post;
}

module.exports = {
  'postsCallback' : function(resp) {
    return function(posts, err, meta) {
      for(var i in posts) {
        var post=posts[i];
        posts[i]=formatpost(post);
        if (post.repost_of) {
          // this is an object...
          post.repost_of.user=formatuser(post.repost_of.user);
          post.repost_of=formatpost(post.repost_of)
        }
        posts[i].you_reposted=false;
        posts[i].you_starred=false;
        if (typeof(post.user)=='undefined') {
          console.log('dialect.appdotnet_official.callback.js::postsCallback - missing user for post '+i);
          posts[i].user={};
        }
        posts[i].user=formatuser(post.user);
        posts[i].user.follows_you=false;
        posts[i].user.you_blocked=false;
        posts[i].user.you_follow=false;
        posts[i].user.you_muted=false;
        posts[i].user.you_can_subscribe=false;
        posts[i].user.you_can_follow=true;
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

  'usersCallback' : function(resp) {
    // posts is a hack, we're converting things like global to user lists
    // we need to not do this...
    return function(posts, err, meta) {
      var users=[];
      for(var i in posts) {
        var post=posts[i];
        posts[i].user.follows_you=false;
        posts[i].user.you_blocked=false;
        posts[i].user.you_follow=false;
        posts[i].user.you_muted=false;
        posts[i].user.you_can_subscribe=false;
        posts[i].user.you_can_follow=true;
        users.push(formatuser(posts[i].user));
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

  'postCallback' : function(resp) {
    return function(post, err, meta) {
      var res={
        meta: { code: 200 },
        data: formatpost(post)
      };
      if (post && post.user) {
        res.data.user=formatuser(post.user);
      }
      if (meta) {
        res.meta=meta;
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
