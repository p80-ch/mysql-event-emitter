# mysql-event-emitter
A mysql / mariadb event emitter.  

_For now it will only tell you \*that\* something changed - not what changed._

It is tested against `mariadb 10.1.31`.


## Install
`npm install mysql-event-emitter`


## Setup
### Mysql Server
Enable binary log replication in `/etc/mysql/my.cnf`
```
[mysqld]
server-id        = 1
log_bin          = /var/log/mysql/mysql-bin
log_bin_index    = /var/log/mysql/mysql-bin.index
binlog-format    = row
```

### Mysql User
Give your user the rights to read binary logs
```sql
GRANT REPLICATION SLAVE, REPLICATION CLIENT, SELECT ON *.* TO '[USER]'@'[HOST]'
```


## Usage
```js
const MyEmitter = require('mysql-event-emitter');

var mye =  MyEmitter({
  "mysql": {
    "user": "[USER]",
    "password": "[PWD]"
  }
});

mye.on('change', function(db, table, event){
  console.log('An ' + event + ' occured in ' + db + '.' + table);
}):

mye.on('insert', function(db, table){
  console.log('An insert occured in ' + db + '.' + table);
}):

// Vanilla Events
mye.on('MyDB.MyTable.insert', function(){
  console.log('An insert occured in MyDB.MyTable');
}):

mye.on('MyDB.MyTable', function(event){
  console.log('An ' + event + ' occured in MyDB.MyTable');
}):

mye.on('MyDB', function(table, event){
  console.log('An ' + event + ' occured in MyDB.' + table);
}):

mye.start(function(err){
  if (err) throw err;
  console.log('started');
});

```


## Options
- For a single instance no binlog option is needed
- Any [mysql](https://www.npmjs.com/package/mysql) [connection](https://www.npmjs.com/package/mysql#connection-options) and [pool](https://www.npmjs.com/package/mysql#pool-options) option is supported.  

**Defaults**
```js
{  
  // mysql pool options
  "mysql": {
    "[socket]": "[SOCKET]",
    "[host]":   "127.0.0.1",
    "user":     "[USER]",
    "password": "[PWD]",
    "[database]": null        // (is not required)
  }
  // binlog options
  "binlog": {
    "slaveId": 1,             // Needs to be counted up, if more than one instance is running  
    "recoverTimeout": 240,    // Time in ms between reconnection attempts. (Eg. on a mysql server restart)
  }
}
```


## Events
Event        | Data              | . 
------------ | ----------------- | --- 
change       | DB, Table, Event  | Any of the following events 
insert       | DB, Table | 
update       | DB, Table | 
delete       | DB, Table | 
truncate     | DB, Table | 
connected    | | 
disconnected | | 
reconnecting | | 
recovering   | | 
error        | Error | 

### Vanilla Events
For your individual db's and tables, vanilla events can be defined: `mye.on('MyDB.MyTable.insert')`.  

Event                      | Data 
-------------------------- | --- 
[TABLE]                    | Event 
[TABLE].[EVENT]            | 
[DATABASE]                 | Table, Event 
[DATABASE].[TABLE]         | Event 
[DATABASE].[TABLE].[EVENT] | 
