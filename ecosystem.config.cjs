const path = require('path')

const envFile = path.resolve(__dirname, '.env')

module.exports = {
	apps: [
		{
			name: 'briar-node',
			script: './dist/index.js',
			cwd: path.resolve(__dirname, 'packages/briar-node'),
			instances: 1,
			exec_mode: 'cluster',
			autorestart: true,
			watch: false,
			max_memory_restart: '1G',
			wait_ready: false,
			listen_timeout: 10000,
			kill_timeout: 5000,
			env: {
				NODE_ENV: 'production',
			},
			env_file: envFile,
			error_file: 'logs/error.log',
			out_file: 'logs/out.log',
			log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
			merge_logs: true,
		},
	],
}
