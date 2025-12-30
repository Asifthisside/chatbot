# CORS Configuration Guide

## Current CORS Setup

The backend is configured to allow requests from:
- **Frontend**: `https://chatbot-backend-seven-sage.vercel.app`
- **Local Development**: `http://localhost:3000`, `http://localhost:5173`

## CORS Error Fix

If you're seeing CORS errors like:
```
Access to XMLHttpRequest at 'https://chatbot-xi-six-89.vercel.app/api/...' 
from origin 'https://chatbot-backend-seven-sage.vercel.app' 
has been blocked by CORS policy
```

### Solution 1: Set CORS_ORIGIN Environment Variable (Recommended)

**In Vercel Backend Project** → Settings → Environment Variables:

Add:
```
CORS_ORIGIN = https://chatbot-backend-seven-sage.vercel.app
```

For multiple origins (comma-separated):
```
CORS_ORIGIN = https://chatbot-backend-seven-sage.vercel.app,http://localhost:3000
```

### Solution 2: Default Configuration (Already Applied)

The backend code now includes the frontend URL in default allowed origins, so CORS should work even without setting the environment variable.

## How CORS Works

1. **Browser sends preflight OPTIONS request** → Backend responds with CORS headers
2. **Browser checks CORS headers** → If origin is allowed, sends actual request
3. **Backend responds with CORS headers** → Browser allows response

## Current Configuration

```javascript
Allowed Origins:
- https://chatbot-backend-seven-sage.vercel.app (Frontend)
- http://localhost:3000 (Local dev)
- http://localhost:5173 (Vite dev)

Allowed Methods:
- GET, POST, PUT, DELETE, OPTIONS, PATCH

Allowed Headers:
- Content-Type
- Authorization
- X-Requested-With
- Accept
```

## Testing CORS

### Test from Browser Console:
```javascript
fetch('https://chatbot-xi-six-89.vercel.app/api/health', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => console.log('Success:', data))
.catch(err => console.error('CORS Error:', err));
```

### Test with curl:
```bash
curl -H "Origin: https://chatbot-backend-seven-sage.vercel.app" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://chatbot-xi-six-89.vercel.app/api/chatbots \
     -v
```

Should return headers:
```
Access-Control-Allow-Origin: https://chatbot-backend-seven-sage.vercel.app
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept
```

## Troubleshooting

### If CORS still doesn't work:

1. **Check Vercel Environment Variables**:
   - Go to Backend Project → Settings → Environment Variables
   - Verify `CORS_ORIGIN` is set correctly
   - Redeploy after setting environment variables

2. **Check Backend Logs**:
   - Go to Vercel Dashboard → Backend Project → Deployments → Function Logs
   - Look for CORS-related logs
   - Check if origin is being logged

3. **Verify Origin Match**:
   - Make sure the origin in the error matches exactly (no trailing slash)
   - `https://chatbot-backend-seven-sage.vercel.app` ✅
   - `https://chatbot-backend-seven-sage.vercel.app/` ❌ (trailing slash)

4. **Clear Browser Cache**:
   - CORS errors can be cached
   - Try incognito/private window
   - Clear browser cache

## Code Changes Made

1. **Default Allowed Origins**: Added frontend URL to default list
2. **Explicit OPTIONS Handling**: Added `app.options('*', cors(corsOptions))`
3. **Manual CORS Headers**: Added fallback middleware to set headers manually
4. **Better Logging**: Added console logs for debugging

## Next Steps

1. **Redeploy Backend** to Vercel
2. **Set CORS_ORIGIN** in Vercel environment variables (optional but recommended)
3. **Test API calls** from frontend
4. **Check browser console** for any remaining CORS errors

