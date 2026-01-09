# Step-by-Step Debugging Guide for 500 Errors

## Current Issue
All API endpoints are returning 500 errors on Vercel deployment.

## Step 1: Verify Code is Deployed
1. Check if latest code is pushed to Git
2. Check Vercel deployment logs to see if deployment succeeded
3. Verify environment variables are set in Vercel dashboard

## Step 2: Test Basic Endpoints
Test these endpoints in order:

1. **Health Check** (should always work):
   ```
   GET https://chatbot-xi-six-89.vercel.app/api/health
   ```
   Expected: `{"status":"OK","message":"Server is running",...}`

2. **Test Endpoint** (no database required):
   ```
   GET https://chatbot-xi-six-89.vercel.app/api/test
   ```
   Expected: `{"status":"OK","message":"API is working",...}`

3. **Chatbot Routes Test**:
   ```
   GET https://chatbot-xi-six-89.vercel.app/api/chatbots/test
   ```
   Expected: `{"status":"OK","message":"Chatbot routes are working",...}`

4. **Messages Routes Test**:
   ```
   GET https://chatbot-xi-six-89.vercel.app/api/messages/test
   ```
   Expected: `{"status":"OK","message":"Message routes are working",...}`

## Step 3: Check Vercel Logs
1. Go to Vercel Dashboard
2. Select your project
3. Go to "Deployments" tab
4. Click on latest deployment
5. Click "Functions" tab
6. Click on any function to see logs
7. Look for error messages

## Step 4: Common Issues and Fixes

### Issue 1: Routes Not Loading
**Symptoms**: All endpoints return 500
**Check**: Vercel logs for "Failed to import" errors
**Fix**: Check if route files have syntax errors

### Issue 2: Database Connection Failing
**Symptoms**: Endpoints return 503 or 500
**Check**: Vercel logs for MongoDB connection errors
**Fix**: 
- Verify `MONGODB_URI` is set in Vercel environment variables
- Check MongoDB Atlas IP whitelist (should allow all IPs: 0.0.0.0/0)
- Verify MongoDB credentials are correct

### Issue 3: CORS Errors
**Symptoms**: Browser console shows CORS errors
**Fix**: Already handled in code - check if CORS headers are being set

### Issue 4: Environment Variables Not Set
**Symptoms**: Database connection fails
**Fix**: 
- Go to Vercel Dashboard → Project → Settings → Environment Variables
- Add `MONGODB_URI` if not present
- Redeploy after adding variables

## Step 5: Manual Testing
Use curl or Postman to test endpoints:

```bash
# Test health endpoint
curl https://chatbot-xi-six-89.vercel.app/api/health

# Test chatbots endpoint
curl https://chatbot-xi-six-89.vercel.app/api/chatbots

# Test with verbose output to see headers
curl -v https://chatbot-xi-six-89.vercel.app/api/chatbots
```

## Step 6: Check Database Connection
1. Verify MongoDB Atlas cluster is running
2. Check network access - IP whitelist should include 0.0.0.0/0
3. Verify database user has correct permissions
4. Test connection string locally

## Step 7: Verify Code Changes
Make sure these files are correct:
- `admin/backend/server.js` - Main server file
- `admin/backend/routes/chatbotRoutes.js` - Chatbot routes
- `admin/backend/routes/messageRoutes.js` - Message routes
- `admin/backend/api/index.js` - Vercel serverless wrapper

## Next Steps After Deployment
1. Test `/api/test` endpoint first
2. Test `/api/health` endpoint
3. Test `/api/chatbots/test` endpoint
4. Test actual `/api/chatbots` endpoint
5. Check Vercel logs for any errors

## Quick Fixes Applied
1. ✅ Removed top-level await
2. ✅ Added comprehensive error handling
3. ✅ Added test endpoints
4. ✅ Improved database connection logic
5. ✅ Enhanced CORS handling
6. ✅ Added asyncHandler wrapper for routes






