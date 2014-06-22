/**
This module takes the API and communicates with the front-end internal API (dispatcher)
to provide data
this file is responsible for the dialect for the associate mountpoint

we're responsible for filteirng models to make sure we only return what matches the dialect's spec
*/
/** get request http library */
var request = require('request');

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
   console.log('created_at is type (!date): ',d);
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
  return user;
}

function formatpost(post) {
  // cast fields to make sure they're the correct type

  // Now to cast
  post.id=''+post.id; // cast to String
  post.num_replies=parseInt(0+post.num_replies); // cast to Number
  post.num_reposts=parseInt(0+post.num_reposts); // cast to Number
  post.num_stars=parseInt(0+post.num_stars); // cast to Number
  post.machine_only=post.machine_only?true:false;
  post.thread_id=''+post.thread_id; // cast to String (Number is too big for js?)
  if (post.reply_to) {
    post.reply_to=''+post.reply_to; // cast to String (Number is too big for js?)
  }
  if (post.repost_of) {
    post.repost_of=''+post.repost_of; // cast to String (Number is too big for js?)
  }
  // remove microtime
  post.created_at=ISODateString(post.created_at);
  return post;
}
// we're also resposible for meta

/**
 * Set up defined API routes at prefix
 */
module.exports=function(app, prefix) {
  var dispatcher=app.dispatcher;
  app.get(prefix+'/posts/:id', function(req, resp) {
    dispatcher.getPost(req.params.id, req.apiParams, function(post, err, meta) {
      var res={
        meta: { code: 200 },
        data: formatpost(post)
      };
      res.data.user=formatuser(post.user);
      if (meta) {
        res.meta=meta;
      }
      sendrepsonse(JSON.stringify(res), resp);
    });
  });
  app.get(prefix+'/users/:user_id', function(req, resp) {
    dispatcher.getUser(req.params.user_id, req.apiParams, function(user, err, meta) {
      var res={
        meta: meta,
        data: user
      };
      if (res.meta==undefined) {
        res.meta={ code: 200 };
      }
      sendrepsonse(JSON.stringify(res), resp);
    });
  });
  app.get(prefix+'/users/:user_id/posts', function(req, resp) {
    dispatcher.getUserPosts(req.params.user_id, req.apiParams, function(posts, err, meta) {
      var res={
        meta: meta,
        data: posts
      };
      if (res.meta==undefined) {
        res.meta={ code: 200 };
      }
      sendrepsonse(JSON.stringify(res), resp);
    });
  });
  app.get(prefix+'/users/:user_id/stars', function(req, resp) {
    //console.log('ADNO::usersStar');
    dispatcher.getUserStars(req.params.user_id, req.apiParams, function(posts, err, meta) {
      var res={
        meta: meta,
        data: posts
      };
      if (res.meta==undefined) {
        res.meta={ code: 200 };
      }
      sendrepsonse(JSON.stringify(res), resp);
    });
  });
  app.get(prefix+'/posts/tag/:hashtag', function(req, resp) {
    dispatcher.getHashtag(req.params.hashtag, req.apiParams, function(posts, err, meta) {
      var res={
        meta: meta,
        data: posts
      };
      if (res.meta==undefined) {
        res.meta={ code: 200 };
      }
      sendrepsonse(JSON.stringify(res), resp);
    });
  });
  app.get(prefix+'/posts/stream/global', function(req, resp) {
    dispatcher.getGlobal(req.apiParams, function(posts, err, meta) {
      var res={
        meta: meta,
        data: posts
      };
      if (res.meta==undefined) {
        res.meta={ code: 200 };
      }
      sendrepsonse(JSON.stringify(res), resp);
    });
  });
  // channel_id 1383 is always good for testing
  app.get(prefix+'/channels/:channel_id', function(req, resp) {
    dispatcher.getChannel(req.params.channel_id, req.apiParams, function(channels, err, meta) {
      var res={
        meta: meta,
        data: channels
      };
      if (res.meta==undefined) {
        res.meta={ code: 200 };
      }
      sendrepsonse(JSON.stringify(res), resp);
    });
  });
  app.get(prefix+'/channels/:channel_id/messages', function(req, resp) {
    dispatcher.getChannelMessages(req.params.channel_id, req.apiParams, function(messages, err, meta) {
      var res={
        meta: meta,
        data: messages
      };
      if (res.meta==undefined) {
        res.meta={ code: 200 };
      }
      sendrepsonse(JSON.stringify(res), resp);
    });
  });
  app.get(prefix+'/channels/:channel_id/messages/:message_id', function(req, resp) {
    dispatcher.getChannelMessage(req.params.channel_id, req.params.message_id, req.apiParams, function(messages, err, meta) {
      var res={
        meta: meta,
        data: messages
      };
      if (res.meta==undefined) {
        res.meta={ code: 200 };
      }
      sendrepsonse(JSON.stringify(res), resp);
    });
  });
  app.get(prefix+'/config', function(req, resp) {
    console.log('server.dispatcher.js::setupapiwithprefix - /config implement me');
    resp.send(404);
  });
  app.get(prefix+'/oembed', function(req, resp) {
    console.log('server.dispatcher.js::setupapiwithprefix - /oembed implement me');
    resp.send(404);
  });
  app.post(prefix+'/text/process', function(req, resp) {
    dispatcher.textProcess(req.body.text, null, null, function(textProcess, err) {
      var res={
        meta: {
          code: 200,
        },
        data: textProcess,
      };
      sendrepsonse(JSON.stringify(res), resp);
    });
  });
}
