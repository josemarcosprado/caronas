/**
 * PM2 Ecosystem Configuration
 * Gerencia o bot WhatsApp do Cajurona
 * 
 * Uso:
 *   pm2 start ecosystem.config.cjs
 *   pm2 logs cajurona-bot
 *   pm2 monit
 */

module.exports = {
    apps: [
        {
            name: 'cajurona-bot',
            script: 'src/bot/server.js',
            interpreter: 'node',

            // Reinício automático
            autorestart: true,
            watch: false,
            max_memory_restart: '200M',

            // Retry em caso de crash
            max_restarts: 10,
            min_uptime: '10s',
            restart_delay: 5000,

            // Logs
            error_file: './logs/bot-error.log',
            out_file: './logs/bot-out.log',
            merge_logs: true,
            time: true,

            // Ambiente
            env: {
                NODE_ENV: 'development'
            },
            env_production: {
                NODE_ENV: 'production'
            }
        }
    ]
};
