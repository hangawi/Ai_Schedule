const User = require('../models/user');
const bcrypt = require('bcryptjs');
const { auth: firebaseAuth } = require('../config/firebaseAdmin');
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// @desc    Register user with Firebase
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  try {
    // Check if user already exists in MongoDB
    let user = await User.findOne({ email });

    if (user) {
      return res.status(400).json({ msg: '이미 존재하는 사용자입니다.' });
    }

    // Create user in Firebase Authentication
    const firebaseUser = await firebaseAuth.createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`.trim()
    });

    // Create user in MongoDB with Firebase UID
    user = new User({
      firebaseUid: firebaseUser.uid,
      firstName,
      lastName,
      email,
      password, // Still hash password for potential future use
    });

    await user.save();

    res.json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        firebaseUid: firebaseUser.uid
      }
    });
  } catch (err) {
    console.error('[Register] Error:', err);
    res.status(500).json({ msg: '서버 오류: ' + err.message });
  }
};

// @desc    Authenticate user & get token (Firebase handles authentication)
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    // Firebase ID token is verified by auth middleware
    // req.user.id contains Firebase UID from middleware
    const firebaseUid = req.user.firebaseUid || req.user.id;

    // Find user in MongoDB by Firebase UID
    let user = await User.findOne({ firebaseUid });

    // If user not found by firebaseUid, try by email (for backward compatibility)
    if (!user && req.user.email) {
      user = await User.findOne({ email: req.user.email });

      // Update user with Firebase UID
      if (user) {
        user.firebaseUid = firebaseUid;
        await user.save();
      }
    }

    if (!user) {
      return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    }

    res.json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        firebaseUid: user.firebaseUid
      }
    });
  } catch (err) {
    console.error('[Login] Error:', err);
    res.status(500).json({ msg: '서버 오류: ' + err.message });
  }
};

// @desc    Authenticate user with Google via Firebase
// @route   POST /api/auth/google
// @access  Public
exports.googleAuth = async (req, res) => {
  try {
    // Firebase ID token is verified by auth middleware
    const firebaseUid = req.user.firebaseUid || req.user.id;
    const email = req.user.email;

    // Get Firebase user info
    const firebaseUserRecord = await firebaseAuth.getUser(firebaseUid);

    // Parse display name
    const displayName = firebaseUserRecord.displayName || '';
    const nameParts = displayName.split(' ');
    const given_name = nameParts[0] || '';
    const family_name = nameParts.slice(1).join(' ') || '';

    // Find or create user in MongoDB
    let user = await User.findOne({ firebaseUid });

    // If not found by firebaseUid, try by email (for backward compatibility)
    if (!user && email) {
      user = await User.findOne({ email });
    }

    if (!user) {
      // Create new user
      user = new User({
        firebaseUid,
        firstName: given_name || '',
        lastName: family_name || '',
        email,
        password: Math.random().toString(36).slice(-8), // Temporary password
        defaultSchedule: [],
        scheduleExceptions: [],
        personalTimes: [],
      });
    } else {
      // Update existing user with Firebase UID if not set
      if (!user.firebaseUid) {
        user.firebaseUid = firebaseUid;
      }

      // Clean up invalid schedule data
      if (!user.defaultSchedule) user.defaultSchedule = [];
      if (!user.personalTimes) user.personalTimes = [];

      if (user.scheduleExceptions && Array.isArray(user.scheduleExceptions)) {
        user.scheduleExceptions = user.scheduleExceptions.filter(ex =>
          ex && ex.startTime && ex.endTime && ex.title && ex.specificDate
        );
      } else {
        user.scheduleExceptions = [];
      }
    }

    await user.save();

    res.json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        firebaseUid: user.firebaseUid,
        google: user.google
      }
    });
  } catch (err) {
    console.error('[Google Auth] Error:', err);
    res.status(500).json({ msg: 'Google 인증 실패: ' + err.message });
  }
};

// @desc    Get logged in user
// @route   GET /api/auth
// @access  Private
exports.getLoggedInUser = async (req, res) => {
  try {
    const firebaseUid = req.user.firebaseUid || req.user.id;

    // Find user by Firebase UID
    let user = await User.findOne({ firebaseUid }).select('-password');

    if (!user) {
      return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    }

    res.json(user);
  } catch (err) {
    console.error('[Get Logged In User] Error:', err);
    res.status(500).send('Server Error');
  }
};
