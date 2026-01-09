import express from 'express';
import mongoose from 'mongoose';
import Message from '../models/Message.js';
import User from '../models/User.js';
import Chatbot from '../models/Chatbot.js';
import { setCorsHeaders } from '../utils/cors.js';

const router = express.Router();

// Helper to send response with CORS headers
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

// Test endpoint - doesn't require database
router.get('/test', (req, res) => {
  setCorsHeaders(req, res);
  res.json({ 
    status: 'OK', 
    message: 'Message routes are working',
    timestamp: new Date().toISOString()
  });
});

// Helper to ensure connection before database operations
const ensureDBConnection = async () => {
  try {
    // Check if already connected
    if (mongoose.connection.readyState === 1) {
      return true;
    }
    
    // If connecting, wait a bit (max 2 seconds)
    if (mongoose.connection.readyState === 2) {
      const maxWait = 2000; // 2 seconds
      const startTime = Date.now();
      while (mongoose.connection.readyState === 2 && (Date.now() - startTime) < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (mongoose.connection.readyState === 1) {
        return true;
      }
    }
    
    // Get MongoDB URI from environment
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://asif786minto:bunny%40123@bunny.f0vwjmk.mongodb.net/chatbot';
    
    if (!mongoURI || mongoURI === 'undefined') {
      console.error('MongoDB URI is not configured');
      return false;
    }
    
    // Try to connect with timeout (shorter for serverless)
    try {
      const connectPromise = mongoose.connect(mongoURI, {
        serverSelectionTimeoutMS: 3000, // 3 seconds for serverless
        socketTimeoutMS: 20000,
        maxPoolSize: 1,
        minPoolSize: 0, // Don't maintain connection in serverless
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 4000)
      );
      
      await Promise.race([connectPromise, timeoutPromise]);
      
      // Check connection state
      if (mongoose.connection.readyState === 1) {
        console.log('MongoDB connection ensured in message route');
        return true;
      }
      return false;
    } catch (connectError) {
      console.error('MongoDB connection error:', connectError?.message || connectError);
      // Return false instead of throwing - don't crash the server
      return false;
    }
  } catch (error) {
    console.error('Failed to ensure MongoDB connection:', error?.message || error);
    // Always return false instead of throwing
    return false;
  }
};

// Helper function to detect browser and OS from user agent
const detectBrowserAndOS = (userAgent = '') => {
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
  // Always set CORS headers first - wrap in try-catch
  try {
    setCorsHeaders(req, res);
  } catch (corsError) {
    console.error('CORS header error:', corsError);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  
  try {
    console.log('GET /api/messages/stats - Request received');
    
    // Ensure MongoDB connection before operations
    let isConnected = false;
    try {
      isConnected = await ensureDBConnection();
    } catch (dbError) {
      console.error('GET /api/messages/stats - ensureDBConnection error:', dbError);
      return res.status(503).json({ 
        error: 'Database connection failed', 
        message: 'Unable to connect to database. Please try again.',
        code: 'DB_CONNECTION_FAILED',
        totalUsers: 0,
        totalMessages: 0,
        totalDevices: 0
      });
    }
    
    if (!isConnected) {
      console.error('GET /api/messages/stats - Database connection failed');
      return res.status(503).json({ 
        error: 'Database connection failed', 
        message: 'Unable to connect to database. Please try again.',
        code: 'DB_CONNECTION_FAILED',
        totalUsers: 0,
        totalMessages: 0,
        totalDevices: 0
      });
    }
    
    console.log('GET /api/messages/stats - Fetching stats from database');
    const [totalUsers, totalMessages, uniqueUsers] = await Promise.all([
      User.countDocuments().catch(() => 0),
      Message.countDocuments().catch(() => 0),
      User.distinct('deviceId').catch(() => [])
    ]);
    
    console.log(`GET /api/messages/stats - Stats: ${uniqueUsers.length} users, ${totalMessages} messages`);
    
    return res.json({
      totalUsers: uniqueUsers?.length || 0,
      totalMessages: totalMessages || 0,
      totalDevices: totalUsers || 0
    });
  } catch (error) {
    console.error('GET /api/messages/stats - Unhandled Error:', error);
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
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
        code: 'DB_TIMEOUT',
        totalUsers: 0,
        totalMessages: 0,
        totalDevices: 0
      });
    }
    
    // Return safe fallback response
    return res.status(500).json({ 
      error: error?.message || 'Failed to get stats',
      code: 'STATS_ERROR',
      totalUsers: 0,
      totalMessages: 0,
      totalDevices: 0
    });
  }
});

// Get users for a specific chatbot
router.get('/users/:chatbotId', async (req, res) => {
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
    
    const users = await User.find({ chatbotId: req.params.chatbotId })
      .sort({ lastSeen: -1 })
      .limit(100);
    
    setCorsHeaders(req, res);
    res.json(users);
  } catch (error) {
    console.error('Error getting users:', error);
    
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
      error: error.message || 'Failed to get users',
      code: 'USERS_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get messages for a specific chatbot with user details
router.get('/chatbot/:chatbotId', async (req, res) => {
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
    
    const messages = await Message.find({ chatbotId: req.params.chatbotId })
      .populate('userId', 'deviceId ipAddress browser os userAgent firstSeen lastSeen messageCount')
      .sort({ timestamp: -1 })
      .limit(100);
    
    setCorsHeaders(req, res);
    res.json(messages);
  } catch (error) {
    console.error('Error getting messages:', error);
    
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
      error: error.message || 'Failed to get messages',
      code: 'MESSAGES_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Admin reply to user message
router.post('/reply', async (req, res) => {
  try {
    console.log('POST /api/messages/reply - Request received');
    
    // Ensure MongoDB connection before operations
    const isConnected = await ensureDBConnection();
    if (!isConnected) {
      return sendResponse(req, res, 503, { 
        error: 'Database connection failed', 
        message: 'Unable to connect to database. Please try again.',
        code: 'DB_CONNECTION_FAILED'
      });
    }
    
    const { chatbotId, userId, text } = req.body;
    
    if (!chatbotId || !userId || !text) {
      return sendResponse(req, res, 400, { 
        error: 'Chatbot ID, User ID, and reply text are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(chatbotId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return sendResponse(req, res, 400, { 
        error: 'Invalid ID format',
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

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return sendResponse(req, res, 404, { 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Create admin reply message (type: 'bot')
    const replyMessage = new Message({
      chatbotId,
      userId: user._id,
      type: 'bot',
      text: text.trim(),
      timestamp: new Date()
    });
    await replyMessage.save();

    console.log('POST /api/messages/reply - Success:', replyMessage._id);
    setCorsHeaders(req, res);
    res.json({
      success: true,
      message: replyMessage
    });
  } catch (error) {
    console.error('POST /api/messages/reply - Error:', error);
    
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
      error: error.message || 'Failed to send reply',
      code: 'REPLY_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get conversations grouped by user for a chatbot
router.get('/conversations/:chatbotId', async (req, res) => {
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
    
    const messages = await Message.find({ chatbotId: req.params.chatbotId })
      .populate('userId', 'deviceId ipAddress browser os userAgent firstSeen lastSeen messageCount')
      .sort({ timestamp: 1 })
      .limit(500);
    
    // Group messages by userId
    const conversations = {};
    messages.forEach(msg => {
      const userId = msg.userId._id.toString();
      if (!conversations[userId]) {
        conversations[userId] = {
          userId: msg.userId._id,
          user: msg.userId,
          messages: [],
          lastMessageTime: msg.timestamp
        };
      }
      conversations[userId].messages.push(msg);
      if (msg.timestamp > conversations[userId].lastMessageTime) {
        conversations[userId].lastMessageTime = msg.timestamp;
      }
    });
    
    // Convert to array and sort by last message time
    const conversationsArray = Object.values(conversations).sort((a, b) => 
      new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
    );
    
    setCorsHeaders(req, res);
    res.json(conversationsArray);
  } catch (error) {
    console.error('Error getting conversations:', error);
    
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
      error: error.message || 'Failed to get conversations',
      code: 'CONVERSATIONS_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get all messages (without chatbot filter) - for admin overview
// This route must be LAST to avoid intercepting more specific routes
router.get('/', async (req, res) => {
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
    
    const limit = parseInt(req.query.limit) || 100;
    const messages = await Message.find()
      .populate('userId', 'deviceId ipAddress browser os userAgent firstSeen lastSeen messageCount')
      .populate('chatbotId', 'name')
      .sort({ timestamp: -1 })
      .limit(limit);
    
    return sendResponse(req, res, 200, messages);
  } catch (error) {
    console.error('Error getting all messages:', error);
    
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
    
    return sendResponse(req, res, 500, { 
      error: error.message || 'Failed to get messages',
      code: 'MESSAGES_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;


