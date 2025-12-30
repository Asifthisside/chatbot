# Backend API Environment Variables Usage Guide

This guide explains how the backend API uses environment variables (1-7) to store and fetch data from MongoDB.

## Environment Variables Overview

The backend uses 7 main environment variables configured in `.env` file:

### 1. **MONGODB_URI** - Database Connection
**Purpose**: Connects the backend to MongoDB database for storing and fetching data

**Usage in Code** (`server.js` line 46):
```javascript
const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://...';
await mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
```

**What it stores/fetches**:
- **Chatbots**: All chatbot configurations (name, welcome message, colors, FAQs, etc.)
- **Users**: User data (deviceId, IP address, browser, OS, message count)
- **Messages**: All chat messages between users and chatbots

**Example**:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/chatbot
```

---

### 2. **PORT** - Server Port
**Purpose**: Defines which port the Express server runs on

**Usage in Code** (`server.js` line 19):
```javascript
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
```

**What it affects**:
- Local development: `http://localhost:5000`
- Vercel: Automatically set (no need to configure)

**Example**:
```env
PORT=5000
```

---

### 3. **NODE_ENV** - Environment Mode
**Purpose**: Sets the application environment (development/production)

**Usage in Code** (`server.js` line 167):
```javascript
...(process.env.NODE_ENV === 'development' && { stack: err.stack })
```

**What it controls**:
- Error messages: Shows stack traces in development, hides in production
- Logging: More verbose in development
- Security: Stricter in production

**Example**:
```env
NODE_ENV=development  # or 'production'
```

---

### 4. **JWT_SECRET** - Authentication Secret
**Purpose**: Secret key for signing and verifying JWT tokens (for future authentication)

**Usage in Code**:
Currently not used, but reserved for future authentication features.

**What it will secure**:
- User authentication tokens
- API access tokens
- Session management

**Example**:
```env
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

**Generate a secure secret**:
```bash
openssl rand -base64 32
```

---

### 5. **CORS_ORIGIN** - Cross-Origin Resource Sharing
**Purpose**: Controls which frontend domains can access the API

**Usage in Code** (`server.js` lines 22-29):
```javascript
const corsOptions = {
  origin: process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
```

**What it controls**:
- Which frontend URLs can make API requests
- Security: Prevents unauthorized domains from accessing your API
- Supports multiple origins (comma-separated)

**Example**:
```env
# Single origin
CORS_ORIGIN=http://localhost:3000

# Multiple origins
CORS_ORIGIN=http://localhost:3000,https://your-frontend.vercel.app
```

---

### 6. **MAX_FILE_SIZE** - File Upload Size Limit (Optional)
**Purpose**: Maximum file size for uploads (in bytes)

**Usage in Code** (`routes/uploadRoutes.js`):
Currently hardcoded to 5MB, but can use env variable:
```javascript
limits: {
  fileSize: process.env.MAX_FILE_SIZE || 5 * 1024 * 1024 // 5MB default
}
```

**What it controls**:
- Maximum size for chatbot icon uploads
- Prevents large file uploads that could crash the server

**Example**:
```env
MAX_FILE_SIZE=10485760  # 10MB in bytes
```

---

### 7. **ALLOWED_FILE_TYPES** - File Type Restrictions (Optional)
**Purpose**: Comma-separated list of allowed MIME types for uploads

**Usage in Code** (`routes/uploadRoutes.js`):
Currently hardcoded, but can use env variable:
```javascript
const allowedTypes = process.env.ALLOWED_FILE_TYPES 
  ? process.env.ALLOWED_FILE_TYPES.split(',')
  : ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
```

**What it controls**:
- Which file types can be uploaded (chatbot icons)
- Security: Prevents malicious file uploads

**Example**:
```env
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp
```

---

## How Data Storage & Fetching Works

### 1. **Database Connection Flow**

```
Environment Variable (MONGODB_URI)
    ↓
server.js loads via dotenv.config()
    ↓
mongoose.connect(process.env.MONGODB_URI)
    ↓
MongoDB Atlas/Cluster Connection Established
    ↓
Models (Chatbot, User, Message) can now store/fetch data
```

### 2. **Storing Data Example**

**Creating a Chatbot** (`routes/chatbotRoutes.js`):
```javascript
// POST /api/chatbots
router.post('/', async (req, res) => {
  const chatbot = new Chatbot(req.body);  // Uses MONGODB_URI connection
  const savedChatbot = await chatbot.save();  // Stores in MongoDB
  res.status(201).json(savedChatbot);
});
```

**Storing a Message** (`routes/messageRoutes.js`):
```javascript
// POST /api/messages/send
const message = new Message({
  chatbotId,
  userId: user._id,
  type: 'user',
  text: text,
  timestamp: new Date()
});
await message.save();  // Stores in MongoDB via MONGODB_URI
```

### 3. **Fetching Data Example**

**Getting All Chatbots** (`routes/chatbotRoutes.js`):
```javascript
// GET /api/chatbots
router.get('/', async (req, res) => {
  const chatbots = await Chatbot.find().sort({ createdAt: -1 });
  // Fetches from MongoDB using MONGODB_URI connection
  res.json(chatbots);
});
```

**Getting Messages** (`routes/messageRoutes.js`):
```javascript
// GET /api/messages/chatbot/:chatbotId
const messages = await Message.find({ chatbotId: req.params.chatbotId })
  .populate('userId', 'deviceId ipAddress browser os')
  .sort({ timestamp: -1 })
  .limit(100);
// Fetches from MongoDB using MONGODB_URI connection
```

---

## Complete .env File Setup

Create a `.env` file in `admin/backend/` directory:

```env
# ============================================
# Database Configuration (REQUIRED)
# ============================================
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/chatbot

# ============================================
# Server Configuration
# ============================================
PORT=5000
NODE_ENV=development

# ============================================
# Security Configuration
# ============================================
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# ============================================
# CORS Configuration (REQUIRED for frontend)
# ============================================
CORS_ORIGIN=http://localhost:3000

# ============================================
# File Upload Configuration (Optional)
# ============================================
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp
```

---

## Vercel Deployment Setup

When deploying to Vercel, add these environment variables in:
**Project Settings → Environment Variables**

### Required Variables:
1. `MONGODB_URI` - Your MongoDB connection string
2. `CORS_ORIGIN` - Your frontend URL (e.g., `https://your-frontend.vercel.app`)
3. `NODE_ENV` - Set to `production`
4. `JWT_SECRET` - Your secret key

### Optional Variables:
5. `MAX_FILE_SIZE` - File upload limit
6. `ALLOWED_FILE_TYPES` - Allowed file types

**Note**: `PORT` is automatically set by Vercel, don't need to configure it.

---

## Data Models Stored in MongoDB

### 1. **Chatbot Model**
Stores chatbot configurations:
- Basic info: name, welcomeMessage, personality
- Appearance: primaryColor, position, icon, iconImage
- Knowledge: knowledgeSource, faqs
- Settings: isActive, enableMongoDBJokes

### 2. **User Model**
Stores user/visitor information:
- Identification: deviceId, chatbotId
- Device info: ipAddress, browser, os, userAgent
- Activity: firstSeen, lastSeen, messageCount

### 3. **Message Model**
Stores chat messages:
- Reference: chatbotId, userId
- Content: type (user/bot), text, timestamp

---

## Testing the Connection

1. **Check MongoDB Connection**:
```bash
# Start the server
npm run dev

# Look for this message:
# "MongoDB connected successfully"
```

2. **Test API Endpoints**:
```bash
# Health check
curl http://localhost:5000/api/health

# Get all chatbots
curl http://localhost:5000/api/chatbots

# Create a chatbot
curl -X POST http://localhost:5000/api/chatbots \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Bot","welcomeMessage":"Hello!"}'
```

---

## Troubleshooting

### MongoDB Connection Issues:
- Check `MONGODB_URI` format is correct
- Verify MongoDB Atlas IP whitelist includes your IP (or 0.0.0.0/0 for all)
- Check username/password are correct
- Ensure database name exists

### CORS Issues:
- Verify `CORS_ORIGIN` matches your frontend URL exactly
- Include protocol (`http://` or `https://`)
- For multiple origins, use comma-separated list

### File Upload Issues:
- Check `MAX_FILE_SIZE` is large enough
- Verify `ALLOWED_FILE_TYPES` includes your file type
- Ensure uploads directory has write permissions

---

## Summary

The backend API uses environment variables to:
1. **Connect to MongoDB** (`MONGODB_URI`) - Stores/fetches Chatbots, Users, Messages
2. **Configure server** (`PORT`, `NODE_ENV`) - Controls server behavior
3. **Secure the API** (`JWT_SECRET`, `CORS_ORIGIN`) - Authentication and access control
4. **Handle uploads** (`MAX_FILE_SIZE`, `ALLOWED_FILE_TYPES`) - File upload restrictions

All data operations (create, read, update, delete) go through MongoDB using the `MONGODB_URI` connection established at server startup.

