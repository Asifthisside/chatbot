import express from 'express';
import mongoose from 'mongoose';
import Message from '../models/Message.js';
import User from '../models/User.js';
import Chatbot from '../models/Chatbot.js';
import { setCorsHeaders } from '../utils/cors.js';

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
    
    console.log('MongoDB connection ensured in message route');
    return mongoose.connection.readyState === 1;
  } catch (error) {
    console.error('Failed to ensure MongoDB connection in message route:', error);
    throw error;
  }
};

// Helper function to detect browser and OS from user agent
const detectBrowserAndOS = (userAgent) => {
  let browser = 'Unknown';
  let os = 'Unknown';

  // Detect Browser
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    browser = 'Chrome';
  } else if (userAgent.includes('Firefox')) {
    browser = 'Firefox';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browser = 'Safari';
  } else if (userAgent.includes('Edg')) {
    browser = 'Edge';
  } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
    browser = 'Opera';
  }

  // Detect OS
  if (userAgent.includes('Windows')) {
    os = 'Windows';
  } else if (userAgent.includes('Mac OS X') || userAgent.includes('Macintosh')) {
    os = 'Mac';
  } else if (userAgent.includes('Linux')) {
    os = 'Linux';
  } else if (userAgent.includes('Android')) {
    os = 'Android';
  } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    os = 'iOS';
  }

  return { browser, os };
};

// Generate or get device ID
const getDeviceId = (req) => {
  // Try to get from cookie first
  let deviceId = req.cookies?.deviceId;
  
  if (!deviceId) {
    // Generate new device ID
    deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  return deviceId;
};

// Get IP address
const getIpAddress = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         '127.0.0.1';
};

// Send message
router.post('/send', async (req, res) => {
  try {
    console.log('POST /api/messages/send - Request received');
    
    // Ensure MongoDB connection before operations
    const isConnected = await ensureDBConnection();
    if (!isConnected) {
      return sendResponse(req, res, 503, { 
        error: 'Database connection failed', 
        message: 'Unable to connect to database. Please try again.',
        code: 'DB_CONNECTION_FAILED'
      });
    }
    
    const { chatbotId, text, type = 'user', deviceId: clientDeviceId } = req.body;
    
    if (!chatbotId || !text) {
      return sendResponse(req, res, 400, { 
        error: 'Chatbot ID and message text are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(chatbotId)) {
      return sendResponse(req, res, 400, { 
        error: 'Invalid chatbot ID format',
        code: 'INVALID_ID'
      });
    }

    // Check if chatbot exists
    const chatbot = await Chatbot.findById(chatbotId);
    if (!chatbot) {
      return sendResponse(req, res, 404, { 
        error: 'Chatbot not found',
        code: 'NOT_FOUND'
      });
    }

    // Get device info
    const userAgent = req.headers['user-agent'] || '';
    const { browser, os } = detectBrowserAndOS(userAgent);
    const ipAddress = getIpAddress(req);
    // Use client-provided deviceId or generate/get from cookie
    const deviceId = clientDeviceId || getDeviceId(req);

    // Find or create user
    let user = await User.findOne({ deviceId, chatbotId });
    
    if (!user) {
      // Create new user
      user = new User({
        deviceId,
        ipAddress,
        browser,
        os,
        userAgent,
        chatbotId,
        messageCount: 1
      });
      await user.save();
    } else {
      // Update existing user
      user.lastSeen = Date.now();
      user.messageCount += 1;
      user.ipAddress = ipAddress; // Update IP in case it changed
      await user.save();
    }

    // Create message
    const message = new Message({
      chatbotId,
      userId: user._id,
      type,
      text,
      timestamp: new Date()
    });
    await message.save();

    // Set device ID cookie
    res.cookie('deviceId', deviceId, { 
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      httpOnly: true 
    });

    console.log('POST /api/messages/send - Success:', message._id);
    setCorsHeaders(req, res);
    res.json({
      success: true,
      message: message,
      user: {
        deviceId: user.deviceId,
        browser: user.browser,
        os: user.os
      }
    });
  } catch (error) {
    console.error('POST /api/messages/send - Error:', error);
    
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
    
    // Handle cast errors
    if (error.name === 'CastError') {
      return sendResponse(req, res, 400, { 
        error: 'Invalid ID format',
        code: 'INVALID_ID'
      });
    }
    
    sendResponse(req, res, 500, { 
      error: error.message || 'Failed to send message',
      code: 'SEND_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get user stats
router.get('/stats', async (req, res) => {
  try {
    // Ensure MongoDB connection before operations
    await ensureDBConnection();
    
    const totalUsers = await User.countDocuments();
    const totalMessages = await Message.countDocuments();
    
    // Get unique users by device ID
    const uniqueUsers = await User.distinct('deviceId');
    
    setCorsHeaders(req, res);
    res.json({
      totalUsers: uniqueUsers.length,
      totalMessages,
      totalDevices: totalUsers
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    sendResponse(req, res, 500, { 
      error: error.message || 'Failed to get stats',
      code: 'STATS_ERROR'
    });
  }
});

// Get users for a specific chatbot
router.get('/users/:chatbotId', async (req, res) => {
  try {
    // Ensure MongoDB connection before operations
    await ensureDBConnection();
    
    const users = await User.find({ chatbotId: req.params.chatbotId })
      .sort({ lastSeen: -1 })
      .limit(100);
    
    setCorsHeaders(req, res);
    res.json(users);
  } catch (error) {
    console.error('Error getting users:', error);
    sendResponse(req, res, 500, { 
      error: error.message || 'Failed to get users',
      code: 'USERS_ERROR'
    });
  }
});

// Get messages for a specific chatbot with user details
router.get('/chatbot/:chatbotId', async (req, res) => {
  try {
    // Ensure MongoDB connection before operations
    await ensureDBConnection();
    
    const messages = await Message.find({ chatbotId: req.params.chatbotId })
      .populate('userId', 'deviceId ipAddress browser os userAgent firstSeen lastSeen messageCount')
      .sort({ timestamp: -1 })
      .limit(100);
    
    setCorsHeaders(req, res);
    res.json(messages);
  } catch (error) {
    console.error('Error getting messages:', error);
    sendResponse(req, res, 500, { 
      error: error.message || 'Failed to get messages',
      code: 'MESSAGES_ERROR'
    });
  }
});

export default router;


