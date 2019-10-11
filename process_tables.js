const XLSX = require('xlsx');
const fs = require('fs');

const dbs = JSON.parse(fs.readFileSync('./data/dbs_2019_10_11.json'));

const unique_tables_columns = dbs.reduce((t, db) => {
  db.tables.forEach(table => {
    if (!(table.name in t)) {
      t[table.name] = [];
    }
    t[table.name] = new Set([...t[table.name], ...table.columns]);
  });
  return t;
}, {});

//get usage of unique_tables_columns
const db_sorted = dbs.sort((a, b) => {
  //sort by boro letters then CB number
  function getValues(name) {
    return [
      name.slice(0, 2).toLowerCase(),
      parseInt(name.match(/CB(?<cb>[0-9]*)/).groups.cb)
    ];
  }
  const [a1, a2] = getValues(a.name);
  const [b1, b2] = getValues(b.name);
  if (a1 === b1) {
    return a2 > b2 ? 1 : -1;
  } else {
    return a1 > b1 ? 1 : -1;
  }
});

const db_names = db_sorted.map(db => db.name);

const tableUsage = Object.keys(unique_tables_columns).map(table_name => {
  const table_columns = [...unique_tables_columns[table_name]];
  const entries = db_sorted.map(db => {
    const matched_table = db.tables.find(table => table.name === table_name);
    if (matched_table) {
      return table_columns.reduce((agg, t) => {
        //check if column exist in table
        if (matched_table.columns.includes(t)) {
          //check if columns are being used
          if (matched_table.columns.includes(t)) {
            if (
              matched_table.sampleRows.some(
                row => Object.keys(row.fields).includes(t) && row.fields[t]
              )
            ) {
              //exists and filled
              agg[t] = 'f';
              return agg;
            }
            //exists but empty
            agg[t] = '-';
            return agg;
          }
        }
        agg[t] = false;
        return agg;
      }, {});
    } else {
      //add empty column
      return table_columns.reduce((agg, t) => {
        agg[t] = '';
        return agg;
      }, {});
    }
  });

  const counts = db_sorted.map(db => {
    const matched_table = db.tables.find(table => table.name === table_name);
    let count = 'n/a';
    if (matched_table) {
      count = matched_table.count;
    }

    return count;
  });

  return {
    name: table_name,
    dbs: db_names,
    columns: table_columns,
    entries,
    counts
  };
});

// //init excel
const workbook = XLSX.readFile('./default.xlsx');
const wb = XLSX.utils.book_new();

//get default sheet and column to order them to the start for easy reference
const defaultOrder = workbook.SheetNames.map(sheetName => {
  const worksheet = workbook.Sheets[sheetName];
  const columnA = [];

  for (let z in worksheet) {
    if (z.toString()[0] === 'A') {
      const value = worksheet[z].v;
      if (value) columnA.push(value);
    }
  }

  return {
    name: sheetName,
    column: columnA
  };
});

tableUsage
  .sort((a, b) => {
    function getValues(table) {
      const findDefault = defaultOrder.find(sheet => sheet.name === table.name);
      return findDefault ? defaultOrder.indexOf(findDefault) : 100;
    }

    return getValues(a) > getValues(b) ? 1 : -1;
  })
  .forEach(table => {
    //generate rows
    const header = ['columns', ...table.dbs];
    const countRow = ['count', ...table.counts];
    const data = table.columns
      .sort((a, b) => {
        function getValues(column) {
          const findDefault = defaultOrder.find(
            sheet => sheet.name === table.name
          );
          if (!findDefault) {
            return -1;
          } else {
            return findDefault.column.indexOf(column);
          }
        }
        return getValues(a) > getValues(b) ? 1 : -1;
      })
      .map(column => {
        return [
          column,
          ...table.entries.map(e => (e[column] ? e[column] : ''))
        ];
      });
    const ws = XLSX.utils.aoa_to_sheet([header, countRow, ...data]);
    XLSX.utils.book_append_sheet(wb, ws, table.name.replace('/', '-'));
  });

function getDate() {
  const d = new Date();
  return `${d.getFullYear()}_${d.getMonth() + 1}_${d.getDate()}`;
}

XLSX.writeFile(wb, `./data/usage_${getDate()}.xlsx`);
