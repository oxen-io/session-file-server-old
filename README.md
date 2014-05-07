appdotnetapi
============

An App.net compatible API implemented as an App.net client.

This is a piece of software that you can run to emulate the ADN API that all
the existing app.net apps could connect to.
if we can convince app developers to include an API root in their app.net software,
we can keep the community and software intact.

well, we'd need a (u)wsgi daemon for serving web requests.
Then another daemon for websocket streaming.
And then possible a background daemon for maintenance or background processing.

it was work as a back up to the main ADN. So while ADN is running everything could feel like one network.

Compatibility would be goal #1.

Making APN be configurable would prove more challenging.
I'd have to look into that, as I don't know much about them besides most of them are using app streaming. Not sure what restrictions Apple and Devs have.

Well I think it should support multiple operational modes (different backends):
1. App.net proxy (work with the main app.net infrastructure) using app streaming and indentity delegation
2. Standalone, your own social network
3. P2p/tent.io etc

Trying to figure out an implementation language to start development.

Possibly written in Go or C?
Using Redis and MySQL

I have a datastore schema.

Phase #1
Public endpoints

Phase #2
Authenticated endpoints
I'm considering a local user database. And then you can authorize official your official ADN account. That way no one has to expose any current password.

Phase #3
Streaming

For a more p2p system, we really should look at tent.io, pond, or maidsafe.net to see how they handle auth.
I'm sure UUIDs are used somewhere.