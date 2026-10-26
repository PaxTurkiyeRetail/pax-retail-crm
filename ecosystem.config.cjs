const fs = require('node:fs');
const path = require('node:path');
const marker = path.join(__dirname, '.next-active');
const buildDir = process.env.NEXT_DIST_DIR || (fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8').trim() : '.next');
if (!['.next', '.next-a', '.next-b'].includes(buildDir)) throw new Error('Invalid Next build directory.');

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
        NEXT_DIST_DIR: buildDir,
      },
    },
  ],
};
