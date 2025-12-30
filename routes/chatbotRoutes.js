import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Chatbot from '../models/Chatbot.js';

dotenv.config();
const router = express.Router();

// Get all chatbots
router.get('/', async (req, res) => {
  try {
    const chatbots = await Chatbot.find().sort({ createdAt: -1 });
    res.json(chatbots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single chatbot
router.get('/:id', async (req, res) => {
  try {
    const chatbot = await Chatbot.findById(req.params.id);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }
    res.json(chatbot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create chatbot
router.post('/', async (req, res) => {
  try {
    // Ensure MongoDB connection is ready (important for serverless)
    const connectionState = mongoose.connection.readyState;
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    
    if (connectionState !== 1) {
      console.log(`MongoDB connection state: ${connectionState}, attempting to connect...`);
      const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://asif786minto:bunny%40123@bunny.f0vwjmk.mongodb.net/chatbot';
      
      // Connect with serverless-optimized settings
      await mongoose.connect(mongoURI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 10000, // 10 seconds
        socketTimeoutMS: 45000,
        bufferMaxEntries: 0, // Disable buffering
        bufferCommands: false, // Disable buffering
        maxPoolSize: 1,
        minPoolSize: 1,
      });
      
      console.log('MongoDB reconnected successfully');
    }

    console.log('Received chatbot data:', req.body);
    
    // Create and save chatbot
    const chatbot = new Chatbot(req.body);
    const savedChatbot = await chatbot.save();
    
    console.log('Chatbot saved successfully:', savedChatbot._id);
    res.status(201).json(savedChatbot);
  } catch (error) {
    console.error('Error creating chatbot:', error);
    
    // Handle specific MongoDB errors
    if (error.message && (
      error.message.includes('buffering timed out') ||
      error.message.includes('connection timed out') ||
      error.name === 'MongoServerSelectionError'
    )) {
      return res.status(503).json({ 
        error: 'Database connection timeout', 
        message: 'Unable to connect to database. Please try again in a moment.',
        retry: true
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: error.message,
        details: error.errors 
      });
    }
    
    // Generic error
    res.status(500).json({ 
      error: error.message || 'Failed to create chatbot',
      details: error.errors 
    });
  }
});

// Update chatbot
router.put('/:id', async (req, res) => {
  try {
    const chatbot = await Chatbot.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }
    res.json(chatbot);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete chatbot
router.delete('/:id', async (req, res) => {
  try {
    const chatbot = await Chatbot.findByIdAndDelete(req.params.id);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }
    res.json({ message: 'Chatbot deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

