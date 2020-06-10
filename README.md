# Session-file-server
Session file server

an express REST API for serving persistent data for Session Software Suite.

System requirements:
- NodeJS
- A storage engine supported by [camintejs](https://github.com/biggora/caminte) for persistence
  - Recommended: MySQL/MariaDB, SQLite3, PostgresQL, Redis
  - Possible: Mongo, CouchDB, Neo4j, Cassandra, Riak, Firebird, TingoDB, RethikDB, ArangoDB

set up instructions may look something like
```
cp loki_template.ini loki.ini
# edit loki.ini
cp config.sample.json config.json
# edit config.json
npm i
npm i -g pm2
pm2 start app.js --watch
```

