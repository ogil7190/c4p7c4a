const axios = require('axios');
const https = require('https');
const _options = {
	SPEECH_TO_TEXT_URL: 'https://api.wit.ai/speech?v=20170307',
	AUTHORIZATION: 'Bearer BNRYP2JH6LWQCQEKYYC77EN2ETOSX4HP'
};

function rdn(min, max) {
	min = Math.ceil(min)
	max = Math.floor(max)
	return Math.floor(Math.random() * (max - min)) + min
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function getResult(page) {
	return await page.evaluate(() => document.getElementById('g-recaptcha-response').value);
}

async function isSolved(page, count=0) {
	const _content = await getResult(page);
	if (_content.length > 0) {
		console.log('--> Captcha Success');
		return true;
	}
	if(count < 3 ) {
		await sleep(1000);
		return await isSolved(page, count + 1);
	}
	return false;
}

async function checkIfPageHaveCaptcha( page ){
	const iframe = await page.evaluate( ()=> {
		return document.querySelector('iframe[src*="/anchor"]');
	});
	if( iframe ) return true;
	return false;
}

async function checkIfOpen(page) {
	const frames = await page.frames();
	const imageFrame = frames.find(frame => frame.url().includes('/bframe'));
	const img = await imageFrame.$('.rc-image-tile-wrapper img');
	return img && img.complete
}

async function clickCheckBox(page) {
	if( checkIfOpen(page) ) {
		await sleep(500);
		return await clickAudioButton(page);
	}

	console.log('--> Clicking Check Box');

	let frames = await page.frames()
	const recaptchaFrame = frames.find(frame => frame.url().includes('/anchor'))
	const checkbox = await recaptchaFrame.$('#recaptcha-anchor');

	if( checkbox ) {
		await checkbox.click({
			delay: rdn(30, 150)
		});
		if (await isSolved(page)) {
			return await getResult(page);
		}
		await sleep(500);
		return clickAudioButton(page);
	}
}

async function clickAudioButton(page) {
	console.log('--> Clicking Audio Button');
	
	const frames = await page.frames();
	const imageFrame = frames.find(frame => frame.url().includes('/bframe'));

	const audioButton = await imageFrame.$('#recaptcha-audio-button');
	
	if(audioButton) {
		await audioButton.click({
			delay: rdn(500, 1500)
		});
		await sleep(500);
		return getAudioBytes(page);
	}
}

async function getAudioBytes(page) {
	console.log('--> Getting Audio Bytes');
	
	const frames = await page.frames();
	const imageFrame = frames.find(frame => frame.url().includes('/bframe'));
	
	const audioLink = await imageFrame.$$eval('.rc-audiochallenge-tdownload-link', el => el.map(x => x.getAttribute("href")));
	console.log( 'audio', audioLink );

	if(audioLink && audioLink.length > 0) {
		const audioBytes = await page.evaluate(audioLink => {
			return (async () => {
				const response = await window.fetch(audioLink)
				const buffer = await response.arrayBuffer()
				return Array.from(new Uint8Array(buffer))
			})()
		}, audioLink[0]);
		await sleep(500);
		return audioToText(page, audioBytes);
	}
}

async function audioToText(page, audioBytes) {
	console.log('--> Converting Audio to Text');
	const httsAgent = new https.Agent({
		rejectUnauthorized: false
	});
	const response = await axios({
		httsAgent,
		method: 'post',
		url: _options.SPEECH_TO_TEXT_URL,
		data: new Uint8Array(audioBytes).buffer,
		headers: {
			Authorization: _options.AUTHORIZATION,
			'Content-Type': 'audio/mpeg3'
		}
	});
	
	const audioTranscript = response.data._text.trim();
	if(audioTranscript) {
		await sleep(500);
		return inputSolvedAudio(page, audioTranscript);
	}
}

async function inputSolvedAudio(page, audioTranscript) {
	console.log('--> Inputing Converted Text ', audioTranscript);
	const frames = await page.frames()
	const imageFrame = frames.find(frame => frame.url().includes('/bframe'))
	const input = await imageFrame.$('#audio-response')
	
	if(input) {
		input.value = "";
		await input.click({
			delay: rdn(30, 150)
		});
		await input.type(audioTranscript, {
			delay: rdn(120, 200)
		});
		
		const verifyButton = await imageFrame.$('#recaptcha-verify-button')
		
		if(verifyButton) {
			await verifyButton.click({
				delay: rdn(50, 150)
			});
			await sleep(3000);
			return await checkIfSolved(page);
		}
	}

}

async function checkIfSolved(page) {
	console.log('--> Checking if Solved');
	if (await isSolved(page)) {
		return await getResult(page);
	} else {
		await sleep(500);
		const frames = await page.frames()
		const imageFrame = frames.find(frame => frame.url().includes('/bframe'))
		const haveError = await imageFrame.$('.rc-audiochallenge-error-message');

		if (haveError) {
			console.log('--> Found resolve error');
			return getAudioBytes(page);
		} else {
			console.log('--> Something went wrong :(');
		}
	}
}

async function injectGoogleCookies(browser) {
	console.log('--> Injecting Google Cookies');
	const topics = ['national', 'state', 'funny', 'country', 'good', 'bad', 'spritual', 'latest', 'google'];
	const page = await browser.newPage();
	await page.goto('https://google.com');
	await page.mouse.move(rdn(0, 500), rdn(500, 0));
	
	await page.click('[name=q]');
	await page.mouse.move(rdn(0, 500), rdn(500, 0));
	const index = Math.floor(Math.random() * topics.length);
	await page.keyboard.type( topics[ index ] + " news", {
		delay: rdn(100, 150)
	});

	await page.keyboard.press('Enter');
	await page.mouse.move(rdn(0, 500), rdn(500, 0));

	const p1 = page.waitForSelector('h3.LC20lb', {
		timeout: 10000
	}).then( () => 'h3.LC20lb').catch();

	const p2 = page.waitForSelector('.yUTMj', {
		timeout: 10000
	}).then( () => '.yUTMj').catch();

	const selector = await Promise.race([p1, p2]);

	// const selector = 'h3 a';
	// await page.waitForSelector(selector);

	await sleep(2000);
	
	await page.mouse.move(rdn(0, 500), rdn(500, 0));
	await page.evaluate((selector) => {
		let elements = document.querySelectorAll(selector);
		let randomIndex = Math.floor(Math.random() * 5 );
		elements[randomIndex].click();
	}, selector);
	
	await page.mouse.move(rdn(0, 500), rdn(500, 0));
	await sleep(rdn(3000, 6000));

	await page.goBack();
	
	await sleep(1000);
	await page.close();
}

async function solveCaptcha(page, browser, options={}) {
	Object.assign(_options, options);
	try {
		await injectGoogleCookies(browser);
	} catch {}
	return await clickCheckBox(page);
}

module.exports = {
	solveCaptcha,
	clickCheckBox,
	checkIfPageHaveCaptcha,
	injectGoogleCookies
}
