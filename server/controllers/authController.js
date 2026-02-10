const User = require('../models/user');
const Room = require('../models/room');
const ActivityLog = require('../models/ActivityLog');
const bcrypt = require('bcryptjs');
const { auth: firebaseAuth } = require('../config/firebaseAdmin');
const { OAuth2Client } = require('google-auth-library');
const { syncEventsToGoogleInternal } = require('./calendarController');

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
    res.status(500).json({ msg: 'Google 인증 실패: ' + err.message });
  }
};

// @desc    Google Calendar 동의 URL 생성
// @route   GET /api/auth/google/calendar-consent
// @access  Private
const getCalendarConsentUrl = async (req, res) => {
  try {
    // returnUrl을 state에 포함 (설정 페이지 vs 로그인 페이지 구분)
    const returnUrl = req.query.returnUrl || '/auth';
    const stateData = `${req.user.id}|${returnUrl}`;

    const authUrl = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ],
      state: stateData,
      redirect_uri: process.env.GOOGLE_CALENDAR_REDIRECT_URI,
    });

    res.json({ url: authUrl });
  } catch (err) {
    res.status(500).json({ msg: 'OAuth URL 생성 실패: ' + err.message });
  }
};

// @desc    Google Calendar OAuth 콜백 처리
// @route   GET /api/auth/google/calendar-callback
// @access  Public
const calendarCallback = async (req, res) => {
  const frontendUrl = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000';
  console.log('[calendarCallback] 호출됨');
  console.log('[calendarCallback] GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI);

  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.redirect(`${frontendUrl}/auth?calendarError=missing_params`);
    }

    // state에서 userId와 returnUrl 파싱 (형식: "userId|returnUrl" 또는 레거시 "userId")
    let userId, returnUrl = '/auth';
    if (state.includes('|')) {
      [userId, returnUrl] = state.split('|');
    } else {
      userId = state;
    }

    const callbackUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;
    const callbackClient = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      callbackUri
    );

    const { tokens } = await callbackClient.getToken(code);

    const user = await User.findById(userId);
    if (!user) {
      return res.redirect(`${frontendUrl}${returnUrl}?calendarError=user_not_found`);
    }

    if (!user.google) user.google = {};
    user.google.accessToken = tokens.access_token;
    if (tokens.refresh_token) {
      user.google.refreshToken = tokens.refresh_token;
    }
    await user.save();

    // 토큰 저장 직후 서버에서 바로 동기화 (클라이언트 타이밍 이슈 없음)
    try {
      const syncResult = await syncEventsToGoogleInternal(userId);
      console.log('[calendarCallback] 서버 동기화 완료:', syncResult);
    } catch (syncErr) {
      console.warn('[calendarCallback] 서버 동기화 실패:', syncErr.message);
    }

    const redirectUrl = `${frontendUrl}${returnUrl}?calendarConnected=true`;
    console.log('[calendarCallback] 리다이렉트:', redirectUrl);
    res.redirect(redirectUrl);
  } catch (err) {
    console.error('Calendar callback error:', err);
    res.redirect(`${frontendUrl}/auth?calendarError=token_exchange_failed`);
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
      } catch (firebaseErr) {
        if (firebaseErr.code !== 'auth/user-not-found') {
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


    res.json({ msg: '회원탈퇴가 완료되었습니다.' });
  } catch (err) {
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
};

// @desc    Link Google account to existing user
// @route   POST /api/auth/link-google
// @access  Private
exports.linkGoogle = async (req, res) => {
  try {
    const { googleId } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    }

    if (!user.google) user.google = {};
    user.google.id = googleId;
    await user.save();

    res.json({ success: true, msg: '구글 계정 연동 완료' });
  } catch (err) {
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
};

// @desc    Unlink Google account from existing user
// @route   POST /api/auth/unlink-google
// @access  Private
exports.unlinkGoogle = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    }

    user.google = {};
    await user.save();

    res.json({ success: true, msg: '구글 계정 연동 해제 완료' });
  } catch (err) {
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
};

exports.getCalendarConsentUrl = getCalendarConsentUrl;
exports.calendarCallback = calendarCallback;
