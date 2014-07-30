AltAPI code base
===
Please review the AltAPI code base, it is written in my style and not sure if its terribly palatable. I want to ensure most devs can easily read and understand what's going on, so it's critical to the success of the project for me to deliver as much clarification and documentation as you, the oncoming, need. But I need you help identifying the weak parts. 

How to get familiar with the AltAPI code base
======

1. Start with a quick review of app.js it's only a couple hundred lines. This is where the set up and main loop of the program is.
2. Next I would say check out the dialect files (specifically "dialect.appdotnet_official.js") file. This is where all the incoming API HTTP requests are bound to functions. New API endpoints would be given their own dialect files.
Typically each endpoint makes a call to dispatcher and then formats the response and sends it out. Dispatcher call is given a callback of what to do with the returned data. 
Most functions read and write take a callback about what to do with the data. For reads its pointless call without a callback, so it's always required. Writes is more optional. The callback allow the read/write to potentially happen in an parallel manner.
Dialect also has format functions that take our internal formats and make sure they're cast to the correct adn data type before being outputted.
There was a lot of code that was being duplicated, so we made some of the code more generic and put it in "dialect.appdotnet_official.callbacks.js". 

3. So you can go to the dispatcher or the dataaccess.caminte.js (depending if you want to see the backing data store/models or the internal API). Dispatcher contains our internal API and communicates with the data access layers. Caminte.js contains all of our actual data storage models and the API to query them. 

4. dataaccess.caminte.js: To be reviewed
http://camintejs.com/

5. dispatcher.js: To be reviewed

FAQ
===
Q: Are there any Node.JS resources any of you recommend to get caught up? 
A: Yes, become familiar with the npm tool, express 4.x framework (we use this, however materials on the web seem to be mostly for the earlier versions that are way different) and maybe camintejs.com

Q: How can I test my changes didn't break anything?
A: You can check your work with the opportunity dragon script. It runs an API call against the live and local and shows any differences. It can be hard to decipher the output though. app.js is a server. OpportunityDragon is written as a client. You need to start the server by "node app.js", then "node OpportunityDragon.js" to run the tests against the server. 

Q: How can I get all the required modules?
A: "npm install" should read package.json and install all the project requirements 