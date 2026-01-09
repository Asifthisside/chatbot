# Fixing 500 Errors - Deployment Guide

## Problem
Backend API is returning 500 errors on Vercel deployment.

## Solution Steps

### 1. Verify Code Changes Are Committed
```bash
cd admin/backend
git status
git add .
git commit -m "Fix 500 errors with improved error handling"
git push
```

### 2. Check Vercel Environment Variables
Go to Vercel Dashboard → Your Project → Settings → Environment Variables

**Required Variables:**
- `MONGODB_URI` - Your MongoDB Atlas connection string
  - Format: `mongodb+srv://username:password@cluster.mongodb.net/database`
- `NODE_ENV` - Set to `production`

**Optional Variables:**
- `CORS_ORIGIN` - Comma-separated list of allowed origins
- `PORT` - Server port (usually auto-set by Vercel)

### 3. Verify MongoDB Atlas Settings
1. Go to MongoDB Atlas Dashboard
2. Network Access → Add IP Address
3. Add `0.0.0.0/0` to allow all IPs (or Vercel IPs)
4. Database Access → Verify user credentials

### 4. Test Endpoints After Deployment

**Test endpoints (no database required):**
```bash
# Health check
curl https://chatbot-xi-six-89.vercel.app/api/health

# Test chatbot routes
curl https://chatbot-xi-six-89.vercel.app/api/chatbots/test

# Test message routes
curl https://chatbot-xi-six-89.vercel.app/api/messages/test
```

**Main endpoints:**
```bash
# Get chatbots
curl https://chatbot-xi-six-89.vercel.app/api/chatbots

# Get stats
curl https://chatbot-xi-six-89.vercel.app/api/messages/stats
```

### 5. Check Vercel Logs
1. Go to Vercel Dashboard → Your Project
2. Click on "Functions" tab
3. Click on latest deployment
4. View Function Logs
5. Look for error messages

### 6. Common Issues and Fixes

#### Issue: Database Connection Failed
**Error:** `503 DB_CONNECTION_FAILED`
**Fix:**
- Verify `MONGODB_URI` is set correctly in Vercel
- Check MongoDB Atlas network access settings
- Verify database user has correct permissions

#### Issue: Route Not Found
**Error:** `404 Not Found`
**Fix:**
- Verify `vercel.json` is configured correctly
- Check that `api/index.js` exists and exports the app

#### Issue: CORS Errors
**Error:** `CORS policy: No 'Access-Control-Allow-Origin' header`
**Fix:**
- CORS headers are set automatically in code
- Check `vercel.json` headers configuration
- Verify frontend origin is allowed

#### Issue: Module Import Errors
**Error:** `500 Internal Server Error` with import errors
**Fix:**
- Verify all dependencies are in `package.json`
- Check that `"type": "module"` is set in `package.json`
- Ensure all imports use `.js` extension

### 7. Expected Error Responses

**Success (200):**
```json
{
  "status": "OK",
  "data": [...]
}
```

**Database Error (503):**
```json
{
  "error": "Database connection failed",
  "message": "Unable to connect to database. Please try again.",
  "code": "DB_CONNECTION_FAILED"
}
```

**Server Error (500):**
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": "..." // Only in development
}
```

### 8. Debugging Steps

1. **Check if server is running:**
   ```bash
   curl https://chatbot-xi-six-89.vercel.app/api/health
   ```

2. **Check if routes are loaded:**
   ```bash
   curl https://chatbot-xi-six-89.vercel.app/api/chatbots/test
   ```

3. **Check database connection:**
   - Look at Vercel logs for MongoDB connection errors
   - Verify MongoDB URI format is correct

4. **Check CORS:**
   - Open browser console
   - Look for CORS error messages
   - Verify origin is in allowed list

### 9. Redeploy After Fixes

After making changes:
1. Commit and push code
2. Vercel will auto-deploy
3. Wait for deployment to complete
4. Test endpoints again
5. Check logs if errors persist

## Quick Fix Checklist

- [ ] Code is committed and pushed
- [ ] `MONGODB_URI` is set in Vercel
- [ ] `NODE_ENV` is set to `production`
- [ ] MongoDB Atlas allows all IPs (0.0.0.0/0)
- [ ] Vercel deployment completed successfully
- [ ] `/api/health` endpoint returns 200
- [ ] `/api/chatbots/test` endpoint returns 200
- [ ] Main endpoints are working

## Still Having Issues?

1. Check Vercel Function Logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test MongoDB connection string locally
4. Check MongoDB Atlas logs for connection attempts
5. Verify `vercel.json` configuration is correct






