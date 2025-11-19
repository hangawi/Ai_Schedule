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
    // Firebase ID token is already verified by auth middleware
    // req.user.id now contains MongoDB ObjectId (set by middleware)
    const user = await User.findById(req.user.id);

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
    // Firebase ID token is already verified by auth middleware
    // req.user.id now contains MongoDB ObjectId (set by middleware)
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    }

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
    // req.user.id now contains MongoDB ObjectId (set by middleware)
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    }

    res.json(user);
  } catch (err) {
    console.error('[Get Logged In User] Error:', err);
    res.status(500).send('Server Error');
  }
};
