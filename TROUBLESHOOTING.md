# Backend API Troubleshooting Guide

## Network Error: Unable to connect to server

If you're getting "Network Error: Unable to connect to server", follow these steps:

### 1. Verify Backend URL

The frontend is configured to use:
- **Production**: `https://chatbot-xi-six-89.vercel.app/api`
- **Development**: `http://localhost:5000/api`

**Check if your backend is deployed at the correct URL:**

```bash
# Test the backend health endpoint
curl https://chatbot-xi-six-89.vercel.app/api/health

# Should return:
# {"status":"OK","message":"Server is running"}
```

### 2. Verify Backend Deployment

**If backend is deployed separately:**
- Check your backend Vercel project URL
- Update `VITE_API_URL` environment variable in frontend Vercel project
- Or update the default URL in `admin/frontend/src/utils/api.js`

**If backend is in same project:**
- Ensure `admin/backend/api/index.js` exists
- Ensure `vercel.json` routes `/api/*` to `/api/index.js`
- Backend should be accessible at `https://your-frontend.vercel.app/api/*`

### 3. Check CORS Configuration

**Backend CORS Settings:**
- Set `CORS_ORIGIN` environment variable in backend Vercel project
- Format: `https://your-frontend.vercel.app` (no trailing slash)
- Multiple origins: `https://app1.com,https://app2.com`

**If CORS_ORIGIN is not set:**
- Backend allows all origins (should work, but less secure)

### 4. Verify Environment Variables

**Backend Vercel Environment Variables (Required):**
```
MONGODB_URI=mongodb+srv://...
CORS_ORIGIN=https://your-frontend.vercel.app
NODE_ENV=production
JWT_SECRET=your-secret-key
```

**Frontend Vercel Environment Variables (Optional but Recommended):**
```
VITE_API_URL=https://your-backend.vercel.app/api
```

### 5. Check Vercel Deployment Logs

1. Go to Vercel Dashboard → Your Project → Deployments
2. Click on latest deployment → View Function Logs
3. Check for errors in backend serverless function

### 6. Test Backend Endpoints Directly

```bash
# Health check
curl https://chatbot-xi-six-89.vercel.app/api/health

# Get chatbots
curl https://chatbot-xi-six-89.vercel.app/api/chatbots

# Create chatbot (POST)
curl -X POST https://chatbot-xi-six-89.vercel.app/api/chatbots \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","welcomeMessage":"Hello"}'
```

### 7. Common Issues

**Issue: 405 Method Not Allowed**
- Backend route doesn't support the HTTP method
- Check `routes/chatbotRoutes.js` for POST handler

**Issue: Network Error**
- Backend URL is incorrect
- Backend is not deployed
- CORS is blocking the request
- SSL certificate issue

**Issue: CORS Error**
- Frontend origin not in `CORS_ORIGIN`
- Missing `Access-Control-Allow-Origin` header
- Preflight OPTIONS request failing

### 8. Quick Fixes

**Update Backend URL in Frontend:**
1. Edit `admin/frontend/src/utils/api.js`
2. Change `API_BASE_URL` default value
3. Redeploy frontend

**Update CORS in Backend:**
1. Go to Vercel → Backend Project → Settings → Environment Variables
2. Add/Update `CORS_ORIGIN` = `https://your-frontend.vercel.app`
3. Redeploy backend

**Test Locally:**
1. Start backend: `cd admin/backend && npm run dev`
2. Start frontend: `cd admin/frontend && npm run dev`
3. Frontend should connect to `http://localhost:5000/api`

### 9. Debug Mode

Enable debug logging in browser console:
- Open browser DevTools → Console
- Look for "API Request:" logs showing full URLs
- Check Network tab for failed requests
- Verify request URL matches backend URL

### 10. Verify Backend Structure

Ensure your backend has:
```
admin/backend/
├── api/
│   └── index.js          # Vercel serverless entry point
├── routes/
│   ├── chatbotRoutes.js  # POST /api/chatbots handler
│   ├── messageRoutes.js
│   └── uploadRoutes.js
├── server.js             # Express app
└── vercel.json           # Routes /api/* to /api/index.js
```

### Still Having Issues?

1. Check browser console for detailed error messages
2. Check Network tab to see actual request URL and response
3. Verify backend is accessible via curl/Postman
4. Check Vercel function logs for backend errors
5. Ensure MongoDB connection is working (check backend logs)

