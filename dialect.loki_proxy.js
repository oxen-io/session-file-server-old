const fs            = require('fs');
const stream        = require('stream');
const util          = require('util');
const crypto        = require('crypto');
const inspect       = require('util').inspect;
const querystring   = require('querystring');
const _             = require('lodash');
const bb            = require('bytebuffer');
const Busboy        = require('busboy');
const { Readable }  = require('stream');
const libsignal     = require('libsignal');
const runMiddleware = require('run-middleware');
const IV_LENGTH = 16;

const FILE_SERVER_PRIV_KEY_FILE = 'proxy.key'
const FILE_SERVER_PUB_KEY_FILE = 'proxy.pub'

console.log('initializing loki_proxy subsystem');
if (!fs.existsSync(FILE_SERVER_PRIV_KEY_FILE)) {
  const serverKey = libsignal.curve.generateKeyPair();
  console.log('no private key, generating new keyPair, saving as', FILE_SERVER_PRIV_KEY_FILE);
  fs.writeFileSync(FILE_SERVER_PRIV_KEY_FILE, serverKey.privKey, 'binary');
  if (!fs.existsSync(FILE_SERVER_PUB_KEY_FILE)) {
    console.log('no public key, saving as', FILE_SERVER_PUB_KEY_FILE);
    fs.writeFileSync(FILE_SERVER_PUB_KEY_FILE, serverKey.pubKey, 'binary');
  }
}
// should have files by this point
if (!fs.existsSync(FILE_SERVER_PUB_KEY_FILE)) {
  console.log('Have', FILE_SERVER_PRIV_KEY_FILE, 'without', FILE_SERVER_PUB_KEY_FILE);
  // maybe nuke FILE_SERVER_PRIV_KEY_FILE and regen
  process.exit(1);
}
// load into buffers
const serverPrivKey = fs.readFileSync(FILE_SERVER_PRIV_KEY_FILE);
const serverPubKey = fs.readFileSync(FILE_SERVER_PUB_KEY_FILE);

const serverPubKey64 = bb.wrap(serverPubKey).toString('base64');

// mount will set this
let cache;

const sendresponse = (json, resp) => {
  const ts = Date.now();
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
    json=JSON.parse(JSON.stringify(json,null,4));
  }
  //resp.set('Content-Type', 'text/javascript');
  resp.type('application/json');
  resp.setHeader("Access-Control-Allow-Origin", "*");
  resp.json(json);
}

function buf2hex(buffer) { // buffer is an ArrayBuffer
  return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}

module.exports = (app, prefix) => {
  // set cache based on dispatcher object
  cache = app.dispatcher.cache;

  runMiddleware(app);

  app.get(prefix + '/loki/v1/public_key', (req, res) => {
    res.start = Date.now()
    sendresponse({
      meta: {
        code: 200
      },
      data: serverPubKey64
    }, res);
  });

  app.post(prefix + '/loki/v1/secure_rpc_debug', async (req, res) => {
    // FIXME
    const cipherText64 = req.body.cipherText64;
    res.start = Date.now()
    sendresponse({
      meta: {
        code: 200
      },
      data: cipherText64
    }, res);
  });

  app.post(prefix + '/loki/v1/secure_rpc', async (req, res) => {
    res.start = Date.now()
    //console.log('got secure_rpc', req.path);
    // should have debug asks and ephermal key
    //console.log('headers', req.headers);
    //console.log('secure_rpc body', req.body, typeof req.body);

    if (!req.body.cipherText64) {
      return sendresponse({
        meta: {
          code: 400,
          error: "not JSON or no cipherText64",
          headers: req.headers,
          body: req.body,
        },
      }, res);
    }

    // after we get our bearings
    // get the base64 body...
    const cipherText64 = req.body.cipherText64;
    // req.header will always have headers...
    const debugHeaders = req.headers['x-loki-file-server-debug-headers'];
    const debugCryptoValues = req.headers['x-loki-file-server-debug-crypto-values'];
    const debugFup = req.headers['x-loki-file-server-debug-file-upload'];

    if (debugHeaders) console.log('headers', req.headers);
    if (debugCryptoValues) console.log('cipherText64', cipherText64, cipherText64 && cipherText64.length);

    const ephemeralPubKey64 = req.headers['x-loki-file-server-ephemeral-key'];
    //console.log('ephemeralPubKey', ephemeralPubKey64);
    if (!ephemeralPubKey64 || ephemeralPubKey64.length < 32) {
      return sendresponse({
        meta: {
          code: 400,
          error: "No x-loki-file-server-ephemeral-key header sent of at least 32 bytes",
          headers: req.headers,
          body: req.body,
        },
      }, res);
    }

    // decode base64 ephemeral key into buffer
    // FIXME: needs a try/catch
    const ephemeralPubKey = Buffer.from(
      bb.wrap(ephemeralPubKey64,'base64').toArrayBuffer()
    );
    //console.log('ephemeralPubKey size', ephemeralPubKey.length, ephemeralPubKey.byteLength)
    //console.log('serverPrivKey size', serverPrivKey.length, serverPrivKey.byteLength)

    if (debugCryptoValues) console.log('ephemeralPubKey', ephemeralPubKey.toString('hex'), ephemeralPubKey.byteLength);

    // build symmetrical keypair mix client pub key with server priv key
    const symKey = libsignal.curve.calculateAgreement(
      ephemeralPubKey,
      serverPrivKey
    );
    if (debugCryptoValues) console.log('symKey', symKey.toString('hex'), symKey.byteLength);

    // base64 decode cipherText64 into buffer
    const ivAndCiphertext = Buffer.from(
      bb.wrap(cipherText64, 'base64').toArrayBuffer()
    );

    // extract iv
    const iv = ivAndCiphertext.slice(0, IV_LENGTH);
    if (debugCryptoValues) console.log('iv', iv.toString('hex'), iv.byteLength);

    // extra text
    const ciphertext = ivAndCiphertext.slice(IV_LENGTH);
    if (debugCryptoValues) console.log('ciphertext', ciphertext.toString('hex'), ciphertext.byteLength);

    let decrypted = '{}';
    try {
      decrypted = await libsignal.crypto.decrypt(symKey, ciphertext, iv);
    } catch(e) {
      return sendresponse({
        meta: {
          code: 400,
          error: e.code + ' '  + e.messsage
        },
      }, res);
    }

    let requestObj;
    try {
      requestObj = JSON.parse(decrypted.toString());
    } catch(e) {
      sendresponse({
        meta: {
          code: 400,
          error: e.code + ' '  + e.messsage
        },
      }, res);
      return;
    }

    //console.log('decrypted', requestObj);
    console.log('body set', !!requestObj.body, 'body type', typeof requestObj.body, 'fileUpload set', !!(requestObj.body && requestObj.body.fileUpload));

    if (requestObj.headers) {
      const contentTypeHeader = Object.keys(requestObj.headers).reduce(
        (prev, key) => key.match(/content-type/i)?key:prev, false
      );
      // if not what we already expect, and is set
      if (contentTypeHeader && contentTypeHeader !== 'content-type' &&
          requestObj.headers[contentTypeHeader]) {
        // fix it up
        console.log('old inner headers', requestObj.headers);
        requestObj.headers['content-type'] = requestObj.headers[contentTypeHeader];
        delete requestObj.headers[contentTypeHeader]; // remove the duplicate...
        // console.log('new inner headers', requestObj.headers);
      }
    }

    console.log('inner headers', requestObj.headers, 'header type', typeof requestObj.headers,
      'json match', !!(requestObj.headers &&
      requestObj.headers['content-type'] &&
      requestObj.headers['content-type'].match(/^application\/json/i)));

    /*
    // works as long as body isn't a string
    const debugObj = JSON.parse(JSON.stringify(requestObj));
    if (requestObj.body && requestObj.body.fileUpload) {
      // clearly not removing it
      delete debugObj.body.fileUpload;
    }
    console.log('rpc without body', debugObj);
    */

    // if body is string but really JSON with fileUpload
    if (typeof(requestObj.body) ==='string' && requestObj.body.match(/^{[ ]*"fileUpload"[ ]*:[ ]*/)) {
      // decode enough to pick up fileUpload
      console.log('body is string and detected file upload, attempting decoding');
      requestObj.body = JSON.parse(requestObj.body);
    }

    // will need decode a multipart body...
    //console.log('decrypted body', requestObj.body);

    // handle file uploads
    if (requestObj.body && requestObj.body.fileUpload) {
      //console.log('detect file upload');
      const fupData = Buffer.from(
        bb.wrap(requestObj.body.fileUpload, 'base64').toArrayBuffer()
      );
      requestObj.body = ''; // free memory

      //console.log('multipart data', buf2hex(fupData));


      const p = new Promise((resolve, reject) => {
        // Desktop attachment:
        // 'content-type': 'multipart/form-data; boundary=--------------------------132629963599778911961269'
        //
        const busboy = new Busboy({ headers: requestObj.headers });
        let lastFile
        busboy.on('field', function(fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) {
          console.log('Field [' + fieldname + ']: value: ' + inspect(val));
        });
        busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
          console.log('FUP file upload detected', fieldname, filename, encoding, mimetype)
          // file is stream but it's expecting a buffer...

          var buffers = [];
          file.on('data', function(chunk) {
            // chunk is a buffer since no encoding is set...
            //console.log(chunk.length, 'chunk', buf2hex(chunk));
            buffers.push(chunk);
          });
          // finish is before end...
          file.on('end', function() {
            // console.log('buffers', buffers.length)
            var buffer = Buffer.concat(buffers);
            console.log('detect file upload', buffer.length, 'bytes');
            buffers = false; // free memory
            const readableInstanceStream = new Readable({
              read() {
                // console.log('reading stream!')
                this.push(buffer);
                this.push(null);
                // console.log('stream read!')
              }
            });
            readableInstanceStream.length = buffer.length;
            // we only handle single file uploads any way...
            requestObj.file = {
              buffer: readableInstanceStream,
              originalname: filename,
              mimetype: mimetype,
            };
            resolve();
          });
        });
        // write and flush
        // don't use .toString here, it'll fuck up the encoding
        busboy.end(fupData);
        // FIXME: we never resolve if no files...
      });
      await p;
      //console.log('fup request', buf2hex(fupData));
      // make sure normal JSON gets copied through...
      requestObj.body = fupData.toString();
    } else {
      // emulate the bodyparser json decoder support
      if (requestObj.headers && requestObj.headers['content-type'] &&
         requestObj.headers['content-type'].match(/^application\/json/i) &&
         typeof(requestObj.body) === 'string') {
        // console.log('bodyPaser failed. Outer headers', req.headers);
        console.log('bodyPaser failed');
        requestObj.body = JSON.parse(requestObj.body);
      }
      // non file upload
      console.log('non-fup request', requestObj); // just debug it all for now
      //console.log('non-fup request body', requestObj.body, typeof(requestObj.body));
    }
    //console.log('setting up fakeReq');

    // rewrite request
    // console.log('old', req)
    const fakeReq = {...req}
    fakeReq.path = '/' + requestObj.endpoint;
    //fakeReq.url = fakeReq.path;
    //fakeReq.originalUrl = fakeReq.path;
    //fakeReq._httpMessage.path = fakeReq.path;
    /*
    fakeReq.route.path = fakeReq.path;
    fakeReq.res.req.method = requestObj.method || 'GET';
    fakeReq.res.req.url = fakeReq.path;
    fakeReq.res.req.originalUrl = fakeReq.path;
    fakeReq.res.path = fakeReq.path;
    */
    fakeReq.cookies.request.url = fakeReq.path;
    fakeReq.cookies.request.method = requestObj.method || 'GET';
    //fakeReq.cookies.request.originalUrl = fakeReq.path;
    //fakeReq.cookies.response.path = fakeReq.path;

    //console.log('changed path to', fakeReq.path);
    fakeReq.method = requestObj.method || 'GET';
    //console.log('old headers', req.headers)
    fakeReq.headers = requestObj.headers;

    fakeReq.body = requestObj.body;
    fakeReq.cookies.request.body = requestObj.body;
    // disable any token passed by proxy
    fakeReq.token = undefined;
    fakeReq.cookies.request.token = undefined;
    if (requestObj.headers && requestObj.headers['Authorization']) {
      fakeReq.token = requestObj.headers['Authorization'].replace(/^Bearer /, '')
      fakeReq.cookies.request.token = fakeReq.token;
    }
    // handle file uploads
    fakeReq.file = requestObj.file;
    fakeReq.cookies.request.file = requestObj.file;
    //fakeReq.res.req = fakeReq;
    //fakeReq.cookies.request = fakeReq;
    console.log('secure_rpc rewrote to', fakeReq.method, fakeReq.path, fakeReq.token?'IDd':'anon')
    //console.log('fake', fakeReq)

    /*
    function LokiDHEncryptStream(options) {
      if (!(this instanceof LokiDHEncryptStream)) {
        return new LokiDHEncryptStream(options);
      }
      // init Transform
      stream.Transform.call(this, options);
    }
    util.inherits(LokiDHEncryptStream, stream.Transform);

    var finalChunk = '';
    LokiDHEncryptStream.prototype._transform = function (chunk, enc, cb) {
      finalChunk += chunk.toString();
      // no push ...
      cb();
    }
    LokiDHEncryptStream.prototype._flush = function(cb) {
      this.push('{}')
      cb();
    }
    var encoder = new LokiDHEncryptStream();
    encoder.pipe(res);
    */

    /*
    const oldWrite = res.write
    const oldEnd = res.end
    res.write = function(chunk) {
      console.log('write chunk', chunk)
    }
    res.end = function(chunk, encoding) {
      console.log('end chunk', chunk.toString(), encoding);
      // ok we can modify the results, we just need to get the correct contents...
      var finalContents = JSON.stringify({
        meta: {
          code: 200
        },
        data: requestObj
      });
      this.setHeader('Content-Length', finalContents.length);
      oldEnd.call(this, finalContents, encoding);
    }
    */

    //
    // start runMiddleware fixups
    //

    function createReq(path, options) {
      if (!options) options = {};
      var req = _.extend(
        {
          method: "GET",
          host: "",
          cookies: {},
          query: {},
          url: path,
          headers: {},
        },
        options
      );
      req.method = req.method.toUpperCase();
      // req.connection=_req.connection
      return req;
    }
    // fix up createRes
    function createRes(callback) {
      var res = {
        _removedHeader: {},
      };
      // res=_.extend(res,require('express/lib/response'));

      var headers = {};
      var code = 200;
      res.set = res.header = (x, y) => {
        if (arguments.length === 2) {
          res.setHeader(x, y);
        } else {
          for (var key in x) {
            res.setHeader(key, x[key]);
          }
        }
        return res;
      }
      res.setHeader = (x, y) => {
        headers[x] = y;
        headers[x.toLowerCase()] = y;
        return res;
      };
      // fix up res.get
      res.get=(x) => {
        return headers[x]
      }
      res.redirect = function(_code, url) {
        if (!_.isNumber(_code)) {
          code = 301;
          url = _code;
        } else {
          code = _code;
        }
        res.setHeader("Location", url);
        res.end();
        // callback(code,url)
      };
      res.status = function(number) {
        code = number;
        return res;
      };
      res.end = res.send = res.write = function(data) {
        if (callback) callback(code, data, headers);
        // else if (!options.quiet){
        //     _res.send(data)
        // }
      };
      return res;
    }

    // fix up runMiddleware
    app.runMiddleware = function(path, options, callback) {
      if (callback) callback = _.once(callback);
      if (typeof options == "function") {
        callback = options;
        options = null;
      }
      options = options || {};
      options.url = path;
      var new_req, new_res;
      if (options.original_req) {
        new_req = options.original_req;
        for (var i in options) {
          if (i == "original_req") continue;
          new_req[i] = options[i];
        }
      } else {
        new_req = createReq(path, options);
      }
      new_res = createRes(callback);
      app(new_req, new_res);
    };

    //
    // fix ups done
    //

    // redispatch internally
    // might need to split on ? for querystring processing
    // seems to be working fine...
    if (fakeReq.path.match(/\?/)) {
      let questions = fakeReq.path.split('?')
      const path = questions.shift();
      //fakeReq.query = querystring.parse(questions.join('?'));
      fakeReq.cookies.request.query = querystring.parse(questions.join('?'));
    }

    // this does cause req in handlers to be immutable
    // we'll have to adapt...
    fakeReq.start = Date.now();
    const diff = fakeReq.start - res.start;
    console.log(fakeReq.method, fakeReq.path, 'decoding took', diff, 'ms');
    fakeReq.runMiddleware(fakeReq.path, async (code, resultBody, headers) => {
      const execStart = Date.now();
      const execDiff = execStart - fakeReq.start;
      console.log(fakeReq.method, fakeReq.path, 'execution took', execDiff, 'ms');
      // console.log('body', resultBody)

      // we'll reuse the iv
      const payloadData = resultBody === undefined ? Buffer.alloc(0) : Buffer.from(
        bb.wrap(resultBody).toArrayBuffer()
      );
      // console.log('payloadData', payloadData)

      // if performance problems, we can cache this value for a period of time
      const returnIv = crypto.randomBytes(IV_LENGTH);
      const iv64 = bb.wrap(returnIv).toString('base64');

      // encrypt payloadData with symmetric Key using iv
      const cipherBody = await libsignal.crypto.encrypt(symKey, payloadData, returnIv);
      // console.log('cipherBody', cipherBody)

      // make final buffer for cipherText
      const ivAndCiphertext = new Uint8Array(
        returnIv.byteLength + cipherBody.byteLength
      );
      // add iv
      ivAndCiphertext.set(new Uint8Array(returnIv));
      // add ciphertext after iv position
      ivAndCiphertext.set(new Uint8Array(cipherBody), returnIv.byteLength);


      // convert final buffer to base64
      const cipherText64 = bb.wrap(ivAndCiphertext).toString('base64');

      sendresponse({
        meta: {
          code: 200
        },
        data: cipherText64,
      }, res);
      const respDiff = Date.now() - execStart;
      console.log(fakeReq.method, fakeReq.path, 'response took', respDiff, 'ms');
    });

  });
}