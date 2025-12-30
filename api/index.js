// Vercel serverless function wrapper for Express app
import app from '../server.js';

// Export handler for Vercel
// Express app can be used directly as a Vercel serverless function handler
// Vercel will call this with (req, res) for each request
export default app;

