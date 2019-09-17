/**
 * Dispatcher is an internal front-facing API for all functions and services
 *
 * "Dialects" will call these functions to the data-access chain to store/retrieve data and format
 * responses in standard way.
 *
 * @module dispatcher
 */

var first_post_id;
var last_post_id;

/** for status reports */
var lmem={ heapUsed: 0 };

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
  console.log("dispatcher @"+ts+" Memory+["+(mem.heapUsed-lmem.heapUsed).toLocaleString()+"] Heap["+(mem.heapUsed).toLocaleString()+"] uptime: "+process.uptime());
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
  /**
   * redis connection for websocket streams
   */
  redisClient: null,
  /**
   * websocket stream pumps
   */
  pumps: {},
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
      // maybe just spare caminte all together and just callback now
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
  },
  pumpStreams: function(options, data) {
    console.log('dispatcher::pumpStreams -', options)
    // op isn't used (add/del), type is only used in the meta
    function checkKey(key, op, type) {
      console.log('dispatcher::pumpStreams - checking', key);
      // see if there's any connections we need to pump
      if (module.exports.pumps[key]) {
        console.log('pumping', key, 'with', module.exports.pumps[key].length);
        // FIXME: by queuing all connections that data needs to be set on
        for(var i in module.exports.pumps[key]) {
          var connId = module.exports.pumps[key][i];
          // push non-db object data to connection
          // is_deleted, deleted_id
          // subscription_ids
          var wrap = {
            meta: {
              connection_id: connId,
              type: type
            },
            data: data
          }
          module.exports.streamEngine.handlePublish(connId, wrap);
        }
      }
    }
    // { id: x, type: 'post', op: 'add', actor: 153 }
    // { id: x, type: 'post', op: 'del', }
    // conver to key
    if (options.type == 'message') {
      checkKey('channel.'+options.channel_id+'.message', options.op, 'message');
    } else {
      checkKey(options.type+'.'+options.id, options.op, 'post');
      if (options.type == 'post') {
        checkKey('user.'+options.actor+'.post', options.op, 'post');
      }
    }
  },
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
