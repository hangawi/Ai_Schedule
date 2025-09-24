const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('config'); // config 모듈 사용
const { OAuth2Client } = require('google-auth-library'); // Google Auth Library 임포트


const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI // 클라이언트의 리디렉션 URI
);

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  const { firstName, lastName, email, password } = req.body; // name 대신 firstName, lastName

  try {
    let user = await User.findOne({ email });

    if (user) {
      return res.status(400).json({ msg: '이미 존재하는 사용자입니다.' });
    }

    user = new User({
      firstName,
      lastName,
      email,
      password,
    });

    // 비밀번호 해싱은 User 모델의 pre('save') 훅에서 처리됩니다.
    await user.save();

    const payload = {
      user: {
        id: user.id,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET, // config.get('jwtSecret') 대신 process.env.JWT_SECRET 사용
      { expiresIn: 360000 },
      (err, token) => {
        if (err) throw err;
        res.json({ token, user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email } });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: '서버 오류' });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    let user = await User.findOne({ email }).select('+password'); // 비밀번호 필드 선택

    if (!user) {
      return res.status(400).json({ msg: '유효하지 않은 자격 증명입니다.' });
    }


    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ msg: '유효하지 않은 자격 증명입니다.' });
    }

    const payload = {
      user: {
        id: user.id,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET, // config.get('jwtSecret') 대신 process.env.JWT_SECRET 사용
      { expiresIn: 360000 },
      (err, token) => {
        if (err) throw err;
        res.json({ token, user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email } });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: '서버 오류' });
  }
};

// @desc    Authenticate user with Google ID token
// @route   POST /api/auth/google
// @access  Public
exports.googleAuth = async (req, res) => {
  const { code } = req.body;

  console.log('🔍 [GOOGLE] Google Auth 시작:', {
    code: code ? 'EXISTS' : 'MISSING',
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
    clientId: process.env.GOOGLE_CLIENT_ID ? 'EXISTS' : 'MISSING'
  });

  try {

    const { tokens } = await client.getToken({
      code,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      scope: 'https://www.googleapis.com/auth/calendar', // 캘린더 읽기/쓰기 권한
    });

    console.log('🔍 [GOOGLE] 토큰 획득 성공:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      hasIdToken: !!tokens.id_token
    });
    client.setCredentials(tokens);

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, given_name, family_name, sub: googleId } = payload;

    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        firstName: given_name || '',
        lastName: family_name || '',
        email,
        password: Math.random().toString(36).slice(-8), // 임시 비밀번호
        google: {
          id: googleId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        },
      });
    } else {
      user.google.id = googleId;
      user.google.accessToken = tokens.access_token;
      if (tokens.refresh_token) {
        user.google.refreshToken = tokens.refresh_token;
      }
    }
    await user.save();

    const jwtPayload = {
      user: {
        id: user.id,
      },
    };

    jwt.sign(
      jwtPayload,
      process.env.JWT_SECRET, // config.get('jwtSecret') 대신 process.env.JWT_SECRET 사용
      { expiresIn: 360000 },
      (err, jwtToken) => {
        if (err) throw err;
        res.json({ token: jwtToken, user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, google: user.google } });
      }
    );
  } catch (err) {
    console.error('🔍 [GOOGLE] Google Auth Error:', {
      message: err.message,
      code: err.code,
      stack: err.stack,
      details: err.details
    });
    res.status(500).json({ msg: 'Google 인증 실패: ' + err.message });
  }
};

// @desc    Get logged in user
// @route   GET /api/auth
// @access  Private
exports.getLoggedInUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};