fetch('https://stardew.site/api/cert/renew', {
	headers: {
		accept: '*/*',
		'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
		'content-type': 'application/json',
		'sec-ch-ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
		'sec-ch-ua-mobile': '?0',
		'sec-ch-ua-platform': '"macOS"',
		'sec-fetch-dest': 'empty',
		'sec-fetch-mode': 'cors',
		'sec-fetch-site': 'same-origin',
	},
	referrer: 'https://stardew.site/briar-display/business',
	body: '{}',
	method: 'POST',
	mode: 'cors',
	credentials: 'include',
})
	.then((r) => r.json())
	.then(console.log)
	.catch(console.error)
