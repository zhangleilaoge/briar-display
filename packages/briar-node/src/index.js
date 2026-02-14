// @briar/node entry point
import { formatDate, generateId, APP_NAME, HTTP_STATUS } from "@briar/shared"

console.log("=".repeat(50))
console.log(`${APP_NAME} Node.js 服务已启动`)
console.log("=".repeat(50))

// 演示使用 shared 包中的工具
console.log("\n📅 当前日期:", formatDate(new Date()))
console.log("🆔 生成的 ID:", generateId())
console.log("✅ HTTP OK 状态码:", HTTP_STATUS.OK)

console.log("\n✨ @briar/shared 包集成成功！")

export default {}
