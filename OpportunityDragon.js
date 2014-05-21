/** omage to ChaosMonkey */
// To run all random tests:
// node OpportunityDragon 
// To run a random post comparison
// node OpportunityDragon post
// To run a specific post comparison (again)
// node OpportunityDragon post postid  

var path = require('path');
var nconf = require('nconf');

/** Look for a config file */
var config_path = path.join(__dirname, '/config.json');
nconf.argv().env('__').file({file: config_path});

/** get request http library */
var request = require('request');

/** for object comparison */
var rusDiff = require('rus-diff').rusDiff;

/** pull configuration from config into variables */
var apiroot = nconf.get('uplink:apiroot') || 'https://api.app.net';
var upstream_client_id=nconf.get('uplink:client_id') || 'NotSet';
var webport = nconf.get('web:port') || 7070;
var api_client_id= nconf.get('web:api_client_id') || '';

var publichannels=[1383,51446,51447];
var localapiroot='http://localhost:'+webport;
var min_post_id=30748295;
var max_post_id=0;
var max_user_id=0;
var samplehashtags=['jukebox'];

// help diffs out
function objectEquals(x, y) {
    // if both are function
    if (x instanceof Function) {
        if (y instanceof Function) {
            return x.toString() === y.toString();
        }
        return false;
    }
    if (x === null || x === undefined || y === null || y === undefined) { return x === y; }
    if (x === y || x.valueOf() === y.valueOf()) { return true; }

    // if one of them is date, they must had equal valueOf
    if (x instanceof Date) { return false; }
    if (y instanceof Date) { return false; }

    // if they are not function or strictly equal, they both need to be Objects
    if (!(x instanceof Object)) { return false; }
    if (!(y instanceof Object)) { return false; }

    var p = Object.keys(x);
    return Object.keys(y).every(function (i) { return p.indexOf(i) !== -1; }) ?
            p.every(function (i) { return objectEquals(x[i], y[i]); }) : false;
}

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
      if (body) {
        json=JSON.parse(body);
        processor(json);
      } else {
        console.log(apiroot,url,"Error Empty body!");
      }
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
        console.log(url,"OrderMatch ",sts-fts,tts-sts);
      } else {
        if (objectEquals(json, localjson)) {
          console.log(url,"Match ",sts-fts,tts-sts);
        } else {
          // show official transcript
          //console.log(JSON.stringify(json),null,4);
          console.dir(json);
					// deep object inspsection
          if (json.data) {
						if (json.data.user) {
							console.dir(json.data.user.counts);
							console.dir(json.data.user.description);
							console.dir(json.data.user.avatar_image);
							console.dir(json.data.user.cover_image);
						}
						console.dir(json.data.entities);
          }
          console.log('================================================');
          //console.log(JSON.stringify(localjson),null,4);
          console.dir(localjson);
          // deep object inspsection
          if (localjson.data) {
            if (localjson.data.user) {
							console.dir(localjson.data.user.counts);
							console.dir(localjson.data.user.description);
							console.dir(localjson.data.user.avatar_image);
							console.dir(localjson.data.user.cover_image);
						}
						console.dir(localjson.data.entities);
					}
          console.log('================================================');
          console.log(url,"Different ",sts-fts,tts-sts);
          console.log(rusDiff(json, localjson));
        }
      }
    });
  });
}

// FIXME: how do we intentionally generate errors?
// FIXME: generalparams
// FIXME: tokens

test_post=function() {
  var postid=parseInt(min_post_id+(Math.random()*(max_post_id-min_post_id)));
  // ?before_id=max&since_id=min&count=less than range?
  compareendpoints('posts/'+postid);
}

test_post=function(postid) {
  if (!postid) {
    postid=parseInt(min_post_id+(Math.random()*(max_post_id-min_post_id)));
  }
  compareendpoints('posts/'+postid);
}

test_getUserPosts=function(userid) {
  if (!userid) {
    userid=parseInt(1+(Math.random()*max_user_id));
  }
  compareendpoints('users/'+userid+'/posts');
}

test_getUserStars=function(userid) {
  if (!userid) {
    userid=parseInt(1+(Math.random()*max_user_id));
  }
  compareendpoints('users/'+userid+'/stars');
}

test_getHashtag=function(hashtag) {
  if (!hashtag) {
    hashtag = samplehashtags[Math.floor(Math.random() * samplehashtags.length)];
  }
  compareendpoints('posts/tag/'+hashtag);
}

test_getGlobal=function() {
  // just asking to be different... (it moves so fast)
  compareendpoints('posts/stream/global');
}

test_getChannel=function(cid) {
  if (!cid) {
    cid = publichannels[Math.floor(Math.random() * publichannels.length)];
  }
  compareendpoints('channels/'+cid);
}

test_getChannelMessages=function(cid) {
  if (!cid) {
    cid = publichannels[Math.floor(Math.random() * publichannels.length)];
  }
  compareendpoints('channels/'+cid+'/messages');
}

test_getChannelMessage=function(mid) {
  if (mid) {
		compareendpoints('channels/messages/?ids='+mid);
  } else {
		var cid = publichannels[Math.floor(Math.random() * publichannels.length)];
		apicall(apiroot,'channels/'+cid+'/messages',function(json) {
			var messages=[];
			for(var i in json.data) {
				messages.push(json.data[i].id)
			}
			mid = messages[Math.floor(Math.random() * messages.length)];
			compareendpoints('channels/'+cid+'/messages/'+mid);
		});
  }
}

test_config=function() {
  compareendpoints('config');
}

test_oembed=function(postid) {
  if (!postid) {
    postid=parseInt(min_post_id+(Math.random()*(max_post_id-min_post_id)));
  }
  compareendpoints('oembed?url=https://posts.app.net/'+postid);
}

// FIXME 
// generate test content from existing post, user
// how to post it properly using requests...
test_textProcess=function() {
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
  switch(process.argv[2]) {
    case 'post':
			test_post(process.argv[3]);
    break;
    case 'userposts':
			test_getUserPosts(process.argv[3]);
    break;
    case 'userstars':
			test_getUserStars(process.argv[3]);
    break;
    case 'hashtag':
			test_getHashtag(process.argv[3]);
    break;
    case 'global':
      // tough one to test
			test_getGlobal();
    break;
    case 'channel':
			test_getChannel(process.argv[3]);
    break;
    case 'channelmessages':
			test_getChannelMessages(process.argv[3]);
    break;
    case 'messages':
			test_getChannelMessage(process.argv[3]);
    break;
    case 'config':
			test_config();
    break;
    case 'oembed':
			test_oembed(process.argv[3]);
    break;
    default:
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
    break;
  }
});