module.exports = {
  apps: [
    {
      name: 'inventory-backend',
      script: 'C:\\Users\\ICICI\\Documents\\inventorymgt\\backend\\dist\\server.js',
      cwd: 'C:\\Users\\ICICI\\Documents\\inventorymgt\\backend',
      env: { NODE_ENV: 'production' },
      restart_delay: 3000,
      max_restarts: 10,
    },
    {
      name: 'inventory-frontend',
      script: 'cmd.exe',
      args: '/c C:\\Users\\ICICI\\AppData\\Roaming\\npm\\serve.cmd -s dist -l 3000',
      cwd: 'C:\\Users\\ICICI\\Documents\\inventorymgt\\frontend',
      interpreter: 'none',
    },
  ],
};
