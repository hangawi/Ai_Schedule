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
    const firebaseUid = decodedToken.uid;

    // Find user in MongoDB by Firebase UID
    const User = require('../models/user');
    let user = await User.findOne({ firebaseUid });

    // If not found by firebaseUid, try by email (backward compatibility)
    if (!user && decodedToken.email) {
      user = await User.findOne({ email: decodedToken.email.toLowerCase() });

      // Update user with Firebase UID
      if (user) {
        try {
          user.firebaseUid = firebaseUid;
          await user.save();
          console.log('[Auth Middleware] Updated firebaseUid for user:', user.email);
        } catch (updateErr) {
          console.error('[Auth Middleware] Failed to update firebaseUid:', updateErr.message);
          // Continue with the found user even if update fails
        }
      }
    }

    // If still no user, create new one (for Google login and new registrations)
    if (!user) {
      try {
        // Get full Firebase user info
        const firebaseUserRecord = await auth.getUser(firebaseUid);

        // Parse display name
        const displayName = firebaseUserRecord.displayName || '';
        const nameParts = displayName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const userEmail = (decodedToken.email || firebaseUserRecord.email || '').toLowerCase();

        // Check one more time if user exists by email (race condition prevention)
        const existingUser = await User.findOne({ email: userEmail });
        if (existingUser) {
          // Update existing user with firebaseUid
          existingUser.firebaseUid = firebaseUid;
          await existingUser.save();
          user = existingUser;
          console.log('[Auth Middleware] Found existing user by email, updated firebaseUid:', userEmail);
        } else {
          // Create new user in MongoDB
          user = new User({
            firebaseUid,
            firstName: firstName || '',
            lastName: lastName || '',
            email: userEmail,
            password: Math.random().toString(36).slice(-8), // Temporary password
            defaultSchedule: [],
            scheduleExceptions: [],
            personalTimes: [],
          });

          await user.save();
          console.log('[Auth Middleware] Created new user:', user.email);
        }
      } catch (createErr) {
        console.error('[Auth Middleware] Failed to create new user:', createErr);

        // If duplicate key error, try to find and update the existing user
        if (createErr.code === 11000) {
          const existingUser = await User.findOne({ email: decodedToken.email.toLowerCase() });
          if (existingUser) {
            existingUser.firebaseUid = firebaseUid;
            await existingUser.save();
            user = existingUser;
            console.log('[Auth Middleware] Recovered from duplicate error, updated user:', existingUser.email);
          } else {
            return res.status(500).json({
              success: false,
              msg: 'Failed to create user account',
              debug: {
                firebaseUid,
                email: decodedToken.email,
                error: createErr.message
              }
            });
          }
        } else {
          return res.status(500).json({
            success: false,
            msg: 'Failed to create user account',
            debug: {
              firebaseUid,
              email: decodedToken.email,
              error: createErr.message
            }
          });
        }
      }
    }

    // Set user information in request
    // IMPORTANT: req.user.id must be MongoDB ObjectId for compatibility
    req.user = {
      id: user._id.toString(),  // MongoDB ObjectId as string (same as JWT version)
      uid: firebaseUid,         // Firebase UID for direct Firebase auth checks
      email: user.email,
      firebaseUid: user.firebaseUid,
      _id: user._id  // Keep original ObjectId for reference
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
