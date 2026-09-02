import type { Context } from 'hono'

/**
 * 根路径落地页
 * 用于域名根目录（https://xiaobuzi.cn/）展示站点名称与备案号，满足备案合规要求
 */
// 标题需与备案网站名称保持一致（管局审核要求）
const SITE_TITLE = 'xiaobuzi'
const ICP_NUMBER = '浙ICP备2024116093号-3'

const LANDING_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>${SITE_TITLE}</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			min-height: 100vh;
			display: flex;
			flex-direction: column;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
				'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
			background: #f7f8fa;
			color: #333;
		}
		main {
			flex: 1;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			padding: 40px 20px;
			text-align: center;
		}
		h1 { font-size: 36px; margin-bottom: 16px; color: #1a1a1a; }
		.subtitle { font-size: 16px; color: #666; margin-bottom: 40px; }
		.links { display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; }
		.links a {
			padding: 10px 24px;
			border-radius: 6px;
			background: #1a1a1a;
			color: #fff;
			text-decoration: none;
			font-size: 14px;
			transition: opacity 0.2s;
		}
		.links a:hover { opacity: 0.8; }
		footer {
			padding: 20px;
			text-align: center;
			font-size: 13px;
			color: #999;
		}
		footer a { color: #999; text-decoration: none; }
		footer a:hover { color: #666; }
	</style>
</head>
<body>
	<main>
		<h1>${SITE_TITLE}</h1>
		<div class="links">
			<a href="/briar/">进入主页</a>
		</div>
	</main>
	<footer>
		<a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">${ICP_NUMBER}</a>
	</footer>
</body>
</html>`

export const rootHandler = (c: Context) => c.html(LANDING_HTML)
