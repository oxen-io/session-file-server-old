const assert = require('assert')

module.exports = {
  runTests: function(platformApi) {
    it('read token', async () => {
      const res = await platformApi.serverRequest('token')
      assert.equal(200, res.statusCode)
/*
res {
  app: {
    client_id: 'mocha_platform_test',
    link: 'http://foo.example.com',
    name: 'Test app'
  },
  scopes: [ 'stream', 'messages', 'export', 'write_post', 'follow' ],
  limits: { following: 40, max_file_size: 10000000 },
  storage: { available: 8787479688, used: 1212520312 },
  user: {
    id: '234',
    username: 'test',
    created_at: '2019-09-23T22:36:27Z',
    canonical_url: null,
    type: null,
    timezone: null,
    locale: null,
    avatar_image: { url: null, width: null, height: null, is_default: false },
    cover_image: { url: null, width: null, height: null, is_default: false },
    counts: { following: 0, posts: 0, followers: 0, stars: 0 },
    follows_you: false,
    you_blocked: false,
    you_follow: false,
    you_muted: false,
    you_can_subscribe: false,
    you_can_follow: true
  },
  invite_link: 'https://join.app.net/from/notareallink'
}
*/
      //console.log('res', res.response.data)
    })
    it('read config', async () => {
      const configRes = await platformApi.serverRequest('config')
      assert.equal(200, configRes.statusCode)
    })
    it('read oembed', async () => {
      const oembedRes = await platformApi.serverRequest('oembed', {
        params: {
          url: '',
        }
      })
      assert.equal(200, oembedRes.statusCode)
    })
    /*
    it('process text', async () => {
      const textRes = await platformApi.serverRequest('text/process', {
        method: 'POST',
        objBody: {
          text: "This is #awesome tell @voidfiles about http://google.com",
        }
      })
      assert.equal(200, textRes.statusCode)
    })
    */
  },
}
