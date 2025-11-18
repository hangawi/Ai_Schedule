const { auth } = require('../config/firebaseAdmin');

module.exports = async function (req, res, next) {
  // Get token from Authorization header
  const authHeader = req.header('authorization') || req.header('Authorization');

  // Check if authorization header exists
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      msg: 'No token, authorization denied',
      debug: {
        headers: {
          'authorization': authHeader ? 'invalid format' : 'missing'
        }
      }
    });
  }

  // Extract token from "Bearer <token>"
  const idToken = authHeader.split('Bearer ')[1];

  if (!idToken) {
    return res.status(401).json({
      success: false,
      msg: 'No token found in authorization header',
      debug: {
        authHeader: 'Bearer token missing'
      }
    });
  }

  try {
    // Verify Firebase ID token
    const decodedToken = await auth.verifyIdToken(idToken);

    // Set user information in request
    // Firebase UID is stored as user.id for compatibility with existing code
    req.user = {
      id: decodedToken.uid,
      email: decodedToken.email,
      firebaseUid: decodedToken.uid
    };

    // Validate user information exists
    if (!req.user || !req.user.id) {
      throw new Error('User information not found in token');
    }

    next();
  } catch (err) {
    // Log authentication failure for security monitoring
    console.error('[Auth Middleware] Token verification failed:', err.message);

    let errorMsg = 'Token is not valid';
    let errorCode = 'INVALID_TOKEN';

    if (err.code === 'auth/id-token-expired') {
      errorMsg = '토큰이 만료되었습니다.';
      errorCode = 'TOKEN_EXPIRED';
    } else if (err.code === 'auth/argument-error') {
      errorMsg = '유효하지 않은 토큰 형식입니다.';
      errorCode = 'MALFORMED_TOKEN';
    } else if (err.code === 'auth/id-token-revoked') {
      errorMsg = '토큰이 취소되었습니다.';
      errorCode = 'TOKEN_REVOKED';
    }

    return res.status(401).json({
      success: false,
      msg: errorMsg,
      error: errorCode,
      debug: {
        errorCode: err.code,
        errorMessage: err.message,
        tokenLength: idToken ? idToken.length : 0
      }
    });
  }
};
