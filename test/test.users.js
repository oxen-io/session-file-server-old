const assert = require('assert')

module.exports = {
  runTests: function(platformApi) {
    it('user search', async () => {
      const res = await platformApi.serverRequest('users/search?q=test')
      assert.equal(200, res.statusCode)
      // FIXME: [] we're not found??
      //console.log('user search res', res.response.data)
    })
    it('write user', async () => {
      const res = await platformApi.serverRequest('users/me', {
        method: 'PUT',
        objBody: {
          name: 'Test User',
          locale: 'en',
          timezone: 'US/Pacific',
          description: {
            text: 'Test description',
          }
        },
      })
      assert.equal(200, res.statusCode)
    })
    it('update user', async () => {
      const res = await platformApi.serverRequest('users/me', {
        method: 'PATCH',
        objBody: {
          name: 'Tested User',
        }
      })
      assert.equal(200, res.statusCode)
    })

    it('single user lookup', async () => {
      const userLookupRes = await platformApi.serverRequest('users/@test')
      assert.equal(200, userLookupRes.statusCode)
      //console.log('single user lookup res', multiuserLookupRes.response.data)
    })

    it('multiple user lookup', async () => {
      const multiuserLookupRes = await platformApi.serverRequest('users', {
        params: {
          ids: '@test'
        }
      })
      assert.equal(200, multiuserLookupRes.statusCode)
      //console.log('multiple user lookup res', multiuserLookupRes.response.data)
    })

    /*
    it('user follow self', async () => {
      const res = await platformApi.serverRequest('users/@test/follow', {
        method: 'POST',
      })
      assert.equal(200, res.statusCode)
      // user obj
      // you_follow/follows_you should probably be true...
      //console.log('user follow self res', res.response.data)
    })

    it('get user followings', async () => {
      const userFollowRes = await platformApi.serverRequest('users/@test/following')
      assert.equal(200, userFollowRes.statusCode)
      // right now just an array of a ton of posts...
      //console.log('get user followings res', userFollowRes.response.data)
    })
    it('get user followers', async () => {
      const userFollowRes = await platformApi.serverRequest('users/@test/followers')
      assert.equal(200, userFollowRes.statusCode)
      // should be greater than one...
      //assert.equal(200, userFollowRes.response.data.length)
      // or loop through and find us...
      // right now just an array of a ton of posts...
      //console.log('get user followers res', userFollowRes.response.data)
    })


    it('user unfollow self', async () => {
      const res = await platformApi.serverRequest('users/@test/follow', {
        method: 'DELETE',
      })
      assert.equal(200, res.statusCode)
      // user obj
      // you_follow/follows_you should probably be false...
      //console.log('user unfollow self res', res.response.data)
    })

    it('get user files', async () => {
      const res = await platformApi.serverRequest('users/me/files')
      assert.equal(200, res.statusCode)
      // right now just []
      //console.log('user files res', res.response.data)
    })

    it('get user stream', async () => {
      const res = await platformApi.serverRequest('posts/stream')
      assert.equal(200, res.statusCode)
      // right now just []
      //console.log('user files res', res.response.data)
    })

    it('get unified stream', async () => {
      const res = await platformApi.serverRequest('posts/stream/unified')
      assert.equal(200, res.statusCode)
      // right now just []
      //console.log('user files res', res.response.data)
    })
    */
  },
}
