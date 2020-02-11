const path = require('path')
const nconf = require('nconf')
const request = require("request")
const assert = require('assert')

// Look for a config file
const config_path = path.join(__dirname, '/config.json');
// and a model file
const config_model_path = path.join(__dirname, '/config.models.json');
nconf.argv().env('__').file({file: config_path}).file('model', {file: config_model_path});

let webport = nconf.get('web:port') || 7070;
const base_url = 'http://localhost:' + webport + '/'
console.log('read', base_url)

const token = ''

function harness200(options, nextTest) {
  it("returns status code 200", function(done) {
    request(options, function(error, response, body) {
      assert.equal(200, response.statusCode)
      done()
      if (nextTest) nextTest(body)
    })
  })
}

describe("Hello World Server", function() {
  describe("GET /", function() {
    harness200({ url: base_url, method: 'GET' })
  })
  // file upload tests
  // plus test config file size limit

  /*
  describe("create /channels", function() {
    const str = {
      type: 'moe.sapphire.test',
    }
    harness200({
      method: 'POST',
      url: base_url + 'channels',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      json: true,
      body: str
    }, function(body) {
      const channelId = body.data.id
      describe("create /channels/"+channelId+"/messages", function() {
        const createMsgParams = {
          text: 'integration test😋',
        }
        harness200({
          method: 'POST',
          url: base_url + 'channels/' + channelId + '/messages',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          json: true,
          body: createMsgParams
        }, function(body) {
          const messageId = body.data.id

          // delete message
          describe("delete /channels/"+channelId+"/messages/" + messageId, function() {
            harness200({
              method: 'DELETE',
              url: base_url + 'channels/' + channelId + '/messages/' + messageId,
              headers: {
                'Authorization': 'Bearer ' + token
              },
            }, function(body) {
              // delete channel
              describe("delete /channel", function() {
                harness200({
                  method: 'DELETE',
                  url: base_url + 'channels/' + channelId,
                  headers: {
                    'Authorization': 'Bearer ' + token
                  },
                })
              })
            })
          })
        })
      })
    })
  })
  */

})
