module.exports = {
  apps: [
    {
      name: 'pax-retail-crm',
      cwd: __dirname,
      script: 'npm',
      args: 'start -- -p 5043 -H 127.0.0.1',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      time: true,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
