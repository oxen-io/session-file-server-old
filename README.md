AppDotNetAPI
============

An App.net compatible API implemented as an App.net client.

This is a piece of software that you can run to emulate the app.net API that all
the existing app.net apps could connect to,
if we can convince app developers to include an API root in their app.net software.
This way we can keep the community and software intact.

Compatibility is goal #1.

#Upstream integration

It can work as a back up to the main app.net. So while app.net is running everything could feel like one network.

A local account can be linked with an App.net account. All local created post can be cross posted to app.net. All app.net created post can be streaming into our data source and out to clients. Ensuring seemless two way posting between the networks on a per user basis.

An API server operator can decide whether to allow non-linked app.net accounts to be able to posts or not. If not allowed they're be a complete two-way App.net relay and backup. If they're allowed to post then the server operator will end up with content only available on their network.

This client/server relationship actually allows an API server whether it's app.net or other API compliant servers to link up in a hub-spoke topology and distribute the network across additional resources. Though work and planning will need to be put into distributed authentication and authorize.

As well as you can set up your own standalone social network and embrace all the app.net clients that support setting an alternative API root.

#Components

## Daemons
We'd need a web daemon for serving web requests.
Then a background daemon for upstream streaming (connects to app.net using an app streaming), maintenance or background processing.
And then a websocket daemon for user streaming.

The web and background daemon will be written in NodeJS as they'll need to share code for creating posts. 

The websocket daemon will be written in Go since it'll just be reading and no writing.


##OAuth and sign up
We will need to implement our own oauth server and sign up process. Since we don't want users using their real app.net username and password.

##Data store
I have a datastore schema started in MySQL based on the data structures that app.net uses. We will need some additional tables to host our own oauth system.

Earlier phases will go straight into MySQL. Later on, I believe we can create a clever Redis caching layer between MySQL and the daemons as well as utilize it's message queuing for streaming.

Luckily large parts of the app.net data set are immutable which is very cache friendly (indefinitely).

I'd love to see an option that's Redis (in-memory) only. So a small server could be set up for quick and easy testing and development.

This MySQL and/or Redis flexibility will require an abstracted wrapper around the storage and message queueing operations.


#I'm an app.net 3rd party developer how can I get my app ready for an alternative API server?
We just need you to have the root of the API request to be configureable.
So if you have "https://api.app.net/" or "https://alpha-api.app.net/stream/0/" are your API root right now, you just need an UI for your users to be able to enter an alternate root. This will allows users to select what API to connect to and use.

#Roadmap

##Phase #1 - Public endpoints
This is an easy target to lay out the base foundation. We just need a data store and a webserver. We will just stream, store and relay app.net data.

- posts
- channels/messages
- configuration
- text processor
- oEmbed

##Phase #2 - Authenticated endpoints
I'm considering a local user database. And then you can authorize official your official ADN account. That way no one has to expose any current password.

We will need to implement our own o-auth server that follows the App.net process with appropriate scopes.

- users
- files
- interactions
- stream marker

##Phase #3 - Streaming
I feel that not many important app.net clients embrace user or app streaming (outside push notifications). So we can delay this peice until phase #3.

- user streaming
- app streaming

##Phase #4 - API Compatiblitilty Completion
- Search / Place

##Phase #5 Beyond app.net
- what did you want to see in the API?


Config
======

#####Standalone mode:
Disables any app.net connectivity. Serves it's only social network to any
app.net API supported client
1. Participate in the App.net social network
2. Standalone social network

######port settings
???

######api base root url
Where does this server live.

#####App.net client id
#####App.net client secret
if connecting upstream to app.net, you'll need to set these to allow user authorization with the upstream network.
#####App.net user token
if receiving a post from spoke API and we need to send it to a parent network, we will have to force all these posts to be under a single user's token. Not ideal but better than nothing

#####Rate limtis
Global, verified user, user. Read/Write.

#####MySQL & Redis connection information
What's enabled? Host, user, pass, etc

######Factual API key

#####Allowed client IDs & Secrets
Limit 3rd party client connectivity

#####Additional Protocol Modules:
these would allow additional downstream pushes of streams.

1. tent.io API - this
2. pond API
3. maidasafe.net API
4. Activity Streams
5. PuSH/RSS
6. Webfinger
7. App.net extensions (what new API features can we add?)


Potential Issues
======
- Scale
Our implementation will not likely be able to host many connections without considerable resoures.

- Authentication
Each user in each spoke needs to authenticate with the parent network. For a more p2p system, we really should look at tent.io, pond, or maidsafe.net to see how they handle auth. I'm sure UUIDs are used somewhere.

- Client Secrets & IDs
To make a client compatible to the real App.net and our API, they will not likely change their client ID. This is not a big deal since apps like patter or vidcast have to expose these in their source that's publicly viewable but we should take care to make sure we don't expose anything unecessarily.

- Location services - While factual has an API, each instances would need their own license.
This maybe feature we cannot easily support
