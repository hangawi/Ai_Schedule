const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  // Get token from header
  const token = req.header('x-auth-token');
  const authHeader = req.header('authorization');

  // Check if token exists
  if (!token) {
    // Log authentication failure for security monitoring
    return res.status(401).json({ 
      success: false,
      msg: 'No token, authorization denied',
      debug: {
        headers: {
          'x-auth-token': 'missing',
          'authorization': authHeader ? 'exists' : 'missing'
        }
      }
    });
  }

  try {
    // Get JWT secret from environment
    const secret = process.env.JWT_SECRET;
    
    if (!secret) {
      return res.status(500).json({ 
        success: false,
        msg: 'Server configuration error',
        debug: 'JWT_SECRET not configured'
      });
    }
    
    // Verify JWT token
    const decoded = jwt.verify(token, secret);
    
    // Set user information in request
    req.user = decoded.user;
    
    // Validate user information exists
    if (!req.user || !req.user.id) {
      throw new Error('User information not found in token');
    }
    
    next();
  } catch (err) {
    // Log authentication failure for security monitoring
    
    let errorMsg = 'Token is not valid';
    let errorCode = 'INVALID_TOKEN';
    
    if (err.name === 'JsonWebTokenError') {
      errorMsg = '유효하지 않은 토큰 형식입니다.';
      errorCode = 'MALFORMED_TOKEN';
    } else if (err.name === 'TokenExpiredError') {
      errorMsg = '토큰이 만료되었습니다.';
      errorCode = 'TOKEN_EXPIRED';
    } else if (err.name === 'NotBeforeError') {
      errorMsg = '토큰이 아직 활성화되지 않았습니다.';
      errorCode = 'TOKEN_NOT_ACTIVE';
    }
    
    return res.status(401).json({ 
      success: false,
      msg: errorMsg,
      error: errorCode,
      debug: {
        errorType: err.name,
        tokenLength: token ? token.length : 0,
        tokenStart: token ? token.substring(0, 10) + '...' : 'N/A',
        hasSecret: !!secret
      }
    });
  }
};