const fs        = require('fs');
const crypto    = require('crypto');
const bb        = require('bytebuffer');
const libsignal = require('libsignal');
const assert    = require('assert');
const lib       = require('../lib');

const IV_LENGTH = 16;
/*
const LOKIFOUNDATION_FILESERVER_PUBKEY = 'BSZiMVxOco/b3sYfaeyiMWv/JnqokxGXkHoclEx8TmZ6';
const FileServerPubKey = Buffer.from(
  bb.wrap(LOKIFOUNDATION_FILESERVER_PUBKEY,'base64').toArrayBuffer()
);
*/

const FILE_SERVER_PRIV_KEY_FILE = 'proxy.key'
const FILE_SERVER_PUB_KEY_FILE = 'proxy.pub'

/*
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
*/

// load into buffers
// const serverPrivKey = fs.readFileSync(FILE_SERVER_PRIV_KEY_FILE);
const FileServerPubKey = fs.readFileSync(FILE_SERVER_PUB_KEY_FILE);

const LOKIFOUNDATION_FILESERVER_PUBKEY = bb.wrap(FileServerPubKey).toString('base64');


const DHEncrypt64 = async (symmetricKey, plainText) => {
  // generate an iv (web-friendly)
  const iv = crypto.randomBytes(IV_LENGTH);
  // encrypt plainText
  const ciphertext = await libsignal.crypto.encrypt(
    symmetricKey,
    plainText,
    iv
  );
  // create buffer
  const ivAndCiphertext = new Uint8Array(
    iv.byteLength + ciphertext.byteLength
  );
  // copy iv into buffer
  ivAndCiphertext.set(new Uint8Array(iv));
  // copy ciphertext into buffer
  ivAndCiphertext.set(new Uint8Array(ciphertext), iv.byteLength);
  // base64 encode
  return bb.wrap(ivAndCiphertext).toString('base64');
}

const DHDecrypt64 = async (symmetricKey, cipherText64) => {
  // base64 decode
  const ivAndCiphertext = Buffer.from(
    bb.wrap(cipherText64, 'base64').toArrayBuffer()
  );
  // extract iv
  const iv = ivAndCiphertext.slice(0, IV_LENGTH);
  // extract ciphertext
  const ciphertext = ivAndCiphertext.slice(IV_LENGTH);
  // decode plaintext
  return libsignal.crypto.decrypt(symmetricKey, ciphertext, iv);
}

const innerRequest = async (testInfo, payloadObj) => {
  const payloadData = Buffer.from(
    bb.wrap(JSON.stringify(payloadObj)).toArrayBuffer()
  );
  // test token endpoints
  const ephemeralKey = libsignal.curve.generateKeyPair();

  // mix server pub key with our priv key
  const symKey = libsignal.curve.calculateAgreement(
    FileServerPubKey, // server's pubkey
    ephemeralKey.privKey // our privkey
  );

  // make sym key
  const cipherText64 = await DHEncrypt64(symKey, payloadData);
  const result = await testInfo.overlayApi.serverRequest('loki/v1/secure_rpc', {
    method: 'POST',
    objBody: {
      cipherText64
    },
    // out headers
    headers: {
      'Content-Type': 'application/json',
      'x-loki-file-server-ephemeral-key': bb.wrap(ephemeralKey.pubKey).toString('base64'),
    },
  });

  return { result, symKey };
}

const decryptResponse = async (data64, symKey) => {
  const ivAndCiphertextResponse = bb.wrap(data64,'base64').toArrayBuffer();

  const riv = Buffer.from(ivAndCiphertextResponse.slice(0, IV_LENGTH));
  const rciphertext = Buffer.from(ivAndCiphertextResponse.slice(IV_LENGTH));

  const decrypted = await libsignal.crypto.decrypt(
    symKey,
    rciphertext,
    riv,
  );
  // not all results are json (/time /)
  return decrypted.toString();
}

const testSecureRpc = async (payloadObj, testInfo) => {
  const { result, symKey } = await innerRequest(testInfo, payloadObj);
  assert.equal(200, result.statusCode);
  assert.ok(result.response);
  assert.ok(result.response.meta);
  assert.equal(200, result.response.meta.code);
  assert.ok(result.response.data);
  const str = await decryptResponse(result.response.data, symKey);
  return str;
}

module.exports = (testInfo) => {
  it('server public key', async function() {
    // test token endpoints
    const result = await testInfo.overlayApi.serverRequest('loki/v1/public_key');
    assert.equal(200, result.statusCode);
    assert.ok(result.response);
    assert.ok(result.response.meta);
    assert.equal(200, result.response.meta.code);
    assert.ok(result.response.data); // 'BWJQnVm97sQE3Q1InB4Vuo+U/T1hmwHBv0ipkiv8tzEc'
  });
  // no reason to test through a snode...
  it('secure rpc homepage', async function() {
    const payloadObj = {
      body: {}, // might need to b64 if binary...
      endpoint: '',
      method: 'GET',
      headers: {},
    };
    const str = await testSecureRpc(payloadObj, testInfo);
    assert.ok(str);
  });
  it('secure rpc time', async function() {
    const payloadObj = {
      body: {}, // might need to b64 if binary...
      endpoint: 'loki/v1/time',
      method: 'GET',
      headers: {},
    };
    const str = await testSecureRpc(payloadObj, testInfo);
    assert.ok(str);
  });
  it('secure rpc rss', async function() {
    const payloadObj = {
      body: {}, // might need to b64 if binary...
      endpoint: 'loki/v1/rss/messenger',
      method: 'GET',
      headers: {},
    };
    const str = await testSecureRpc(payloadObj, testInfo);
    assert.ok(str);
  });
  it('secure rpc version', async function() {
    const payloadObj = {
      body: {}, // might need to b64 if binary...
      endpoint: 'loki/v1/version/client/desktop',
      method: 'GET',
      headers: {},
    };
    const json = await testSecureRpc(payloadObj, testInfo);
    assert.ok(json);
    const obj = JSON.parse(json);
    // console.log('obj', obj)
    assert.ok(obj);
    assert.ok(obj.meta);
    assert.equal(200, obj.meta.code);
  });
  it('secure rpc get users by id', async function() {
    const payloadObj = {
      body: {}, // might need to b64 if binary...
      endpoint: 'users?include_user_annotations=1&ids=@053b0ff9567a9ae0c2c62d5c37eb065b766e18d90e1c92c5a4a1ee1ba8d235b26e',
      method: 'GET',
      headers: {},
    };
    const json = await testSecureRpc(payloadObj, testInfo);
    assert.ok(json);
    const obj = JSON.parse(json);
    // console.log('obj', obj)
    assert.ok(obj);
    assert.ok(obj.meta);
    assert.equal(200, obj.meta.code);
    assert.ok(obj.data);
  });
  // TODO:
  // patch users/me
  // file upload
  // token exchange...
  it('secure rpc get/submit challenge', async function() {
    const ephemeralKey = libsignal.curve.generateKeyPair();
    const getChalPayloadObj = {
      // I think this is a stream, we may need to collect it all?
      body: null,
      endpoint: "loki/v1/get_challenge?pubKey=" + ephemeralKey.pubKey.toString('hex'),
      method: "GET",
      headers: {},
    };
    const json = await testSecureRpc(getChalPayloadObj, testInfo);
    const response = JSON.parse(json);
    assert.ok(response.cipherText64);
    assert.ok(response.serverPubKey64);
    // test b64 decode?
    // that's why this next line kind of does...
    const symmetricKey = libsignal.curve.calculateAgreement(
      Buffer.from(response.serverPubKey64, 'base64'),
      ephemeralKey.privKey
    );
    const token = await DHDecrypt64(symmetricKey, response.cipherText64);
    const submitChalPayloadObj = {
      // I think this is a stream, we may need to collect it all?
      body: '{"pubKey":"' + ephemeralKey.pubKey.toString('hex') + '","token":"' + token + '"}',
      endpoint: "loki/v1/submit_challenge",
      method: "POST",
      headers: { 'content-type': 'application/json; charset=utf-8' },
    };
    // will auto test the response enough
    await testSecureRpc(submitChalPayloadObj, testInfo);
  });
  it('secure rpc missing header', async function() {
    const payloadObj = {
      body: {}, // might need to b64 if binary...
      endpoint: 'loki/v1/time',
      method: 'GET',
    };
    const str = await testSecureRpc(payloadObj, testInfo);
    assert.ok(str);
  });
  it('secure rpc missing body', async function() {
    const payloadObj = {
      endpoint: 'loki/v1/time',
      method: 'GET',
      headers: {},
    };
    const str = await testSecureRpc(payloadObj, testInfo);
    assert.ok(str);
  });
  it('secure rpc missing method', async function() {
    const payloadObj = {
      endpoint: 'loki/v1/time',
      body: {}, // might need to b64 if binary...
      headers: {},
    };
    const str = await testSecureRpc(payloadObj, testInfo);
    assert.ok(str);
  });
  it('secure rpc missing body & header', async function() {
    const payloadObj = {
      endpoint: 'loki/v1/time',
      method: 'GET',
    };
    const str = await testSecureRpc(payloadObj, testInfo);
    assert.ok(str);
  });

}
