# How to Start Local Backend Server

## Quick Start

1. **Navigate to backend directory:**
   ```bash
   cd admin/backend
   ```

2. **Install dependencies (if not already installed):**
   ```bash
   npm install
   ```

3. **Create/Check .env file:**
   Make sure you have a `.env` file with:
   ```
   MONGODB_URI=mongodb+srv://asif786minto:bunny%40123@bunny.f0vwjmk.mongodb.net/chatbot
   PORT=5000
   ```

4. **Start the server:**
   ```bash
   npm start
   ```
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

5. **Verify server is running:**
   - Open browser: http://localhost:5000/api/health
   - Should see: `{"status":"OK","message":"Server is running",...}`

## Alternative: Use Production API

If you don't want to run local backend, update frontend to use production API:

1. **Create `.env` file in `admin/frontend/` directory:**
   ```
   VITE_API_URL=https://chatbot-xi-six-89.vercel.app/api
   ```

2. **Restart frontend dev server**

## Troubleshooting

### Port 5000 already in use
- Change PORT in `.env` file
- Or kill the process using port 5000:
  ```bash
  # Windows PowerShell
  netstat -ano | findstr :5000
  taskkill /PID <PID> /F
  ```

### MongoDB connection errors
- Check MongoDB Atlas IP whitelist (should allow all: 0.0.0.0/0)
- Verify MONGODB_URI in .env file
- Check MongoDB cluster is running

### CORS errors
- Backend CORS is configured to allow localhost:3000
- If using different port, update CORS config in server.js






