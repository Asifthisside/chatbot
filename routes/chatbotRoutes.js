import express from 'express';
import Chatbot from '../models/Chatbot.js';

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
    console.log('Received chatbot data:', req.body);
    const chatbot = new Chatbot(req.body);
    const savedChatbot = await chatbot.save();
    console.log('Chatbot saved successfully:', savedChatbot._id);
    res.status(201).json(savedChatbot);
  } catch (error) {
    console.error('Error creating chatbot:', error);
    res.status(400).json({ error: error.message, details: error.errors });
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

