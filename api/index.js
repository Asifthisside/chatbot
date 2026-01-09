// Vercel serverless function wrapper for Express app
let app;

try {
  // Try to import the server
  const serverModule = await import('../server.js');
  // Try default export first, then named export, then the module itself
  app = serverModule.default || serverModule.app || serverModule;
  
  if (!app) {
    throw new Error('Server module did not export app');
  }
  
  console.log('✅ Server loaded successfully');
  console.log('App type:', typeof app);
} catch (error) {
  console.error('❌ Failed to load server.js:', error);
  console.error('Error stack:', error.stack);
  
  // Create a minimal Express app to handle errors gracefully
  const express = (await import('express')).default;
  app = express();
  
  // Set CORS headers
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });
  
  // Health check that always works
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ERROR',
      message: 'Server initialization failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  });
  
  // All other routes return error
  app.use('/api/*', (req, res) => {
    res.status(500).json({
      error: 'Server initialization failed',
      message: 'The backend server could not start. Please check Vercel logs.',
      code: 'SERVER_INIT_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  });
  
  // Root route
  app.use('*', (req, res) => {
    res.status(500).json({
      error: 'Server initialization failed',
      message: 'The backend server could not start.',
      code: 'SERVER_INIT_ERROR'
    });
  });
}

// Export the Express app as Vercel serverless function handler
export default app;

// Also export as handler for compatibility
export const handler = app;

