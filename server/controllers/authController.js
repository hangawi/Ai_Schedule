const User = require('../models/user');
const Room = require('../models/room');
const ActivityLog = require('../models/ActivityLog');
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

// @desc    Delete user account (self)
// @route   DELETE /api/auth/delete-account
// @access  Private
exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    }

    const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;

    // 활동 로그에 회원탈퇴 기록
    await ActivityLog.create({
      action: 'user_withdraw',
      userName: userName,
      details: user.email,
      createdAt: new Date()
    });

    // Firebase 사용자 삭제
    if (user.firebaseUid) {
      try {
        await firebaseAuth.deleteUser(user.firebaseUid);
        console.log('Firebase user deleted:', user.firebaseUid);
      } catch (firebaseErr) {
        if (firebaseErr.code !== 'auth/user-not-found') {
          console.error('Firebase user deletion error:', firebaseErr.message);
        }
      }
    }

    // 사용자가 속한 방에서 제거
    await Room.updateMany(
      { 'members.user': userId },
      { $pull: { members: { user: userId } } }
    );

    // 사용자가 방장인 방 삭제
    await Room.deleteMany({ owner: userId });

    // 사용자 삭제
    await User.findByIdAndDelete(userId);

    console.log('User account deleted:', user.email);

    res.json({ msg: '회원탈퇴가 완료되었습니다.' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
};
