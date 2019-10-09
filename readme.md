scripts to pull airtable usage data.

create a .env file with the following:

```
USERNAME = airtable@email.com
PASSWORD = password
API_KEY = airtable.api.key
SHEET_BEST_URL = sheet.best.api.url
```

then run `npm install` and `node get_airtables.js` to get .json exports of database, table and columns (field) structures

use `node diff.js` to generate a diff of two .json exports
use `node process_tables.js` to generate an excel table with tables and columns in use
