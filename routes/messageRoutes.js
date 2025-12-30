import express from 'express';
import mongoose from 'mongoose';
import Message from '../models/Message.js';
import User from '../models/User.js';
import Chatbot from '../models/Chatbot.js';

const router = express.Router();

// Helper to ensure connection before database operations
const ensureDBConnection = async () => {
  if (mongoose.connection.readyState !== 1) {
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://asif786minto:bunny%40123@bunny.f0vwjmk.mongodb.net/chatbot';
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      bufferMaxEntries: 0,
      bufferCommands: false,
      maxPoolSize: 1,
    });
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
    // Ensure MongoDB connection before operations
    await ensureDBConnection();
    
    const { chatbotId, text, type = 'user', deviceId: clientDeviceId } = req.body;
    
    if (!chatbotId || !text) {
      return res.status(400).json({ error: 'Chatbot ID and message text are required' });
    }

    // Check if chatbot exists
    const chatbot = await Chatbot.findById(chatbotId);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
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
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message });
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
    
    res.json({
      totalUsers: uniqueUsers.length,
      totalMessages,
      totalDevices: totalUsers
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: error.message });
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
    
    res.json(users);
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ error: error.message });
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
    
    res.json(messages);
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;


