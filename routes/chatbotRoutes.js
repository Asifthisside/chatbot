import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Chatbot from '../models/Chatbot.js';
import { setCorsHeaders } from '../utils/cors.js';

dotenv.config();
const router = express.Router();

// Helper to send response with CORS headers (must be defined before asyncHandler)
const sendResponse = (req, res, statusCode, data) => {
  try {
    setCorsHeaders(req, res);
    return res.status(statusCode).json(data);
  } catch (err) {
    console.error('Error in sendResponse:', err);
    // Fallback: set basic CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(statusCode).json(data);
  }
};

// Async error wrapper for route handlers
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error('Async handler error:', err);
    console.error('Error name:', err?.name);
    console.error('Error message:', err?.message);
    if (err?.stack) {
      console.error('Error stack:', err.stack);
    }
    // Use sendResponse to ensure CORS headers are set
    return sendResponse(req, res, 500, {
      error: err?.message || 'Internal server error',
      code: 'ASYNC_ERROR',
      type: err?.name || 'UnknownError'
    });
  });
};

// Global error handler middleware for this router (catches errors passed to next(err))
router.use((err, req, res, next) => {
  console.error('Router-level error:', err);
  try {
    setCorsHeaders(req, res);
  } catch (e) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.status(500).json({
    error: err?.message || 'Internal server error',
    code: 'ROUTER_ERROR',
    type: err?.name || 'UnknownError'
  });
});

// Handle OPTIONS requests for CORS preflight
router.options('*', (req, res) => {
  try {
    setCorsHeaders(req, res);
  } catch (e) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  res.status(200).end();
});

// Test endpoint - doesn't require database
router.get('/test', (req, res) => {
  setCorsHeaders(req, res);
  res.json({ 
    status: 'OK', 
    message: 'Chatbot routes are working',
    timestamp: new Date().toISOString()
  });
});

// Helper to ensure connection before database operations
const ensureDBConnection = async () => {
  try {
    // Check if already connected
    if (mongoose.connection.readyState === 1) {
      console.log('MongoDB already connected');
      return true;
    }
    
    // If connecting, wait a bit (max 3 seconds)
    if (mongoose.connection.readyState === 2) {
      console.log('MongoDB is connecting, waiting...');
      const maxWait = 3000; // 3 seconds
      const startTime = Date.now();
      while (mongoose.connection.readyState === 2 && (Date.now() - startTime) < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (mongoose.connection.readyState === 1) {
        console.log('MongoDB connected after wait');
        return true;
      }
    }
    
    // Get MongoDB URI from environment
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://asif786minto:bunny%40123@bunny.f0vwjmk.mongodb.net/chatbot';
    
    if (!mongoURI || mongoURI === 'undefined' || mongoURI.trim() === '') {
      console.error('MongoDB URI is not configured');
      return false;
    }
    
    console.log('Attempting MongoDB connection...');
    
    // Try to connect with timeout (shorter for serverless)
    try {
      // Don't call connect if already connecting or connected
      if (mongoose.connection.readyState === 0 || mongoose.connection.readyState === 3) {
        const connectPromise = mongoose.connect(mongoURI, {
          serverSelectionTimeoutMS: 5000, // 5 seconds for serverless
          socketTimeoutMS: 30000,
          maxPoolSize: 1,
          minPoolSize: 0, // Don't maintain connection in serverless
        });
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 6000)
        );
        
        await Promise.race([connectPromise, timeoutPromise]);
      }
      
      // Check connection state after potential connection
      if (mongoose.connection.readyState === 1) {
        console.log('MongoDB connection ensured successfully');
        return true;
      }
      
      console.error('MongoDB connection failed - readyState:', mongoose.connection.readyState);
      return false;
    } catch (connectError) {
      console.error('MongoDB connection error:', connectError?.message || connectError);
      console.error('Connection error name:', connectError?.name);
      // Return false instead of throwing - don't crash the server
      return false;
    }
  } catch (error) {
    console.error('Failed to ensure MongoDB connection:', error?.message || error);
    console.error('Error stack:', error?.stack);
    // Always return false instead of throwing
    return false;
  }
};

// Get all chatbots
router.get('/', asyncHandler(async (req, res) => {
  // Outer try-catch to catch ANY error
  try {
    // Always set CORS headers first
    try {
      setCorsHeaders(req, res);
    } catch (corsError) {
      console.error('CORS header error:', corsError);
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    
    console.log('GET /api/chatbots - Request received');
    
    // Ensure MongoDB connection before operations
    let isConnected = false;
    try {
      isConnected = await ensureDBConnection();
    } catch (dbError) {
      console.error('GET /api/chatbots - ensureDBConnection error:', dbError);
      return res.status(503).json({ 
        error: 'Database connection failed', 
        message: 'Unable to connect to database. Please try again.',
        code: 'DB_CONNECTION_FAILED'
      });
    }
    
    if (!isConnected) {
      console.error('GET /api/chatbots - Database connection failed');
      return res.status(503).json({ 
        error: 'Database connection failed', 
        message: 'Unable to connect to database. Please try again.',
        code: 'DB_CONNECTION_FAILED'
      });
    }
    
    console.log('GET /api/chatbots - Fetching chatbots from database');
    let chatbots = [];
    try {
      chatbots = await Chatbot.find().sort({ createdAt: -1 }).lean();
      console.log(`GET /api/chatbots - Found ${chatbots.length} chatbots`);
    } catch (queryError) {
      console.error('GET /api/chatbots - Query error:', queryError);
      // Don't throw, return error response instead
      return res.status(503).json({ 
        error: 'Database query failed', 
        message: 'Unable to fetch data from database.',
        code: 'QUERY_ERROR'
      });
    }
    
    return res.json(chatbots || []);
  } catch (error) {
    // Catch ANY unhandled error
    console.error('GET /api/chatbots - Unhandled Error:', error);
    console.error('Error name:', error?.name);
    console.error('Error message:', error?.message);
    if (error?.stack) {
      console.error('Error stack:', error.stack);
    }
    
    // Ensure CORS headers
    try {
      setCorsHeaders(req, res);
    } catch (e) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    
    // Handle MongoDB connection errors
    if (error?.name === 'MongoServerSelectionError' || 
        error?.name === 'MongoNetworkError' ||
        error?.name === 'MongoTimeoutError' ||
        error?.name === 'MongoError' ||
        error?.message?.includes('buffering timed out') ||
        error?.message?.includes('connection timed out') ||
        error?.message?.includes('ECONNREFUSED') ||
        error?.message?.includes('ENOTFOUND') ||
        error?.message?.includes('MongoDB')) {
      return res.status(503).json({ 
        error: 'Database connection timeout', 
        message: 'Unable to connect to database. Please try again in a moment.',
        retry: true,
        code: 'DB_TIMEOUT'
      });
    }
    
    // Handle CastError (invalid ObjectId)
    if (error?.name === 'CastError') {
      return res.status(400).json({ 
        error: 'Invalid ID format',
        code: 'INVALID_ID'
      });
    }
    
    // Default error response - always return something
    return res.status(500).json({ 
      error: error?.message || 'Failed to fetch chatbots',
      code: 'FETCH_ERROR',
      type: error?.name || 'UnknownError'
    });
  }
}));

// Get single chatbot
router.get('/:id', asyncHandler(async (req, res) => {
  // Outer try-catch to catch ANY error, including CORS errors
  try {
    // Always set CORS headers first
    try {
      setCorsHeaders(req, res);
    } catch (corsError) {
      console.error('CORS header error:', corsError);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    
    console.log('GET /api/chatbots/:id - Request received:', req.params.id);
    
    // Validate MongoDB ObjectId format first
    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        error: 'Invalid chatbot ID format',
        code: 'INVALID_ID',
        id: req.params.id
      });
    }
    
    // Ensure MongoDB connection before operations
    let isConnected = false;
    try {
      isConnected = await ensureDBConnection();
    } catch (dbError) {
      console.error('GET /api/chatbots/:id - ensureDBConnection error:', dbError);
      return res.status(503).json({ 
        error: 'Database connection failed', 
        message: 'Unable to connect to database. Please try again.',
        code: 'DB_CONNECTION_FAILED'
      });
    }
    
    if (!isConnected) {
      console.error('GET /api/chatbots/:id - Database connection failed');
      return res.status(503).json({ 
        error: 'Database connection failed', 
        message: 'Unable to connect to database. Please try again.',
        code: 'DB_CONNECTION_FAILED'
      });
    }
    
    // Fetch chatbot from database
    let chatbot = null;
    try {
      chatbot = await Chatbot.findById(req.params.id).lean();
    } catch (queryError) {
      console.error('GET /api/chatbots/:id - Query error:', queryError);
      // Handle CastError from query
      if (queryError?.name === 'CastError') {
        return res.status(400).json({ 
          error: 'Invalid chatbot ID format',
          code: 'INVALID_ID'
        });
      }
      // Handle other query errors
      return res.status(503).json({ 
        error: 'Database query failed', 
        message: 'Unable to fetch chatbot from database.',
        code: 'QUERY_ERROR'
      });
    }
    
    if (!chatbot) {
      return res.status(404).json({ 
        error: 'Chatbot not found',
        code: 'NOT_FOUND',
        id: req.params.id
      });
    }
    
    console.log('GET /api/chatbots/:id - Success:', chatbot._id);
    return res.json(chatbot);
  } catch (error) {
    // Catch ANY unhandled error
    console.error('GET /api/chatbots/:id - Unhandled Error:', error);
    console.error('Error name:', error?.name);
    console.error('Error message:', error?.message);
    if (error?.stack) {
      console.error('Error stack:', error.stack);
    }
    
    // Ensure CORS headers are set even for errors
    try {
      setCorsHeaders(req, res);
    } catch (e) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    
    // Handle MongoDB connection errors
    if (error?.name === 'MongoServerSelectionError' || 
        error?.name === 'MongoNetworkError' ||
        error?.name === 'MongoTimeoutError' ||
        error?.name === 'MongoError' ||
        error?.message?.includes('buffering timed out') ||
        error?.message?.includes('connection timed out')) {
      return res.status(503).json({ 
        error: 'Database connection timeout', 
        message: 'Unable to connect to database. Please try again in a moment.',
        retry: true,
        code: 'DB_TIMEOUT'
      });
    }
    
    // Handle invalid ObjectId errors
    if (error?.name === 'CastError') {
      return res.status(400).json({ 
        error: 'Invalid chatbot ID format',
        code: 'INVALID_ID'
      });
    }
    
    // Default error response
    return res.status(500).json({ 
      error: error?.message || 'Failed to fetch chatbot',
      code: 'FETCH_ERROR',
      type: error?.name || 'UnknownError'
    });
  }
}));

// Create chatbot
router.post('/', asyncHandler(async (req, res) => {
  // Always set CORS headers first
  try {
    setCorsHeaders(req, res);
  } catch (corsError) {
    console.error('CORS header error:', corsError);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  
  try {
    console.log('POST /api/chatbots - Request received');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Request headers:', req.headers);
    
    // Ensure MongoDB connection before operations
    const isConnected = await ensureDBConnection();
    if (!isConnected) {
      console.error('POST /api/chatbots - Database connection failed');
      return sendResponse(req, res, 503, { 
        error: 'Database connection failed', 
        message: 'Unable to connect to database. Please try again.',
        code: 'DB_CONNECTION_FAILED'
      });
    }

    console.log('POST /api/chatbots - Creating chatbot with data:', req.body);
    
    // Validate required fields
    if (!req.body.name && !req.body.propertyName) {
      return sendResponse(req, res, 400, { 
        error: 'Validation Error', 
        message: 'Chatbot name is required',
        code: 'VALIDATION_ERROR'
      });
    }
    
    // Create and save chatbot
    const chatbotData = {
      ...req.body,
      name: req.body.name || req.body.propertyName || 'Chatbot',
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const chatbot = new Chatbot(chatbotData);
    const savedChatbot = await chatbot.save();
    
    console.log('POST /api/chatbots - Chatbot saved successfully:', savedChatbot._id);
    return sendResponse(req, res, 201, savedChatbot);
  } catch (error) {
    console.error('POST /api/chatbots - Error creating chatbot:', error);
    console.error('Error name:', error?.name);
    console.error('Error message:', error?.message);
    if (error?.stack) {
      console.error('Error stack:', error.stack);
    }
    
    // Handle specific MongoDB errors
    if (error?.name === 'MongoServerSelectionError' || 
        error?.name === 'MongoNetworkError' ||
        error?.name === 'MongoTimeoutError' ||
        error?.message?.includes('buffering timed out') ||
        error?.message?.includes('connection timed out') ||
        error?.message?.includes('ECONNREFUSED') ||
        error?.message?.includes('ENOTFOUND')) {
      return sendResponse(req, res, 503, { 
        error: 'Database connection timeout', 
        message: 'Unable to connect to database. Please try again in a moment.',
        retry: true,
        code: 'DB_TIMEOUT'
      });
    }
    
    // Handle validation errors
    if (error?.name === 'ValidationError') {
      return sendResponse(req, res, 400, { 
        error: 'Validation Error', 
        message: error.message,
        code: 'VALIDATION_ERROR',
        details: error.errors 
      });
    }
    
    // Handle cast errors (invalid ObjectId)
    if (error?.name === 'CastError') {
      return sendResponse(req, res, 400, { 
        error: 'Invalid ID format',
        code: 'INVALID_ID'
      });
    }
    
    // Generic error - always use sendResponse to ensure CORS headers
    return sendResponse(req, res, 500, { 
      error: error?.message || 'Failed to create chatbot',
      code: 'CREATE_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}));

// Update chatbot
router.put('/:id', asyncHandler(async (req, res) => {
  try {
    // Ensure MongoDB connection before operations
    const isConnected = await ensureDBConnection();
    if (!isConnected) {
      return sendResponse(req, res, 503, { 
        error: 'Database connection failed', 
        message: 'Unable to connect to database. Please try again.',
        code: 'DB_CONNECTION_FAILED'
      });
    }
    
    const chatbot = await Chatbot.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!chatbot) {
      return sendResponse(req, res, 404, { 
        error: 'Chatbot not found',
        code: 'NOT_FOUND'
      });
    }
    setCorsHeaders(req, res);
    res.json(chatbot);
  } catch (error) {
    console.error('Error updating chatbot:', error);
    
    // Handle MongoDB connection errors
    if (error.name === 'MongoServerSelectionError' || 
        error.message?.includes('buffering timed out') ||
        error.message?.includes('connection timed out')) {
      return sendResponse(req, res, 503, { 
        error: 'Database connection timeout', 
        message: 'Unable to connect to database. Please try again in a moment.',
        retry: true,
        code: 'DB_TIMEOUT'
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return sendResponse(req, res, 400, { 
        error: 'Validation Error', 
        message: error.message,
        code: 'VALIDATION_ERROR',
        details: error.errors 
      });
    }
    
    sendResponse(req, res, 500, { 
      error: error.message || 'Failed to update chatbot',
      code: 'UPDATE_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}));

// Delete chatbot
router.delete('/:id', asyncHandler(async (req, res) => {
  try {
    // Ensure MongoDB connection before operations
    const isConnected = await ensureDBConnection();
    if (!isConnected) {
      return sendResponse(req, res, 503, { 
        error: 'Database connection failed', 
        message: 'Unable to connect to database. Please try again.',
        code: 'DB_CONNECTION_FAILED'
      });
    }
    
    const chatbot = await Chatbot.findByIdAndDelete(req.params.id);
    if (!chatbot) {
      return sendResponse(req, res, 404, { 
        error: 'Chatbot not found',
        code: 'NOT_FOUND'
      });
    }
    setCorsHeaders(req, res);
    res.json({ message: 'Chatbot deleted successfully' });
  } catch (error) {
    console.error('Error deleting chatbot:', error);
    
    // Handle MongoDB connection errors
    if (error.name === 'MongoServerSelectionError' || 
        error.message?.includes('buffering timed out') ||
        error.message?.includes('connection timed out')) {
      return sendResponse(req, res, 503, { 
        error: 'Database connection timeout', 
        message: 'Unable to connect to database. Please try again in a moment.',
        retry: true,
        code: 'DB_TIMEOUT'
      });
    }
    
    sendResponse(req, res, 500, { 
      error: error.message || 'Failed to delete chatbot',
      code: 'DELETE_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}));

// Global error handler middleware - must be after all routes
router.use((err, req, res, next) => {
  console.error('Router-level error:', err);
  try {
    setCorsHeaders(req, res);
  } catch (e) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.status(500).json({
    error: err?.message || 'Internal server error',
    code: 'ROUTER_ERROR',
    type: err?.name || 'UnknownError'
  });
});

export default router;

