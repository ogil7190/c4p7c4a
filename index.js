const fs = require('fs');
const path = require('path');
const express = require("express");
const { getRouter } = require("./router");
const puppeteer = require("puppeteer-extra");
const pluginStealth = require("puppeteer-extra-plugin-stealth");
const { sleep } = require("./utils");
const { solveCaptcha } = require("./services/captcha.service");

var global = {};
const directory = "temp";
const PORT = process.env.PORT || 3000;
const app = express();

const username = process.env.USER;
const password = process.env.SECRET;

function cleanDir( directory ) {
  fs.readdir(directory, (err, files) => {
      if (err) throw err;
    
      for (const file of files) {
        fs.unlink(path.join(directory, file), err => {
          if (err) throw err;
        });
      }
  });
}

function setupDir() {
  try {
		if( fs.existsSync(directory) ){
			cleanDir( directory );
		}
		else {
			fs.mkdirSync(directory);
		}
	} catch {}
}

const router = getRouter(global);
app.use(express.json());
app.use(router);
app.listen(PORT);
setupDir();
app.use("/ss", express.static(__dirname + `/${directory}`));

async function checkIfHaveCaptcha(page) {
  return await page.evaluate(() => {
    const iframes = $(".captcha-solver iframe");
    if (iframes && iframes[0]) {
      const iframe =
        iframes[0].contentDocument &&
        iframes[0].contentDocument.querySelector('iframe[title="reCAPTCHA"]');
      if (iframe) {
        const box =
          iframe.contentDocument &&
          iframe.contentDocument.querySelector("#recaptcha-anchor");
        return box && true;
      }
    }
    return false;
  });
}

async function lookForPaused(page) {
  while(true) {
    await sleep(10000);
    const playPauseButton = await page.$('#playPauseButton');
    const classes = await page.evaluate(el => el.className, playPauseButton);
    if(classes.includes('state-play')) {
      console.log('We are paused.');
      await playPauseButton.click();
    }
  }
}

async function lookForCaptcha(page, browser) {
  while(true) {
    await sleep(3000);
    const haveCaptcha = await checkIfHaveCaptcha(page);
    
    if(haveCaptcha) {
      console.log( 'Captcha Found' );
      try {
        await solveCaptcha(page, browser);
        await sleep(2000);
      } catch{}
    }
  }
}

function heartbeat() {
  setInterval( () => {
    global.session.screenshot({ path: "temp/ss.png", fullPage: true });
  }, 1000 * 15);
}

async function test() {
  puppeteer.use(pluginStealth());

  const options = {
    headless: process.env.IS_DEV == "true" ? false : true,
    ignoreHTTPSErrors: true,
    ignoreDefaultArgs: ["--disable-extensions", "--enable-automation"],
    args: [
      "--disable-web-security",
      "--window-position=000,000",
      "--window-size=1440,821",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-features=site-per-process",
      '--js-flags="--max-old-space-size=300"',
      "--load-extension=./kbplugin",
    ],
  };

  const browser = await puppeteer.launch(options);

  global.session = await browser.newPage();
  const page = global.session;
  const pages = await browser.pages();
  
  await pages[0].goto("chrome://extensions", { waitUntil: "networkidle0" });
  await sleep(5000);
  await pages[0].screenshot({ path: "temp/0.png", fullPage: true });
  pages[0].close();

  heartbeat();

  const trigger = async () => {
    await page.goto("https://kolotibablo.com/workers/entrance/login", {
      waitUntil: "networkidle0",
    });
    await page.screenshot({ path: "temp/captcha.png", fullPage: true });
    sleep(3000);

    async function approveLogin(page) {
      while (true) {
        console.log('Waiting for approval');
        await sleep(3000);
    
        if (global.refresh) {
          global.refresh = false;
          trigger();
          break;
        }
    
        if (global.captcha) {
          await page.type("#captchaText", global.captcha);
          await page.keyboard.press("Enter");
          global.captcha = undefined;
    
          //@todo check for error & call refresh
          
          await sleep(5000);
          await page.screenshot({ path: "temp/captcha5.png", fullPage: true });
          break;
        }
      }
    }

    await page.type("#enterlogin", username);
    await sleep(1000);
    await page.screenshot({ path: "temp/captcha2.png", fullPage: true });

    await page.type("#password", password);
    await sleep(1000);
    await page.screenshot({ path: "temp/captcha3.png", fullPage: true });

    await page.keyboard.press("Enter");
    await sleep(5000);
    await page.screenshot({ path: "temp/captcha4.png", fullPage: true });

    await approveLogin(page);
    await sleep(10000);

    try {
      await page.waitForSelector('span[data-navigate="earn"]');
      const element = await page.$('span[data-navigate="earn"]');
      await element.click();
    } catch {}

    lookForPaused(page);
    lookForCaptcha(page, browser);
  };

  await trigger();
}

test();
