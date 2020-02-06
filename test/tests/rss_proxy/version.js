const assert = require('assert');

const lib = require('../lib');

module.exports = (testInfo) => {
  it('version', async function() {
    // test token endpoints
    const result = await testInfo.overlayApi.serverRequest('loki/v1/version/client/desktop');
    assert.equal(200, result.statusCode);
    assert.ok(result.response); // is a timestamp...
    assert.ok(result.response.meta);
    assert.equal(200, result.response.meta.code);
    assert.ok(result.response.data);
    assert.ok(result.response.data[0]);
    assert.ok(result.response.data[0][0]); // first dns txt record
  });
}
