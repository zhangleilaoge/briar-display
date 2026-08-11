import * as tencentcloud from 'tencentcloud-sdk-nodejs-ses'
const ses = new tencentcloud.ses.v20201002.Client({
	credential: { secretId: process.env.BRIAR_TX_SEC_ID, secretKey: process.env.BRIAR_TX_SEC_KEY },
	region: 'ap-hongkong',
	profile: { httpProfile: { endpoint: 'ses.tencentcloudapi.com' } },
})
const info = await ses.GetEmailTemplate({ TemplateID: 211971 })
console.log('TemplateStatus:', info.TemplateStatus)
process.exit(info.TemplateStatus === 0 ? 0 : 1)
