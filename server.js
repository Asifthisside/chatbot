import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { setCorsHeaders } from './utils/cors.js';

dotenv.config();

// Import routes synchronously (works better in serverless)
import chatbotRoutesModule from './routes/chatbotRoutes.js';
import uploadRoutesModule from './routes/uploadRoutes.js';
import messageRoutesModule from './routes/messageRoutes.js';

const chatbotRoutes = chatbotRoutesModule.default || chatbotRoutesModule;
const uploadRoutes = uploadRoutesModule.default || uploadRoutesModule;
const messageRoutes = messageRoutesModule.default || messageRoutesModule;

console.log('✅ Route modules imported');
console.log('Chatbot routes:', typeof chatbotRoutes, chatbotRoutes ? 'OK' : 'NULL');
console.log('Upload routes:', typeof uploadRoutes, uploadRoutes ? 'OK' : 'NULL');
console.log('Message routes:', typeof messageRoutes, messageRoutes ? 'OK' : 'NULL');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware - CORS Configuration
// Simplified CORS that ALWAYS sets headers for frontend
const frontendOrigin = 'https://chatbot-backend-seven-sage.vercel.app';
const defaultAllowedOrigins = [
  frontendOrigin,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5173' // Vite default port
];

// Get allowed origins from environment or use defaults
let allowedOrigins = defaultAllowedOrigins;
if (process.env.CORS_ORIGIN) {
  allowedOrigins = [
    ...process.env.CORS_ORIGIN.split(',').map(o => o.trim()),
    ...defaultAllowedOrigins
  ];
  // Remove duplicates
  allowedOrigins = [...new Set(allowedOrigins)];
}

// Set CORS headers FIRST - before any other middleware
// This ensures headers are ALWAYS set for ALL requests
app.use((req, res, next) => {
  // Set CORS headers
  try {
    setCorsHeaders(req, res);
  } catch (corsError) {
    console.error('Error setting CORS headers in middleware:', corsError);
    // Fallback CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  }
  
  // Handle OPTIONS preflight requests immediately
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Override res.json and res.status to ensure CORS headers are always set
  const originalJson = res.json.bind(res);
  const originalStatus = res.status.bind(res);
  
  res.json = function(body) {
    try {
      setCorsHeaders(req, res);
    } catch (e) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    return originalJson(body);
  };
  
  res.status = function(code) {
    try {
      setCorsHeaders(req, res);
    } catch (e) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    return originalStatus(code);
  };
  
  next();
});

// Apply CORS middleware as additional layer
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin) || origin.includes('chatbot-backend-seven-sage.vercel.app')) {
      callback(null, true);
    } else {
      // Log but allow for debugging
      console.log('CORS: Origin requested:', origin);
      console.log('CORS: Allowed origins:', allowedOrigins);
      callback(null, true); // Allow for now
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length'],
  optionsSuccessStatus: 200
};

// Apply CORS middleware
try {
  app.use(cors(corsOptions));
  console.log('CORS middleware applied. Allowed origins:', allowedOrigins);
} catch (corsError) {
  console.error('CORS middleware error:', corsError);
  // Headers already set above, so continue
}

app.use(cookieParser());
// Increase JSON payload limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static('uploads'));

// Explicitly handle chatbot-widget.js FIRST - before static file middleware
// Return 404 so Vercel can serve it as static file from frontend
app.get('/chatbot-widget.js', (req, res) => {
  // Backend doesn't serve this file - Vercel should serve it from frontend static files
  res.status(404).end();
});

// Check and serve frontend static files
// Note: chatbot-widget.js is handled above, so it won't reach here
const frontendDistPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  console.log('Frontend static files enabled');
}

// Database connection with optimized settings for serverless
const connectDB = async () => {
  try {
    // Check if already connected
    if (mongoose.connection.readyState === 1) {
      console.log('MongoDB already connected');
      return;
    }

    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://asif786minto:bunny%40123@bunny.f0vwjmk.mongodb.net/chatbot';
    
    const connectionOptions = {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      maxPoolSize: 1, // Maintain up to 1 socket connection for serverless
      minPoolSize: 1, // Maintain at least 1 socket connection
      maxIdleTimeMS: 30000, // Close connections after 30s of inactivity
    };

    await mongoose.connect(mongoURI, connectionOptions);
    console.log('✅ MongoDB connected successfully');
    console.log('Database:', mongoose.connection.db?.databaseName || 'connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message || err);
    console.error('Error details:', {
      name: err.name,
      code: err.code,
      message: err.message
    });
    // Don't exit - let routes handle connection on first request
    // This allows the server to start even if DB is temporarily unavailable
    console.log('⚠️  Server will continue, database will connect on first request');
  }
};

// Connect to database (non-blocking for serverless)
// Don't block server startup - connect on first request instead
if (process.env.VERCEL !== '1') {
  // Only auto-connect in non-serverless environments
  connectDB().catch(err => {
    console.error('Initial database connection failed (non-critical):', err.message);
  });
} else {
  console.log('Serverless environment detected - database will connect on first request');
}

// Helper function to ensure MongoDB connection (exported for use in routes)
export const ensureConnection = async () => {
  // Check connection state: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  if (mongoose.connection.readyState === 1) {
    return true; // Already connected
  }
  
  // If connecting, wait a bit
  if (mongoose.connection.readyState === 2) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (mongoose.connection.readyState === 1) {
      return true;
    }
  }
  
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://asif786minto:bunny%40123@bunny.f0vwjmk.mongodb.net/chatbot';
    
    const connectionOptions = {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 1,
      minPoolSize: 1,
    };

    await mongoose.connect(mongoURI, connectionOptions);
    console.log('MongoDB connection ensured');
    return mongoose.connection.readyState === 1;
  } catch (error) {
    console.error('Failed to ensure MongoDB connection:', error);
    return false;
  }
};

// Handle MongoDB connection events
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

mongoose.connection.on('connected', () => {
  console.log('MongoDB connected');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

// Async error wrapper middleware
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Test endpoint - always works, helps debug routing issues
app.get('/api/test', (req, res) => {
  try {
    setCorsHeaders(req, res);
  } catch (e) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.json({ 
    status: 'OK', 
    message: 'API is working',
    timestamp: new Date().toISOString(),
    routes: {
      chatbots: !!chatbotRoutes,
      upload: !!uploadRoutes,
      messages: !!messageRoutes
    }
  });
});

// Routes with comprehensive error handling
console.log('Loading routes...');
console.log('Chatbot routes type:', typeof chatbotRoutes);
console.log('Upload routes type:', typeof uploadRoutes);
console.log('Message routes type:', typeof messageRoutes);

// Wrap route registration in try-catch
try {
  if (chatbotRoutes && typeof chatbotRoutes === 'function') {
    app.use('/api/chatbots', chatbotRoutes);
    console.log('✅ Chatbot routes registered');
  } else {
    throw new Error('Chatbot routes is not a valid router');
  }
} catch (err) {
  console.error('❌ Error registering chatbot routes:', err);
  console.error('Error stack:', err.stack);
  app.use('/api/chatbots', (req, res) => {
    try {
      setCorsHeaders(req, res);
    } catch (e) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.status(500).json({ 
      error: 'Chatbot routes error', 
      code: 'ROUTE_ERROR',
      message: err?.message 
    });
  });
}

try {
  if (uploadRoutes && typeof uploadRoutes === 'function') {
    app.use('/api/upload', uploadRoutes);
    console.log('✅ Upload routes registered');
  } else {
    throw new Error('Upload routes is not a valid router');
  }
} catch (err) {
  console.error('❌ Error registering upload routes:', err);
  console.error('Error stack:', err.stack);
  app.use('/api/upload', (req, res) => {
    try {
      setCorsHeaders(req, res);
    } catch (e) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.status(500).json({ 
      error: 'Upload routes error', 
      code: 'ROUTE_ERROR',
      message: err?.message 
    });
  });
}

try {
  if (messageRoutes && typeof messageRoutes === 'function') {
    app.use('/api/messages', messageRoutes);
    console.log('✅ Message routes registered');
  } else {
    throw new Error('Message routes is not a valid router');
  }
} catch (err) {
  console.error('❌ Error registering message routes:', err);
  console.error('Error stack:', err.stack);
  app.use('/api/messages', (req, res) => {
    try {
      setCorsHeaders(req, res);
    } catch (e) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.status(500).json({ 
      error: 'Message routes error', 
      code: 'ROUTE_ERROR',
      message: err?.message 
    });
  });
}

console.log('✅ All routes registered');

// Root endpoint - API info (define early, before health)
app.get('/', (req, res) => {
  try {
    setCorsHeaders(req, res);
  } catch (e) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  res.json({
    message: 'Chatbot Admin API Server',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      test: '/api/test',
      chatbots: '/api/chatbots',
      messages: '/api/messages',
      upload: '/api/upload'
    },
    documentation: 'This is an API server. Use /api/* endpoints.',
    timestamp: new Date().toISOString()
  });
});

// Health check - Always works, doesn't require database (define early)
app.get('/api/health', (req, res) => {
  // Always set CORS first
  try {
    setCorsHeaders(req, res);
  } catch (e) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  try {
    // Check MongoDB connection status
    const dbStatus = mongoose.connection.readyState;
    const dbStates = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    return res.json({ 
      status: 'OK', 
      message: 'Server is running',
      database: {
        status: dbStates[dbStatus] || 'unknown',
        connected: dbStatus === 1,
        readyState: dbStatus
      },
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    // Even if error, return response
    return res.json({ 
      status: 'OK', 
      message: 'Server is running',
      error: error?.message,
      timestamp: new Date().toISOString()
    });
  }
});


// Handle favicon and other static file requests
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // No Content - standard response for favicon
});

// Serve frontend React app for non-API routes (SPA routing) - must be after API routes
if (fs.existsSync(frontendDistPath)) {
  app.get('*', (req, res, next) => {
    // Always set CORS headers first
    try {
      setCorsHeaders(req, res);
    } catch (e) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    
    // Don't handle chatbot-widget.js - let Vercel serve it as static file
    if (req.path === '/chatbot-widget.js') {
      return next(); // Let Vercel handle this
    }
    
    // Only serve frontend for non-API, non-upload routes
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(frontendDistPath, 'index.html'), (err) => {
        if (err) {
          console.error('Error serving index.html:', err);
          res.status(404).json({ 
            error: 'Frontend not found', 
            code: 'FRONTEND_NOT_FOUND' 
          });
        }
      });
    } else {
      next();
    }
  });
}

// Handle non-API routes gracefully (only if frontend dist doesn't exist)
app.use((req, res, next) => {
  // Always set CORS headers first
  try {
    setCorsHeaders(req, res);
  } catch (e) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  // Skip if it's an API route (should have been handled already)
  if (req.path.startsWith('/api')) {
    return next(); // Let API routes handle it
  }
  // For non-API routes, return helpful 404 (only if frontend not being served)
  if (!fs.existsSync(frontendDistPath)) {
    res.status(404).json({ 
      error: 'Not Found', 
      message: 'This is an API server. Use /api/* endpoints.',
      availableEndpoints: [
        'GET /api/health',
        'GET /api/chatbots',
        'POST /api/chatbots',
        'GET /api/messages',
        'POST /api/messages',
        'POST /api/upload'
      ]
    });
  } else {
    next();
  }
});

// Global error handling middleware (must be last)
app.use((err, req, res, next) => {
  // ALWAYS set CORS headers for errors (critical for CORS to work)
  try {
    setCorsHeaders(req, res);
  } catch (corsError) {
    // Fallback CORS headers if setCorsHeaders fails
    try {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    } catch (e) {
      // If even fallback fails, continue anyway
      console.error('Failed to set CORS headers in error handler:', e);
    }
  }
  
  // Log error details
  console.error('Global Error Handler:', {
    message: err?.message || 'Unknown error',
    name: err?.name || 'Error',
    stack: err?.stack,
    method: req.method,
    url: req.url,
    origin: req.headers?.origin,
    params: req.params,
    query: req.query
  });
  
  // Ensure response hasn't been sent
  if (res.headersSent) {
    return next(err);
  }
  
  // CORS error
  if (err?.message && err.message.includes('CORS')) {
    return res.status(403).json({ 
      error: 'CORS Error', 
      message: 'Origin not allowed by CORS policy' 
    });
  }
  
  // MongoDB connection errors
  if (err?.name === 'MongoServerSelectionError' || 
      err?.name === 'MongoNetworkError' ||
      err?.name === 'MongoTimeoutError' ||
      err?.message?.includes('buffering timed out') ||
      err?.message?.includes('connection timed out') ||
      err?.message?.includes('ECONNREFUSED') ||
      err?.message?.includes('ENOTFOUND')) {
    return res.status(503).json({ 
      error: 'Database connection timeout', 
      message: 'Unable to connect to database. Please try again in a moment.',
      retry: true,
      code: 'DB_TIMEOUT'
    });
  }
  
  // Mongoose validation error
  if (err?.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Validation Error', 
      message: err.message,
      details: err.errors,
      code: 'VALIDATION_ERROR'
    });
  }
  
  // Mongoose cast error (invalid ID)
  if (err?.name === 'CastError') {
    return res.status(400).json({ 
      error: 'Invalid ID format', 
      message: 'The provided ID is not valid',
      code: 'INVALID_ID'
    });
  }
  
  // MongoDB duplicate key error
  if (err?.code === 11000) {
    return res.status(400).json({ 
      error: 'Duplicate Entry', 
      message: 'A record with this value already exists',
      code: 'DUPLICATE_KEY'
    });
  }
  
  // Default 500 server error - ensure we always send a response
  try {
    res.status(err?.status || 500).json({ 
      error: err?.message || 'Internal Server Error',
      code: 'INTERNAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && { stack: err?.stack })
    });
  } catch (responseError) {
    // If sending response fails, log and try one more time
    console.error('Failed to send error response:', responseError);
    try {
      res.status(500).end();
    } catch (e) {
      // Last resort - just log
      console.error('Complete failure to send error response:', e);
    }
  }
});

// Export for Vercel serverless functions
export default app;

// Also export as named export for compatibility
export { app };

// Process-level error handlers to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Don't exit in serverless/Vercel environment
  if (process.env.VERCEL !== '1') {
    console.error('Server will continue running, but error occurred:', err.message);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit in serverless/Vercel environment
  if (process.env.VERCEL !== '1') {
    console.error('Server will continue running, but unhandled rejection occurred');
  }
});

// Start server only if not in Vercel environment
if (process.env.VERCEL !== '1') {
  const server = app.listen(PORT, () => {
    console.log(`✅ Server is running on port ${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use.`);
      console.error(`   Please either:`);
      console.error(`   1. Stop the process using port ${PORT}`);
      console.error(`   2. Set a different PORT in your .env file`);
      console.error(`   3. Use: netstat -ano | findstr :${PORT} (Windows) to find the process`);
      console.error(`   4. Use: taskkill /PID <PID> /F (Windows) to kill the process`);
      process.exit(1);
    } else {
      console.error('❌ Server error:', err);
      process.exit(1);
    }
  });
}

