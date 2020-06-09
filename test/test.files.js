const assert = require('assert')
const FormData = require('form-data')

module.exports = {
  runTests: function(platformApi, nconf) {
    const webport = nconf.get('web:port') || 7070;
    const provider_url = nconf.get('pomf:provider_url') || 'http://127.0.0.1:' + webport + '/upload'
    if (!provider_url.match(/localhost|127.0.0.1|192.168/i)) {
      console.log('skipping files test because non-local provider', provider_url)
      return
    }
    let fileRes
    it('file upload', async () => {
      const formData = new FormData()
      const buffer = Buffer.from('{ "this": "is a string of json" }')
      formData.append('type', 'network.loki')
      formData.append('content', buffer, {
        contentType: 'application/octet-stream',
        name: 'content',
        filename: 'attachment',
      })
      const res = await platformApi.serverRequest('files', {
        method: 'POST',
        rawBody: formData
      })
      assert.equal(200, res.statusCode)
/*
{
  complete: true,
  created_at: '2019-12-30T04:06:05.060Z',
  derived_files: {},
  file_token: '/f/qohkjs',
  id: 1,
  image_info: { width: 600, height: 800 },
  kind: 'other',
  mime_type: 'application/octet-stream',
  name: 'attachment',
  sha1: 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
  size: 18,
  total_size: 18,
  type: 'network.loki',
  url: '/f/qohkjs',
  source: {
    name: 'Unknown',
    link: 'nowhere',
    client_id: 'mocha_platform_test'
  },
  user: {
    id: 1,
    username: 'test',
    created_at: '2019-12-30T04:06:04.948Z',
    canonical_url: null,
    type: null,
    timezone: 'US/Pacific',
    locale: 'en',
    avatar_image: { url: null, width: null, height: null, is_default: false },
    cover_image: { url: null, width: null, height: null, is_default: false },
    counts: { following: 0, posts: 0, followers: 0, stars: 0 },
    description: { text: 'Test description', html: '', entities: [Object] },
    name: 'Tested User'
  }
}
*/
      //console.log('file upload res', res.response.data)
      fileRes = res
      //console.log('setting fileRes', fileRes)
      // check upload
      let url = res.response.data.url
      // console.log('file URL', url)
      if (provider_url.match(/localhost|127.0.0.1|192.168/i)) {
        url = res.response.data.url.replace(/^\//, '')
        if (url.match(/:\/\//)) {
          console.log('absolute download test is not yet written, skipping')
        } else {
          // url isn't supposed to have it's front / by now...
          // console.log('file updated URL', url, 'platformApi', platformApi.base_url)
          const downloadRes = await platformApi.serverRequest(url, {
            //noJson: true
          })
          assert.equal(200, downloadRes.statusCode)
          // we don't need to assert this, we're not unit testing the pomf
          if (downloadRes.statusCode !== 200) {
            console.log('POMF download result code', downloadRes)
          }
        }
      }
    })
    // not implemented yet
    /*
    it('get file', async () => {
      const getFileRes = await platformApi.serverRequest('files/' + fileRes.response.data.id)
      assert.equal(200, getFileRes.statusCode)
    })
    it('get multiple file singular', async () => {
      const getFilesRes = await platformApi.serverRequest('files', {
        params: {
          ids: fileRes.response.data.id
        }
      })
      assert.equal(200, getFilesRes.statusCode)
    })
    */

    // we do this in users...
    /*
    it('get my files', async () => {
      const getMyFileRes = await platformApi.serverRequest('users/me/files')
      assert.equal(200, getMyFileRes.statusCode)
    })
    */
    // not implemented yet
    /*
    it('delete file', async () => {
      const delFileRes = await platformApi.serverRequest('files/' + fileRes.response.data.id, {
        method: 'DELETE'
      })
      assert.equal(200, delFileRes.statusCode)
    })
    */
  },
}
