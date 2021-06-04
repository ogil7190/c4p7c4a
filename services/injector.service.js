const puppeteer = require("puppeteer-extra");
const pluginStealth = require("puppeteer-extra-plugin-stealth");
const { sleep } = require("../utils");

const LOGIN_URL = "https://accounts.google.com/signin/v2/identifier";
const email = process.env.USER;
const password = process.env.SECRET;

async function injectUser(options) {
  puppeteer.use(pluginStealth());

  const browser = await puppeteer.launch(options);

  const page = await browser.newPage();
  const pages = await browser.pages();

  await pages[0].goto("chrome://extensions", { waitUntil: "networkidle0" });
  await sleep(5000);
  
  await pages[0].screenshot({ path: "temp/0.png", fullPage: true });
  pages[0].close();

  await page.goto(LOGIN_URL, { waitUntil: "networkidle2" });
  await page.screenshot({ path: "temp/login1.png", fullPage: true });

  await page.waitForSelector("#identifierId");
  let badInput = true;

  await page.screenshot({ path: "temp/login2.png", fullPage: true });
  while (badInput) {
    await page.type("#identifierId", email);
    await sleep(1000);
    await page.keyboard.press("Enter");
    await sleep(1000);
    badInput = await page.evaluate(
      () =>
        document.querySelector('#identifierId[aria-invalid="true"]') !== null
    );
    
    if (badInput) {
      await page.click("#identifierId", { clickCount: 3 });
    }
  }

  await page.screenshot({ path: "temp/login3.png", fullPage: true });
  await sleep(1000);
  await page.type('input[type="password"]', password);
  await sleep(2000);
  await page.keyboard.press("Enter");
  await page.screenshot({ path: "temp/login4.png", fullPage: true });
  
  await sleep(5000);
  
  await page.screenshot({ path: `temp/login5.png`, fullPage: true });
  await page.goto("https://youtube.com/", { waitUntil: "networkidle2" });
  await sleep(3000);
  
  await page.screenshot({ path: `temp/login6.png`, fullPage: true });

  return {
    page,
    browser
  };
}

module.exports = {
  inject: injectUser,
};
