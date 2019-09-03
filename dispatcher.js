/**
 * Dispatcher is an internal front-facing API for all functions and services
 *
 * "Dialects" will call these functions to the data-access chain to store/retrieve data and format
 * responses in standard way.
 *
 * @module dispatcher
 */

var downloader=require('./downloader.js');

var first_post_id;
var last_post_id;

/** for status reports */
var lmem={ heapUsed: 0 };

/**
 * Helper function for copying entities around
 * @param {string} type - type of entity (mentions, hashtags, links)
 * @param {object} src - source entities array
 * @param {object} dest - destination entities array
 * @param {boolean} postcontext - are we a in a post context (versus user context)
 */
function copyentities(type, src, dest, postcontext) {
  if (!dest) {
    console.log('dispatcher.js::copyentities - dest not set ', dest);
    return;
  }
  // dest.entities[type]=[];
  for(var i in src) {
    var res=src[i];
    var obj=new Object;
    switch(type) {
      case 'mentions':
        // need is_leading only for post context
        if (postcontext && res.altnum!=undefined) {
          obj.is_leading=res.altnum?true:false;
        }
        obj.id=''+res.alt; // could be a hint of future issues here
        obj.name=res.text;
      break;
      case 'hashtags':
        obj.name=res.text;
      break;
      case 'links':
        obj.url=res.alt;
        obj.text=res.text;
        if (res.altnum) {
          obj.amended_len=parseInt(0+res.altnum);
        }
      break;
      default:
        console.log('unknown type '+type);
      break;
    }
    obj.pos=parseInt(0+res.pos);
    obj.len=parseInt(0+res.len);
    dest.entities[type].push(obj);
  }
}

function normalizeUserID(input, tokenobj, callback) {
  //console.log('dispatcher::normalizeUserID', input)
  if (input=='me') {
    if (tokenobj && tokenobj.userid) {
      //console.log('dispatcher.js::normalizeUserID - me became', tokenobj.userid);
      callback(tokenobj.userid, '');
      return;
    } else {
      callback(0, 'no or invalid token');
      return;
    }
  }
  var ref=module.exports;
  if (input[0]=='@') {
    //console.log('dispatcher::normalizeUserID @', input.substr(1))
    ref.cache.getUserID(input.substr(1), function(userobj, err) {
      if (err) {
        console.log('dispatcher.js::normalizeUserID err', err);
      }
      if (userobj) {
        callback(userobj.id, '');
      } else {
        callback(0, 'no such user');
      }
    });
  } else {
    // numeric
    callback(input, '');
  }
}

// http://stackoverflow.com/a/30970751
function escapeHTML(s) {
  return s.replace(/[&"<>]/g, function (c) {
    return {
      '&': "&amp;",
      '"': "&quot;",
      '<': "&lt;",
      '>': "&gt;"
    }[c];
  });
}

// what calls this?? I think global did
function postsToADN(posts, token) {
  // data is an array of entities
  var apiposts={}, postcounter=0;
  //console.log('dispatcher.js:getUserPosts - mapping '+posts.length);
  if (posts && posts.length) {
    posts.map(function(current, idx, Arr) {
      //console.log('dispatcher.js:getUserPosts - map postid: '+current.id);
      // get the post in API foromat
      ref.postToAPI(current, {}, token, function(post, err, postmeta) {
        apiposts[post.id]=post;
        postcounter++;
        // join
        //console.log(apiposts.length+'/'+entities.length);
        if (postcounter==posts.length) {
          //console.log('dispatcher.js::getUserPosts - finishing');
          var res=[];
          for(var i in posts) {
            res.push(apiposts[posts[i].id]);
          }
          callback(res, null, meta);
        }
      });
    }, ref);
  } else {
    // no posts
    callback([], 'no posts for postsToADN', meta);
  }
}

var humanFormat=require('human-format');

/** minutely status report */
setInterval(function () {
  var ts=new Date().getTime();
  var mem=process.memoryUsage();
  /*
  regarding: the dispatcher stdout writes (isThisDoingAnything)
  it's pretty compact, only one or two lines per minute
  so finding the exception still shouldn't be an issue
  though they will get further and further apart as the quality of the code gets better
  either case the exceptions need to be logged in a proper log file
  */
  // break so the line stands out from the instant updates
  process.stdout.write("\n");
  console.log("dispatcher @"+ts+" Memory+["+humanFormat(mem.heapUsed-lmem.heapUsed)+"] Heap["+humanFormat(mem.heapUsed)+"] uptime: "+process.uptime());
  lmem=mem;
  ts=null;
}, 60*1000);

// cache is available at this.cache
// we set from API to DB format
// we get from DB format to API
// how much error checking do we need in the get callback?
// should we stop the callback on failure? probably not...
/** @constructs dispatcher */
module.exports = {
  /**
   * cache object for accessing the data store
   * @type {object}
   */
  cache: null,
  /**
   * config object for app.net specific configuration
   * @type {object}
   */
  config: null,
  /**
   * app config object for accessing the config files
   * @type {object}
   */
  appConfig: null,
  /**
   * boolean option for controlling streaming output
   * @type {boolean}
   */
  notsilent: true,
  /** posts */
  // tokenObj isn't really used at this point...
  // difference between stream and api?
  addPost: function(post, tokenObj, callback) {

    var ref=this;
    function makePost() {
      //console.log('dispatcher::addPost annotations - ', post.annotations);
      // text, entities, postcontext, callback
      ref.cache.addPost(post, tokenObj, function(dbpost, err, meta) {
        if (dbpost) {
          // FIXME: annotations may not be returned on post creation
          if (post.annotations) {
            ref.setAnnotations('post', dbpost.id, post.annotations);
          }
          console.log('dispatcher.js::addPost - GotPost', dbpost.id);


          //console.log('dispatcher.js::addPost - postToAPI params', params);
          // well we have to wait until we have the post.id and then we can write it
          function finishCreatingPost() {
            ref.setEntities('post', dbpost.id, post.entities, function() {
              //console.log('dispatcher.js::addPost - Entities set', post.entities.links);
              ref.postToAPI(dbpost, {}, tokenObj, callback, meta);
            });
          }

          if (post.html.match(/{post_id}/) || post.text.match(/{post_id}/)) {
            //console.log('dispatcher.js::addPost - {post_id} live tag detected');
            //console.log('dispatcher.js::addPost - reading', dbpost.id, 'got', dbpost.text);
            // recalculate entities and html
            ref.textProcess(dbpost.text, false, true, function(textProc, err) {
              //console.log('dispatcher.js::addPost - got new links', textProc.entities.links);
              // need dbpost for the id
              //dbpost.html=textProc.html;
              //console.log('dispatcher.js::addPost - rewriting HTML to', dbpost.html, 'for', dbpost.id);
              //updatePostHTML: function(postid, html, callback) {
              //ref.cache.setPost(dbpost, function(fixedPost, err) {
              ref.cache.updatePostHTML(dbpost.id, textProc.html, function(fixedPost, err) {
                if (err) console.error('dispatcher.js::addPost - fixedPost', err);
                if (fixedPost) {
                  //console.log('dispatcher.js::addPost - fixedPost', fixedPost);
                  dbpost=fixedPost;
                  post.entities=textProc.entities;
                  //console.log('dispatcher.js::addPost - new entity links', post.entities.links);
                  finishCreatingPost();
                }
              });
            });
          } else {
            finishCreatingPost();
          }
        } else {
          // may need to delete entities
          callback(null, 'empty_result');
        }
      });
    }

    var postDone={
      html: false,
      thread: false,
    }
    function setDone(type) {
      postDone[type]=true;
      // if something is not done
      //console.log('dispatcher.js::addPost - checking if done');
      for(var i in postDone) {
        if (!postDone[i]) {
          //console.log('dispatcher.js::addPost -', i, 'is not done');
          return;
        }
      }
      //console.log('dispatcher.js::addPost - done', data, meta);
      //console.log('dispatcher.js::addPost - done, text', data.text);
      // everything is done
      makePost();
      //callback(data, null, meta);
    }

    function getEntities(post, cb) {
      ref.textProcess(post.text, post.entities, true, function(textProc, err) {
        console.log('dispatcher.js::addPost - textProc', textProc);
        post.entities=textProc.entities;
        post.html=textProc.html;
        cb();
      });
    }
    // check out postToAPI
    // needs to run before textProcess
    function checkTagUser(post, cb) {
      if (!((post.text && post.text.match(/{username}/)) || (post.html && post.html.match(/{username}/)))) {
        cb();
        return;
      }
      ref.cache.getUser(post.userid, function(user, err, meta) {
        if (post.text && post.text.match(/{username}/)) {
          post.text=post.text.replace(new RegExp('{username}', 'g'), user.username);
        }
        if (post.html && post.html.match(/{username}/)) {
          post.html=post.html.replace(new RegExp('{username}', 'g'), user.username);
        }
        cb();
      });
    }
    function getThreadID(post, cb) {
      // cache expects post to be in our internal db format
      console.log('post.reply_to', post.reply_to);
      if (post.reply_to) {
        ref.cache.getPost(post.reply_to, function(parentPost, err, meta) {
          post.thread_id=parentPost.thread_id;
          console.log('post.threadid', post.thread_id);
          cb();
        });
      } else {
        cb();
      }
    }
    // these both mess with .html / .text
    checkTagUser(post, function() {
      // after username is in place, we'll have better positions
      getEntities(post, function() {
        setDone('html');
      });
    });
    getThreadID(post, function() {
      setDone('thread');
    });
  },
  // FIXME change API to access params
  delPost: function(postid, token, callback) {
    var ref = this;
    this.getPost(postid, {}, function(post, err, postMeta) {
      if (post.userid != token.userid) {
        console.warn('permissions denied')
        callback(post, 'access denied to post', {
          code: token?403:401,
        });
        return
      }
      ref.cache.delPost(postid, function(delRes, dbErr, dbMeta) {
        // delRes are
        /*
        OkPacket {
          fieldCount: 0,
          affectedRows: 0,
          insertId: 0,
          serverStatus: 2,
          warningCount: 0,
          message: '(Rows matched: 0  Changed: 0  Warnings: 0',
          protocol41: true,
          changedRows: 0
        }
        */
        //console.log('dispatcher.js::delPost - returning', post);
        var params = {
          generalParams: {
            deleted: true
          }
        }
        // postToAPI: function(post, params, tokenObj, callback, meta) {
        //getPost: function(id, params, callback) {
        //ref.getPost(postid, params, callback);
        post.is_deleted = 1
        callback(post, '', postMeta)
        /*
        ref.postToApi(post, { }, function(apiPost, err) {
          module.exports.pumpStreams({
            id: postid,
            type: 'post',
            op:   'del',
          }, apiPost);
          callback(apiPost, err, dbMeta);
        });
        */
      });
    });
  },
  /**
   * Add/Update post in data store
   * @param {object} post - the new post object (in API format)
   * @param {setPostCallback} callback - function to call after completion
   */
  setPost: function(post, callback) {
    if (!post) {
      console.log('dispatcher.js::setPost - post is not set!');
      if (callback) {
        callback(null, 'setPost - post is not set!');
      }
      return;
    }
    if (!post.id) {
      console.log('dispatcher.js::setPost - no id in post', post);
      if (callback) {
        callback(null, 'setPost - no id in post');
      }
      return;
    }

    // we're assuming we're getting a contiguous amount of posts...
    // get a sample of where the app stream is starting out
    if (first_post_id==undefined) {
      // not a good way to do this,
      // some one can interact (delete?) an older post with a much lower id
      console.log("Setting first post to ", post.id);
      first_post_id=post.id;
    }

    post.date=new Date(post.created_at);
    post.ts=post.date.getTime();

    // update user first, to avoid proxy
    if (post.user && post.user.id) {
      // update User records
      /*
      if (post.user.description && post.user.description.entities) {
        console.log('disptacher.js::setPost '+post.id+' has user entites');
      } else {
        console.log('disptacher.js::setPost '+post.id+' has NO user entites');
        //console.dir(post.user);
      }
      */
      this.updateUser(post.user, post.ts, function(user, err) {
        if (err) {
          console.log("User Update err: "+err);
        //} else {
          //console.log("User Updated");
        }
      });
    }
    if (post.entities) {
      this.setEntities('post', post.id, post.entities, function(entities, err) {
        if (err) {
          console.log("entities Update err: "+err);
        //} else {
          //console.log("entities Updated");
        }
      });
    }
    //console.log('dispatcher.js::setPost post id is '+post.id);
    var dataPost=post;
    //dataPost.id=post.id; // not needed
    if (post.user) {
      dataPost.userid=post.user.id;
    } else {
      // usually on deletes, they don't include the user object
      //console.log('No Users on post ', post);
      /*
{ created_at: '2013-08-16T01:10:29Z',
  num_stars: 0,
  is_deleted: true,
  num_replies: 0,
  thread_id: '9132210',
  deleted: '1',
  num_reposts: 0,
  entities: { mentions: [], hashtags: [], links: [] },
  machine_only: false,
  source:
   { link: 'http://tapbots.com/software/netbot',
     name: 'Netbot for iOS',
     client_id: 'QHhyYpuARCwurZdGuuR7zjDMHDRkwcKm' },
  reply_to: '9132210',
  id: '9185233',
  date: Thu Aug 15 2013 18:10:29 GMT-0700 (PDT),
  ts: 1376615429000 }
      */
    }
    dataPost.created_at=new Date(post.created_at); // fix incoming created_at iso date to Date
    //console.log('dispatcher::setPost - user is', post.userid);
    if (post.source) {
      var ref=this;
      this.cache.setSource(post.source, function(client, err) {
        // param order is correct
        //console.log('addPost setSource returned ', client, err, dataPost);
        if (err) {
          console.log('can\'t setSource', err);
        } else {
          dataPost.client_id=client.client_id;
        }
        //console.log('dispatcher.js::setPost datapost id is '+dataPost.id);
        ref.cache.setPost(dataPost, callback);
      });
    } else {
      //console.log('dispatcher.js::setPost datapost id is '+dataPost.id);
      this.cache.setPost(dataPost, callback);
    }

    if (post.annotations) {
      this.setAnnotations('post', post.id, post.annotations);
    }

    if (last_post_id==undefined || post.id>last_post_id) {
      //console.log("Setting last post to ", post.id);
      last_post_id=post.id;
    }
    // can't clear this because we're still processing it
    //dataPost=null;
    if (this.notsilent) {
      process.stdout.write('P');
    }
  },
  // set shit like you_starred, you_reposted, etc
  contextualizePostRepsonse: function(post, token, callback) {
    //
  },
  // convert ADN format to DB format
  apiToPost: function(api, meta, callback) {
    if (!api.user) {
      console.log('apiToPost - api user is missing', api.user,api);
      if (callback) {
        callback(null, 'no api user');
      }
      return;
    }
    // copy api
    var post=JSON.parse(JSON.stringify(api));
    post.date=new Date(api.created_at);
    post.ts=post.date.getTime();
    post.user.created_at=new Date(api.user.created_at);
    post.userid=api.user.id;
    // repost_of?
    // it's an object in api and an numericid in DB
    if (api.repost_of) {
      // is this right in the case of repost of a repost?
      post.repost_of=api.repost_of.id
    }
    // source
    if (post.source) {
      var ref=this;
      // find it (or create it for caching later)
      this.cache.setSource(post.source, function(client, err) {
        if (err) {
          console.log('can\'t setSource ', err);
        } else {
          post.client_id=client.client_id;
        }
        callback(post, err, meta);
      });
    } else {
      callback(post, null, meta);
    }
    //return post;
  },
  /**
   * convert DB format to API structure
   * @param {object} post - the new post object
   * @param {object} params - the request parameters (load annotations)
   * @param {object} token - the request context (which user/client)
   * @param {setPostCallback} callback - function to call after completion
   * @param {object} meta - the meta data
   */
  postToAPI: function(post, params, tokenObj, callback, meta) {
    //console.log('dispatcher.js::postToAPI('+post.id+') - start');
    if (!post) {
      console.log('dispatcher.js::postToAPI - no post data passed in');
      callback(null, 'no_post');
      return;
    }
    if (!post.userid) {
      console.log('dispatcher.js::postToAPI - no userid', post);
      callback(null, 'no_userid');
      return;
    }
    var ref=this; // back it up

    // set up new final object for collection

    var data={};
    // , 'source', 'user'
    var postFields=['id', 'text', 'html', 'canonical_url', 'created_at',
      'machine_only', 'num_replies', 'num_reposts', 'num_stars', 'thread_id',
      'entities', 'is_deleted'];
    for(var i in postFields) {
      var f=postFields[i];
      data[f]=post[f];
    }
    // hack
    if (data.text===undefined && data.html===undefined) {
      console.log('dispatcher.js::postToAPI('+post.id+') - no text or html');
      data.text='';
      data.html='';
    }
    if (data.html && !data.text) data.text=data.html;
    if (!data.html && data.text) data.html=data.text;

    //if (typeof(data.created_at)!=='object') {
      //console.log('dispatcher::postToAPI - created_at isnt a date', typeof(data.created_at), data.created_at);
    if (!data.created_at) {
      console.log('dispatcher::postToAPI - created_at isnt object', data.created_at);
      data.created_at=new Date(data.created_at);
      console.log('dispatcher::postToAPI - created_at converted to', data.created_at.toString());
    }

    // convert TS to date object
    //console.log('dispatcher::postToAPI - created_at check', data.created_at);
    if (isNaN(data.created_at.getTime())) {
      //delete data.created_at
      data.created_at='2000-01-01T00:00:00.000Z';
      data.is_deleted=true
    } else {
      data.created_at=new Date(data.created_at);
    }

    //console.log(post.num_replies+' vs '+data.num_replies);
    //'repost_of'
    var postFieldOnlySetIfValue=['reply_to'];
    for(var i in postFieldOnlySetIfValue) {
      var f=postFieldOnlySetIfValue[i];
      if (post[f]) {
        data[f]=post[f];
      }
    }
    //data.user=user;
    //console.log('dispatcher.js::postToAPI - return check', data);

    var postDone={
      client: false,
      user: false,
      entities: false,
      repostOf: false,
      annotation: false,
      context: false,
    }

    if (params && params.generalParams) {
      if (params.generalParams.starred_by) {
        //console.log('dispatcher.js::postToAPI('+post.id+') - include_starred_by - write me!');
        postDone.starred_by=false;
        this.cache.getPostStars(post.id, {}, function(interactions, err, meta) {
          if (!interactions || !interactions.length) {
            data.starred_by=[];
            setDone('starred_by');
            return;
          }
          var userids=[];
          for(var i in interactions) {
            var action=interactions[i]
            userids.push(action.userid);
          }
          //console.log('dispatcher.js::postToAPI('+post.id+') - include_starred_by - getting users', userids);
          ref.cache.getUsers(userids, params, function(userObjs, userErr, meta) {
            //console.log('dispatcher.js::postToAPI('+post.id+') - include_starred_by - got', userObjs.length);
            var rUsers=[]
            for(var i in userObjs) {
              ref.userToAPI(userObjs[i], tokenObj, function(adnUserObj, err) {
                //console.log('dispatcher.js::postToAPI - got', adnUserObj, 'for', users[i])
                rUsers.push(adnUserObj)
                //console.log('dispatcher.js::postToAPI('+post.id+') - include_starred_by - ', rUsers.length, 'vs', userids.length);
                if (rUsers.length==userids.length) {
                  data.starred_by=rUsers;
                  //console.log('marking starred_by done');
                  setDone('starred_by');
                }
              }, meta);
            }
          });
        });
      }
      if (params.generalParams.reposters) {
        //console.log('dispatcher.js::postToAPI('+post.id+') - include_reposters - write me!');
        postDone.reposters=false;
        this.cache.getReposts(post.id, {}, tokenObj, function(posts, err, meta) {
          if (!posts || !posts.length) {
            data.reposters=[];
            setDone('reposters');
            return;
          }
          var userids=[];
          for(var i in posts) {
            var post=posts[i]
            if (userids.indexOf(post.userid)==-1) {
              userids.push(post.userid);
            }
          }
          //console.log('dispatcher.js::postToAPI('+post.id+') - include_reposters - getting users', userids);
          ref.cache.getUsers(userids, params, function(userObjs, userErr, meta) {
            //console.log('dispatcher.js::postToAPI('+post.id+') - include_reposters - got', userObjs.length);
            var rUsers=[]
            for(var i in userObjs) {
              ref.userToAPI(userObjs[i], tokenObj, function(adnUserObj, err) {
                //console.log('dispatcher.js::postToAPI - got', adnUserObj, 'for', adnUserObj.id)
                rUsers.push(adnUserObj)
                //console.log('dispatcher.js::postToAPI('+post.id+') - include_reposters - ', rUsers.length, 'vs', userids.length);
                if (rUsers.length==userids.length) {
                  //callback(rUsers, '');
                  data.reposters=rUsers;
                  //console.log('marking reposters done');
                  setDone('reposters');
                }
              }, meta);
            }
          });
        });
      }
    } else {
      //if (params != {}) {
        //console.log('dispatcher.js::postToAPI('+post.id+') - params dont have generalParams');
      //}
    }


    function setDone(type) {
      postDone[type]=true;
      // if something is not done
      //console.log('dispatcher.js::postToAPI('+post.id+') - checking if done');
      for(var i in postDone) {
        if (!postDone[i]) {
          //console.log('dispatcher.js::postToAPI('+post.id+') -', i, 'is not done');
          return;
        }
      }
      //console.log('dispatcher.js::postToAPI('+post.id+') - done', data, meta);
      //console.log('dispatcher.js::postToAPI('+post.id+') - done, text', data.text);

      //console.log('dispatcher.js::postToAPI('+post.id+') - params', params);
      // everything is done
      callback(data, null, meta);
    }

    function loadClient(post, cb) {
      if (post.repost_of) { // no need to look up client of a repost (atm but eventually should probably)
        // Alpha does need this
        var source={
          link: 'https://sapphire.moe/',
          name: 'Unknown',
          client_id: 'Unknown',
        }
        cb(source); // was just ()
        return;
      }
      ref.getClient(post.client_id, function(client, clientErr, clientMeta) {
        //console.log('dispatcher.js::postToAPI('+post.id+') - gotClient');
        var source={
          link: 'https://sapphire.moe/',
          name: 'Unknown',
          client_id: 'Unknown',
        }
        if (client) {
          source={
            link: client.link,
            name: client.name,
            client_id: client.client_id
          };
        } else {
          console.log('dispatcher.js::postToAPI('+post.id+') - client is', client, clientErr);
        }
        cb(source, clientErr, clientMeta);
      }); // getClient
    }

    function loadUser(userid, params, cb) {
      //console.log('dispatcher.js::postToAPI('+post.id+') - getting user '+post.userid);
      ref.getUser(userid, params, function(user, userErr, userMeta) {
        //console.log('dispatcher.js::postToAPI('+post.id+') - got user '+post.userid, err);
        if (!user) {
          user={
            id: 0,
            username: 'likelydeleted',
            created_at: '2014-10-24T17:04:48Z',
            avatar_image: {
              url: ''
            },
            cover_image: {
              url: ''
            },
            counts: {
              following: 0,
            }
          }
        }
        cb(user, userErr, userMeta);
      }); // getUser
    }

    var loadRepostOf=function(post, tokenObj, cb) {
      //console.log('dispatcher.js::postToAPI - return check', data);
      //console.log('dispatcher.js::postToAPI - Done, calling callback');
      // now fix up reposts
      if (post.repost_of) {
        //console.log('converting repost_of from ', post.repost_of);
        // use thread_id because we need a direct path back to the original
        // and we can use repost_of to find the share tree
        ref.getPost(post.thread_id, { tokenobj: tokenObj }, function(repost, repostErr, repostMeta) {
          //console.log('converting repost_of to', repostapi.id);
          //data.repost_of=repost;
          //callback(data, err, meta);
          cb(repost, repostErr, repostMeta);
        })
      } else {
        //callback(data, err, meta);
        cb(null, null, null);
      }
    }

    var loadAnnotation=function(post, cb) {
      ref.getAnnotation('post', post.id, function(dbNotes, err, noteMeta) {
        var apiNotes=[];
        for(var j in dbNotes) {
          var note=dbNotes[j];
          //console.log('got note', j, '#', note.type, '/', note.value, 'for', post.id);
          apiNotes.push({
            type: note.type,
            value: note.value,
          });
        }
        cb(apiNotes, err, noteMeta);
      });
    }

    function loadEntites(post, cb) {
      // use entity cache (DB read or CPU calculate)
      if (1) {
        //console.log('dispatcher.js::postToAPI('+post.id+') - getEntity post. post.userid:', post.userid);
        ref.getEntities('post', post.id, function(entities, entitiesErr, entitiesMeta) {
          //console.log('dispatcher.js::postToAPI('+post.id+') - gotEntities');

          data.entities={
            mentions: [],
            hashtags: [],
            links: [],
          };
          copyentities('mentions', entities.mentions, data, 1);
          copyentities('hashtags', entities.hashtags, data, 1);
          copyentities('links', entities.links, data, 1);
          // use html cache?
          if (1) {
            //console.log('dispatcher.js::postToAPI('+post.id+') - calling final comp');
            //finalcompsite(post, user, client, callback, err, meta);
            cb();
          } else {
            // generate HTML
            // text, entities, postcontext, callback
            ref.textProcess(post.text, post.entities, true, function(textProcess, err) {
              //console.dir(textProcess);
              data.html=textProcess.html;
              //finalcompsite(post, user, client, callback, err, meta);
              cb();
            });
          }
        }); // getEntities
      } else {
        ref.textProcess(post.text, post.entities, true, function(textProcess, err) {
          data.entities=textProcess.entities;
          data.html=textProcess.html;
          //finalcompsite(post, user, client, callback, err, meta);
          cb();
        });
      }
    }

    // any value into breaking into 3 functions?
    // removed another checkDone style function
    var loadContext=function(post, tokenObj, cb) {
      // these will need to be queried:
      //   reposters
      //     Not completet & only included if include_reposters=1 is passed to App.net
      //   starred_by
      //     include_starred_by=1
      // so we have to query:
      // ok if token is a string we need to resolve it
      // otherwise we're good to go with an object
      //console.log('dispatcher.js::postToAPI:::loadContext - tokenObj', tokenObj)
      //console.log('dispatcher.js::postToAPI post', post.id, 'data', data.id, 'id', id);
      if (tokenObj && tokenObj.userid) {
        // if this post is a report that we reposted
        //if (post.repost_of && post.userid==token.userid) data.you_reposted=true;
        var starDone=false
        var repostRepostDone=false
        var repostPostDone=false
        var checkDone=function() {
          //console.log('dispatcher.js::postToAPI:::loadContext - checkDone', starDone, repostRepostDone, repostPostDone);
          if (starDone && repostRepostDone && repostPostDone) {
            cb();
          }
        }
        ref.cache.getUserStarPost(tokenObj.userid, data.id, function(res, err) {
          //console.log('dispatcher.js::postToAPI -  getUserStarPost got', res);
          starDone=true;
          //repostDone=true
          data.you_starred=false; // needs to be defined (if token only?)
          if (res && res.id) data.you_starred=true;
          checkDone();
        })
        //console.log('is this post', data.id, 'by', tokenObj.userid);

        // what if this isn't repost but we did retweet
        ref.cache.getUserRepostPost(tokenObj.userid, post.id, function(res, err) {
          //console.log('dispatcher.js::postToAPI:::loadContext -', post.id, 'hasRepost', res.id);
          data.you_reposted=false;
          if (res && res.id) {
            //console.log(post.id, 'not a repost but look up says ', tokenObj.userid, 'has reposted as', res.id);
            data.you_reposted=true;
          }
          repostPostDone=true;
          checkDone();
        });

        // well we only need if this is a repost
        if (post.repost_of) {
          // we'll need to look at it
          ref.cache.getUserRepostPost(tokenObj.userid, post.thread_id, function(res, err) {
            //console.log('dispatcher.js::postToAPI:::loadContext -', post.id, 'isRepost', res.id);
            repostRepostDone=true;
            data.you_reposted=false;
            if (res && res.id) {
              //console.log(tokenObj.userid, 'has reposted', post.repost_of, 'as', res.id);
              data.you_reposted=true;
            }
            checkDone();
          });
        } else {
          repostRepostDone=true;
          checkDone();
        }

        //
      } else {
        cb();
      }
    }

    // post.client_id is string(32)
    //console.log('dispatcher.js::postToAPI - gotUser. post.client_id:', post.client_id);
    loadClient(post, function(source, clientErr, clientMeta) {
      data.source=source;
      setDone('client');
    });
    //console.log('dispatcher.js::postToAPI - gotPost. post.userid:', post.userid);
    loadUser(post.userid, params, function(user, userErr, userMeta) {
      data.user=user;
      setDone('user');
    });
    loadRepostOf(post, tokenObj, function(repost, repostErr, repostMeta) {
      if (repost) data.repost_of=repost;
      setDone('repostOf');
    });
    loadAnnotation(post, function(apiNotes, notesErr, notesMeta) {
      data.annotations=apiNotes;
      setDone('annotation');
    });
    // writes to data
    loadEntites(post, function() {
      setDone('entities');
    });
    loadContext(post, tokenObj, function(post, contextErr, contextMeta) {
      setDone('context');
    });

    // these are stored in the db
    //   num_stars
    //   num_reposts
    //   num_replies



    // we need post, entities, annotations
    // user, entities, annotations
    // and finally client
    // could dispatch all 3 of these in parallel
    // shouldAdd but can't no name/link data

    //console.log('dispatcher.js::postToAPI - is ref this?', ref);

  },
  // take a list of IDs and lookup posts
  idsToAPI: function(posts, params, callback, meta) {
    //console.log('dispatcher.js::idsToAPI(', posts.length, 'posts,...,...,', meta, ') - start');
    var ref=this;
    // definitely need this system
    var apiposts={};
    var counts=0;
    //var apiposts=[];
    if (posts.length) {
      posts.map(function(current, idx, Arr) {
        // get the post in API foromat
        //console.log('getting', current.id);
        // params && params.tokenobj?params.tokenobj:null
        ref.getPost(current.id, params, function(post, err, postMeta) {
          if (post && post.text) {
            //apiposts.push(post);
            apiposts[post.id]=post;
          } else {
            // reposts are an example of a post without text
            console.log('dispatcher.js::idsToAPI - no post or missing text', post, err, meta, current.id);
            // with counts we don't need to do this
            //posts.pop(); // lower needed
          }
          counts++;
          // join
          //console.log(apiposts.length+'/'+entities.length);
          //console.log(counts+'/'+posts.length);
          if (counts===posts.length) {
          //if (apiposts.length===posts.length) {
            //console.log('dispatcher.js::idsToAPI - finishing');
            var res=[]
            for(var i in posts) {
              var id=posts[i].id;
              if (apiposts[id]) {
                //console.log('final', id);
                res.push(apiposts[id]);
              }
            }
            callback(res, null, meta);
            /*
            for(var i in apiposts) {
              var id=apiposts[i].id;
              console.log('final', id);
            }
            callback(apiposts, null, meta);
            */
          }
        });
      }, ref);
    } else {
      // no entities
      // this can be normal, such as an explore feed that's being polled for since_id
      //console.log('dispatcher.js::idsToAPI - no posts');
      callback([], 'idsToAPI no posts', meta);
    }
  },
  addRepost: function(postid, tokenObj, callback) {
    //console.log('dispatcher.js::addRepost - start', postid);
    var ref=this;
    // if postid is a repost_of
    this.cache.getPost(postid, function(srcPost, err) {
      var originalPost=postid
      if (srcPost.repost_of) {
        originalPost=srcPost.thread_id
      }
      ref.cache.addRepost(postid, originalPost, tokenObj, function(dbPost, err, meta) {
        if (err) {
          console.error('dispatcher.js::addRepost - err', err);
        }
        //console.log('dispatcher.js::addRepost - dbPost', dbPost);
        // postToAPI function(post, params, token, callback, meta) {
        ref.postToAPI(dbPost, {}, tokenObj, callback, meta);
      });
    });
  },
  delRepost: function(postid, tokenObj, callback) {
    var ref = this;
    this.cache.delRepost(postid, tokenObj, function(success, err, meta) {
      // postToAPI function(post, params, token, callback, meta) {
      ref.getPost(postid, { generalParams: { deleted: true } }, callback);
    });
  },
  /**
   * get single post from data access
   * @param {number} id - the new post object
   * @param {object} params - the options context
   * @param {metaCallback} callback - function to call after completion
   */
  // what params here?? all
  // we need to ignore any paging parameter, likely from the parent call
  getPost: function(id, params, callback) {
    // probably should just exception and backtrace
    if (callback==undefined) {
      console.log('dispatcher.js::getPost - callback undefined');
      return;
    }
    if (id==undefined) {
      callback(null, 'dispatcher.js::getPost - id is undefined');
      return;
    }
    if (params==undefined) {
      console.log('dispatcher.js::getPost - WARNING params is undefined');
    }
    var ref=this;
    //console.log('dispatcher.js::getPost - getting id',id);
    this.cache.getPost(id, function(post, err, meta) {
      if (post) {
        //console.log('dispatcher.js::getPost - GotPost', post);
        //console.log('dispatcher.js::getPost - GotPost',post.id);
        //console.log('dispatcher.js::getPost - postToAPI params', params);
        ref.postToAPI(post, params, params && params.tokenobj?params.tokenobj:null, callback, meta);
      } else {
        callback(null, 'dispatcher.js::getPost - post is not set!');
      }
    });
  },
  // threadid or reply_to? reply_to for now
  getReplies: function(postid, params, token, callback) {
    var ref=this;
    if (!postid || postid === 'undefined') {
      callback([], 'empty postid', postid);
      return;
    }
    // userid can't be me without a token
    // userid could be a username though
    // FIXME: make sure postid is a number
    this.cache.getPost(postid, function(post, err) {
      if (!post || err) {
        callback([], 'no posts for replies: '+err);
        return;
      }
      // probably should chain these
      // because stupid if we don't have all the replies
      //console.log('apiroot', downloader.apiroot)
      if (downloader.apiroot != 'NotSet') {
        downloader.downloadThread(post.thread_id, token);
      }
      ref.cache.getReplies(post.thread_id, params, token, function(posts, err, meta) {
        //console.log('dispatcher.js::getReplies - returned meta ', meta);
        // data is an array of entities
        var apiposts={}, postcounter=0;
        //console.log('dispatcher.js:getReplies - mapping '+posts.length);
        if (posts && posts.length) {
          posts.map(function(current, idx, Arr) {
            //console.log('dispatcher.js:getReplies - map postid: '+current.id);
            // get the post in API foromat
            ref.postToAPI(current, params, token, function(post, err, postmeta) {
              // can error out
              if (post) {
                apiposts[post.id]=post;
              }
              // always increase counter
              postcounter++;
              // join
              //console.log(apiposts.length+'/'+entities.length);
              if (postcounter==posts.length) {
                //console.log('dispatcher.js::getReplies - finishing');
                // need to restore original order
                var res=[];
                for(var i in posts) {
                  if (posts[i]) {
                    res.push(apiposts[posts[i].id]);
                  }
                }
                //console.log('dispatcher.js::getReplies - result ', res);
                callback(res, null, meta);
              }
            });
          }, ref);
        } else {
          // no posts which is fine
          //console.log('dispatcher.js:getReplies - no replies ');
          callback([], 'no posts for replies', meta);
        }
      });
    });
  },
  getMentions: function(userid, params, token, callback) {
    // userid can't be me without a token
    if (userid=='me') {
      if (token && token.userid) {
        userid=token.userid;
      } else {
        console.log('dispatcher.js:getMentions - me but token', token);
        callback([], "need token for 'me' user");
        return;
      }
    }
    var ref=this;
    // is this blocking execution? yes, I think it is
    this.cache.getUser(userid, function(user, err) {
      if (err) {
        console.log('dispatcher.js::getMentions - getUser err', err);
      }
      if (user && user.following==0) {
        if (downloader.apiroot != 'NotSet') {
          console.log('downloadMentions');
          downloader.downloadMentions(userid, params, token);
          console.log('downloadMentions complete');
        }
      }
    });
    // userid could be a username though
    this.cache.getMentions(userid, params, function(entities, err, meta) {
      // data is an array of entities
      var apiposts={};
      var count=0;
      //console.log('dispatcher.js:getMentions - mapping', entities.length);
      if (entities && entities.length) {
        //for(var i in entities) {
          //console.log('i',entities[i].typeid);
        //}
        entities.map(function(current, idx, Arr) {
          // get the post in API foromat
          //console.log('getting post',current.typeid);
          ref.getPost(current.typeid, params, function(post, perr, pmeta) {
            //console.log('got post',post.id);
            apiposts[post.id]=post;
            count++;
            // join
            //console.log(count+'/'+entities.length,'post',post.id,'entity',current.id);
            if (count==entities.length) {
              //console.log('dispatcher.js::getMentions - finishing', meta);
              // restore order
              var nlist=[];
              for(var i in entities) {
                nlist.push(apiposts[entities[i].typeid]);
              }
              callback(nlist, err, meta);
            }
          });
        }, ref);
      } else {
        // no entities
        callback([], 'no mentions/entities for '+userid, meta);
      }
    });
  },
  /**
   * get range of posts from data access
   * @param {object} params - the pagination context
   * @param {metaCallback} callback - function to call after completion
   */
  getGlobal: function(params, callback) {
    var ref=this;
    //console.log('dispatcher.js::getGlobal - start');
    this.cache.getGlobal(params, function(posts, err, meta) {
      // meta is garbage
      // more yes or no
      //console.log('dispatcher.js::getGlobal - returned meta', meta);
      // data is an array of entities
      var apiposts={}, postcounter=0;
      //console.log('dispatcher.js:getGlobal - mapping', posts.length);
      if (posts.length) {
        posts.map(function(current, idx, Arr) {
          if (!current) {
            console.log('dispatcher.js:getGlobal - no post', idx);
            current={}; // needs to at least be an object
          }
          //console.log('dispatcher.js:getGlobal - map postid: '+current.id);
          //console.log('ref',ref,'this',this);
          // get the post in API foromat
          ref.postToAPI(current, params, params.tokenobj, function(post, err, postmeta) {
            if (post && !post.user) {
              console.log('dispatcher.js:getGlobal - no user from postToAPI',post.user);
            }
            //console.log('dispatcher.js:getGlobal - post id check post postToAPI ',post.userid);
            // can error out
            if (post) {
              apiposts[post.id]=post;
            }
            // always increase counter
            postcounter++;
            // join
            //console.log(postcounter+'/'+posts.length);
            if (postcounter==posts.length) {
              //console.log('dispatcher.js::getGlobal - finishing');
              // need to restore original order
              var res=[];
              for(var i in posts) {
                if (posts[i]) {
                  //console.log('id',posts[i].id,'id',apiposts[posts[i].id].id,'date',apiposts[posts[i].id].created_at);
                  res.push(apiposts[posts[i].id]);
                }
              }
              //console.log('sending',res.length,'posts to dialect');
              //console.log('dispatcher.js::getGlobal - meta', meta);
              callback(res, null, meta);
            }
          });
        }, ref);
      } else {
        // no posts
        callback([], 'no posts for global', meta);
      }
    });
  },
  /**
   * get explore streams
   * @param {object} params - the pagination context
   * @param {metaCallback} callback - function to call after completion
   */
  getExplore: function(params, callback) {
    var ref=this;
    this.cache.getExplore(params, function(endpoints, err, meta) {
      //console.log('dispatcher.js::getExplore - returned meta', meta);
      callback(endpoints, null, meta);
    });
  },
  getUserStream: function(user, params, tokenObj, callback) {
    var ref=this;
    //console.log('dispatcher.js::getUserStream - ', user);
    normalizeUserID(user, tokenObj, function(userid, err) {
      //console.log('dispatcher.js::getUserStream - got', userid);
      if (downloader.apiroot != 'NotSet') {
        ref.cache.getUser(userid, function(userdata, err, meta) {
          ref.cache.getFollowing(user, {}, function(followings, err) {
            if (!followings || !followings.length) {
              // Yer following no one
              console.log('likely we need to sync followers for', user);
              downloader.downloadFollowing(user, tokenObj);
              return;
            }
            console.log('user counts check', userdata.following, 'vs', followings.length);
            if (userdata.following==0 || followings.length==0 || userdata.following>followings.length) {
              console.log('likely we need to sync followers for', user);
              downloader.downloadFollowing(user, tokenObj);
            }
          });
        });
      }
      // ok actually build the stream
      if (params.pageParams.count===undefined) params.pageParams.count=20;
      if (params.pageParams.before_id===undefined) params.pageParams.before_id=-1; // -1 being the very end
      var oldcount=params.count;
      // but we want to make sure it's in the right direction
      // if count is positive, then the direction is older than the 20 oldest post after before_id
      //params.pageParams.count+=1; // add one at the end to check if there's more
      // before_id
      //console.log('dispatcher.js::getUserStream - count', params.count);
      ref.cache.getUserStream(userid, params, tokenObj, function(posts, err, meta) {
        // data is an array of entities
        var apiposts={}, postcounter=0;
        //if (posts) console.log('dispatcher.js:getUserStream - mapping '+posts.length);
        if (posts && posts.length) {
          //var min_id=posts[0].id+200,max_id=0;
          posts.map(function(current, idx, Arr) {
            //console.log('dispatcher.js:getUserPosts - map postid: '+current.id);
            // get the post in API foromat
            ref.postToAPI(current, params, tokenObj, function(post, err, postmeta) {
              //min_id=Math.min(min_id,post.id);
              //max_id=Math.max(max_id,post.id);
              apiposts[post.id]=post;
              postcounter++;
              // join
              //console.log(postcounter+'/'+posts.length);
              // -1 because we asked for an extra
              // but is that extra in the front or back?
              // was -1 but if we're ++ here
              // on 1/1 you can't do 1/1-1
              if (postcounter==posts.length) {
                //console.log('dispatcher.js::getUserStream - finishing');
                /*
                var imeta={
                  code: 200,
                  min_id: min_id,
                  max_id: max_id,
                  // we can't just compare here
                  // get 20: is it 20 posts? or is there 21?
                  more: meta.more
                };
                */
                var res=[];
                // well not all of them...
                for(var i in posts) {
                  // well not all of them...
                  if (apiposts[posts[i].id]) {
                    res.push(apiposts[posts[i].id]);
                  }
                }
                //console.log('dispatcher::getUserStream - meta', meta);
                //console.log('imeta',imeta);
                callback(res, null, meta);
              }
            });
          }, ref);
        } else {
          // no posts
          callback([], 'no posts for user stream', meta);
        }
      });
    });
  },
  getUnifiedStream: function(user, params, token, callback) {
    console.log('dispatcher.js::getUnifiedStream', user);
    var ref=this;
    this.cache.getUnifiedStream(user, params, function(posts, err, meta) {
      // data is an array of entities
      var apiposts={}, postcounter=0;
      //console.log('dispatcher.js:getUserPosts - mapping '+posts.length);
      if (posts && posts.length) {
        posts.map(function(current, idx, Arr) {
          //console.log('dispatcher.js:getUserPosts - map postid: '+current.id);
          // get the post in API foromat
          ref.postToAPI(current, params, token, function(post, err, postmeta) {
            apiposts[post.id]=post;
            postcounter++;
            // join
            //console.log(apiposts.length+'/'+entities.length);
            if (postcounter==posts.length) {
              //console.log('dispatcher.js::getUserPosts - finishing');
              var res=[];
              for(var i in posts) {
                res.push(apiposts[posts[i].id]);
              }
              callback(res, null, meta);
            }
          });
        }, ref);
      } else {
        // no posts
        callback([], 'no posts for unified', meta);
      }
    });
    //console.log('dispatcher.js::getUnifiedStream - write me');
    //callback(null, null);
  },
  /**
   * get range of posts for user id userid from data access
   * @param {number} userid - the user id to get posts for
   * @param {object} params - the pagination context
   * @param {metaCallback} callback - function to call after completion
   */
  getUserPosts: function(user, params, callback) {
    //console.log('dispatcher.js::getUserPosts - user:', user);
    var ref=this;
    normalizeUserID(user, params.tokenobj, function(userid) {
      //console.log('dispatcher.js::getUserPosts - userid:', userid);
      ref.cache.getUserPosts(userid, params, function(posts, err, meta) {
        // data is an array of entities
        var apiposts={}, postcounter=0;
        //console.log('dispatcher.js:getUserPosts - mapping '+posts.length);
        if (posts && posts.length) {
          posts.map(function(current, idx, Arr) {
            //console.log('dispatcher.js:getUserPosts - map postid: '+current.id);
            // get the post in API foromat
            ref.postToAPI(current, params, params.tokenobj, function(post, err, postmeta) {
              // cache?? no
              apiposts[post.id]=post;
              postcounter++;
              // join
              //console.log(postcounter+'/'+posts.length);
              if (postcounter==posts.length) {
                //console.log('dispatcher.js::getUserPosts - finishing');
                var res=[];
                for(var i in posts) {
                  res.push(apiposts[posts[i].id]);
                }
                callback(res, null, meta);
                /*
                var res={};
                var done=0;
                for(var i in posts) {
                  var scope=function(i) {
                    apiposts[posts[i].id].annotations=[];
                    ref.getAnnotation('post', posts[i].id, function(notes, err, notemeta) {
                      for(var j in notes) {
                        var note=notes[j];
                        //console.log('got note', j, '#', note.type, '/', note.value, 'for', posts[i].id);
                        apiposts[posts[i].id].annotations.push({
                          type: note.type,
                          value: note.value,
                        });
                      }
                      //console.log('got notes', posts[i].annotations, 'for', posts[i].id);
                      res[posts[i].id]=apiposts[posts[i].id];
                      console.log('results', done, '==posts', posts.length);
                      console.log(i, 'post obj', posts[i]);
                      done++;
                      if (done==posts.length) {
                        var nRes=[];
                        for(var k in posts) {
                          nRes.push(res[posts[k].id]);
                        }
                        callback(nRes, null, meta);
                      }
                    });
                  }(i);
                }
                */
              }
            });
          }, ref);
        } else {
          // no posts
          callback([], 'no posts for user posts', meta);
        }
      });
    });
  },
  /**
   * get range of stared posts for user id userid from data access
   * @param {number} userid - the user id to get posts for
   * @param {object} params - the pagination context
   * @param {metaCallback} callback - function to call after completion
   */
  getUserStars: function(userid, params, callback) {
    //console.log('dispatcher.js::getUserStars start');
    if (!params.count) params.count=20;
    var ref=this;
    if (userid=='me') {
      if (params.tokenobj && params.tokenobj.userid) {
        //console.log('dispatcher.js::getUserStars - me became', params.tokenobj.userid);
        this.getUserStars(params.tokenobj.userid, params, callback)
        return;
      } else {
        console.log('dispatcher.js::getUserStars - userid is me but invalud token', params.tokenobj);
        callback([], 'no or invalid token');
        return;
      }
    }

    this.cache.getInteractions('star', userid, params, function(interactions, err, meta) {
      // make sure stars are up to date
      if (downloader.apiroot != 'NotSet') {
        console.log('dispatcher.js::getUserStars - start d/l');
        downloader.downloadStars(userid);
        console.log('dispatcher.js::getUserStars - end d/l');
      }
      //console.log('dispatcher.js::getUserStars - ', interactions);
      // data is an array of interactions
      if (interactions && interactions.length) {
        var apiposts=[];
        interactions.map(function(current, idx, Arr) {
          // we're a hasMany, so in theory I should be able to do
          // record.posts({conds});
          // get the post in API foromat
          //console.log('dispatcher::getUserStars - tokenobj', params.tokenobj);
          ref.getPost(current.typeid, params, function(post, err, meta) {
            //console.dir(post);
            if (post && post.user && post.text) { // some are deleted, others are errors
              apiposts.push(post);
            } else {
              interactions.pop();
            }
            // join
            // params.count is requested rpp
            //console.log(apiposts.length+'/'+interactions.length+' or '+params.count);
            // interactions.length looks good
            if (apiposts.length==params.count || apiposts.length==interactions.length) {
              //console.log('dispatcher.js::getUserStars - finishing', apiposts.length);
              callback(apiposts);
              return; // kill map, somehow?
            }
          });
        }, ref);
      } else {
        // no interactions
        //console.log('dispatcher.js::getUserStars - finishing but no stars for', userid, params);
        callback([], err, meta);
      }
    });
  },
  /**
   * get range of hashtagged posts from data access
   * @param {string} hashtag - the hashtag to get posts for
   * @param {object} params - the pagination context
   * @param {metaCallback} callback - function to call after completion
   */
  getHashtag: function(hashtag, params, callback) {
    var ref=this;
    //console.log('dispatcher.js:getHashtag - start #'+hashtag);
    this.cache.getHashtagEntities(hashtag, params, function(entities, err, meta) {
      // data is an array of entities
      var apiposts=[];
      //console.log('dispatcher.js:getHashtag - mapping '+entities.length);
      if (entities.length) {
        // this seems to preserve order
        entities.map(function(current, idx, Arr) {
          // get the post in API foromat
          ref.getPost(current.typeid, params && params.tokenobj?{ tokenobj: params.tokenobj }:null, function(post, err, meta) {
            apiposts.push(post);
            // join
            //console.log(apiposts.length+'/'+entities.length);
            if (apiposts.length==entities.length) {
              //console.log('dispatcher.js::getHashtag - finishing');
              callback(apiposts);
            }
          });
        }, ref);
      } else {
        // no entities
        callback([], 'no entities for '+hashtag, meta);
      }
    });
  },
  getExploreFeed: function(feed, params, callback) {
    //console.log('dispatcher.js::getExploreFeed(', feed, ',...,...) - start');
    var ref=this;
    this.cache.getExploreFeed(feed, params, function(posts, err, meta) {
      //console.log('dispatcher.js::getExploreFeed - gotExploreFeed');
      // definitely need this system
      ref.idsToAPI(posts, params, callback, meta);
      /*
      var apiposts={};
      var counts=0;
      //var apiposts=[];
      if (posts.length) {
        posts.map(function(current, idx, Arr) {
          // get the post in API foromat
          //console.log('getting', current.id);
          // params && params.tokenobj?params.tokenobj:null
          ref.getPost(current.id, params, function(post, err, postMeta) {
            if (post && post.text) {
              //apiposts.push(post);
              apiposts[post.id]=post;
            } else {
              // reposts are an example of a post without text
              console.log('dispatcher.js::getExploreFeed - no post or missing text', post, err, meta, current.id);
              posts.pop(); // lower needed
            }
            counts++;
            // join
            //console.log(apiposts.length+'/'+entities.length);
            if (counts===posts.length) {
            //if (apiposts.length===posts.length) {
              //console.log('dispatcher.js::getExploreFeed - finishing');
              var res=[]
              for(var i in posts) {
                var id=posts[i].id;
                if (apiposts[id]) {
                  //console.log('final', id);
                  res.push(apiposts[id]);
                }
              }
              callback(res, null, meta);
              //for(var i in apiposts) {
                //var id=apiposts[i].id;
                //console.log('final', id);
              //}
              //callback(apiposts, null, meta);
            }
          });
        }, ref);
      } else {
        // no entities
        callback([], 'no posts for '+feed, meta);
      }
      */
    });
  },
  postSearch: function(query, params, tokenObj, callback) {
    var ref=this;
    console.log('postSearch query', query)
    this.cache.searchPosts(query, params, function(users, err, meta) {
      //console.log('dispatcher.js::userSearch - got', users.length, 'users')
      if (!users.length) {
        callback([], null, meta);
        return;
      }
      var rPosts=[]
      for(var i in users) {
        // postToAPI function(post, params, tokenObj, callback, meta) {
        ref.postToAPI(users[i], params, tokenObj, function(adnPostObj, err) {
          //console.log('dispatcher.js::userSearch - got', adnUserObj, 'for', users[i])
          rPosts.push(adnPostObj)
          if (rPosts.length==users.length) {
            //console.log('dispatcher.js::userSearch - final', rUsers)
            callback(rPosts, null, meta);
          }
        }, meta);
      }
    });
  },
  /** channels */
  apiToChannel: function(api, meta, callback) {
    console.log('dispatcher.js::apiToChannel - api', api);
    // map API to DB
    // default to most secure
    var raccess=2; // 0=public, 1=loggedin, 2=selective
    var waccess=2; // 1=loggedin, 2=selective
    // editors are always seletcive
    if (api.readers) {
      if (api.readers.any_user) {
        raccess=1;
      }
      if (api.readers.public) {
        raccess=0;
      }
    } else {
      api.readers={ user_ids: '' };
    }
    if (api.writers) {
      if (api.writers.any_user) {
        waccess=1;
      }
    } else {
      api.writers={ user_ids: '' };
    }
    if (api.readers.user_ids == undefined) {
      api.readers.user_ids='';
    }
    if (api.writers.user_ids == undefined) {
      api.writers.user_ids='';
    }
    if (api.editors.user_ids == undefined) {
      api.editors.user_ids='';
    }
    var channel={
      id: api.id,
      ownerid: api.owner.id,
      type: api.type,
      reader: raccess,
      writer: waccess,
      readers: api.readers.user_ids,
      writers: api.writers.user_ids,
      editors: api.editors.user_ids,
    };
    callback(channel, null, meta);
  },
  channelToAPI: function (channel, params, tokenObj, callback, meta) {
    if (typeof(channel)!='object') {
      console.log('dispatcher.js::channelToAPI - channel passed in wasnt object');
      callback([], 'bad data');
      return;
    }
    if (channel==null) {
      console.log('dispatcher.js::channelToAPI - channel is null');
      callback([], 'null data');
      return;
    }
    var api={
      counts: {
        messages: 0,
        subscribers: 0,
      },
      has_unread: false,
      id: channel.id,
      //owner: {},
      is_inactive: false,
      readers: {
        any_user: channel.reader==1?true:false,
        immutable: channel.readedit?false:true,
        public: channel.reader==0?true:false,
        user_ids: channel.readers==null?[]:channel.readers.split(/,/),
        you: false,
      },
      editors: {
        any_user: false,
        immutable: channel.editedit?false:true,
        public: false,
        user_ids: channel.editors==null?[]:channel.editors.split(/,/),
        you: false,
      },
      writers: {
        any_user: channel.writer==1?true:false,
        immutable: channel.writeedit?false:true,
        public: false,
        user_ids: channel.writers==null?[]:channel.writers.split(/,/),
        you: false,
      },
      type: channel.type,
    }
    // make sure ownerid isn't in the writers
    // we need it in the db this way for PM channel search
    // which way is this way?
    if (api.writers.user_ids) {
      var nList=[];
      for(var i in api.writers.user_ids) {
        var writer=api.writers.user_ids[i];
        //console.log('dispatcher.js::channelToAPI('+channel.id+') - looking at', writer, 'vs', channel.ownerid);
        if (writer!=channel.ownerid) {
          nList.push(writer);
        }
      }
      //console.log('dispatcher.js::channelToAPI('+channel.id+') - final list', nList);
      api.writers.user_ids=nList;
    }
    var ref=this;

    var channelDone={
      user: false,
      annotations: false,
      messages: false,
    }

    function setDone(type) {
      channelDone[type]=true;
      // if something is not done
      //if (channel.debug) {
      //console.log('dispatcher.js::channelToAPI('+channel.id+') - checking if done');
      //}
      for(var i in channelDone) {
        if (!channelDone[i]) {
          if (channel.debug) {
            console.log('dispatcher.js::channelToAPI('+channel.id+') -', i, 'is not done');
          }
          return;
        }
      }
      if (channel.debug) {
        console.log('dispatcher.js::channelToAPI('+channel.id+') - done', meta, typeof(callback));
      }
      //console.log('dispatcher.js::channelToAPI('+channel.id+') - done, text', data.text);
      // everything is done
      callback(api, null, meta);
    }

    function loadUser(userid, params, cb) {
      if (channel.debug) console.log('dispatcher.js::channelToAPI('+channel.id+') - getting user '+userid);
      //params.debug = true
      ref.getUser(userid, params, function(user, userErr, userMeta) {
        if (userErr) console.error('dispatcher.js::channelToAPI('+channel.id+') - ', userErr)
        if (channel.debug) console.log('dispatcher.js::channelToAPI('+channel.id+') - got user '+userid);
        if (!user) {
          user={
            id: 0,
            username: 'likelydeleted',
            created_at: '2014-10-24T17:04:48Z',
            avatar_image: {
              url: ''
            },
            cover_image: {
              url: ''
            },
            counts: {
              following: 0,
            }
          }
        }
        cb(user, userErr, userMeta);
      }); // getUser
    }

    function loadAnnotation(channel, cb) {
      ref.getAnnotation('channel', channel.id, function(dbNotes, err, noteMeta) {
        var apiNotes=[];
        for(var j in dbNotes) {
          var note=dbNotes[j];
          //console.log('got note', j, '#', note.type, '/', note.value, 'for', posts[i].id);
          apiNotes.push({
            type: note.type,
            value: note.value,
          });
        }
        cb(apiNotes, err, noteMeta);
      });
    }

    //console.log('dispatcher.js::channelToAPI - tokenObj', tokenObj)
    // you_subscribed
    if (tokenObj.subscribedOpt) {
      api.you_subscribed=true;
    } else if (tokenObj.unsubscribedOpt) {
      api.you_subscribed=false;
    } else {
      if (tokenObj.subscribedOpt===undefined && tokenObj.unsubscribedOpt===undefined) {
        //console.log('dispatcher.js::channelToAPI - are you subscribed?', tokenObj.userid);
        channelDone.subscribed = false
        ref.cache.getSubscription(api.id, tokenObj.userid, function(subed, err) {
          //console.log('dispatcher.js::channelToAPI - are you subscribed?', subed);
          api.you_subscribed=false;
          if (subed) {
            api.you_subscribed=true;
          }
          //console.log('dispatcher.js::channelToAPI - are you subscribed?', api.you_subscribed);
          setDone('subscribed');
        })
      }
    }
    if (channel.ownerid == tokenObj.userid) {
      api.readers.you=true;
      api.editors.you=true;
      api.writers.you=true;
      // could insert into user_ids... (Writers is spec)
      // you_can_edit
      api.you_can_edit=true;
      // you_muted
      api.you_muted=false; // can't mute self
    } else
    //console.log('dispatcher.js::channelToAPI - tokenObj', tokenObj);
    if (tokenObj.userid) {
      // process readers
      if (channel.reader==0) {
        api.readers.you=true;
      } else
      // logged in
      if (channel.reader==1) {
        api.readers.you=true;
      }

      if (channel.writer==1) {
        api.writers.you=true;
      }
      if (!api.writers.you) { // optimization
        var writes=channel.writers?channel.writers.split(/,/):[];
        //console.log('checking', writes, 'for', tokenObj.userid, '=', writes.indexOf(tokenObj.userid+''));
        if (writes.indexOf(tokenObj.userid+'')!=-1) {
          api.writers.you=true;
        }
      }
    }
    //if (channel.debug) console.log('asking to load', channel.ownerid)
    loadUser(channel.ownerid, params, function(user, userErr, userMeta) {
      api.owner=user;
      //console.log('dispatcher.js::channelToAPI - params', params);
      setDone('user');
    });
    if (params.generalParams.annotations || params.generalParams.post_annotations) {
      loadAnnotation(channel, function(apiNotes, noteErr, noteMeta) {
        api.annotations = apiNotes;
        //callback(api, userErr || noteErr);
        setDone('annotations');
      });
    } else {
      //callback(api, userErr);
      setDone('annotations');
    }
    //getChannelMessages function(cid, params, callback) {
    var mParams={ pageParams: { count: 1 }, generalParams: {}, tokenobj: tokenObj }
    this.getChannelMessages(channel.id, mParams, function(messages, messageErr, messageMeta) {
      if (messageErr) {
        console.log('dispatcher::channelToAPI - messageErr', messageErr, 'channel', channel.id);
      }
      if (!messages.length) {
        //console.log('dispatcher::channelToAPI - last message for', channel.id, 'is', messages);
      }
      if (messages[0]) {
        api.recent_message_id = messages[0].id;
      }
      api.recent_message = messages[0];
      setDone('messages');
    });
  },
  /**
   * add/update channel
   * @param {object} json - channel object data
   * @param {number} ts - the timestamp of this event
   * @param {metaCallback} callback - function to call after completion
   */
  setChannel: function(json, ts, callback) {
    if (!json) {
      console.log('dispatcher.js::setChannel - no json passed in');
      callback(null, 'no json passed in');
      return;
    }
    // update user object
    this.updateUser(json.owner, ts);
    var ref=this;
    // map API to DB
    this.apiToChannel(json, {}, function(channel, convertErr) {
      ref.cache.setChannel(channel, ts, function(chnl, err) {
        // if newer update annotations
        if (callback) {
          callback(chnl, err || convertErr);
        }
      });
    });
    if (this.notsilent) {
      process.stdout.write('C');
    }
  },
  updateChannel: function(channelid, update, params, token, callback) {
    //console.log('dispatcher.js::updateChannel', channelid)
    // The only keys that can be updated are annotations, readers, and writers
    // (and the ACLs can only be updated if immutable=false).
    // The you_can_edit property tells you if you are allowed to update a channel. Currently, only the Channel owner can edit a channel.
    var ref = this;
    this.cache.getChannel(channelid, params, function(channel, err, meta) {
      console.log('dispatcher.js::updateChannel - got channel', typeof(channel), Object.keys(channel), channel);
      // FIXME: use apiToChannel
      if (!token.userid || channel.ownerid != token.userid) {
        callback({}, 'access denied to channel', {
          code: token?403:401,
        });
        return;
      }

      // update readers
      if (update.readers) {
        // can we tell the difference between set and not set?
        // so we can clear?
        if (update.readers.public) {
          channel.reader = 0;
        } else
        if (update.readers.any_user) {
          channel.reader = 1;
        } else {
          channel.reader = 2;
        }
        if (update.readers.user_ids) {
          channel.reader = 2;
          channel.readers = update.readers.user_ids.join(',');
        }
      }
      // update writers
      if (update.writers) {
        if (update.writers.any_user) {
          channel.writer = 1;
        } else {
          channel.writer = 2;
        }
        if (update.writers.user_ids) {
          // has to be an array
          channel.writers = update.writers.user_ids.join(',');
          channel.writer = 2;
        } else {
          channel.writers = ''
        }
      }
      console.log('dispatcher.js::updateChannel - updating channel', channel.id, 'to', channel);
      channel.save(function(){
        //ref.cache.setChannel(channel, Date.now()/1000, function(ochnl, chanUpdErr) {
        //ref.cache.updateChannel(channelid, channel, function(ochnl, chanUpdErr) {
        //console.log('dispatcher.js::updateChannel - chanUpdErr', chanUpdErr);
        // update annotations
        //setAnnotations: function(type, id, annotations, callback) {
        // if it's not set, it'll clear it...
        // If you want to add or update a Channel’s annotations, you may include the optional annotations key and pass in the annotations that are changing.
        // it's optional
        if (update.annotations !== undefined) {
          ref.setAnnotations('channel', channelid, update.annotations, function() {
            //console.log('dispatcher.js::updateChannel - annotations set');
            ref.channelToAPI(channel, params, token, callback, meta);
          });
        } else {
          ref.channelToAPI(channel, params, token, callback, meta);
        }
      });
      //});
    });
  },
  addChannel: function(api, params, token, callback) {
    //console.log('dispatcher::addChannel', params, token);
    var ref=this;
    function createChannel() {
      // Currently, the only keys we use from your JSON will be readers, writers, annotations, and type.
      // The owner will be auto-subscribed to this channel.
      //apiToChannel: function(api, meta, callback) {
      api.owner={};
      ref.apiToChannel(api, {}, function(channel, err, meta) {
        delete channel.id;
        ref.cache.addChannel(token.userid, channel, function(channelRes, createErr, createMeta) {
          console.log('dispatcher::addChannel', channelRes.id);
          ref.setAnnotations('channel', channelRes.id, api.annotations, function() {
            ref.channelToAPI(channelRes, params, token, callback, createMeta);
          });
        });
      });
    }
    if (api.type == 'net.app.core.pm') {
      var group = [token.userid];
      for(var i in api.writers.user_ids) {
        group.push(api.writers.user_ids[i]);
      }
      console.log('dispatcher.addChannel - detecting pm channel creation, dedupe check for', group);
      // destinations is input string (comma sep list: @,ints)
      this.cache.getPMChannel(group, function(nChannel_id, err, createMeta) {
        console.log('dispatcher.addChannel - dedupe result', nChannel_id);
        if (nChannel_id) {
          ref.getChannel(nChannel_id, params, callback);
        } else {
          createChannel();
        }
      })
    } else {
      createChannel();
    }
  },
  deactiveChannel: function(channelid, params, token, callback) {
    console.log('dispatcher::deactiveChannel', channelid, params, token);
    var ref=this;
    // only the owner can deactivate
    this.getChannel(channelid, params, function(channel, err, meta) {
      //console.log('ownerid', channel.owner.id, 'token', token.userid, 'channel', channel);
      if (!token.userid || (channel && channel.owner && channel.owner.id != token.userid)) {
        callback({}, 'access denied to channel', {
          code: token?403:401,
        });
        return;
      }
      var chnl={
        inactive: new Date(),
      }
      //console.log('dispatcher::deactiveChannel', channelid, params, token);
      ref.cache.updateChannel(channelid, chnl, function(success, err2, meta2) {
        channel.is_deleted = true;
        callback(channel, '', meta);
        //ref.channelToAPI(channel, params, token, callback, meta2);
      })
      // FIXME: get rid of the N+1 and delete all in one query
      ref.cache.getChannelSubscriptions(channelid, { }, function(subs, err, meta) {
        for(var i in subs) {
          var userid = subs[i].userid
          ref.cache.setSubscription(channelid, userid, true, new Date(), function(subscription, err) {
            console.log('dispatcher::deactiveChannel - remove used from channel', channelid)
          })
        }
      })
    })
  },
  checkChannelAccess: function(channel, userid) {
    var allowed=false;
    if (channel.reader==0) allowed=true;
    else if (userid) {
      if (channel.ownerid==userid) allowed=true;
      else if (channel.reader==1) allowed=true;
      else if (channel.reader==2) {
        var readList=channel.readers.split(/,/);
        if (readList.indexOf(userid+'')!=-1){
          allowed=true;
        }
      }
      //console.log('dispatcher.js::getChannel - allowed', allowed, 'writers', channel.writers, 'looking for', params.tokenobj.userid);
      // pm hack, if you can write to the channel, you can read from it
      if (!allowed && channel.writers) {
        var writeList=channel.writers.split(/,/);
        if (writeList.indexOf(userid+'')!=-1){
          allowed=true;
        }
        //console.log('dispatcher.js::getChannel - ', writeList, 'allowed', allowed);
      }
    }
    return allowed;
  },
  checkWriteChannelAccess: function(channel, userid) {
    if (!channel) {
      console.warn('dispatcher::checkWriteChannelAccess - no channel passed in')
      return false
    }
    var allowed=false;
    // maybe throw error if channel isnt an object
    // this isn't a thing in writer mode
    //if (channel.writer==0) allowed=true;
    //console.log('dispatcher::checkWriteChannelAccess - userid', userid, 'channel', channel)
    if (userid) { // have to be loggedin to write
      if (channel.ownerid==userid) allowed=true;
      else if (channel.writer==1) allowed=true;
      else if (channel.writer==2) {
        var writeList=channel.writers.split(/,/);
        if (writeList.indexOf(userid+'')!=-1){
          allowed=true;
        }
      }
      //console.log('dispatcher.js::getChannel - allowed', allowed, 'writers', channel.writers, 'looking for', params.tokenobj.userid);
      // pm hack, if you can write to the channel, you can read from it
      /*
      if (!allowed && channel.writers) {
        var writeList=channel.writers.split(/,/);
        if (writeList.indexOf(userid+'')!=-1){
          allowed=true;
        }
        //console.log('dispatcher.js::getChannel - ', writeList, 'allowed', allowed);
      }
      */
    }
    return allowed;
  },
  getUserChannels: function(params, tokenobj, callback) {
    //console.log('dispatcher::getUserChannels - tokenobj', tokenobj)
    if (!tokenobj.userid) {
      callback([], 'not user token');
      return;
    }
    var ref=this;
    //console.log('dispatcher::getUserChannels - userid', tokenobj.userid)
    //console.log('dispatcher::getUserChannels - params', params)
    this.cache.getUserChannels(tokenobj.userid, params, function(channels, err, meta) {
      if (err) console.error('dispatcher.js::getUserChannels - getUserChannels', err)
      //console.log('dispatcher::getUserChannels - channels', channels.length)
      if (!channels.length) {
        callback([], null);
        return;
      }
      var apis=[];
      for(var i in channels) {
        var channel=channels[i];
        // channel, params, tokenObj, callback, meta
        //console.log('dispatcher::getUserChannels - convert obj', channels[i], 'to API');
        // channelToAPI: function (channel, params, tokenObj, callback, meta) {
        //console.log('asking for', channels[i].id)
        //channels[i].debug = true
        ref.channelToAPI(channels[i], params, params.tokenobj?params.tokenobj:{}, function(api, cErr, meta2) {
          if (cErr) console.error('dispatcher.js::getUserChannels - channelToAPI', cErr)
          //console.log('dispatcher.js::getUserChannels - got API')
          apis.push(api);
          //console.log('dispatcher.js::getUserChannels - ', channels.length, '/', apis.length);
          if (channels.length == apis.length) {
            //console.log('dispatcher.js::getUserChannels - returning array');
            callback(apis, err || cErr);
          }
        }, meta);
      }
    })
  },
  /**
   * get channel data for specified channel id
   * @param {number} id - the id of channel you're requesting
   * @param {object} param - channel formatting options
   * @param {metaCallback} callback - function to call after completion
   */
  getChannel: function(ids, params, callback) {
    if (ids===undefined || ids === "undefined") {
      console.log('dispatcher.js::getChannel - id was undefined');
      callback([], 'ids was undefined');
      return;
    }
    //console.log('dispatcher.js::getChannel - ids', ids);
    var ref=this;
    this.cache.getChannel(ids, params, function(channels, err, meta) {
      if (channels === undefined) {
        callback([], err, meta);
        return;
      }
      //console.log('dispatcher.js::getChannel - got array', channels);
      if (channels instanceof Array) {
        //console.log('dispatcher.js::getChannel - got array', channels.length);
        if (!channels.length) {
          //console.log('dispatcher.js::getChannel multiple - no result for', ids);
          callback([], err, meta);
          return;
        }
        var apis=[];
        for(var i in channels) {
          var channel=channels[i]
          // we can do a quick security check here before pulling it all
          // omitting options will fuck with meta tho
          /*
          var allowed=false;
          if (channel.reader==0) allowed=true;
          else if (params.tokenobj) {
            if (channel.ownerid==params.tokenobj.userid) allowed=true;
            else if (channel.reader==1) allowed=true;
            else if (channel.reader==2) {
              var readList=channel.readers.split(/,/);
              if (readList.indexOf(params.tokenobj.userid+'')!=-1){
                allowed=true;
              }
            }
            //console.log('dispatcher.js::getChannel - allowed', allowed, 'writers', channel.writers, 'looking for', params.tokenobj.userid);
            // pm hack, if you can write to the channel, you can read from it
            if (!allowed && channel.writers) {
              var writeList=channel.writers.split(/,/);
              if (writeList.indexOf(params.tokenobj.userid+'')!=-1){
                allowed=true;
              }
              //console.log('dispatcher.js::getChannel - ', writeList, 'allowed', allowed);
            }
          }
          */
          var allowed=ref.checkChannelAccess(channel, params.tokenobj?params.tokenobj.userid:0);
          // block if not allowed
          if (!allowed) {
            apis.push({ id: channel.id, readers: { user_ids: [] }, writers: { user_ids: [] }, editors: { user_ids: [] } });
            if (channels.length == apis.length) {
              //console.log('dispatcher.js::getChannel - returning array');
              callback(apis, err);
            }
            continue;
          }
          //console.log('dispatcher.js::getChannel array - channel', channels[i]);
          // channel, params, tokenObj, callback, meta
          ref.channelToAPI(channels[i], params, params.tokenobj?params.tokenobj:{}, function(api, cErr) {
            apis.push(api);
            //console.log('dispatcher.js::getChannel - ', channels.length, '/', apis.length);
            if (channels.length == apis.length) {
              //console.log('dispatcher.js::getChannel - returning array');
              callback(apis, err || cErr);
            }
          });
        }
        return;
      }
      //console.log('dispatcher.js::getChannel single - channel', channels);
      //console.log('dispatcher.js::getChannel - non array');
      // channelToAPI: function (channel, params, tokenObj, callback, meta) {
      ref.channelToAPI(channels, params, params.tokenobj?params.tokenobj:{}, callback, meta);
    });
  },
  channelSearch: function(criteria, params, tokenObj, callback) {
    var ref = this;
    this.cache.searchChannels(criteria, params, function(channels, err, meta) {
      if (!channels.length) {
        callback([], err, meta);
        return;
      }
      var apis=[];
      for(var i in channels) {
        var channel=channels[i];
        // we can do a quick security check here before pulling it all
        // omitting options will fuck with meta tho
        // we'll insert dummy stubs
        var allowed=ref.checkChannelAccess(channel, tokenObj.userid);
        // block if not allowed
        if (!allowed) {
          apis.push({ id: channel.id, readers: { user_ids: [] }, writers: { user_ids: [] }, editors: { user_ids: [] } });
          if (channels.length == apis.length) {
            //console.log('dispatcher.js::getChannel - returning array');
            callback(apis, err);
          }
          continue;
        }
        // channel, params, tokenObj, callback, meta
        //console.log('dispatcher.js::channelSearch - channel', channel)
        ref.channelToAPI(channel, params, tokenObj, function(api, cErr) {
          apis.push(api);
          // todo: sorting by popularity (number of subscriptions)
          // todo: sorting by activity (by recent message)

          //console.log('dispatcher.js::getChannel - ', channels.length, '/', apis.length);
          if (channels.length == apis.length) {
            //console.log('dispatcher.js::getChannel - returning array');
            callback(apis, err || cErr);
          }
        });
      }
    });
  },
  //
  // messages
  //
  apiToMessage: function(api, meta, callback) {
    var channel=api;
    callback(channel, null);
  },
  messageToAPI: function(message, params, tokenObj, callback, meta) {
    if (!message) {
      console.log('dispatcher::messageToAPI - empty message', message)
      callback({}, 'empty message')
      return
    }
    var api={
      channel_id: message.channel_id,
      created_at: message.created_at,
      entities: {
        links: [],
        mentions: [],
        hashtags: []
      },
      id: message.id,
      machine_only: message.machine_only?true:false,
      num_replies: 0,
      source: {},
      thread_id: message.id,
    };
    if (message.is_deleted) {
      api.is_deleted = true
      delete api.text;
      delete api.html;
    } else {
      api.text = message.text;
      api.html = message.html;
      api.source = {};
    }
    var ref=this;

    var messageDone={
      user: false,
      annotations: false,
      entities: false,
    }

    function setDone(type) {
      messageDone[type]=true;
      // if something is not done
      //console.log('dispatcher.js::messageToAPI('+message.id+') - checking if done');
      for(var i in messageDone) {
        if (!messageDone[i]) {
          //console.log('dispatcher.js::messageToAPI('+message.id+') -', i, 'is not done');
          return;
        }
      }
      //console.log('dispatcher.js::channelToAPI('+channel.id+') - done', data, meta);
      //console.log('dispatcher.js::channelToAPI('+channel.id+') - done, text', data.text);
      // everything is done
      callback(api, null, meta);
    }
    function loadUser(userid, params, cb) {
      //console.log('dispatcher.js::postToAPI('+post.id+') - getting user '+post.userid);
      ref.getUser(userid, params, function(user, userErr, userMeta) {
        //console.log('dispatcher.js::postToAPI('+post.id+') - got user '+post.userid, err);
        if (!user) {
          user={
            id: 0,
            username: 'likelydeleted',
            created_at: '2014-10-24T17:04:48Z',
            avatar_image: {
              url: ''
            },
            cover_image: {
              url: ''
            },
            counts: {
              following: 0,
            }
          }
        }
        cb(user, userErr, userMeta);
      }); // getUser
    }
    function loadAnnotation(mid, cb) {
      ref.getAnnotation('message', mid, function(dbNotes, err, noteMeta) {
        var apiNotes=[];
        for(var j in dbNotes) {
          var note=dbNotes[j];
          //console.log('got note', j, '#', note.type, '/', note.value, 'for', posts[i].id);
          apiNotes.push({
            type: note.type,
            value: note.value,
          });
        }
        cb(apiNotes, err, noteMeta);
      });
    }

    function loadEntites(message, cb) {
      // use entity cache (DB read or CPU calculate)
      if (1) {
        //console.log('dispatcher.js::postToAPI('+post.id+') - getEntity post. post.userid:', post.userid);
        if (!message.id) {
          console.log('dispatcher.js::messageToAPI:::loadEntites', message);
          console.trace('dispatcher.js::messageToAPI:::loadEntites')
          cb();
          return;
        }
        ref.getEntities('message', message.id, function(entities, entitiesErr, entitiesMeta) {
          //console.log('dispatcher.js::postToAPI('+post.id+') - gotEntities');
          api.entities={
            mentions: [],
            hashtags: [],
            links: [],
          };
          copyentities('mentions', entities.mentions, api, 1);
          copyentities('hashtags', entities.hashtags, api, 1);
          copyentities('links', entities.links, api, 1);
          // use html cache?
          if (1) {
            //console.log('dispatcher.js::postToAPI('+post.id+') - calling final comp');
            //finalcompsite(post, user, client, callback, err, meta);
            cb();
          } else {
            // generate HTML
            // text, entities, postcontext, callback
            ref.textProcess(message.text, post.entities, true, function(textProcess, err) {
              //console.dir(textProcess);
              api.html=textProcess.html;
              //finalcompsite(post, user, client, callback, err, meta);
              cb();
            });
          }
        }); // getEntities
      } else {
        ref.textProcess(message.text, message.entities, true, function(textProcess, err) {
          api.entities=textProcess.entities;
          api.html=textProcess.html;
          //finalcompsite(post, user, client, callback, err, meta);
          cb();
        });
      }
    }

    if (message.is_deleted) {
      setDone('entities');
    } else {
      loadEntites(message, function() {
        setDone('entities');
      })
    }

    loadUser(message.userid, params, function(user, userErr, userMeta) {
      api.user=user;
      //console.log('dispatcher.js::messageToAPI - params', params.generalParams);
      if (params.generalParams.annotations || params.generalParams.post_annotations) {
        // do user annotations need to be loaded?
        //console.log('write me')
      }
      setDone('user');
      //callback(api, null);
    });

    if (!message.is_deleted && (params.generalParams.annotations || params.generalParams.post_annotations)) {
      loadAnnotation(message.id, function(apiNotes, noteErr, noteMeta) {
        //console.log('dispatcher.js::messageToAPI - loading annotations', apiNotes.length)
        api.annotations = apiNotes;
        setDone('annotations');
      });
    } else {
      //api.annotations=[];
      setDone('annotations');
    }

  },
  /**
   * add/update message
   * @param {object} json - message object data
   * @param {number} ts - the timestamp of this event
   * @param {metaCallback} callback - function to call after completion
   */
  setMessage: function(json, ts, callback) {
    //console.log('dispatcher.js::setMessage - write me!');
    // update user object
    // if the app gets behind (and/or we have mutliple stream)
    // the message could be delayed, so it's better to tie the user timestamp
    // for when the message was created then now
    // if though the user object maybe be up to date when the packet was sent
    // however the delay in receiving and processing maybe the cause of delay
    // meta.timestamp maybe the most accurate here?
    this.updateUser(json.user, ts);
    // create message DB object (API=>DB)
    var message={
      id: json.id,
      channelid: json.channel_id,
      text: json.text,
      html: json.html,
      machine_only: json.machine_only,
      client_id: json.client_id,
      thread_id: json.thread_id,
      userid: json.user.id,
      reply_to: json.reply_to,
      is_deleted: json.is_deleted,
      created_at: json.created_at
    };
    this.cache.setMessage(message, function(msg, err) {
      // if current, extract annotations too
      if (callback) {
        callback(msg, err);
      }
    });
    if (this.notsilent) {
      process.stdout.write('M');
    }
  },
  addMessage: function(channel_id, postdata, params, tokenobj, callback) {
    console.log('dispatcher.js::addMessage - channel_id', channel_id);
    var ref=this;
    function continueAddMessage(channel_id) {
      console.log('dispatcher.js::addMessage - checking channel', channel_id, 'permission for token user', tokenobj?tokenobj.userid:0)
      ref.cache.getChannel(channel_id, params, function(channel, channelErr, channelMeta) {
        if (channelErr) console.error('dispatcher::addMessage - channelErr', channelErr)
        if (!channel) {
          console.warn('dispatcher::addMessage - no channel for', channel_id)
        }
        if (!ref.checkWriteChannelAccess(channel, tokenobj?tokenobj.userid:0)) {
          //console.log('dispatcher.js::addMessage - denying access')
          callback({}, 'access denied to channel', {
            code: tokenobj?403:401,
          });
          return;
        }
        continueAddMessage2(channel_id);
      })
    }
    function continueAddMessage2(channel_id) {
      console.log('continueAddMessage2', channel_id)
      // why does annotations force channel_id 0?
      // so the message doesn't show up until
      // the annotations are written all the way through
      // it prevents bounces in the bridges
      var message={
        channel_id: postdata.annotations?0:channel_id,
        annotation_channel_id: channel_id,
        text: postdata.text,
        html: postdata.text, // FIXME: generate HTML from text
        machine_only: postdata.machine_only?1:0,
        client_id: tokenobj.client_id,
        //thread_id: json.thread_id,
        userid: tokenobj.userid,
        //reply_to: json.reply_to,
        is_deleted: false,
        created_at: new Date()
      };

      function getEntities(message, cb) {
        ref.textProcess(message.text, message.entities, true, function(textProc, err) {
          //console.log('dispatcher.js::addMessage - textProc', textProc);
          message.entities=textProc.entities;
          message.html=textProc.html;
          cb();
        });
      }
      // check out postToAPI
      // needs to run before textProcess
      function checkTagUser(message, cb) {
        if (!((message.text && message.text.match(/{username}/)) || (message.html && message.html.match(/{username}/)))) {
          cb();
          return;
        }
        ref.cache.getUser(message.userid, function(user, err, meta) {
          if (message.text && message.text.match(/{username}/)) {
            message.text=message.text.replace(new RegExp('{username}', 'g'), user.username);
          }
          if (message.html && message.html.match(/{username}/)) {
            message.html=message.html.replace(new RegExp('{username}', 'g'), user.username);
          }
          cb();
        });
      }
      // these both mess with .html / .text
      checkTagUser(message, function() {
        // after username is in place, we'll have better positions
        getEntities(message, function() {
          //console.log('dispatcher.js::addMessage - message', message);
          ref.cache.addMessage(message, function(msg ,err, meta) {
            if (err) {
              console.log('dispatcher.js::addMessage - err', err);
              callback([], err, {
                code: 500,
              });
              return
            }
            if (postdata.annotations) {
              console.log('dispatcher.js::addMessage - detected annotations', channel_id)
              // fix up channel_id for msg pump
              msg.channel_id = channel_id
              ref.setAnnotations('message', msg.id, postdata.annotations, function() {
                console.log('write channel_id', channel_id)
                ref.cache.setMessage({
                  id: msg.id,
                  channel_id: channel_id
                }, function(omsg) {
                  // omsg will be 1 if it's an update
                  //console.log('channel set', channel_id, 'for', msg.id, omsg);
                });
              });
            }
            // OPT: if no streams and no callback, no need for API conversion
            ref.messageToAPI(msg, params, tokenobj, function(api, err) {
              //console.log('dispatcher.js::addMessage - api', api);
              /*
              module.exports.pumpStreams({
                id:   msg.id,
                type: 'message',
                op:   'add',
                actor: msg.userid,
                channel_id: channel_id
              }, api);
              */
              ref.setEntities('message', msg.id, message.entities, function() {
                // if current, extract annotations too
                if (callback) {
                  //console.log('dispatcher.js::addMessage - has callback');
                  callback(api, err, meta);
                }
              });
            }, meta);
          });
        });
      });
    }
    if (channel_id=='pm') {
      //console.log('dispatcher.js::addMessage - pm channel');
      if (!postdata.destinations) {
        console.log('dispatcher.js::addMessage - no destinations passed', postdata);
        callback({}, 'no destinations passed');
        return;
      }
      this.cache.getPMChannel(postdata.destinations, function(nChannel_id, err) {
        //console.log('dispatcher.js::addMessage - pm channel is', nChannel_id, err);
        continueAddMessage(nChannel_id);
      });
    } else {
      console.log('dispatcher.js::addMessage - not pm channel', channel_id);
      continueAddMessage(channel_id);
    }
  },
  deleteMessage: function(message_id, channel_id, params, tokenObj, callback) {
    //console.log('dispatcher.js::deleteMessage - channel_id', channel_id);
    if (!channel_id) {
      console.log('dispatcher.js::deleteMessage - no channel');
      callback([], 'no channel passed in', {
        code: tokenobj?403:401,
      });
      return;
    }
    if (!tokenObj || !tokenObj.userid) {
      console.log('dispatcher.js::deleteMessage - no token');
      callback([], 'no token passed in', {
        code: 401,
      });
      return;
    }
    var ref=this;
    //console.log('dispatcher.js::deleteMessage - checking channel', channel_id, 'permission for token user', tokenobj?tokenobj.userid:0)
    ref.cache.getChannel(channel_id, params, function(channel, channelErr, channelMeta) {
      if (!ref.checkWriteChannelAccess(channel, tokenObj?tokenObj.userid:0)) {
        console.log('dispatcher.js::deleteMessage - denying channel access')
        callback({}, 'access denied to channel', {
          code: 403,
        });
        return;
      }
      // is this your message
      ref.getMessage(message_id, params, tokenObj, function(apiMsg, apiErr, apiMeta) {
        if (!apiMsg) {
          console.log('dispatcher.js::deleteMessage -', message_id, 'not found');
          callback({}, 'message not found', {
            code: 404,
          });
          return;
        }
        if (!apiMsg.user) {
          console.log('dispatcher.js::deleteMessage - ', message_id, ' has no user', apiMsg);
          callback({}, 'message not found', {
            code: 404,
          });
          return;
        }
        if (apiMsg.user.id != tokenObj.userid) {
          console.log('dispatcher.js::deleteMessage - denying message access');
          callback({}, 'access denied to message', {
            code: 403,
          });
          return;
        }
        ref.cache.deleteMessage(message_id, channel_id, function(msg, err, meta) {
          //console.log('dispatcher.js::deleteMessage - api1', msg);
          apiMsg.is_deleted = true;
          callback(apiMsg, apiErr, apiMeta);
          /*
          ref.cache.getMessage(message_id, function(message, err, meta) {
            ref.messageToAPI(message, params, tokenObj, function(api, err) {
              //console.log('dispatcher.js::deleteMessage - api2', api);
              callback(api, err);
            }, meta);
          });
          */
        });
      });
    })
  },
  getMessage: function(mids, params, tokenObj, callback) {
    //console.log('dispatcher.js::getMessage - mids', mids);
    var ref=this;
    this.cache.getMessage(mids, function(messages, err, meta) {
      // make messages an array if not
      if (!(messages instanceof Array)) {
        messages = [ messages ];
      }
      //console.log('dispatcher.js::getMessage - messages', messages.length);
      //if (!messages.length) {
        //console.log('dispatcher.js::getMessage - messages', messages);
      //}
      var apis = [];
      for(var i in messages) {
        var message = messages[i];
        // messageToAPI: function(message, params, tokenObj, callback, meta) {
        ref.messageToAPI(message, params, tokenObj, function(api, err) {
          apis.push(api);
          if (apis.length == messages.length) {
            callback(api, err, meta);
          }
        }, meta);
      }
    })
  },
  /**
   * get messages for specified channel id
   * @param {number} cid - the id of channel you're requesting
   * @param {object} param - message formatting options
   * @param {metaCallback} callback - function to call after completion
   */
  getChannelMessages: function(cid, params, callback) {
    //console.log('dispatcher.js::getChannelMessages - getChannelMessages', cid, params);
    var ref=this;
    if (cid=='pm') {
      console.log('dispatcher.js::getChannelMessages - getting pm message is not allowed');
      callback([], 'getting pm message is not allowed');
      return;
    }
    //getChannel: function(ids, params, callback) {
    this.cache.getChannel(cid, params, function(channel, channelErr, channelMeta) {
      //console.log('dispatcher.js:getChannelMessages - check', channel)
      if (!channel) {
        callback([], 'no such channel', {
          code: 404,
        });
        return;
      }
      if (!ref.checkChannelAccess(channel, params.tokenobj?params.tokenobj.userid:0)) {
        callback([], 'access denied to channel', {
          code: params.tokenobj?403:401,
        });
        return;
      }

      // I wonder if this should be migrated into caminte
      // well it needs to be unified per class
      // but where it lives is tbh
      //
      // disabled, since we had these properly now in caminte
      // not sure why we were rewriting them...
      // the params are more for messages than channel?
      /*
      var nParams=params.pageParams;
      //console.log('dispatcher.js::getChannelMessages - nParams', nParams);
      nParams.generalParams=params.generalParams;
      if (nParams.count===undefined) nParams.count=20;
      if (nParams.before_id===undefined) nParams.before_id=-1; // -1 being the very end
      */

      ref.cache.getChannelMessages(cid, params, function(messages, err, meta) {
        //console.log('dispatcher.js::getChannelMessages -', cid, 'has', messages.length);
        if (!messages.length) {
          callback([], err);
          return;
        }
        // FIXME: doesn't perserve order does it? nope
        var apis={};
        var apiCount = 0;
        for(var i in messages) {
          // channel, params, tokenObj, callback, meta
          ref.messageToAPI(messages[i], params, params.tokenobj, function(message, cErr) {
            //console.log('dispatcher.js::getChannelMessages - pushing', message.id)
            //apis.push(message);
            apis[message.id] = message;
            apiCount++;
            if (messages.length == apiCount) {
              var list = []
              for(var i in messages) {
                list.push(apis[messages[i].id]);
              }
              callback(list, err || cErr);
            }
          });
        }
      });
    });
  },
  /**
   * get messages for specified message ids on specified channel
   * @param {number} cid - the id of channel you're requesting
   * @param {array} mids - the ids of messaes you're requesting
   * @param {object} param - message formatting options
   * @param {metaCallback} callback - function to call after completion
   */
  getChannelMessage: function(cid, mids, params, callback) {
    console.log('dispatcher.js::getChannelMessage - write me!');
    callback([], null);
  },
  //
  // channel_subscription
  //
  /**
   * add/update channel subscription
   * @param {object} data - subscription data
   * @param {boolean} deleted - subscribe/unscribe
   * @param {number} ts - the timestamp of the event
   * @param {metaCallback} callback - function to call after completion
   */
  setChannelSubscription: function(data, deleted, ts, callback) {
    // update user object
    if (data.user) {
      this.updateUser(data.user, ts);
    }
    // update channel object
    this.setChannel(data.channel, ts);
    // update subscription
    this.cache.setSubscription(data.channel.id, data.user.id, deleted, ts, callback);
    if (this.notsilent) {
      process.stdout.write(deleted?'s':'S');
    }
  },
  addChannelSubscription: function(tokenobj, channel_id, params, callback) {
    //If a user has muted this Channel, this call will automatically unmute the Channel
    var ref=this;
    //addSubscription: function (channel_id, userid, callback) {
    this.cache.addSubscription(channel_id, tokenobj.userid, function(subscription, err) {
      params.subscribedOpt = true;
      ref.getChannel(channel_id, params, callback);
    });
  },
  delChannelSubscription: function(tokenobj, channel_id, params, callback) {
    var ref=this;
    //channel_id, userid, del, ts, callback
    this.cache.setSubscription(channel_id, tokenobj.userid, true, new Date(), function(subscription, err) {
      //delSubscription: function (channel_id, userid, callback) {
      //this.cache.delSubscription(channel_id, tokenobj.userid, function(subscription, err) {
      params.unsubscribedOpt = true;
      ref.getChannel(channel_id, params, callback);
    });
  },
  /**
   * get subscriptions for specified user id
   * @param {number} userid - the id of user you're requesting
   * @param {object} param - channel formatting options
   * @param {metaCallback} callback - function to call after completion
   */
  getUserSubscriptions: function(userid, params, callback) {
    //console.log('dispatcher.js::getUserSubscriptions - ', userid)
    // include_recent messages
    // channel_types filter
    var ref=this;

    /*
    //console.log('dispatcher.js::getUserSubscriptions - params', params);
    var nParams = params.pageParams;
    //console.log('dispatcher.js::getUserSubscriptions - nParams', nParams);
    if (nParams.count===undefined) nParams.count=20;
    if (nParams.before_id===undefined) nParams.before_id=-1; // -1 being the very end
    var oldcount=nParams.count;
    // but we want to make sure it's in the right direction
    // if count is positive, then the direction is older than the 20 oldest post after before_id
    if (nParams.count>0) {
      nParams.count+=1; // add one at the end to check if there's more
    }
    if (nParams.count<0) {
      nParams.count-=1; // add one at the end to check if there's more
    }
    if (params.channelParams.types) {
      nParams.types=params.channelParams.types;
    }
    */

    this.cache.getUserSubscriptions(userid, params, function(subs, subsErr, subsMeta) {
      //console.log('dispatcher.js::getUserSubscriptions - ', userid, 'has', subs.length)
      if (!subs.length) {
        callback([], subsErr, { code: 200, more: false});
        return;
      }
      var channelids=[];
      for(var i in subs) {
        var sub=subs[i];
        channelids.push(sub.channelid);
      }
      if (!channelids.length) {
        callback([], err, { code: 200, more: false});
        return;
      }
      //getChannel: function(ids, params, callback) {
      params.tokenobj.subscribedOpt=true;
      var result_recent_messages=params.generalParams.recent_messages;
      params.generalParams.recent_messages=true;
      //params.channelParams.types=
      ref.getChannel(channelids, params, function(apis, apiErr, apiMeta) {
        //console.log('dispatcher.js::getUserSubscriptions - got apis', apis.length);
        // sort by the "most recent post first"
        var list=[];
        for(var i in apis) {
          var api=apis[i];
          var ts=0;
          if (api.recent_message) {
            ts=new Date(api.recent_message.created_at).getTime();
          }
          //console.log('dispatcher.js::getUserSubscriptions - presort list', api.id);
          list.push([i, ts]);
        }
        //console.log('dispatcher.js::getUserSubscriptions - presort list', list);
        // sort list (ts desc (highest first))
        list=list.sort(function(a, b) {
          if (a[1] < b[1]) return 1;
          if (a[1] > b[1]) return -1;
          return 0;
        })
        //console.log('dispatcher.js::getUserSubscriptions - postsort list', list);
        var nlist=[];
        for(var i in list) {
          // strip out the recent_messages?
          if (result_recent_messages) {
            //
          }
          var api=apis[list[i][0]];
          //console.log('dispatcher.js::getUserSubscriptions - post list', api.id);
          nlist.push(api);
        }
        //console.log('dispatcher.js::getUserSubscriptions - final count', nlist.length);
        // we actually want the count from subsMeta
        callback(nlist, apiErr, subsMeta);
      });
      /*
      var channelCriteria={ where: { id: { in: channelids } } };
      if (params.types) {
        channelCriteria.where['type']={ in: params.types.split(/,/) };
        //console.log('dataaccess.caminte.js::getUserSubscriptions - types', channelCriteria.where['type']);
      }
      channelModel.find(channelCriteria, function (err, channels) {
        callback(channels, err, meta);
      });
      */

      /*
      var apis={};
      var count=0;
      var min_id = 999999;
      var max_id = 0;
      for(var i in channels) {
        var channel_id=channels[i].id
        console.log('dispatcher.js::getUserSubscriptions - in order', channel_id);
        min_id=Math.min(channel_id, min_id);
        max_id=Math.max(channel_id, max_id);
        params.tokenobj.subscribedOpt=true;
        // channel, params, tokenObj, callback, meta
        ref.channelToAPI(channels[i], params, params.tokenobj, function(channel, cErr) {
          //apis.push(channel);
          apis[channel.id]=channel;
          count++;
          if (count == channels.length) {
            var nlist=[];
            for(var i in channels) {
              //console.log('dispatcher.js::getUserSubscriptions - out order', channels[i].id);
              nlist.push(apis[channels[i].id]);
            }
            callback(nlist, err || cErr, { code: 200, min_id: min_id,
              max_id: max_id, more: false});
          }
        });
      }
      */
    });
  },
  /**
   * get subscriptions for specified channel id
   * @param {number} channelid - the id of channel you're requesting
   * @param {object} param - user formatting options
   * @param {metaCallback} callback - function to call after completion
   */
  getChannelSubscriptions: function(channelid, params, callback) {
    var ref = this;
    this.cache.getChannelSubscriptions(channelid, params, function(subs, err, meta) {
      var list = [];
      for(var i in subs) {
        var sub = subs[i].userid;
        // FIXME: remove N+1
        ref.getUser(sub, params, function(user, uErr, uMeta) {
          list.push(user);
          if (list.length == subs.length) {
            callback(list, '', meta);
          }
        })
      }
    });
  },
  //
  // stream_marker
  //
  /**
   * add/update stream marker
   * @todo spec out proper prototype
   * @todo implement function
   * @param {object} data - stream marker data object
   */
  setStreamMarkerdata: function(data) {
    console.log('dispatcher.js::setStreamMarkerdata - write me!');
    if (callback) {
      callback(null, null);
    }
  },
  //
  // user token
  //
  // so we need access to the session store
  // or some way to get context
  getAppCallbacks: function(client_id, client_secret, callback) {
    this.cache.getAppCallbacks(client_id, client_secret, callback);
  },
  /**
   * get current context user token
   * @param {metaCallback} callback - function to call after completion
   */
  getToken: function(userid, client_id, callback) {
    // we could lookup unique token by userid/client_id
    // dummy token
    this.getUser(userid, null, function(user, err) {
      var token={
        app: {
          client_id: client_id,
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
        user: user,
        "invite_link": "https://join.app.net/from/notareallink"
      };
      //console.log('dispatcher::getToken - ', token);
      callback(token, null);
    });
  },
  getUserClientByToken: function(token, callback) {
    //console.log('dispatcher::getUserClientByToken', token);
    this.cache.getAPIUserToken(token, callback);
  },
  /**
   * add/update user token
   * @param {number} userid - owner of token
   * @param {string} client_id - client token is for
   * @param {array} scopes - token scope
   * @param {string} token - upstream token
   */
  // FIXME: store downstream token, so we can look it up later!
  setToken: function(userid, client_id, scopes, token, callback) {
    // function(userid, client_id, scopes, token, callback)
    this.cache.addAPIUserToken(userid, client_id, scopes, token, callback);
  },
  createOrFindToken: function(userid, client_id, scopes, token, callback) {
    // function(userid, client_id, scopes, token, callback)
    this.cache.createOrFindUserToken(userid, client_id, scopes, token, callback);
  },
  setUpstreamToken: function(userid, token, scopes, callback) {
    this.cache.setUpstreamUserToken(userid, token, scopes, callback);
  },
  //
  // star (interaction)
  //
  // id is meta.id, not sure what this is yet
  addStar: function(postid, token, callback) {
    var ref=this
    // supposed to return post
    this.cache.addStar(postid, token, function() {
      ref.getPost(postid, {}, callback)
    });
  },
  delStar: function(postid, token, callback) {
    this.cache.delStar(postid, token, callback);
  },
  /**
   * add/update star
   * @param {object} data - stream star object
   * @param {boolean} deleted - star/unstar
   * @param {number} ts - timestamp of event
   * @param {metaCallback} callback - function to call after completion
   */
  setStar: function(data, deleted, id, ts, callback) {
    // and what if the posts doesn't exist in our cache?
    // update post
    // yea, there was one post that didn't has post set
    if (data && data.post) {
      this.setPost(data.post);
    }
    // update user record
    if (data && data.user && data.user.username) {
      this.updateUser(data.user, ts);
    }
    // create/update star
    if (data) {
      // we don't need source user because that'll be in the post
      // though maybe able to remove a look up if we pass it
      this.cache.setInteraction(data.user.id, data.post.id, 'star', id, deleted, ts, callback);
    } else {
      if (deleted) {
        this.cache.setInteraction(0, 0, 'star', id, deleted, ts, callback);
      } else {
        console.log('dispatcher.js::setStar - Create empty?');
        if (callback) {
          callback(null, null);
        }
      }
    }
    if (this.notsilent) {
      process.stdout.write(deleted?'_':'*');
    }
  },
  /**
   * get interactions from data access
   * @param {metaCallback} callback - function to call after completion
   */
  getInteractions: function(userid, tokenObj, params, callback) {
    //console.log('getInteractions - ', userid, typeof(tokenObj), typeof(params), typeof(callback));
    var ref=this;
    params.tokenobj = tokenObj
    // FIXME: why do we need this getUser call?
    // is this just used to normalize the userid?
    // it's to insert ourselves as a receiver of actions
    this.getUser(userid, params, function(user, err) {
      // o(3) maybe 4 if toApi
      //console.log('getInteractions - gotUser');
      // was base class getting in the way
      //console.log('getInteractions - calling', userid, params, tokenObj);
      ref.cache.getNotices(userid, params, tokenObj, function(notices, err) {
        //console.log('dispatcher.js::getInteractions - gotNotice', notices.length);

        // actionuserid <= may have to look this up too
        // look up: notice.postid => post
        // look up: post.user.id => post.user
        // we can roll up multiple entries for same type and post objects
        if (!notices.length) {
          callback([], err);
          return;
        }
        var interactions={};
        // we need to maintain the order of the result set
        function resortReturn(interactions, err) {
          //console.log('dispatcher.js::getInteractions - resortReturn');
          var res=[];
          for(var i in notices) {
            var id=notices[i].id;
            if (interactions[id]) {
              res.push(interactions[id]);
            } else {
              console.log('cant find', id, 'in', interactions);
            }
          }
          //console.log('dispatcher.js::getInteractions - calling back');
          callback(res, err);
        }
        var count=0;
        for(var i in notices) {
          var notice=notices[i];
          var scope=function(notice) {
            if (notice.type==='follow') {
              // follow, look up user
              // if we use use the dispatcher one then we don't need to conver it
              //typeid is who was followed
              // but it would be action user followed typeid
              ref.getUser(notice.actionuserid, { tokenobj: tokenObj }, function(fuser, err) {
                if (!fuser) {
                  fuser={
                    id: 0,
                    username: 'deleteduser',
                    created_at: '2014-10-24T17:04:48Z',
                    avatar_image: {
                      url: 'https://cdn.discordapp.com/icons/235920083535265794/a0f48aa4e45d17d1183a563b20e15a54.png'
                    },
                    cover_image: {
                      url: 'https://cdn.discordapp.com/icons/235920083535265794/a0f48aa4e45d17d1183a563b20e15a54.png'
                    },
                    counts: {
                      following: 0,
                    }
                  };
                }
                interactions[notice.id]={
                    "event_date": notice.event_date,
                    "action": 'follow',
                    "objects": [
                      user
                    ],
                    "users": [
                      fuser
                    ],
                    "pagination_id": notice.id
                };
                count++;
                if (count==notices.length) {
                  //console.log('dispatcher.js::getInteractions - resortReturn');
                  resortReturn(interactions, err);
                }
              });
            } else {
              // probably a star
              // not follow, look up post
              // if we use use the dispatcher one then we don't need to conver it
              ref.getUser(notice.actionuserid, { tokenobj: tokenObj }, function(auser, err) {
                ref.getPost(notice.typeid, {}, function(post, err) {
                  interactions[notice.id]={
                      "event_date": notice.event_date,
                      "action": notice.type,
                      "objects": [
                        post
                      ],
                      "users": [
                        auser
                      ],
                      "pagination_id": notice.id
                  };
                  if (notice.altnum) {
                    ref.getPost(notice.altnum, {}, function(post2, err) {
                      interactions[notice.id].objects.push(post2)
                      count++;
                      if (count==notices.length) {
                        //console.log('dispatcher.js::getInteractions - resortReturn');
                        resortReturn(interactions, err);
                      }
                    })
                  } else {
                    count++;
                    if (count==notices.length) {
                      //console.log('dispatcher.js::getInteractions - resortReturn');
                      resortReturn(interactions, err);
                    }
                  }
                });
              });
            }
          }(notice);
        }
        //console.log('getInteractions - done');
        //callback(interactions, err);
      });
    });
  },
  getInteractions2: function(userid, token, params, callback) {
    // probably will needs params
    // if each returns 0-count, that should be more than enough to fulfill count
    // 4xcount but let's say we get less than count, that means there isn't the data
    // so we can't provide more
    var interactions=[]; // [ts, {}]
    // get a list of interactions for this user
    // interactions are follows = users
    // stars, reposts, reply = posts
    // welcome will be empty
    // broadcast_create, broadcast_subscribe, broadcast_subscribe will be channels
    // build a list sorted by timestamp
    var ref=this;
    var done_follows=0;
    var done_stars=0;
    var done_reposts=0;
    var done_replies=0;
    //var list=[]; // (timestamp, action, objects, users)
    var sent=0;
    var checkdone=function() {
      if (sent) return;
      var list=followlist.concat(starlist).concat(repostlist).concat(replieslist);
      console.log('dispatcher.js::getInteractions check', done_follows, done_stars, done_reposts, done_replies, 'items', list.length);
      if (done_follows && done_stars && done_reposts && done_replies) {
        //console.log('dispatcher.js::getInteractions done');
        sent=1; // sent lock
        //ref.getUser(userid, null, function(self, err) {
          //console.log('self');
          /*
          ref.getUser(2, null, function(actor, err) {
            //console.log('berg');
            var interaction={
                "action": "follow",
                "event_date": "2012-07-16T17:23:34Z",
                "objects": [
                  self
                ],
                "users": [
                  actor
                ]
            };
            // pagination_id
            //console.log('sending back');
            callback([interaction], null);
          });
          */
          // since we only need count (20)
          // let's only do the getUser here
          var interactions=[];
          console.log('dispatcher.js::getInteractions - list len',list.length);
          // so the way node works is that if we have 900 items
          // we have to issue all 900 items before we'll get one response
          for(var i in list) {
            if (i>20) break;
            // yield and then run this
            //setImmediate(function() {
              ref.getUser(list[i][3], null, function(fuser, err) {
                var interaction={
                    "event_date": list[i][0],
                    "action": list[i][1],
                    "objects": [
                      list[i][2]
                    ],
                    "users": [
                      fuser
                    ]
                };
                //console.log(interaction.objects,interaction.users);
                interactions.push(interaction);
                console.log('i',i,'len',interactions.length);
                if (interactions.length==list.length || interactions.length==20) {
                  // 16-70s on 54posts 0 followers
                  console.log('sending');
                  callback(interactions, null);
                }
              });
            //});
          }
          console.log('for is done, waiting on getUser');
          //console.log('sending',interactions.length);
          //callback(interactions, null);
        //});
      }
    }
    // follows
    var followlist=[]
    var followexpect=0;
    // only need the most recent 20 follows
    console.log('getting followers for', userid);
    // lookup self first, and then get down to business
    this.getUser(userid, null, function(user, err) {
      ref.cache.getFollows(userid, { count: 20 }, function(follows, err) {
        if (!follows.length) {
          done_follows=1;
          checkdone();
        } else {
          for(var i in follows) {
            var follow=follows[i];
            if (follow.active) {
              followexpect++;
              done_follows=0;
              //console.log('expecting',followexpect);
              //ref.getUser(follow.userid, null, function(fuser, err) {
                followlist.push([follow.last_updated, 'follow', user, follow.userid])
                //console.log('got',followlist.length,'vs',followexpect);
                if (followlist.length==followexpect) {
                  // move it into the main list
                  done_follows=1;
                  checkdone();
                }
              //});
            }
          }
          if (followexpect===0) {
            console.log('no active followers');
            done_follows=1;
          }
          checkdone();
        }
      });
    });
    // stars
    var starlist=[]
    // not that I starred a post...
    /*
    this.cache.getInteractions('star', userid, { count: 20 }, function(stars, err) {
      if (!stars.length) {
        done_stars=1;
      } else {
        for(var i in stars) {
          var star=stars[i];
          ref.getUser(userid, null, function(user, err) {
            ref.getPost(star.typeid, null, function(post, err) {
              starlist.push([star.datetime, 'star', post, user])
              console.log('*i',i,'vs',stars.length,'vs',starlist.length,'starlist');
              if (starlist.length==stars.length) {
                // move it into the main list
                done_stars=1;
                checkdone();
              }
            });
          });
        }
      }
      checkdone();
    });
    */
    var repostlist=[]
    var replieslist=[]
    // can't count 20, we want any activity on all our posts
    this.getUserPosts(userid, { }, function(posts, err) {
      if (!posts.length) {
        console.log('no posts');
        done_reposts=1;
        done_replies=1;
        done_stars=1;
        checkdone();
        return;
      }
      var repostcount=0;
      var replycount=0;
      var starcount=0;
      var postrepostcalls=0;
      var postreplycalls=0;
      var poststarcalls=0;
      console.log('posts', posts.length);
      var postcalls=0;
      for(var i in posts) {
        var post=posts[i];
        // skip delete posts...
        if (post.deleted) continue;
        postcalls++;
        // reposts
        // get a list of all my posts, did any of them were a repost_of
        // up to 20 reposts (as long as their reposts replies)
        ref.cache.getReposts(post.id, { count: 20 }, token, function(reposts, err) {
          /*
          if (!reposts.length) {
            console.log('well no reposts, let\'s check on things. posts: ',postcalls,'postrepostcalls',postrepostcalls);
          }
          */
            //done_reposts=1;
          //} else {
          repostcount+=reposts.length;
          for(var j in reposts) {
            var repost=reposts[j];
            //ref.getUser(repost.userid, null, function(ruser, err) {
              repostlist.push([repost.created_at, 'repost', post, repost.userid])
              //console.log('Pi',i,'vs',posts.length);
              console.log('repost check',repostlist.length,'vs',repostcount,'repostcalls',postrepostcalls,'/',postcalls);
              if (repostlist.length==repostcount && postcalls==postrepostcalls) {
                // move it into the main list
                // we're hitting this early
                done_reposts=1;
                checkdone();
              }
            //});
          }
          postrepostcalls++;
          if (postrepostcalls==postcalls) {
            // we're done, there maybe repostcount outstanding, let's check
            console.log('repost done, count:',repostcount,'done:',repostlist.length);
            // if we never requested anything, then we're done
            if (!repostcount || repostcount==repostlist.length) {
              done_reposts=1;
              checkdone();
            }
          }
          //}
        });
        // replys
        // get a list of all my posts, reply_to
        //console.log('Calling getReplies');
        // up to 20 replies (as long as their recent replies)
        ref.cache.getReplies(post.id, { count: 20 }, token, function(replies, err) {
          //if (!replies.length) {
            //done_replies=1;
          //} else {
          replycount+=replies.length;
          for(var j in replies) {
            var reply=replies[j];
            //ref.getUser(reply.userid, null, function(ruser, err) {
              replieslist.push([reply.created_at, 'reply', post, reply.userid])
              //console.log('Li',i,'vs',posts.length);
              console.log('reply check',replieslist.length,'vs',replycount,'replycalls',postreplycalls,'/',postcalls);
              if (replieslist.length==replycount && postcalls==postreplycalls) {
                // move it into the main list
                done_replies=1;
                checkdone();
              }
            //});
          }
          //console.log('uWotM8?',postreplycalls,'/',postcalls);
          postreplycalls++;
          if (postreplycalls==postcalls) {
            // we're done, there maybe repostcount outstanding, let's check
            console.log('reply done, count:',replycount,'done:',replieslist.length);
            // if we never requested anything, then we're done
            if (!replycount || replycount==replieslist.length) {
              done_replies=1;
              checkdone();
            }
          }
          //}
        });
        // get people that have starred your posts
        // up to 20 stars (as long as their recent stars)
        ref.cache.getPostStars(post.id, { count: 20 }, function(starredposts, err) {
          starcount+=starredposts.length;
          for(var j in starredposts) {
            var starpost=starredposts[j];
            //ref.getUser(starpost.userid, null, function(ruser, err) {
              starlist.push([starpost.created_at, 'star', post, starpost.userid])
              //console.log('Li',i,'vs',posts.length);
              console.log('star check',starlist.length,'vs',starcount,'starscalls',poststarcalls,'/',postcalls);
              if (starlist.length==starcount && postcalls==poststarcalls) {
                // move it into the main list
                done_stars=1;
                checkdone();
              }
            //});
          }
          poststarcalls++;
          if (poststarcalls==postcalls) {
            // we're done, there maybe repostcount outstanding, let's check
            console.log('star done, count:',starcount,'done:',starlist.length);
            // if we never requested anything, then we're done
            if (!starcount || starcount==starlist.length) {
              done_stars=1;
              checkdone();
            }
          }
        });
      }
      console.log('postcalls',postcalls);
      console.log('counts',repostcount,replycount);
      if (!postcalls) {
        // if no valid posts to inspect, we're done
        done_reposts=1;
        done_replies=1;
        done_stars=1;
      } else {
        // if post checks are done and there's no repostcost, then it's done
        // do we even need these? if there are psts, we deal with it in the replycount
        console.log('postcalls',postcalls);
        console.log('reposts',postrepostcalls,'counts',repostcount,replycount);
        console.log('replies',postreplycalls,'counts',replycount);
        console.log('stars',poststarcalls,'counts',starcount);
        //if (postcalls==postrepostcalls && !repostcount) done_reposts=1;
        //if (postcalls==postreplycalls && !replycount) done_reposts=1;
        //if (postcalls==poststarcalls && !starcount) done_stars=1;
      }
      checkdone();
    }); // getUserPosts
  },
  //
  // mute
  //
  /** @todo mute */
  //
  // block
  //
  /** @todo block */
  //
  // user
  //
  /**
   * add/update user object
   * @param {object} data - user stream object
   * @param {number} ts - timestamp of event
   * @param {metaCallback} callback - function to call after completion
   */
  updateUser: function(data, ts, callback) {
    if (!data) {
      console.log('dispatcher.js:updateUser - data is missing', data);
      callback(null, 'data is missing');
      return;
    }
    if (!data.id) {
      console.log('dispatcher.js:updateUser - id is missing', data);
      callback(null, 'id is missing');
      return;
    }
    // FIXME: current user last_updated
    var ref=this;
    if (data.annotations) {
      console.log('dispatcher.js:updateUser - hasNotes, userid', data.id, 'notes', data.annotations, 'full', data)
      // FIXME: only updated annotation if the timestamp is newer than we have
      this.setAnnotations('user', data.id, data.annotations);
    }
    // fix api/stream record in db format
    this.apiToUser(data, function(userData) {
      //console.log('made '+data.created_at+' become '+userData.created_at);
      // can we tell the difference between an add or update?
      //console.log('dispatcher.js::updateUser - final', userData)
      ref.cache.setUser(userData, ts, function(user, err, meta) {
        // TODO: define signal if ts is old
        if (callback) {
          callback(user, err, meta);
        }
      });
    });
    /*
    userData.username=data.username.toLowerCase(); // so we can find it
    userData.created_at=new Date(data.created_at); // fix incoming created_at iso date to Date
    // if there isn't counts probably a bad input
    if (data.counts) {
      userData.following=data.counts.following;
      userData.followers=data.counts.followers;
      userData.posts=data.counts.posts;
      userData.stars=data.counts.stars;
    }
    // set avatar to null if is_default true
    userData.avatar_width=data.avatar_image.width;
    userData.avatar_height=data.avatar_image.height;
    userData.avatar_image=data.avatar_image.url;
    userData.cover_width=data.cover_image.width;
    userData.cover_height=data.cover_image.height;
    userData.cover_image=data.cover_image.url;

    if (data.description) {
      //console.log('user '+data.id+' has description', data.description.entities);
      if (data.description.entities) {
        //console.log('user '+data.id+' has entities');
        this.setEntities('user', data.id, data.description.entities, function(entities, err) {
          if (err) {
            console.log("entities Update err: "+err);
          //} else {
            //console.log("entities Updated");
          }
        });
      }
      // cache html version
      userData.descriptionhtml=data.description.html;
      // since userData is a reference to data, we can't stomp on it until we're done
      userData.description=data.description.text;
    }
    */

    if (this.notsilent) {
      process.stdout.write('U');
    }
  },
  patchUser: function(request, params, tokenObj, callback) {
    /*
        name: req.body.name,
        locale: req.body.locale,
        timezone: req.body.timezone,
        description: req.body.description,
    */
    var changes={};
    if (request.name!==undefined) changes.name=request.name;
    if (request.locale!==undefined) changes.locale=request.locale;
    if (request.timezone!==undefined) changes.timezone=request.timezone;
    if (request.description!==undefined) {
      if (request.description.text) changes.description=request.description.text;
      if (request.description.html) changes.descriptionhtml=request.description.html;
    }
    //console.log("dispatcher.js::patchUser - user", tokenObj.userid, 'changes', changes);
    // params we'd have to pay attention to:
    // include_annotations, include_user_annotations, include_html
    var ref=this;
    if (request.annotations) {
      console.log('dispatcher.js::patchUser - annotations', request.annotations);
      this.setAnnotations('user', tokenObj.userid, request.annotations);
    }
    this.cache.patchUser(tokenObj.userid, changes, function(user, err, meta) {
      if (callback) {
        ref.userToAPI(user, tokenObj, function(apiUser, apiErr, apiMeta) {
          callback(apiUser, apiErr, apiMeta);
        }, meta);
      }
    });
  },
  // destructive to user
  // to database format
  apiToUser: function(user, callback) {
    // collapse API to db structure
    // copy what we can without linking to the orignal, so we don't destroy
    var userData=JSON.parse(JSON.stringify(user));
    if (user.username === undefined) {
      console.log('dispatcher::apiToUser - user', user.id, 'doesnt have a username', user)
      user.username = ''
    }
    userData.username=user.username.toLowerCase(); // so we can find it
    userData.created_at=new Date(user.created_at); // fix incoming created_at iso date to Date
    // if there isn't counts probably a bad input
    if (user.counts) {
      userData.following=user.counts.following;
      userData.followers=user.counts.followers;
      userData.posts=user.counts.posts;
      userData.stars=user.counts.stars;
    }
    if (user.avatar_image === undefined) {
      console.log('dispatcher::apiToUser - user', user.id, 'doesnt have a avatar_image', user)
      user.avatar_image = {}
    }
    // set avatar to null if is_default true
    userData.avatar_width=user.avatar_image.width;
    userData.avatar_height=user.avatar_image.height;
    userData.avatar_image=user.avatar_image.url;
    if (user.cover_image === undefined) {
      console.log('dispatcher::apiToUser - user', user.id, 'doesnt have a cover_image', user)
      user.cover_image = {}
    }
    userData.cover_width=user.cover_image.width;
    userData.cover_height=user.cover_image.height;
    userData.cover_image=user.cover_image.url;

    if (user.description) {
      //console.log('user '+data.id+' has description', data.description.entities);
      if (user.description.entities) {
        //console.log('user '+data.id+' has entities');
        this.setEntities('user', user.id, user.description.entities, function(entities, err) {
          if (err) {
            console.log("entities Update err: "+err);
          //} else {
            //console.log("entities Updated");
          }
        });
      }
      // cache html version
      userData.descriptionhtml=user.description.html;
      // since userData is a reference to data, we can't stomp on it until we're done
      userData.description=user.description.text;
    }
    callback(userData, null);
    //return userData;
  },
  // from internal database format
  userToAPI: function(user, token, callback, meta) {
    //console.log('dispatcher.js::userToAPI - '+user.id, callback, meta);
    if (!user) {
      callback(null, 'dispatcher.js::userToAPI - no user passed in');
      return;
    }
    if (!callback) {
      callback(null, 'dispatcher.js::userToAPI - no callback passed in');
      return;
    }
    //console.log('dispatcher.js::userToAPI - setting up res');
    // copy user structure
    var res={
      id: user.id,
      username: user.username,
      created_at: new Date(user.created_at),
      canonical_url: user.canonical_url,
      type: user.type,
      timezone: user.timezone,
      locale: user.locale,
      avatar_image: {
        url: user.avatar_image,
        width: user.avatar_width,
        height: user.avatar_height,
        is_default: user.avatar_image==''?true:false,
      },
      cover_image: {
        url: user.cover_image,
        width: user.cover_width,
        height: user.cover_height,
        is_default: user.cover_image==''?true:false,
      },
      counts: {
        following: user.following,
        posts: user.posts,
        followers: user.followers,
        stars: user.stars,
      }
    };
    if (user.description) {
      res.description={
        text: user.description,
        html: user.description,
        entities: {
          mentions: [],
          hashtags: [],
          links: []
        }
      };
    }
    // conditionals
    if (user.name) {
      res.name=user.name; // 530 was cast as a int
    }
    if (user.verified_domain) {
      res.verified_domain=user.verified_domain;
      // alpha needs this and the dev doesn't seem to cover it
      res.verified_link='http://'+user.verified_domain;
    }

    if (user.description && !res.description) {
      console.log('dispatcher.js::userToAPI - sanity check failure...');
    }

    var need = {
      annotation: false,
      tokenFollow: false,
    }

    function needComplete(type) {
      need[type] = false;
      // if something is not done
      //console.log('dispatcher.js::userToAPI - checking if done, just finished', type);
      for(var i in need) {
        if (need[i]) {
          if (user.debug) console.log('dispatcher.js::userToAPI('+user.id+') -', i, 'is not done');
          return;
        }
      }
      // , res, meta
      if (user.debug) console.log('dispatcher.js::userToAPI ('+user.id+') - done');
      //console.log('dispatcher.js::userToAPI - done, text', data.text);
      // everything is done
      reallyDone();
      //callback(data, null, meta);
    }

    var ref=this;
    function reallyDone() {
      // final peice
      if (user.description) {
        // use entity cache?
        if (1) {
          //console.log('dispatcher.js::userToAPI - getEntities '+user.id);
          ref.getEntities('user', user.id, function(userEntities, userEntitiesErr, userEntitiesMeta) {
            copyentities('mentions', userEntities.mentions, res.description);
            copyentities('hashtags', userEntities.hashtags, res.description);
            copyentities('links', userEntities.links, res.description);
            // use html cache?
            if (1) {
              if (res.description) {
                res.description.html=user.descriptionhtml;
              } else {
                console.log('dispatcher.js::userToAPI - what happened to the description?!? ', user, res);
              }
              if (user.debug) console.log('dispatcher.js::userToAPI('+user.id+') - calling back');
              callback(res, userEntitiesErr);
            } else {
              // you can pass entities if you want...
              // text, entities, postcontext, callback
              ref.textProcess(user.description, users.entities, false, function(textProc, err) {
                res.description.html=textProc.html;
                callback(res, userEntitiesErr);
              });
            }
          });
        } else {
          //console.log('dispatcher.js::userToAPI - textProcess description '+user.id);
          //console.log('dispatcher.js::userToAPI - calling back', res);
          ref.textProcess(user.description, user.entities, false, function(textProc, err) {
            res.description.html=textProc.html;
            res.description.entities=textProc.entities;
            callback(res, null);
          });
        }
      } else {
        //console.log('dispatcher.js::userToAPI - calling back', res);
        callback(res, null);
      }
    }

    if (user.annotations) {
      if (user.debug) console.log('dispatcher.js::userToAPI('+user.id+') - need user annotations');
      need.annotation = true;
      var loadAnnotation=function(user, cb) {
        if (user.debug) console.log('dispatcher.js::userToAPI('+user.id+') - get user annotations');
        ref.getAnnotation('user', user.id, function(dbNotes, err, noteMeta) {
          if (user.debug) console.log('user', user.id, 'annotations', dbNotes.length);
          var apiNotes=[];
          for(var j in dbNotes) {
            var note=dbNotes[j];
            //console.log('got note', j, '#', note.type, '/', note.value, 'for', user.id);
            apiNotes.push({
              type: note.type,
              value: note.value,
            });
          }
          cb(apiNotes, err, noteMeta);
        });
      }

      loadAnnotation(user, function(apiNotes, notesErr, notesMeta) {
        if (notesErr) console.log('dispatcher.js::userToAPI - loadAnnotation', notesErr);
        if (user.debug) console.log('final anno', apiNotes.length)
        res.annotations=apiNotes;
        needComplete('annotation')
      });
      //res.annotations = user.annotations
    }

    if (token && token.userid) {
      need.tokenFollow = true;
      //console.log('dispatcher.js::userToAPI - need tokenFollow');
      // follows_you
      // you_follow
      this.cache.follows(token.userid, user.id, function(following, err) {
        //console.log('do we follow this guy?', following, 'err', err);
        if (following && following.active) {
          //console.log('flagging as followed');
          res.you_follow=true;
        }
        //reallyDone();
        needComplete('tokenFollow')
      });
    } else {
      //reallyDone();
      needComplete('tokenFollow')
    }
  },
  getUser: function(user, params, callback) {
    //console.log('dispatcher.js::getUser - '+user, params);
    if (!callback) {
      console.error('dispatcher.js::getUser - no callback passed in');
      return;
    }
    if (!user) {
      callback(null, 'dispatcher.js::getUser - no getUser passed in');
      return;
    }
    if (params===null) {
      console.log('dispatcher.js::getUser - params are null');
      params={
        generalParams: {},
        tokenobj: {}
      };
    }
    //console.log('dispatcher.js::getUser - params', params);
    var ref=this;
    normalizeUserID(user, params.tokenobj, function(userid, err) {
      if (err) {
        console.log('dispatcher.js::getUser - cant normalize user', user, err);
      }
      if (!userid) userid = 0 // don't break caminte
      ref.cache.getUser(userid, function(userobj, userErr, userMeta) {
        if (userErr) {
          console.log('dispatcher.js::getUser - cant get user', userid, userErr);
        }
        if (userobj && params.generalParams) {
          // FIXME: temp hack (until we can change the userToAPI prototype)
          userobj.annotations = params.generalParams.annotations || params.generalParams.user_annotations
        //} else {
          //console.log('dispatcher.js::getUser - not such user?', userid, 'or no generalParams?', params)
        }
        //console.log('found user', userobj.id, '==', user)
        if (params.debug) userobj.debug = true
        ref.userToAPI(userobj, params.tokenobj, callback, userMeta);
      });
    })
    /*
    if (user=='me') {
      //console.log('getUser token', params.tokenobj);
      if (params.tokenobj) {
        console.dir(params.tokenobj);
        this.cache.getUser(params.tokenobj.userid, function(userobj, userErr, userMeta) {
          //console.log('dispatcher.js::getUser - gotUser', userErr);
          ref.userToAPI(userobj, params.tokenobj, callback, userMeta);
        });
      } else {
        this.getUserClientByToken(params.token, function(usertoken, err) {
          if (usertoken==null) {
            console.log('dispatcher.js::getUser - me but not token');
            callback(null, 'dispatcher.js::getUser - me but not token');
            return;
          } else {
            ref.cache.getUser(usertoken.userid, function(userobj, userErr, userMeta) {
              //console.log('dispatcher.js::getUser - gotUser', userErr);
              ref.userToAPI(userobj, params.token, callback, userMeta);
            });
          }
        });
      }
    } else {
      var func='getUser';
      // make sure we check the cache
      if (user[0]=='@') {
        func='getUserID';
        // strip @ from beginning
        user=user.substr(1);
      }
      //console.log('dispatcher.js::getUser - calling', func);
      this.cache[func](user, function(userobj, userErr, userMeta) {
        //console.log('dispatcher.js::getUser - gotUser', userErr);
        ref.userToAPI(userobj, params.tokenobj, callback, userMeta);
      });
    }
    */
  },
  // NOTE: users has to be an array!
  getUsers: function(users, params, callback) {
    //console.log('dispatcher.js::getUsers - '+user, params);
    if (!callback) {
      console.log('dispatcher.js::getUsers - no callback passed in');
      return;
    }
    if (!users) {
      callback(null, 'dispatcher.js::getUsers - no getUser passed in');
      return;
    }
    if (params===null) {
      console.log('dispatcher.js::getUsers - params are null');
      params={
        tokenobj: {}
      };
    }

    var ref=this;
    /*
    this.cache.getUsers(users, params, function(userObjs, userErr, meta) {
      if (!userObjs.length) {
        callback([], null, meta);
        return;
      }
      var rUsers=[]
      for(var i in userObjs) {
        ref.userToAPI(userObjs[i], params.tokenobj, function(adnUserObj, err) {
          //console.log('dispatcher.js::getUsers - got', adnUserObj, 'for', users[i])
          rUsers.push(adnUserObj)
          if (rUsers.length==users.length) {
            callback(rUsers, null, meta);
          }
        }, meta);
      }
    });
    */
    //console.log('dispatcher.js::getUsers - calling', func);
    var rUsers=[]
    //console.log('dispatcher.js::getUsers - users', users);
    for(var i in users) {
      //console.log('dispatcher.js::getUsers - user', users[i]);
      normalizeUserID(users[i], params.tokenobj, function(userid, err) {
        ref.cache.getUser(userid, function(userobj, userErr, userMeta) {
          //console.log('dispatcher.js::getUsers - gotUser', userErr);
          ref.userToAPI(userobj, params.tokenobj, function(adnUserObj, err) {
            //console.log('dispatcher.js::getUsers - got', adnUserObj, 'for', users[i])
            rUsers.push(adnUserObj)
            if (rUsers.length==users.length) {
              callback(rUsers, '');
            }
          }, userMeta);
        });
      });
    }
  },
  userSearch: function(query, params, tokenObj, callback) {
    var ref=this;
    this.cache.searchUsers(query, params, function(users, err, meta) {
      //console.log('dispatcher.js::userSearch - got', users.length, 'users')
      if (!users.length) {
        callback([], null, meta);
        return;
      }
      var rUsers=[]
      for(var i in users) {
        ref.userToAPI(users[i], tokenObj, function(adnUserObj, err) {
          //console.log('dispatcher.js::userSearch - got', adnUserObj, 'for', users[i])
          rUsers.push(adnUserObj)
          if (rUsers.length==users.length) {
            //console.log('dispatcher.js::userSearch - final', rUsers)
            callback(rUsers, null, meta);
          }
        }, meta);
      }
    });
  },
  /** user_follow */
  setFollows: function(data, deleted, id, ts, callback) {
    //console.log('dispatcher.js::setFollows - data', data);
    // data can be null
    if (data) {
      //console.log('dispatcher.js::setFollows - has data');
      // update user object
      // so we need the username check
      // because user/ID/follow calls this without looking up the complete user
      if (data.user && data.user.username) {
        this.updateUser(data.user, ts);
      //} else {
        //console.log('dispatcher.js::setFollows - no user', data);
      }
      // update user object
      if (data.follows_user && data.follows_user.username) {
        this.updateUser(data.follows_user, ts);
      //} else {
        //console.log('dispatcher.js::setFollows - no follows_user', data);
      }
      // set relationship status
      //console.log('dispatcher.js::setFollows - has data', data.user.id, data.follows_user.id, id, deleted, ts);
      this.cache.setFollow(data.user.id, data.follows_user.id, id, deleted, ts);
    } else {
      // likely deleted is true in this path
      this.cache.setFollow(0, 0, id, deleted, ts);
    }
    if (this.notsilent) {
      process.stdout.write(deleted?'f':'F');
    }
    if (callback) {
      this.getUser(data.follows_user.id, null, function(user, err) {
        callback(user, err);
      });
    }
  },
  getFollowings: function(user, params, tokenObj, callback) {
    //console.log('dispatcher.js::getFollowing - for', userid);
    var ref=this;
    normalizeUserID(user, tokenObj, function(userid) {
      ref.cache.getFollowing(userid, params, function(follows, err, meta) {
        if (err || !follows || !follows.length) {
          callback([], err);
          return;
        }
        var users=[]
        //console.log('dispatcher.js::getFollowing', follows.length);
        var min_id = 9999;
        var max_id = 0;
        for(var i in follows) {
          min_id=Math.min(min_id, follows[i].id);
          max_id=Math.max(max_id, follows[i].id);
          var scope=function(i) {
            ref.getUser(follows[i].followsid, { tokenobj: tokenObj }, function(user, err) {
              if (err) {
                console.error('dispatcher.js::getFollowers - err', err);
              }
              if (!user) {
                console.log('dispatcher.js::getFollowers - empty user gotten for', follows[i].userid);
                user = {} // fix it so setting pagination doesn't crash
              }
              /*
              if (!user.avatar_image.url) {
                user.avatar_image.url='http://cdn.discordapp.com/icons/235920083535265794/a0f48aa4e45d17d1183a563b20e15a54.png';
                user.avatar_image.height=128;
                user.avatar_image.width=128;
              }
              */
              //console.log('dispatcher.js::getFollowing - adding user', user);
              // alpha needs this dummy wrapper
              // but it's against spec
              /*
              var obj={
                id: 0,
                text: 'alpha hack',
                created_at: '2014-10-24T17:04:48Z',
                source: {

                },
                user: user
              }
              */
              user.pagination_id = follows[i].id;
              users.push(user);
              if (users.length==follows.length) {
                // supposed to return meta too
                var imeta={
                  code: 200,
                  min_id: min_id,
                  max_id: max_id,
                  more: users.length==params.count
                };
                callback(users, err, imeta);
              }
            })
          }(i);
        }
      });
    });
  },
  getFollowers: function(user, params, tokenObj, callback) {
    //console.log('dispatcher.js::getFollowers - for', userid);
    var ref=this;
    normalizeUserID(user, tokenObj, function(userid) {
      ref.cache.getFollows(userid, params, function(follows, err, meta) {
        if (err || !follows || !follows.length) {
          if (err) console.error('dispatcher::getFollowers', err);
          callback([], err);
          return;
        }
        var users=[]
        //console.log('dispatcher.js::getFollowers', follows.length);
        for(var i in follows) {
          ref.getUser(follows[i].userid, { tokenobj: tokenObj }, function(user, err) {
            if (err) {
              console.error('dispatcher.js::getFollowers - err', err);
            }
            if (!user) {
              console.log('dispatcher.js::getFollowers - empty user gotten for', follows[i].userid);
            }
            //console.log('dispatcher.js::getFollowers - adding user', user);
            // alpha needs this dummy wrapper
            // but it's against spec
            /*
            var obj={
              id: 0,
              text: 'alpha hack',
              created_at: '2014-10-24T17:04:48Z',
              source: {

              },
              user: user
            }
            */
            users.push(user);
            //console.log('dispatcher.js::getFollowers - users', users.length, 'follows', follows.length);
            if (users.length==follows.length) {
              // supposed to return meta too
              callback(users, err, meta);
            }
          })
        }
      });
    });
  },
  /** mutes */
  //req.params.user_id, req.apiParams, req.usertoken, callbacks.dataCallback(resp)
  getMutes: function(userids, params, tokenObj, callback) {
    var ref = this;
    var userid = userids;
    if (userids == 'me') {
      userid = tokenObj.userid;
    }
    this.cache.getMutes(userid, params, function(mutes, err, meta) {
      if (!mutes.length) {
        callback([], err, meta);
        return;
      }
      var userMutes = [];
      for(var i in mutes) {
        var userid = mutes[i].muteeid;
        // strip paging out params but leave includes
        // FIXME: turn into function
        var nParams = params;
        delete nParams.before_id;
        delete nParams.since_id;
        ref.getUser(userid, nParams, function(user, userErr, userMeta) {
          userMutes.push(user);
          if (mutes.length == userMutes.length) {
            callback(userMutes, err, meta);
          }
        })
      }
    });
  },
  addMute: function(userid, params, tokenObj, callback) {
    var ref = this;
    console.log('dispatcher::addMute', userid, 'for', tokenObj.userid);
    this.cache.addMute(tokenObj.userid, userid, params, function(mute, err) {
      var nParams = params;
      delete nParams.before_id;
      delete nParams.since_id;
      ref.getUser(mute.muteeid, nParams, callback);
    });
  },
  deleteMute: function(userid, params, tokenObj, callback) {
    var ref = this;
    console.log('dispatcher::deleteMute', userid, 'for', tokenObj.userid);
    this.cache.delMute(tokenObj.userid, userid, params, function(mute, err) {
      var nParams = params;
      delete nParams.before_id;
      delete nParams.since_id;
      if (mute) {
        ref.getUser(mute.muteeid, nParams, callback);
      } else {
        console.log('dispatcher::deleteMute - mute not found', userid, 'for', tokenObj.userid);
        callback([], '404 mute not found');
      }
    });
  },
  /** files */
  fileToAPI: function(file, params, token, callback) {
    var api={
      complete: file.complete, // only allow completed files atm
      created_at: file.created_at,
      derived_files: {},
      file_token: file.url,
      id: file.id,
      image_info: {
        width: 600,
        height: 800
      },
      kind: file.kind,
      mime_type: file.mime_type,
      name: file.name,
      sha1: file.sha1,
      size: file.size,
      //source (file.client_id
      total_size: file.size, // should include all derived_files
      type: file.type,
      url: file.url,
      //url_expires
      //user
    };
    function checkDone() {
      if (api.user && api.source) {
        callback(api, null);
      }
    }
    this.getUser(file.userid, params, function(user, userErr, userMeta) {
      api.user = user;
      checkDone();
    });
    this.getClient(file.client_id, function(source, clientErr, clientMeta) {
      api.source = source;
      checkDone();
    }, false); // don't need to add if d.n.e.
  },
  getFile: function(fileid, params, callback) {
    console.log('dispatcher.js::getFile - write me!');
    callback(null, null);
  },
  getFiles: function(userid, params, callback) {
    var ref=this
    //console.log('dispatcher.js::getFiles - for user', userid);
    this.cache.getFiles(userid, params, function(dbFiles, err, meta) {
      if (!dbFiles.length) {
        callback([], null)
      }
      var files=[]
      for(var i in dbFiles) {
        ref.fileToAPI(dbFiles[i], params, { userid: userid }, function(api, err) {
          files.push(api);
          if (files.length === dbFiles.length) {
            callback(files, err, meta)
          }
        })
      }
    });
  },
  addFile: function(apiFile, tokenObj, params, callback) {
    // so translate ADN file object stuffs into fileModel
    var file=apiFile;
    file.userid=tokenObj.userid;
    file.client_id=tokenObj.client_id;
    file.complete=true; // very true if we have a url
    file.total_size=file.size;
    file.created_at=new Date();
    var ref=this;
    this.cache.addFile(file, tokenObj, function(dbFile, err, meta) {
      // and convert back
      ref.fileToAPI(dbFile, params, tokenObj, function(api, err) {
        callback(api, err);
      });
      /*
      var resFile=dbFile;
      // probably can be optimized out
      ref.getUser(dbFile.userid, { tokenobj: tokenObj }, function(user, userErr, userMeta) {
        resFile.user=user;
        // could also dab client obj but who needs that...
        // need to return
        // id: numeric
        // file_token: auCj3h64JZrhQ9aJdmwre3KP-QL9UtWHYvt5tj_64rUJWemoIV2W8eTJv9NMaGpBFk-BbU_aWA26Q40w4jFhiPBpnIQ_lciLwfh6o8YIAQGEQziksUMxZo7gOHJ_-niw3l3MZCh7QRWzqNGpiVaUEptfKO0fETrZ8bJjDa61234a
        callback(resFile, err, meta);
      })
      */
    });
  },
  setFile: function(data, deleted, id, ts, callback) {
    // map data onto model
    if (data.user) {
      this.updateUser(data.user);
    }
    var file=data;
    if (deleted) {
      file.id=id; // we need this for delete
    }
    file.userid=data.user.id;
    // client_id?
    // data.source handling...
    this.cache.setFile(data, deleted, id, callback);
    // file annotations are this mutable
    // if so we need to make sure we only update if timestamp if newer
    /*
      if (data.annotations) {
        ref.setAnnotations('file', data.id, data.annotations);
      }
    */
  },
  /** client */
  getSource: function(source, callback) {
    if (source==undefined) {
      callback(null, 'source is undefined');
      return;
    }
    //console.dir(source);
    var ref=this.cache;
    console.log('dispatcher.js::getSource ', source.client_id);
    this.cache.getClient(source.client_id, function(client, err, meta) {
      if (client==null || err) {
        //console.log('dispatcher.js::getSource failure ', err, client);
        // we need to create it
        ref.addSource(source.client_id, source.name, source.link, callback);
      } else {
        callback(client, err, meta);
      }
    });
    if (this.notsilent) {
      process.stdout.write('c');
    }
  },
  getClient: function(client_id, callback, shouldAdd) {
    if (client_id==undefined) {
      callback(null, 'client_id is undefined');
      return;
    }
    if (client_id==null) {
      callback(null, 'client_id is null');
      return;
    }
    var ref=this.cache;
    //console.log('dispatcher.js::getClient', client_id);
    this.cache.getClient(client_id, function(client, err, meta) {
      if (err) {
        console.error('dispatcher.js::getClient - err', err);
      }
      if (client) {
        delete client.secret; // don't expose the secret!
      }
      if (client==null) {
        console.log('dispatcher.js::getClient - no such client', client_id);
        // should we just be setClient??
        if (shouldAdd!=undefined) {
          console.log("Should add client_id: "+client_id, shouldAdd);
          //var source={ client_id: client_id, name: ??, link: ?? };
          //ref.setSource();
        }
        // make dummy
        var client={
          name: 'Unknown',
          link: 'nowhere',
          client_id: client_id
        };
      }
      callback(client, err, meta);
    });
  },
  /** entities */
  getEntities: function(type, id, callback) {
    this.cache.getEntities(type, id, callback);
  },
  setEntities: function(type, id, entities, callback) {
    //console.dir('dispatcher.js::setEntities - '+type, entities);
    var mentionsDone=false;
    var hashtagsDone=false;
    var linksDone=false;
    function checkDone() {
      if (mentionsDone && hashtagsDone && linksDone) {
        if (callback) {
          callback();
        }
      }
    }
    // I'm pretty sure these arrays are always set
    if (entities.mentions && entities.mentions.length) {
      this.cache.extractEntities(type, id, entities.mentions, 'mention', function(nEntities, err, meta) {
        mentionsDone=true;
        checkDone();
      });
      if (this.notsilent) {
        process.stdout.write('@');
      }
    } else {
      mentionsDone=true;
      checkDone();
    }
    if (entities.hashtags && entities.hashtags.length) {
      this.cache.extractEntities(type, id, entities.hashtags, 'hashtag', function(nEntities, err, meta) {
        hashtagsDone=true;
        checkDone();
      });
      if (this.notsilent) {
        process.stdout.write('#');
      }
    } else {
      hashtagsDone=true;
      checkDone();
    }
    if (entities.links && entities.links.length) {
      this.cache.extractEntities(type, id, entities.links, 'link', function(nEntities, err, meta) {
        linksDone=true;
        checkDone();
      });
      if (this.notsilent) {
        process.stdout.write('^');
      }
    } else {
      linksDone=true;
      checkDone();
    }
  },
  /** annotations */
  getAnnotation: function(type, id, callback) {
    var ref=this;
    this.cache.getAnnotations(type, id, function(notes, err, meta) {
      //console.log('start notes', notes);
      //var fixedNotes=[];
      if (!notes.length) {
        callback(notes, err, meta);
        return;
      }

      var done={}, calls={};
      var replaces=0;

      function checkDone(i) {
        done[i]++;
        //console.log('(', type, id, ')', i, 'done', done[i], 'calls', calls[i]);
        if (done[i]===calls[i]) {
          // replace value
          notes[i].value=fixedSet;
          replaces++;
          //console.log('dispatcher.js::getAnnotation(', type, id, ') - checkdone replaces', replaces, 'notes', notes.length);
          if (replaces===notes.length) {
            //console.log('dispatcher.js::getAnnotation(', type, id, ') - final notes', notes);
            callback(notes, err, meta);
          }
        }
      }

      //console.log('dispatcher.js::getAnnotation(', type, id, ') - notes', notes.length);
      for(var i in notes) {
        // check values
        var fixedSet={}
        notes[i].value = JSON.parse(notes[i].value)
        var oldValue=notes[i].value;
        calls[i]=0;
        done[i]=0;
        // is notes[i].value is a key value tuple, not an array
        //console.log('dispatcher.js::getAnnotation - note', i, 'has', notes[i].value);
        for(var k in notes[i].value) {
          calls[i]++;
        }
        // I think we only every have one value
        // nope because you can have an empty array
        //console.log(i, 'value', notes[i].value, 'len', notes[i].value.length, typeof(notes[i].value), notes[i].value.constructor.name)
        if (notes[i].value.constructor.name == 'Array' && !notes[i].value.length) {
          fixedSet=notes[i].value
          calls[i]++;
          checkDone(i)
          continue
        }
        for(var k in notes[i].value) {
          //console.log('value', notes[i].value, 'vs', oldValue, 'k', k, 'val', notes[i].value[k], 'vs', oldValue[k]);
          if (k[0]=='+') {
            if (k=='+net.app.core.file') {
              // look up file
              var scope=function(k, oldValue, fixedSet,i ) {
                //console.log('oldValue', oldValue);
                //console.log('looking up', oldValue[k].file_id);
                ref.cache.getFile(oldValue[k].file_id, function(fData, fErr, fMeta) {
                  //console.log('looking at', oldValue);
                  //console.log('looking at', oldValue[k]);
                  fixedSet.file_id=oldValue[k].file_id;
                  fixedSet.file_token=oldValue[k].file_token;
                  fixedSet.url=fData.url;
                  if (notes[i].type==='net.app.core.oembed') {
                    if (fData.kind==='image') {
                      fixedSet.type='photo';
                      fixedSet.version='1.0';
                      fixedSet.width=128;
                      fixedSet.height=128;
                      fixedSet.thumbnail_url=fData.url;
                      fixedSet.thumbnail_url_secure=fData.url;
                      //fixedSet.thumbnail_url_immediate=fData.url;
                      fixedSet.thumbnail_width=128;
                      fixedSet.thumbnail_height=128;
                      fixedSet.title=fData.name;
                      // author_name from the external site
                      // author_url for the external site
                      fixedSet.provider=ref.appConfig.provider;
                      fixedSet.provider_url=ref.appConfig.provider_url;
                      fixedSet.embeddable_url=fData.url;
                    }
                  }
                  checkDone(i);
                });
              }(k, oldValue, fixedSet, i);
            }
          } else {
            //console.log('dispatcher.js::getAnnotation - note', i, 'value', k, 'copying', notes[i].value[k]);
            fixedSet[k]=notes[i].value[k];
            checkDone(i);
          }
        }

        //fixedNotes.push();
      }
    });
  },
  setAnnotations: function(type, id, annotations, callback) {
    //console.log('dispatcher.js::setAnnotations - id', id, 'annotations', annotations);
    // probably should clear all the existing anntations for this ID
    // channel annotations mutable
    // and we don't have a unique constraint to tell if it's an add or update or del
    var ref=this;
    //console.log('dispatcher.js::setAnnotations - annotations', annotations);
    //console.log('dispatcher.js::setAnnotations - clearing', type, id);
    this.cache.clearAnnotations(type, id, function() {
      for(var i in annotations) {
        var note=annotations[i];
        //console.log('dispatcher.js::setAnnotations - note', i, note);
        // insert into idtype, id, type, value
        // type, id, note.type, note.value
        //console.log('dispatcher.js::setAnnotations - insert', note.type, note.value);
        ref.cache.addAnnotation(type, id, note.type, note.value, function(nNote, err) {
          if (err) {
            console.log('dispatcher.js::setAnnotations - addAnnotation failure', err);
          //} else {
          }
          if (this.notsilent) {
            process.stdout.write('a');
          }
          /*
          if (note.value.length) {
            writevaluearray(id, note.value);
          }
          */
        });
      }
      if (callback) {
        // what would we return??
        callback();
      }
    });
  },
  /** stream marker */
  getStreamMarker: function(name, usertoken, params, callback) {
    this.cache.getStreamMarker(usertoken.userid, name, callback);
  },
  setStreamMarker: function(name, id, percentage, usertoken, params, callback) {
    this.cache.setStreamMarker(usertoken.userid, name, id, percentage, params, callback);
  },
  /** text process */
  // postcontext (bool) means this is a post
  // FIXME: pass in if it's a machine_only or not
  textProcess: function(text, entities, postcontext, callback) {
    var ref=this;
    var html=escapeHTML(text);
    var hashtags=[];
    var links=[];
    // from patter @duerig
    // FIXME: these text ranges aren't very i8n friendly, what about UTF stuff huh?
    var mentionRegex = /@([a-zA-Z0-9\-_]+)\b/g;
    var hashtagRegex = /#([a-zA-Z0-9\-_]+)\b/g;
    // https://gist.github.com/gruber/8891611
    // https://alpha.app.net/dalton/post/6597#6595
    var urlRegex = /\b((?:https?:(?:\/{1,3}|[a-z0-9%])|[a-z0-9.\-]+[.](?:com|net|org|edu|gov|mil|aero|asia|biz|cat|coop|info|int|jobs|mobi|museum|name|post|pro|tel|travel|xxx|ac|ad|ae|af|ag|ai|al|am|an|ao|aq|ar|as|at|au|aw|ax|az|ba|bb|bd|be|bf|bg|bh|bi|bj|bm|bn|bo|br|bs|bt|bv|bw|by|bz|ca|cc|cd|cf|cg|ch|ci|ck|cl|cm|cn|co|cr|cs|cu|cv|cx|cy|cz|dd|de|dj|dk|dm|do|dz|ec|ee|eg|eh|er|es|et|eu|fi|fj|fk|fm|fo|fr|ga|gb|gd|ge|gf|gg|gh|gi|gl|gm|gn|gp|gq|gr|gs|gt|gu|gw|gy|hk|hm|hn|hr|ht|hu|id|ie|il|im|in|io|iq|ir|is|it|je|jm|jo|jp|ke|kg|kh|ki|km|kn|kp|kr|kw|ky|kz|la|lb|lc|li|lk|lr|ls|lt|lu|lv|ly|ma|mc|md|me|mg|mh|mk|ml|mm|mn|mo|mp|mq|mr|ms|mt|mu|mv|mw|mx|my|mz|na|nc|ne|nf|ng|ni|nl|no|np|nr|nu|nz|om|pa|pe|pf|pg|ph|pk|pl|pm|pn|pr|ps|pt|pw|py|qa|re|ro|rs|ru|rw|sa|sb|sc|sd|se|sg|sh|si|sj|Ja|sk|sl|sm|sn|so|sr|ss|st|su|sv|sx|sy|sz|tc|td|tf|tg|th|tj|tk|tl|tm|tn|to|tp|tr|tt|tv|tw|tz|ua|ug|uk|us|uy|uz|va|vc|ve|vg|vi|vn|vu|wf|ws|ye|yt|yu|za|zm|zw)\/)(?:[^\s()<>{}\[\]]+|\([^\s()]*?\([^\s()]+\)[^\s()]*?\)|\([^\s]+?\))+(?:\([^\s()]*?\([^\s()]+\)[^\s()]*?\)|\([^\s]+?\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’])|(?:[a-z0-9]+(?:[.\-][a-z0-9]+)*[.](?:com|net|org|edu|gov|mil|aero|asia|biz|cat|coop|info|int|jobs|mobi|museum|name|post|pro|tel|travel|xxx|ac|ad|ae|af|ag|ai|al|am|an|ao|aq|ar|as|at|au|aw|ax|az|ba|bb|bd|be|bf|bg|bh|bi|bj|bm|bn|bo|br|bs|bt|bv|bw|by|bz|ca|cc|cd|cf|cg|ch|ci|ck|cl|cm|cn|co|cr|cs|cu|cv|cx|cy|cz|dd|de|dj|dk|dm|do|dz|ec|ee|eg|eh|er|es|et|eu|fi|fj|fk|fm|fo|fr|ga|gb|gd|ge|gf|gg|gh|gi|gl|gm|gn|gp|gq|gr|gs|gt|gu|gw|gy|hk|hm|hn|hr|ht|hu|id|ie|il|im|in|io|iq|ir|is|it|je|jm|jo|jp|ke|kg|kh|ki|km|kn|kp|kr|kw|ky|kz|la|lb|lc|li|lk|lr|ls|lt|lu|lv|ly|ma|mc|md|me|mg|mh|mk|ml|mm|mn|mo|mp|mq|mr|ms|mt|mu|mv|mw|mx|my|mz|na|nc|ne|nf|ng|ni|nl|no|np|nr|nu|nz|om|pa|pe|pf|pg|ph|pk|pl|pm|pn|pr|ps|pt|pw|py|qa|re|ro|rs|ru|rw|sa|sb|sc|sd|se|sg|sh|si|sj|Ja|sk|sl|sm|sn|so|sr|ss|st|su|sv|sx|sy|sz|tc|td|tf|tg|th|tj|tk|tl|tm|tn|to|tp|tr|tt|tv|tw|tz|ua|ug|uk|us|uy|uz|va|vc|ve|vg|vi|vn|vu|wf|ws|ye|yt|yu|za|zm|zw)\b\/?))/ig;

    // data-mention-id="$1" will have to do a look up pass and set this back
    //html = html.replace(mentionRegex, '<span data-mention-name="$1" itemprop="mention">@$1</span>');

    // since input is text, I believe we can safely assume it's not already in a tag
    // FIXME: we need to insert http:// if there's no protocol (post: 30795290)
    // be sure to check your html/entity caching to make sure it's off otherwise 30795290 is fine
    //html = html.replace(urlRegex, '<a href="$1">$1</a>');
    // since hash can be in a link, make sure we process hashtags last
    //html = html.replace(hashtagRegex, '<span data-hashtag-name="$1" itemprop="hashtag">#$1</span>');
    var re = [
      "@([a-zA-Z0-9\-_]+)\\b",
      "\\b((?:https?:(?:\\/{1,3}|[a-z0-9%])|[a-z0-9.\\-]+[.](?:com|net|org|edu|gov|mil|aero|asia|biz|cat|coop|info|int|jobs|mobi|museum|name|post|pro|tel|travel|xxx|ac|ad|ae|af|ag|ai|al|am|an|ao|aq|ar|as|at|au|aw|ax|az|ba|bb|bd|be|bf|bg|bh|bi|bj|bm|bn|bo|br|bs|bt|bv|bw|by|bz|ca|cc|cd|cf|cg|ch|ci|ck|cl|cm|cn|co|cr|cs|cu|cv|cx|cy|cz|dd|de|dj|dk|dm|do|dz|ec|ee|eg|eh|er|es|et|eu|fi|fj|fk|fm|fo|fr|ga|gb|gd|ge|gf|gg|gh|gi|gl|gm|gn|gp|gq|gr|gs|gt|gu|gw|gy|hk|hm|hn|hr|ht|hu|id|ie|il|im|in|io|iq|ir|is|it|je|jm|jo|jp|ke|kg|kh|ki|km|kn|kp|kr|kw|ky|kz|la|lb|lc|li|lk|lr|ls|lt|lu|lv|ly|ma|mc|md|me|mg|mh|mk|ml|mm|mn|mo|mp|mq|mr|ms|mt|mu|mv|mw|mx|my|mz|na|nc|ne|nf|ng|ni|nl|no|np|nr|nu|nz|om|pa|pe|pf|pg|ph|pk|pl|pm|pn|pr|ps|pt|pw|py|qa|re|ro|rs|ru|rw|sa|sb|sc|sd|se|sg|sh|si|sj|Ja|sk|sl|sm|sn|so|sr|ss|st|su|sv|sx|sy|sz|tc|td|tf|tg|th|tj|tk|tl|tm|tn|to|tp|tr|tt|tv|tw|tz|ua|ug|uk|us|uy|uz|va|vc|ve|vg|vi|vn|vu|wf|ws|ye|yt|yu|za|zm|zw)\\/)(?:[^\\s()<>{}\\[\\]]+|\\([^\\s()]*?\\([^\\s()]+\\)[^\\s()]*?\\)|\\([^\\s]+?\\))+(?:\\([^\\s()]*?\\([^\\s()]+\\)[^\\s()]*?\\)|\\([^\\s]+?\\)|[^\\s`!()\\[\\]{};:'\".,<>?«»“”‘’])|(?:[a-z0-9]+(?:[.\\-][a-z0-9]+)*[.](?:com|net|org|edu|gov|mil|aero|asia|biz|cat|coop|info|int|jobs|mobi|museum|name|post|pro|tel|travel|xxx|ac|ad|ae|af|ag|ai|al|am|an|ao|aq|ar|as|at|au|aw|ax|az|ba|bb|bd|be|bf|bg|bh|bi|bj|bm|bn|bo|br|bs|bt|bv|bw|by|bz|ca|cc|cd|cf|cg|ch|ci|ck|cl|cm|cn|co|cr|cs|cu|cv|cx|cy|cz|dd|de|dj|dk|dm|do|dz|ec|ee|eg|eh|er|es|et|eu|fi|fj|fk|fm|fo|fr|ga|gb|gd|ge|gf|gg|gh|gi|gl|gm|gn|gp|gq|gr|gs|gt|gu|gw|gy|hk|hm|hn|hr|ht|hu|id|ie|il|im|in|io|iq|ir|is|it|je|jm|jo|jp|ke|kg|kh|ki|km|kn|kp|kr|kw|ky|kz|la|lb|lc|li|lk|lr|ls|lt|lu|lv|ly|ma|mc|md|me|mg|mh|mk|ml|mm|mn|mo|mp|mq|mr|ms|mt|mu|mv|mw|mx|my|mz|na|nc|ne|nf|ng|ni|nl|no|np|nr|nu|nz|om|pa|pe|pf|pg|ph|pk|pl|pm|pn|pr|ps|pt|pw|py|qa|re|ro|rs|ru|rw|sa|sb|sc|sd|se|sg|sh|si|sj|Ja|sk|sl|sm|sn|so|sr|ss|st|su|sv|sx|sy|sz|tc|td|tf|tg|th|tj|tk|tl|tm|tn|to|tp|tr|tt|tv|tw|tz|ua|ug|uk|us|uy|uz|va|vc|ve|vg|vi|vn|vu|wf|ws|ye|yt|yu|za|zm|zw)\\b\\/?))",
      "#([a-zA-Z0-9\-_]+)\\b",
    ];
    //console.log('array', re)
    //console.log('string', re.join('|'))
    re = new RegExp(re.join('|'), "gi");
    html = html.replace(re, function(match, mention, link, hash) {
      //console.log('html replace', match);
      //console.log('html mention', mention);
      //console.log('html link', link);
      //console.log('html hash', hash);
      if (mention) {
        return '<span data-mention-name="'+mention+'" itemprop="mention">@'+mention+'</span>';
      }
      if (link) {
        if (!link.match(/:\/\//)) {
          link = 'http://'+link
        }
        return '<a href="'+link+'">'+link+'</a>';
      }
      if (hash) {
        return '<span data-hashtag-name="'+hash+'" itemprop="hashtag">#'+hash+'</span>';
      }
      return match;
    });

    var userlookup={};

    var finishcleanup=function(html, text, callback) {
      if (!entities) {
        entities={
          mentions: [],
          hashtags: [],
          links: []
        };
      }
      //|| entities.parse_mentions isn't spec
      //should be on if not machine_only
      if (!entities.mentions || !entities.mentions.length) {
        // extract mentions
        var mentions=[]
        var lastmenpos=0;
        while(match=mentionRegex.exec(text)) {
          //console.log('Found '+match[1]+' at '+match.index);
          var username=match[1].toLowerCase();
          //console.log('@'+match.index+' vs '+lastmenpos);
          if (userlookup[username]) {
            // only push if user exists
            var obj={
              pos: match.index,
              id: ''+userlookup[username],
              len: username.length+1, // includes char for @
              name: username,
            }
            if (postcontext) {
              // means no text before the mention...
              obj.is_leading=match.index==lastmenpos;
            }
            mentions.push(obj);
          }
          // while we're matching
          if (match.index==lastmenpos) {
            // update it
            lastmenpos=match.index+username.length+2; // @ and space after wards
          }
        }
        entities.mentions=mentions;
      }
      // we should do links before hashtags
      // since a # can be inside a link
      if (!entities.links || !entities.links.length || entities.parse_links) {
        // extract URLS
        var links=[]
        while(match=urlRegex.exec(text)) {
          var url=match[1];
          // we need to insert http:// if there's no protocol (post: 30795290)
          // FIXME: colon isn't good enough
          var text=url;
          if (url.indexOf('://')==-1) {
            url='http://'+url;
          }
          var obj={
            url: url,
            text: text,
            pos: match.index,
            len: text.length,
          }
          links.push(obj);
        }
        entities.links=links;
      }

      //console.log('current hashtags', entities.hashtags);
      //|| entities.parse_hashtags isn't spec
      // should always be on
      if (!entities.hashtags || !entities.hashtags.length) {
        // extract hashtags
        //console.log('extracting hashtags');
        // FIXME: 30792555 invisible hashtags?
        // we're not encoding text right...
        var hashtags=[];
        while(match=hashtagRegex.exec(text)) {
          var hashtag = match[1];
          var insideLink = false;
          for(var i in entities.links) {
            var link = entities.links[i];
            var start=link.pos;
            var end=start + link.len;
            //console.log('hash start inside link?', start, '<?', match.index, '<?', end);
            if (start <= match.index && match.index <= end) {
              //console.log('hash end inside link?', start, '<?', match.index+hashtag.length+1, '<?', end);
              if (start <= match.index + hashtag.length+1 && match.index + hashtag.length+1 <= end) {
                //console.log('hashtag', hashtag, 'is in link', link.url)
                insideLink = true;
                break;
              }
            }
          }
          if (insideLink) {
            continue;
          }
          var obj={
            name: hashtag,
            pos: match.index,
            len: hashtag.length+1, // includes char for #
          }
          //console.log('extracted hashtag:', hashtag);
          hashtags.push(obj);
        }
        //console.log('extracted hashtags', hashtags);
        entities.hashtags=hashtags;
      }

      /*
      console.dir(mentions);
      console.dir(hashtags);
      console.dir(links);
      */

      // unicode chars
      // <>\&
      html = html.replace(/[\u00A0-\u9999]/gim, function(i) {
         return '&#'+i.charCodeAt(0)+';';
      });

      // remove line breaks
      html=html.replace(/\r/g, '&#13;');
      html=html.replace(/\n/g, '<br>');

      var res={
        entities: entities,
        html: '<span itemscope="https://app.net/schemas/Post">'+html+'</span>',
        text: text
      };
      callback(res, null);
    }

    var mentionsSrch=text.match(mentionRegex);
    var launches=0, completed=0;
    if (mentionsSrch && mentionsSrch.length) {
      for(var i in mentionsSrch) {
        var mention=mentionsSrch[i]; // with @
        //RegExp.$1 // without @
        //var username=RegExp.$1;
        var username=mention.substr(1);
        //console.log("Replacing "+username);
        var pattern=new RegExp(' data-mention-name="'+username, 'gi');
        launches++;
        // renames are going to break this caching
        if (userlookup[username]) {
          console.log('cached got', userlookup[username]);
          html=html.replace(pattern, ' data-mention-id="'+userlookup[username]+'" data-mention-name="'+username);
          completed++;
          if (completed==launches) {
            finishcleanup(html, text, callback);
          }
        } else {
          console.log('Searching for', username);
          ref.cache.getUserID(username, function(user, userErr, userMeta) {
            if (user) {
              console.log('got', user.id);
              // save in cache
              userlookup[user.username]=user.id;
              // fix up missing user ids
              //var pattern=new RegExp(' data-mention-name="'+user.username, 'gi');
              html=html.replace(pattern, ' data-mention-id="'+user.id+'" data-mention-name="'+user.username);
              //console.log('Adjusted html '+html);
            }
            completed++;
            //console.log(completed+'/'+launches);
            // tired/lazy man's promise
            // I'm concerned that if we queue 2 and then finish 2, we may trigger the ending early
            // and possibly more than once
            if (completed==launches) {
              finishcleanup(html, text, callback);
            }
          });
        }
      }
    } else {
      finishcleanup(html, text, callback);
    }

  },
  /** config **/
  // change to callback style?
  getConfig: function() {
    return this.config;
  },
  /** oembed **/
  getOEmbed: function(url, callback) {
    this.cache.getOEmbed(url, callback);
  },
  /** dispatcher for streamrouter */
  dispatch: function(userid, json) {
    // remember json is in app streaming format!
    //console.dir(json);
    var data=json.data;
    var meta=json.meta;
    // the missing meta is going to be an issue
    /*
     { meta:
       { suppress_notifications_all: false,
         timestamp: 1399812206341,
         type: 'post',
         id: '30224684',
         suppress_notifications: [] },
    */
    switch(meta.type) {
      case 'post':
        // transfer stream encoding over to normal post structure
        if (meta && meta.is_deleted) {
          if (data==undefined) data={};
          data.is_deleted=true;
        }
        if (data.id) {
          this.setPost(data);
        }
      break;
      case 'channel':
        this.setChannel(data, meta.timestamp);
      break;
      case 'message':
        // meta.timestamp is important here for channels
        this.setMessage(data, meta.timestamp);
      break;
      case 'channel_subscription':
        this.setChannelSubscription(data, meta.is_deleted, meta.timestamp);
      break;
      case 'file':
        console.log('file');
      break;
      case 'stream_marker':
        console.log('stream_marker');
      break;
      case 'token':
        console.log('token');
      break;
      case 'star':
        this.setStar(data, meta.is_deleted, meta.id, meta.timestamp);
      break;
      case 'mute':
        console.log('mute');
      break;
      case 'block':
        console.log('block');
      break;
      case 'user':
        this.updateUser(data, meta.timestamp);
      break;
      case 'user_follow':
        if (data) {
          this.setFollows(data, meta.is_deleted, meta.id, meta.timestamp);
        } else {
          this.setFollows(null, meta.is_deleted, meta.id, meta.timestamp);
        }
      break;
      default:
        console.log("dispatcher.js::dispatch - unknown appstream type ["+meta.type+"]");
      break;
    }
    // done with data
    data=false;
    meta=false;
    json=false;
  }
  /**
   * This callback is displayed as part of Dispatcher class
   * @callback setPostCallback
   * @param {object} post object
   * @param {string} error
   */
  /**
   * This is a callback that passes back the meta data as well
   * @callback metaCallback
   * @param {object} post post data object
   * @param {?string} error null if no errors, otherwise string
   * @param {object} meta meta object
   */

}

// configure downloader
downloader.dispatcher=module.exports;
