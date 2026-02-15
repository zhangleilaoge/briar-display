import "dotenv/config"

import * as tencentcloud from "tencentcloud-sdk-nodejs-ses"

export enum EmailTemplate {
  RESET_PASSWORD = 131569,
}

const SesClient = tencentcloud.ses.v20201002.Client

const clientConfig = {
  credential: {
    secretId: process.env.BRIAR_TX_SEC_ID,
    secretKey: process.env.BRIAR_TX_SEC_KEY,
  },
  region: "ap-hongkong",
  profile: {
    httpProfile: {
      endpoint: "ses.tencentcloudapi.com",
    },
  },
}

const client = new SesClient(clientConfig)

export const emailService = {
  async sendEmail(
    targetEmail: string,
    template: {
      TemplateID: EmailTemplate
      TemplateData: Record<string, any>
      subject: string
    },
  ) {
    return new Promise<boolean>((resolve, reject) => {
      const params = {
        FromEmailAddress: "zhangleilaoge <zhangleilaoge@stardew.site>",
        Destination: [targetEmail],
        Template: {
          TemplateID: template.TemplateID,
          TemplateData: JSON.stringify(template.TemplateData),
        },
        Subject: template.subject,
      }

      client.SendEmail(params).then(
        () => {
          resolve(true)
        },
        (err) => {
          console.error("error", err)
          reject(false)
        },
      )
    })
  },

  async sendPasswordResetCode(email: string, name: string, code: string) {
    try {
      await this.sendEmail(email, {
        TemplateID: EmailTemplate.RESET_PASSWORD,
        TemplateData: {
          name,
          verificationCode: code,
        },
        subject: "Briar - 重置密码验证码",
      })
      return true
    } catch (error) {
      console.error("Failed to send password reset code:", error)
      throw error
    }
  },
}
