/*
rateLimit(function() {
  request.get(function(err, res, body) {
    logRequest();
  });
});
*/

// minutely status report
setInterval(function () {
  var ts=new Date().getTime();
  process.stdout.write("\n");
  var ref=module.exports;
  console.log('rate.limit report, resetting in', (ts-ref.resetAt).toLocaleString(), 'ms');
  // just need a redis info call to pull memory and keys stats
}, 60*1000);

// pass in proxy settings or just conf it?
module.exports = {
  resetAt: Date.now(),
  rateCounters: {},
  logRequest: function(isAuth, isWrite) {
    var now=Date.now();
    if (now>=this.resetAt) {
      console.log('resetting rate limits');
      // how often do we want to reset?
      this.resetAt=now+60000; // 50 calls per 1 minute is the strickest
      this.rateCounters[0]={};
      this.rateCounters[0][0]=50;
      this.rateCounters[0][1]=50;
      this.rateCounters[1]={};
      this.rateCounters[1][0]=83;
      this.rateCounters[1][1]=20;
    }
    console.log('watching rate limit');
    this.rateCounters[isAuth][isWrite]--;
  },
  rateLimit: function(isAuth, isWrite, callback) {
    if (this.rateCounters[isAuth]===undefined) this.rateCounters[isAuth]={};
    var callsleft=this.rateCounters[isAuth][isWrite];
    console.log('callsleft for', isAuth, isWrite, 'are', callsleft);
    if (callsleft<1) {
      var delay=this.resetAt-Date.now();
      console.log('delaying call by', delay);
      setTimeout(function() {
        callback();
      }, delay);
      return true;
    }
    callback();
  }
}

module.exports.logRequest(0, 0);
