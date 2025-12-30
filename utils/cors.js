// CORS helper functions
export const setCorsHeaders = (req, res) => {
  const origin = req.headers.origin;
  
  // ALWAYS set CORS headers - allow all origins for cross-origin requests
  if (origin) {
    // Set the origin header to match the request origin
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    // No origin - allow all
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  // Set other CORS headers
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length');
};

