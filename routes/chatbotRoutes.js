import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Chatbot from '../models/Chatbot.js';
import { setCorsHeaders } from '../utils/cors.js';

dotenv.config();
const router = express.Router();

// Helper to send response with CORS headers
const sendResponse = (req, res, statusCode, data) => {
  setCorsHeaders(req, res);
  return res.status(statusCode).json(data);
};

// Helper to ensure connection before database operations
const ensureDBConnection = async () => {
  try {
    // Check if already connected
    if (mongoose.connection.readyState === 1) {
      return true;
    }
    
    // If connecting, wait a bit
    if (mongoose.connection.readyState === 2) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (mongoose.connection.readyState === 1) {
        return true;
      }
    }
    
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://asif786minto:bunny%40123@bunny.f0vwjmk.mongodb.net/chatbot';
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      bufferMaxEntries: 0,
      bufferCommands: false,
      maxPoolSize: 1,
      minPoolSize: 1,
    });
    
    console.log('MongoDB connection ensured in route');
    return mongoose.connection.readyState === 1;
  } catch (error) {
    console.error('Failed to ensure MongoDB connection in route:', error);
    throw error; // Re-throw to be caught by route error handler
  }
};

// Get all chatbots
router.get('/', async (req, res) => {
  try {
    // Ensure MongoDB connection before operations
    await ensureDBConnection();
    
    const chatbots = await Chatbot.find().sort({ createdAt: -1 });
    setCorsHeaders(req, res);
    res.json(chatbots);
  } catch (error) {
    console.error('Error fetching chatbots:', error);
    sendResponse(req, res, 500, { 
      error: error.message || 'Failed to fetch chatbots',
      code: 'FETCH_ERROR'
    });
  }
});

// Get single chatbot
router.get('/:id', async (req, res) => {
  try {
    console.log('GET /api/chatbots/:id - Request received:', req.params.id);
    
    // Ensure MongoDB connection before operations
    const isConnected = await ensureDBConnection();
    if (!isConnected) {
      return res.status(503).json({ 
        error: 'Database connection failed', 
        message: 'Unable to connect to database. Please try again.' 
      });
    }
    
    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid chatbot ID format' });
    }
    
    const chatbot = await Chatbot.findById(req.params.id);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }
    
    console.log('GET /api/chatbots/:id - Success:', chatbot._id);
    setCorsHeaders(req, res);
    res.json(chatbot);
  } catch (error) {
    console.error('GET /api/chatbots/:id - Error:', error);
    
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
    
    // Handle invalid ObjectId errors
    if (error.name === 'CastError') {
      return sendResponse(req, res, 400, { 
        error: 'Invalid chatbot ID format',
        code: 'INVALID_ID'
      });
    }
    
    sendResponse(req, res, 500, { 
      error: error.message || 'Failed to fetch chatbot',
      code: 'FETCH_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Create chatbot
router.post('/', async (req, res) => {
  try {
    // Ensure MongoDB connection before operations
    await ensureDBConnection();

    console.log('Received chatbot data:', req.body);
    
    // Create and save chatbot
    const chatbot = new Chatbot(req.body);
    const savedChatbot = await chatbot.save();
    
    console.log('Chatbot saved successfully:', savedChatbot._id);
    setCorsHeaders(req, res);
    res.status(201).json(savedChatbot);
  } catch (error) {
    console.error('Error creating chatbot:', error);
    
    // Handle specific MongoDB errors
    if (error.message && (
      error.message.includes('buffering timed out') ||
      error.message.includes('connection timed out') ||
      error.name === 'MongoServerSelectionError'
    )) {
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
    
    // Generic error
    sendResponse(req, res, 500, { 
      error: error.message || 'Failed to create chatbot',
      code: 'CREATE_ERROR',
      details: error.errors 
    });
  }
});

// Update chatbot
router.put('/:id', async (req, res) => {
  try {
    // Ensure MongoDB connection before operations
    await ensureDBConnection();
    
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
    sendResponse(req, res, 400, { 
      error: error.message || 'Failed to update chatbot',
      code: 'UPDATE_ERROR'
    });
  }
});

// Delete chatbot
router.delete('/:id', async (req, res) => {
  try {
    // Ensure MongoDB connection before operations
    await ensureDBConnection();
    
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
    sendResponse(req, res, 500, { 
      error: error.message || 'Failed to delete chatbot',
      code: 'DELETE_ERROR'
    });
  }
});

export default router;

