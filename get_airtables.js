const puppeteer = require('puppeteer');
const fs = require('fs');
const Airtable = require('airtable');

require('dotenv').config();

async function getTableCount(apiKey, baseKey, tableName, tableField) {
  return new Promise(function(resolve, reject) {
    var base = new Airtable({ apiKey }).base(baseKey);

    let recordsCount = 0;

    base(tableName)
      .select({
        fields: [tableField]
      })
      .eachPage(
        function page(records, fetchNextPage) {
          records.forEach(function(record) {
            recordsCount += 1;
          });

          fetchNextPage();
        },
        function done(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(recordsCount);
        }
      );
  });
}

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://airtable.com/login?continue=/api');

  const username = await page.$x(
    '//*[@id="sign-in-form-fields-root"]/div/label[1]/input'
  );
  const password = await page.$x(
    '//*[@id="sign-in-form-fields-root"]/div/label[2]/input'
  );
  await username[0].type(process.env.USERNAME);
  await password[0].type(process.env.PASSWORD);

  await page.waitFor(1000);
  const submit = await page.$x(
    '//*[@id="sign-in-form-fields-root"]/div/label[3]/input'
  );

  await submit[0].click();

  await page.waitForNavigation();

  const links = await page.evaluate(() => {
    const links = document
      .querySelector(
        'body > div > div > div.p3 > div > div:nth-child(2) > div > div:nth-child(1)'
      )
      .querySelectorAll('a');
    return Array.from(links)
      .map(({ href, text }) => ({
        href,
        text
      }))
      .filter(link => link.text.toLowerCase().includes('0.3'));
  });

  const dbs = [];

  //get column and row info for each table
  for (const link of links) {
    await page.goto(link.href);

    console.log(`Grabbing info for: ${link.text}`);
    const tables = await page.evaluate(() => {
      console.log(window.application.id);
      return window.application.tables.map(
        ({ columns, sampleRows, isEmpty, name }) => ({
          name,
          columns: columns.map(column => column.name),
          sampleRows,
          isEmpty,
          db_id: window.application.id
        })
      );
    });

    //get counts for all tables
    for (const table of tables) {
      await page.waitFor(1000);
      const count = await getTableCount(
        process.env.API_KEY,
        table.db_id,
        table.name,
        table.columns[0]
      );

      table.count = count;
    }

    dbs.push({ tables, name: link.text, href: link.href });
  }

  //save to json
  await fs.writeFile('./data/dbs.json', JSON.stringify(dbs), function(err) {
    if (err) {
      return console.log(err);
    }

    console.log('The file was saved!');
  });

  await browser.close();
})();
