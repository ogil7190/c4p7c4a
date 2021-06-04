const fs = require("fs");
const path = require("path");
const express = require("express");
const { getRouter } = require("./router");
const { sleep } = require("./utils");
const {
  solveCaptcha,
  injectGoogleCookies,
} = require("./services/captcha.service");
const { inject } = require('./services/injector.service');

var global = {
	vars: {}
};

const directory = "temp";
const PORT = process.env.PORT || 3000;
const app = express();

const username = process.env.KUSER;
const password = process.env.KSECRET;

function cleanDir(directory) {
  fs.readdir(directory, (err, files) => {
    if (err) throw err;

    for (const file of files) {
      fs.unlink(path.join(directory, file), (err) => {
        if (err) throw err;
      });
    }
  });
}

function setupDir() {
  try {
    if (fs.existsSync(directory)) {
      cleanDir(directory);
    } else {
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
	setInterval( async () => {
		try {
			const playPauseButton = await page.$("#playPauseButton");
			const classes = await page.evaluate((el) => el.className, playPauseButton);
			if(classes && classes.includes("state-play")) {
				console.log("We were paused.");
				const isHidden = await page.evaluate(() => document.hidden);
				if(!isHidden && !global.vars.processingCaptcha) {
					await page.keyboard.press("Enter");
					await playPauseButton.click();
				}
			}
		} catch {}
	}, 60 * 1000 );
}

async function lookForCaptcha(page, browser) {
	// let count = 0;
	while(true) {
		await sleep(3000);
		const haveCaptcha = await checkIfHaveCaptcha(page);

		if(haveCaptcha && !global.vars.processingCaptcha) {
      console.log("Captcha Found");
      try {
				global.vars.processingCaptcha = true;
        await solveCaptcha(page, browser);
      } catch {}
			global.vars.processingCaptcha = false;
		}
		await sleep(2000);
	}
}

async function wanderAround(browser) {
  const time = new Date().getTime();
  while( (new Date().getTime() - time) < (3 * 60 * 1000) ) {
    await injectGoogleCookies(browser);
  }
}

async function approveLogin(page, restart, cont) {
  const interval = setInterval( async () => {
    console.log("Waiting for approval");

    if (global.refresh) {
      global.refresh = false;
      clearInterval(interval);
			restart();
      return;
    }

    if (global.captcha) {
      await page.type("#captchaText", global.captcha);
      await page.keyboard.press("Enter");
      global.captcha = undefined;
			clearInterval(interval);
			cont();
      return;
    }
  }, 5000 );
}

async function authorize(page) {
  try {
    await page.goto("https://kolotibablo.com/workers/entrance/login", {
      waitUntil: "networkidle2",
    });
  } catch {}
  await page.screenshot({ path: "temp/captcha.png", fullPage: true });
  sleep(3000);

  await page.type("#enterlogin", username);
  await sleep(1000);

  await page.type("#password", password);
  await sleep(1000);

  await page.keyboard.press("Enter");
  await sleep(5000);
  await page.screenshot({ path: "temp/captcha4.png", fullPage: true });
}

async function gotoHarvest(page) {
  try {
    await page.waitForSelector('span[data-navigate="earn"]');
    const element = await page.$('span[data-navigate="earn"]');
    await element.click();
  } catch {}
}

function heartbeat() {
  setInterval(async() => {
		const isHidden = await global.session.evaluate(() => document.hidden);
		if(!isHidden) {
			global.session.screenshot({ path: "temp/ss.png", fullPage: true });
		}
  }, 1000 * 15);
}

async function test() {
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
      "--load-extension=./kbplugin"
    ],
  };

  const { page, browser } = await inject(options);

  global.session = page;
  heartbeat();

  const trigger = async () => {
    await authorize(page);
		approveLogin(page, trigger, async () => {
			await sleep(10000);

      await wanderAround(browser);

			await gotoHarvest(page);

			lookForPaused(page);
			lookForCaptcha(page, browser);
		});
  };

  await trigger();
}

test();
