module.exports = {
  /** posts */
  addPost: function(json) {
    console.log('proto.buffer.js::addPost - write me!');
  },
  getPost: function(id) {
  },
  getGlobal: function() {
  },
  getUserPosts: function(userid) {
  },
  getUserStars: function(userid) {
  },
  getHashtag: function(hashtag) {
  },
  /** channels */
  addChannel: function(json) {
    console.log('proto.buffer.js::addChannel - write me!');
  },
  getChannel: function(id) {
  },
  /** messages */
  addMessage: function(json) {
    console.log('proto.buffer.js::addMessage - write me!');
  },
  getChannelMessages: function(cid) {
  },
  getChannelMessage: function(cid,mids) {
  },
  /** channel_subscription */
  addChannelSubscription: function(data,deleted,ts) {
  },
  /** file */
  /** stream_marker */
  addStreamMakerdata: function(data) {
  },
  /** token */
  /** star */
  addStar: function(data,deleted,id,ts) {
  },
  /** mute */
  /** block */
  /** user */
  updateUser: function(data,ts) {
  },
  /** user_follow */
  addFollows: function(data,deleted,id,ts) {
  },
  /** dispatcher for streamrouter */
  dispatch: function(userid, json) {
    // remember json is in app streaming format!
    //console.dir(json);
    var data=json.data;
    var meta=json.meta;
    // the missing meta is going to be an issue
    /*
     { meta:
       { suppress_notifications_all: false,
         timestamp: 1399812206341,
         type: 'post',
         id: '30224684',
         suppress_notifications: [] },
    */
    switch(meta.type) {
      case 'post':
        // transfer stream encoding over to normal post structure
        if (meta && meta.is_deleted) {
          if (data==undefined) data={};
          data.is_deleted=true;
        }
        this.addPost(data);
        // this.updateUser(data,meta.timestamp);
        // if (data.annotations) {
        //   this.extractAnnotation(data);
        // }
      break;
      case 'channel':
        this.addChannel(data,meta.timestamp);
        // annotation?
      break;
      case 'message':
        this.addMessage(data);
        // this.updateUser(data,meta.timestamp);
        // if (data.annotations) {
        //   this.extractAnnotation(data,'message');
        // }
      break;
      case 'channel_subscription':
        console.log('channel_subscription');
        // this.addChannelSubscription(data,meta.is_deleted,meta.timestamp);
      break;
      case 'file':
        console.log('file');
      break;
      case 'stream_marker':
        console.log('stream_marker');
        // this.addStreamMakerdata(data);
        // this.updateUser(data,meta.timestamp);
      break;
      case 'token':
        console.log('token');
      break;
      case 'star':
        //console.log('star');
        // need to know when this event happened
        this.addStar(data,meta.is_deleted,meta.id,meta.timestamp);
        // do we get a full post object too?
        // this.updateUser(data,meta.timestamp);
      break;
      case 'mute':
        console.log('mute');
      break;
      case 'block':
        console.log('block');
      break;
      case 'user':
        console.log('user');
        // this.updateUser(data,meta.timestamp);
      break;
      case 'user_follow':
        //console.log('user_follow');
        this.addFollows(data,meta.is_deleted,meta.id,meta.timestamp)
      break;
      default:
        console.log("proto.buffer.js::dispatch - unknown appstream type ["+meta.type+"]");
      break;
    }
  }
}