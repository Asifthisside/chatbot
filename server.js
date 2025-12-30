import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import chatbotRoutes from './routes/chatbotRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import messageRoutes from './routes/messageRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware - CORS Configuration
// Default allowed origins (frontend URL)
const defaultAllowedOrigins = [
  'https://chatbot-backend-seven-sage.vercel.app',
  'http://localhost:3000',
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

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or server-to-server)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Log for debugging
      console.log('CORS: Origin not in allowed list:', origin);
      console.log('CORS: Allowed origins:', allowedOrigins);
      // Allow for now (can be changed to reject for security)
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

// Apply CORS middleware (handles OPTIONS automatically)
// Wrap in try-catch to handle any CORS configuration errors
try {
  app.use(cors(corsOptions));
  console.log('CORS configured with allowed origins:', allowedOrigins);
} catch (corsError) {
  console.error('CORS configuration error:', corsError);
  // Fallback to permissive CORS if configuration fails
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
  }));
}

// Explicitly handle OPTIONS preflight requests for all routes
app.options('*', cors(corsOptions));

// Add CORS headers manually as fallback (only if not already set by cors middleware)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Only set headers if not already set and origin is allowed
  if (origin && allowedOrigins.includes(origin) && !res.getHeader('Access-Control-Allow-Origin')) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  }
  next();
});

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      bufferMaxEntries: 0, // Disable mongoose buffering for serverless
      bufferCommands: false, // Disable mongoose buffering for serverless
      maxPoolSize: 1, // Maintain up to 1 socket connection for serverless
      minPoolSize: 1, // Maintain at least 1 socket connection
      maxIdleTimeMS: 30000, // Close connections after 30s of inactivity
    };

    await mongoose.connect(mongoURI, connectionOptions);
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    // Don't exit in Vercel/serverless environment
    if (process.env.VERCEL !== '1') {
      process.exit(1);
    }
  }
};

// Connect to database
connectDB();

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
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      bufferMaxEntries: 0,
      bufferCommands: false,
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

// Export ensureConnection for use in routes
export { ensureConnection };

// Routes
app.use('/api/chatbots', chatbotRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/messages', messageRoutes);

// Root route - Always serve frontend index.html (dist file) instead of API
app.get('/', (req, res) => {
  const indexPath = path.join(frontendDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(404).send('Frontend not found. Please build the frontend first.');
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});


// Handle favicon and other static file requests
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // No Content - standard response for favicon
});

// Serve frontend React app for non-API routes (SPA routing) - must be after API routes
if (fs.existsSync(frontendDistPath)) {
  app.get('*', (req, res, next) => {
    // Don't handle chatbot-widget.js - let Vercel serve it as static file
    if (req.path === '/chatbot-widget.js') {
      return next(); // Let Vercel handle this
    }
    
    // Only serve frontend for non-API, non-upload routes
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(frontendDistPath, 'index.html'));
    } else {
      next();
    }
  });
}

// Handle non-API routes gracefully (only if frontend dist doesn't exist)
app.use((req, res, next) => {
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
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    origin: req.headers.origin
  });
  
  // CORS error
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({ 
      error: 'CORS Error', 
      message: 'Origin not allowed by CORS policy' 
    });
  }
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Validation Error', 
      message: err.message,
      details: err.errors 
    });
  }
  
  // Mongoose cast error (invalid ID)
  if (err.name === 'CastError') {
    return res.status(400).json({ 
      error: 'Invalid ID format', 
      message: 'The provided ID is not valid' 
    });
  }
  
  // MongoDB duplicate key error
  if (err.code === 11000) {
    return res.status(400).json({ 
      error: 'Duplicate Entry', 
      message: 'A record with this value already exists' 
    });
  }
  
  // Default 500 server error
  res.status(err.status || 500).json({ 
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Export for Vercel serverless functions
export default app;

// Start server only if not in Vercel environment
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Server  is running on port ${PORT}`);
  });
}

