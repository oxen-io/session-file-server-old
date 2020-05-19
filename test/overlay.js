const fs = require('fs');
const path = require('path');
const nconf = require('nconf');
const assert = require('assert');
const ini = require('loki-launcher/ini');
const lokinet = require('loki-launcher/lokinet');
const crypto = require('crypto');
const bb = require('bytebuffer');
const libsignal = require('libsignal');
const adnServerAPI = require('../fetchWrapper');

const IV_LENGTH = 16;

const config_path = path.join(__dirname, '/../config.json');
console.log('config_path', config_path);
nconf.argv().env('__').file({file: config_path});

const webport = nconf.get('web:port') || 7070;
const base_url = 'http://localhost:' + webport + '/'
console.log('base_url', base_url);

// loki specific endpoints
const overlayApi  = new adnServerAPI(base_url);

const ensureServer = () => {
  return new Promise((resolve, rej) => {
    console.log('app port', webport);
    lokinet.portIsFree('localhost', webport, function(free) {
      console.log('overlay_port is free?', !!free)
      if (free) {
        // make sure we use the same config...
        process.env['config-file-path'] = config_path;
        // make sure the web__port is what we tested...
        process.env['web__port'] = webport;
        const startPlatform = require('../app');
      } else {
        console.log('detected running file server testing that');
      }
      resolve();
    });
  });
};

// make our local keypair
const ourKey = libsignal.curve.generateKeyPair();
// encode server's pubKey in base64
const ourPubKey64 = bb.wrap(ourKey.pubKey).toString('base64');
const ourPubKeyHex = bb.wrap(ourKey.pubKey).toString('hex');

async function DHDecrypt(symmetricKey, ivAndCiphertext) {
  const iv = ivAndCiphertext.slice(0, IV_LENGTH);
  const ciphertext = ivAndCiphertext.slice(IV_LENGTH);
  return libsignal.crypto.decrypt(symmetricKey, ciphertext, iv);
}

// globally passing overlayApi
function get_challenge(ourKey, ourPubKeyHex) {
  return new Promise((resolve, rej) => {
    describe(`get challenge for ${ourPubKeyHex} /loki/v1/get_challenge`, async () => {
      // this can be broken into more it() if desired
      //it("returns status code 200", async () => {
        const result = await overlayApi.serverRequest('loki/v1/get_challenge', {
          params: {
           pubKey: ourPubKeyHex
          }
        });
        assert.equal(200, result.statusCode);
        const body = result.response;
        //console.log('get challenge body', body);
        // body.cipherText64
        // body.serverPubKey64 // base64 encoded pubkey

        // console.log('serverPubKey64', body.serverPubKey64);
        const serverPubKeyBuff = Buffer.from(body.serverPubKey64, 'base64')
        const serverPubKeyHex = serverPubKeyBuff.toString('hex');
        //console.log('serverPubKeyHex', serverPubKeyHex)

        const ivAndCiphertext = Buffer.from(body.cipherText64, 'base64');

        const symmetricKey = libsignal.curve.calculateAgreement(
          serverPubKeyBuff,
          ourKey.privKey
        );
        const token = await DHDecrypt(symmetricKey, ivAndCiphertext);
        const tokenString = token.toString('utf8');
        //console.log('tokenString', tokenString);
        resolve(tokenString);
      //});
    });
  });
}

function submit_challenge(tokenString) {
  return new Promise((resolve, rej) => {
    describe(`submit challenge for ${tokenString} /loki/v1/submit_challenge`, async () => {
      //it("returns status code 200", async () => {
        const result = await overlayApi.serverRequest('loki/v1/submit_challenge', {
          method: 'POST',
          objBody: {
            pubKey: ourPubKeyHex,
            token: tokenString,
          },
          noJson: true
        });
        assert.equal(200, result.statusCode);
        // body should be ''
        //console.log('submit challenge body', body);
        resolve();
      //});
    });
  });
}

// requires overlayApi to be configured with a token
function user_info() {
  return new Promise((resolve, rej) => {
    describe("get user_info /loki/v1/user_info", async () => {
      //it("returns status code 200", async () => {
        const result = await overlayApi.serverRequest('loki/v1/user_info');
        assert.equal(200, result.statusCode);
        //console.log('get user_info body', body);
        // {"meta":{"code":200},"data":{
        // "user_id":10,"client_id":"messenger",
        //"scopes":"basic stream write_post follow messages update_profile files export",
        //"created_at":"2019-09-09T01:15:06.000Z","expires_at":"2019-09-09T02:15:06.000Z"}}
        resolve();
      //});
    });
  });
}

const runIntegrationTests = async (ourKey, ourPubKeyHex) => {
  describe('ensureServer', async () => {
    it('make sure we have something to test', async () => {
      await ensureServer();
    });
  });
  let channelId = 1; // default channel to try to test first

  // get our token
  let tokenString
  describe('token dialect', () => {
    require('./tests/tokens/get_challenge.js')(testInfo);
    require('./tests/tokens/submit_challenge.js')(testInfo);
    it('set token', async function() {
      tokenString = testInfo.tokenString;
      console.log('tokenString', tokenString);
      // set token
      overlayApi.token = tokenString;
      //platformApi.token = tokenString;
      //userid = await getUserID(ourPubKeyHex);
    });
    require('./tests/tokens/user_info.js')(testInfo);
    require('./tests/tokens/time.js')(testInfo);
    require('./tests/rss_proxy/version.js')(testInfo);
    require('./tests/rss_proxy/rss.js')(testInfo); // slow
    require('./tests/loki_proxy/secure_rpc.js')(testInfo); // even slower
  });
  // test custom homepage

  // all tests should be complete
  //console.log('all done!')
  //process.exit(0);
}

let testInfo = {
  overlayApi,
  ourKey,
  ourPubKeyHex
}

//console.log('bob');
runIntegrationTests(ourKey, ourPubKeyHex);
