const assert = require('assert');

const lib = require('../lib');

module.exports = (testInfo) => {
  it('time', async function() {
    // test token endpoints
    const result = await testInfo.overlayApi.serverRequest('loki/v1/time');
    //console_wrapper.log('user user_info result', result)
    assert.equal(200, result.statusCode);
    assert.ok(result.response); // is a timestamp...
  });
}
