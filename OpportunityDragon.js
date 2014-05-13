/** omage to ChaosMonkey */
var path = require('path');
var nconf = require('nconf');

/** Look for a config file */
var config_path = path.join(__dirname, '/config.json');
nconf.argv().env('__').file({file: config_path});

/** get request http library */
var request = require('request');

/** pull configuration from config into variables */
var apiroot = nconf.get('uplink:apiroot') || 'https://api.app.net';
var upstream_client_id=nconf.get('uplink:client_id') || 'NotSet';
var webport = nconf.get('web:port') || 7070;
var api_client_id= nconf.get('web:api_client_id') || '';

var publichannels=[1383,51446,51447];
var localapiroot='http://localhost:'+webport;
var max_post_id=0;
var max_user_id=0;
var samplehashtags=['jukebox'];

// post params for text/process
var apicall=function(apiroot, url, processor) {
  console.log("Requesting "+url+" from "+apiroot);
  request.get({
    url: apiroot+'/'+url
  }, function(e, r, body) {
    // FIXME: compare headers?
    // FIXME: compare status code?
    if (!e && r.statusCode === 200) {
      //console.log("200");
      //body=JSON.stringify(JSON.parse(body),null,4);
      json=JSON.parse(body);
      processor(json);
    } else {
      // 204,302,400,401,403,404,405,429,500,507
      console.log("Error ",e,"status",r.statusCode,'body',body);
      json=JSON.parse(body);
      processor(json);
    }
  });
}

// maybe need an ignore param
// post params
var compareendpoints=function (url) {
  var fts=new Date().getTime();
  apicall(apiroot,url,function(json) {
    var sts=new Date().getTime();
    apicall(localapiroot,url,function(localjson) {
      var tts=new Date().getTime();
      if (JSON.stringify(json)===JSON.stringify(localjson)) {
        console.log(url,"Matches ",sts-fts,tts-sts);
      } else {
        console.log(url,"Different ",sts-fts,tts-sts);
        console.dir(json);
        console.log('---------------------------------------------------');
        console.dir(localjson);
        console.log('===================================================');
      }
    });
  });
}

test_post=function () {
  var postid=parseInt(1+(Math.random()*max_post_id));
  compareendpoints('posts/'+postid);
}

test_post=function () {
  var postid=parseInt(1+(Math.random()*max_post_id));
  compareendpoints('posts/'+postid);
}

test_getUserPosts=function () {
  var userid=parseInt(1+(Math.random()*max_user_id));
  compareendpoints('users/'+userid+'/posts');
}

test_getUserStars=function () {
  var userid=parseInt(1+(Math.random()*max_user_id));
  compareendpoints('users/'+userid+'/stars');
}

test_getHashtag=function () {
  var hashtag = samplehashtags[Math.floor(Math.random() * samplehashtags.length)];
  compareendpoints('posts/tag/'+hashtag);
}

test_getGlobal=function () {
  // just asking to be different... (it moves so fast)
  compareendpoints('posts/stream/global');
}

test_getChannel=function () {
  var cid = publichannels[Math.floor(Math.random() * publichannels.length)];
  compareendpoints('channels/'+cid);
}

test_getChannelMessages=function () {
  var cid = publichannels[Math.floor(Math.random() * publichannels.length)];
  compareendpoints('channels/'+cid+'/messages');
}

test_getChannelMessage=function () {
  var cid = publichannels[Math.floor(Math.random() * publichannels.length)];
  apicall(apiroot,'channels/'+cid+'/messages',function(json) {
    var messages=[];
    for(var i in json.data) {
      messages.push(json.data[i].id)
    }
    var mid = messages[Math.floor(Math.random() * messages.length)];
    compareendpoints('channels/'+cid+'/messages/'+mid);
  });
}

test_config=function () {
  compareendpoints('config');
}

test_oembed=function () {
  var postid=parseInt(1+(Math.random()*max_post_id));
  compareendpoints('oembed?url=https://posts.app.net/'+postid);
}

// FIXME
test_textProcess=function () {
  var postid=parseInt(1+(Math.random()*max_post_id));
  //compareendpoints('text/process');
}

apicall(apiroot,'/posts/stream/global',function(res) {
  max_post_id=res.meta.max_id;
  for(var i in res.data) {
    var post=res.data[i];
    if (post.entities && post.entities.hashtags) {
      for(var j in post.entities.hashtags) {
        var hashtag=post.entities.hashtags[j];
        samplehashtags.push(hashtag.name);
      }
    }
    max_user_id=Math.max(post.user.id,max_user_id);
  }
  test_post();
  test_getUserPosts();
  test_getUserStars();
  test_getHashtag();
  test_getGlobal();
  test_getChannel();
  test_getChannelMessages();
  test_getChannelMessage();
  test_config();
  test_oembed();
});
