module.exports = {
  apps: [
    {
      name: "briar-node",
      script: "./dist/index.js",
      cwd: "./packages/briar-node",
      instances: 1,
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
      },
      error_file: "logs/error.log",
      out_file: "logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
    },
  ],
}
