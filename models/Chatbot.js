import mongoose from 'mongoose';

const chatbotSchema = new mongoose.Schema({
  propertyName: {
    type: String,
    required: true,
    trim: true
  },
  siteUrl: {
    type: String,
    required: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  welcomeMessage: {
    type: String,
    required: true,
    default: 'Hello! How can I help you today?'
  },
  personality: {
    type: String,
    enum: ['Friendly', 'Professional', 'Funny'],
    default: 'Friendly'
  },
  theme: {
    type: String,
    enum: ['light', 'dark', 'custom'],
    default: 'light'
  },
  primaryColor: {
    type: String,
    default: '#3B82F6'
  },
  position: {
    type: String,
    enum: ['Bottom Left', 'Bottom Right'],
    default: 'Bottom Right'
  },
  icon: {
    type: String,
    default: '💬'
  },
  iconImage: {
    type: String,
    default: ''
  },
  knowledgeSource: {
    type: String,
    default: ''
  },
  faqs: [{
    question: String,
    answer: String
  }],
  enableMongoDBJokes: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

chatbotSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('Chatbot', chatbotSchema);

