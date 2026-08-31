module.exports = {
  apps: [
    {
      name: 'api',
      script: 'backend/src/server.ts',
      interpreter: 'node',
      interpreterArgs: '--import tsx',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: '8787',
        BACKEND_HOST: '0.0.0.0'
      }
    }
  ]
}
