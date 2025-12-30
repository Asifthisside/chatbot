# Chatbot Admin Backend

Backend API for the Chatbot Admin Panel built with Express.js and MongoDB.

## Setup Instructions

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the backend directory:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/chatbot-admin
```

3. Make sure MongoDB is running on your system.

4. Start the server:
```bash
npm run dev
```

The server will run on `http://localhost:5000`

## API Endpoints

### Chatbots
- `GET /api/chatbots` - Get all chatbots
- `GET /api/chatbots/:id` - Get single chatbot
- `POST /api/chatbots` - Create new chatbot
- `PUT /api/chatbots/:id` - Update chatbot
- `DELETE /api/chatbots/:id` - Delete chatbot

### Upload
- `POST /api/upload/icon` - Upload chatbot icon image

## Database Schema

The chatbot model includes:
- name, welcomeMessage, personality
- primaryColor, position, icon, iconImage
- knowledgeSource, faqs, enableMongoDBJokes
- isActive, createdAt, updatedAt





