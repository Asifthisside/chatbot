import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import chatbotRoutes from './routes/chatbotRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import messageRoutes from './routes/messageRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware - CORS Configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

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

// Root route - API information
app.get('/', (req, res) => {
  res.json({ 
    message: 'Chatbot Admin API Server',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      chatbots: '/api/chatbots',
      messages: '/api/messages',
      upload: '/api/upload'
    },
    documentation: 'This is an API server. Use /api/* endpoints.'
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

// Handle non-API routes gracefully (must be last before error handler)
app.use((req, res, next) => {
  // Skip if it's an API route (should have been handled already)
  if (req.path.startsWith('/api')) {
    return next(); // Let API routes handle it
  }
  // For non-API routes, return helpful 404
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
});

// Global error handling middleware (must be last)
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
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

