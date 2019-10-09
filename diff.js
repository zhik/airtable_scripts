const fs = require('fs');
const fetch = require('node-fetch');
require('dotenv').config();

//https://stackoverflow.com/questions/1187518/how-to-get-the-difference-between-two-arrays-in-javascript
Array.prototype.diff = function(a) {
  return this.filter(function(i) {
    return !(a.indexOf(i) > -1);
  });
};

//compares to dbs.json to find differences in columns or tables
const dbs_old = JSON.parse(fs.readFileSync('./data/dbs_2019_10_1.json'));
const dbs_new = JSON.parse(fs.readFileSync('./data/dbs_2019_10_9.json'));

const change_log = [];

dbs_new.map(db_new => {
  const db_old = dbs_old.find(db_old => db_old.name === db_new.name);
  if (!db_old) {
    return 0;
  }
  //check for new or old tables
  const table_names_old = db_old.tables.map(table => table.name);
  const table_names_new = db_new.tables.map(table => table.name);
  table_names_old.diff(table_names_new).forEach(table => {
    change_log.push({
      CBDB: db_old.name,
      Operation: 'Remove',
      Table: table,
      Field: null
    });
  });

  table_names_new.diff(table_names_old).forEach(table => {
    change_log.push({
      CBDB: db_new.name,
      Operation: 'Add',
      Table: table,
      Field: null
    });
  });

  //check all tables for new columns
  db_new.tables.map(table_new => {
    const table_old = db_old.tables.find(
      table_old => table_old.name === table_new.name
    );
    if (!table_old) {
      return 0;
    }
    table_old.columns.diff(table_new.columns).forEach(column => {
      change_log.push({
        CBDB: db_old.name,
        Operation: 'Remove',
        Table: table_old.name,
        Field: column
      });
    });

    table_new.columns.diff(table_old.columns).forEach(column => {
      change_log.push({
        CBDB: db_new.name,
        Operation: 'Add',
        Table: table_new.name,
        Field: column
      });
    });
  });
});

const d = new Date();
change_log.forEach(entry => {
  //format CBDB
  entry.CBDB = entry.CBDB.slice(2, 8).toUpperCase();
  //add time
  entry.Timestamp = d.toString();
});

fetch(process.env.SHEET_BEST_URL, {
  method: 'post',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(change_log)
}).then(res => console.log(res));
