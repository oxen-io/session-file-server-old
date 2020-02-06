const assert = require('assert');

const lib = require('../lib');

module.exports = (testInfo) => {
  lib.setup(testInfo);
  it('get token', async function() {
    const result = await lib.get_challenge(testInfo.ourPubKeyHex);
    assert.equal(200, result.statusCode);
    testInfo.tokenString = await lib.decodeToken(testInfo.ourKey, result);
  });
}
