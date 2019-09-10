// offical_callback??
const sendresponse = (json, resp) => {
  const ts = new Date().getTime();
  const diff = ts-resp.start;
  if (diff > 1000) {
    // this could be to do the client's connection speed
    // how because we stop the clock before we send the response...
    console.log(`${resp.path} served in ${ts - resp.start}ms`);
  }
  if (json.meta && json.meta.code) {
    resp.status(json.meta.code);
  }
  if (resp.prettyPrint) {
    json=JSON.stringify(json,null,4);
  }
  //resp.set('Content-Type', 'text/javascript');
  resp.type('application/json');
  resp.setHeader("Access-Control-Allow-Origin", "*");
  resp.send(json);
}

// FIXME verification of modKey

module.exports=function(app, prefix) {
  //var dispatcher=app.dispatcher;
  // set cache based on dispatcher object
  cache = app.dispatcher.cache;

  // get listing
  app.get(prefix + '/:model', (req, res) => {
    const model = req.params.model;
    console.log('admin::list model', model);
    switch(model) {
      case 'channels':
        cache.searchChannels({}, req.apiParams, function(channels, err, meta) {
          const resObj={
            meta: meta,
            data: channels,
          }
          return sendresponse(resObj, res);
        })
      break;
      default:
        res.status(200).end("{}");
      break;
    }
  });

  // get single record
  app.get(prefix + '/:model/:id', (req, res) => {
    const model = req.params.model;
    const id = req.params.id;
    console.log('admin::findOne model', model, 'id', id);
    switch(model) {
      case 'users':
        cache.getUser(id, function(user, err, meta) {
          const resObj={
            meta: meta,
            data: user,
          }
          return sendresponse(resObj, res);
        });
      break;
      case 'tokens':
        // look up by token string
        cache.getAPIUserToken(id, function(usertoken, err, meta) {
          const resObj={
            meta: meta,
            data: usertoken,
          }
          return sendresponse(resObj, res);
        });
      break;
      case 'channels':
        cache.getChannel(id, req.apiParams, function(channel, err, meta) {
          const resObj={
            meta: meta,
            data: channel,
          }
          return sendresponse(resObj, res);
        });
      break;
      default:
        res.status(200).end("{}");
      break;
    }
  });

  // get deletion list
  app.get(prefix + '/channels/:cid/interactions', (req, res) => {
    const cid = req.params.cid;
    //console.log('loading channel', cid);
    cache.getChannelDeletions(cid, req.apiParams, function(interactions, err, meta) {
      if (err) {
        console.error('getMessage err', err);
        const resObj={
          meta: {
            code: 500,
            error_message: err
          }
        };
        return sendresponse(resObj, res);
      }
      const resObj={
        meta: meta,
        data: interactions,
      }
      return sendresponse(resObj, res);
    });
  });

  // get message record
  app.get(prefix + '/channels/:cid/messages/:mid', (req, res) => {
    const cid = req.params.cid;
    const mid = req.params.mid;
    //console.log('message id', mid);
    cache.getMessage(mid, function(message, err, meta) {
      if (err) {
        console.error('getMessage err', err);
        const resObj={
          meta: {
            code: 500,
            error_message: err
          }
        };
        return sendresponse(resObj, res);
      }
      const resObj={
        meta: meta,
        data: message,
      }
      return sendresponse(resObj, res);
    })
  });

  // nuke message record
  app.delete(prefix + '/channels/:cid/messages/:mid', (req, res) => {
    const cid = req.params.cid;
    const mid = req.params.mid;
    //console.log('message id', mid);
    // marks it is_deleted: 1
    cache.deleteMessage(mid, cid, function(message, err, meta) {
      if (err) {
        console.error('getMessage err', err);
        const resObj={
          meta: {
            code: 500,
            error_message: err
          }
        };
        return sendresponse(resObj, res);
      }
      const resObj={
        meta: meta,
        data: message,
      }
      return sendresponse(resObj, res);
    })
  });

  // create record
  app.post(prefix + '/:model', (req, res) => {
    const model = req.params.model;
    console.log('admin::create model', model);
    switch(model) {
      case 'users':
        // "password" (2nd) parameter is not saved/used
        cache.addUser(req.body.username, '', function(user, err, meta) {
          const resObj={
            meta: meta,
            data: user,
          }
          return sendresponse(resObj, res);
        })
      break;
      case 'tokens':
        const tokenIn = req.body;
        console.log('creating token', tokenIn);
        cache.addUnconstrainedAPIUserToken(tokenIn.user_id, tokenIn.client_id, tokenIn.scopes, tokenIn.token, tokenIn.expireInMinds, function(token, err, meta) {
          const resObj={
            meta: meta,
            data: token,
          }
          return sendresponse(resObj, res);
        })
      break;
      default:
        res.status(200).end("{}");
      break;
    }
  });

  // update some fields
  app.patch(prefix + '/:model/:id', (req, res) => {
    const model = req.params.model;
    const id = req.params.id;
    console.log('admin::update model', model, 'id', id);
    switch(model) {
      case 'channels':
        cache.getChannel(id, req.apiParams, function(channel, err, meta) {
          // FIXME: WRITE ME
          const resObj={
            meta: meta,
            data: channel,
          }
          return sendresponse(resObj, res);
        })
      break;
      default:
        res.status(200).end("{}");
      break;
    }
  });

  // set is_deleted=1
  app.delete(prefix + '/:model/:id', (req, res) => {
    const model = req.params.model;
    const id = req.params.id;
    console.log('admin::delete model', model, 'id', id);
    switch(model) {
      default:
        res.status(200).end("{}");
      break;
    }
  })
}
