const User = require('../models/user');
const Room = require('../models/room');
const ActivityLog = require('../models/ActivityLog');
const { auth: firebaseAuth } = require('../config/firebaseAdmin');

// 관리자 비밀번호 (환경변수로 관리 권장)
const ADMIN_CODE = process.env.ADMIN_CODE || '1128';

// 관리자 코드 확인 및 권한 부여
exports.verifyAdminCode = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.id;

    if (code !== ADMIN_CODE) {
      return res.status(400).json({ msg: '잘못된 관리자 코드입니다.' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role: 'admin' },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    }

    res.json({
      msg: '관리자 권한이 부여되었습니다.',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Verify admin code error:', error);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
};

// 관리자 권한 해제
exports.revokeAdmin = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findByIdAndUpdate(
      userId,
      { role: 'user' },
      { new: true }
    );

    res.json({
      msg: '관리자 권한이 해제되었습니다.',
      user: {
        id: user._id,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Revoke admin error:', error);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
};

// 전체 회원 목록 조회
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;

    const query = {};
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('email firstName lastName name phone address role status createdAt lastLoginAt google firebaseUid')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
};

// 회원 삭제
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    console.log('Delete user request - userId:', userId);

    // userId 유효성 검사
    if (!userId || userId === 'undefined' || userId === 'null') {
      return res.status(400).json({ msg: '유효하지 않은 사용자 ID입니다.' });
    }

    // 자기 자신은 삭제 불가
    if (userId === req.user.id) {
      return res.status(400).json({ msg: '자기 자신은 삭제할 수 없습니다.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    }

    console.log('Deleting user:', user.email);

    // Firebase 사용자 삭제 (firebaseUid가 있는 경우)
    if (user.firebaseUid) {
      try {
        await firebaseAuth.deleteUser(user.firebaseUid);
        console.log('Firebase user deleted:', user.firebaseUid);
      } catch (firebaseErr) {
        // Firebase 사용자가 없을 수 있음 (이미 삭제됨)
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

    // 사용자가 방장인 방 삭제 또는 처리
    await Room.deleteMany({ owner: userId });

    // 같은 이메일을 가진 모든 사용자 삭제 (중복 제거)
    const deleteResult = await User.deleteMany({ email: user.email });
    console.log('Deleted users count:', deleteResult.deletedCount);

    if (!deleteResult || deleteResult.deletedCount === 0) {
      console.error('User deletion failed - no document deleted');
      return res.status(500).json({ msg: '사용자 삭제에 실패했습니다.' });
    }

    // 삭제 검증
    const verifyDeleted = await User.findOne({ email: user.email });
    if (verifyDeleted) {
      console.error('User deletion verification failed - user still exists:', user.email);
      return res.status(500).json({ msg: '사용자 삭제에 실패했습니다. 다시 시도해주세요.' });
    }

    console.log('User deleted successfully:', user.email);

    res.json({ msg: '회원이 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
};

// 회원 관리자로 승급
exports.promoteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByIdAndUpdate(
      userId,
      { role: 'admin' },
      { new: true }
    ).select('email firstName lastName role');

    if (!user) {
      return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    }

    res.json({
      msg: '관리자로 승급되었습니다.',
      user
    });
  } catch (error) {
    console.error('Promote user error:', error);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
};

// 회원 일반 사용자로 강등
exports.demoteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // 자기 자신은 강등 불가
    if (userId === req.user.id) {
      return res.status(400).json({ msg: '자기 자신은 강등할 수 없습니다.' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role: 'user' },
      { new: true }
    ).select('email firstName lastName role');

    if (!user) {
      return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    }

    res.json({
      msg: '일반 사용자로 강등되었습니다.',
      user
    });
  } catch (error) {
    console.error('Demote user error:', error);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
};

// 전체 방 목록 조회
exports.getAllRooms = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;

    const query = {};
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const rooms = await Room.find(query)
      .populate('owner', 'firstName lastName email')
      .select('name description inviteCode members createdAt settings')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Room.countDocuments(query);

    // 각 방의 멤버 수 추가
    const roomsWithCount = rooms.map(room => ({
      ...room.toObject(),
      memberCount: room.members?.length || 0
    }));

    res.json({
      rooms: roomsWithCount,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get all rooms error:', error);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
};

// 방 삭제
exports.deleteRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // 관련 활동 로그도 삭제
    await ActivityLog.deleteMany({ roomId });

    // 방 삭제
    await Room.findByIdAndDelete(roomId);

    res.json({ msg: '방이 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
};

// 방 활동 로그 조회
exports.getRoomLogs = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    const logs = await ActivityLog.find({ roomId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await ActivityLog.countDocuments({ roomId });

    res.json({
      logs,
      roomName: room.name,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get room logs error:', error);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
};

// 대시보드 통계
exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalRooms = await Room.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const adminUsers = await User.countDocuments({ role: 'admin' });

    // 최근 7일간 가입자 수
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentSignups = await User.countDocuments({
      createdAt: { $gte: weekAgo }
    });

    res.json({
      totalUsers,
      totalRooms,
      activeUsers,
      adminUsers,
      recentSignups
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
};
