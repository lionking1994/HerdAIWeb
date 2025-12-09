module.exports = {
    apps: [
      {
        name: 'server',                      // Name for the PM2 process
        script: 'server.js',                  // Entry point of your app (adjust if different)
        instances: 1,                         // Or 'max' for all CPU cores
        exec_mode: 'fork',                    // 'cluster' for multi-core support
        watch: false,                         // Set to true to watch for changes (useful in dev)
        env: {
          NODE_ENV: 'development',
          PORT: 5000                          // Adjust this to your backend port
        },
        env_production: {
          NODE_ENV: 'production',
          PORT: 5000                          // Same port in production, or adjust if needed
        }
      }
    ]
  };
  