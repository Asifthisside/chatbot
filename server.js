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
// Simplified CORS configuration that handles errors gracefully
let corsOptions;
if (process.env.CORS_ORIGIN) {
  // If CORS_ORIGIN is set, use it (can be comma-separated for multiple origins)
  const allowedOrigins = process.env.CORS_ORIGIN.split(',').map(o => o.trim());
  corsOptions = {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, Postman, or server-to-server)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // Log but allow for now (can be changed to reject)
        console.log('CORS: Origin not in allowed list:', origin);
        callback(null, true); // Allow for flexibility, change to callback(new Error(...)) to reject
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Length']
  };
} else {
  // If CORS_ORIGIN is not set, allow all origins
  corsOptions = {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Length']
  };
}

// Apply CORS middleware (handles OPTIONS automatically)
// Wrap in try-catch to handle any CORS configuration errors
try {
  app.use(cors(corsOptions));
} catch (corsError) {
  console.error('CORS configuration error:', corsError);
  // Fallback to permissive CORS if configuration fails
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));
}

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Check and serve frontend static files
const frontendDistPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  console.log('Frontend static files enabled');
}

// Database connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://asif786minto:bunny%40123@bunny.f0vwjmk.mongodb.net/chatbot';
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    // Don't exit in Vercel/serverless environment
    if (process.env.VERCEL !== '1') {
      process.exit(1);
    }
  }
};

connectDB();

// Handle MongoDB connection events
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

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

