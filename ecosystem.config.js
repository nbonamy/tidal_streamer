module.exports = {
  apps : [{
    name   : "tidal-streamer",
		interpreter: "/home/mnmt/.nvm/versions/node/v20.12.2/bin/node",
    script : "./src/index.js",
    watch: true,
		watch_delay: 1000,
		ignore_watch : ["config.yml*"],
		autorestart: true,
    restart_delay: 10000,
	  cron_restart: '0 4 * * *',
    log_date_format: "YYYY-MM-DD HH:mm:ss"
  }]
}
