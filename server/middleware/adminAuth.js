const User = require('../models/user');

// 관리자 권한 확인 미들웨어
const adminAuth = async (req, res, next) => {
  try {
    // 이미 인증된 사용자 정보 사용 (auth 미들웨어 이후)
    if (!req.user || !req.user.id) {
      return res.status(401).json({ msg: '인증이 필요합니다.' });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ msg: '관리자 권한이 필요합니다.' });
    }

    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
};

module.exports = adminAuth;
