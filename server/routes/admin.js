const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const adminController = require('../controllers/adminController');

// 관리자 코드 확인 (인증된 사용자만)
router.post('/verify', auth, adminController.verifyAdminCode);

// 관리자 권한 해제
router.post('/revoke', auth, adminController.revokeAdmin);

// 이하 모든 라우트는 관리자 권한 필요
// 대시보드 통계
router.get('/stats', auth, adminAuth, adminController.getDashboardStats);

// 회원 관리
router.get('/users', auth, adminAuth, adminController.getAllUsers);
router.delete('/users/:userId', auth, adminAuth, adminController.deleteUser);
router.put('/users/:userId/promote', auth, adminAuth, adminController.promoteUser);
router.put('/users/:userId/demote', auth, adminAuth, adminController.demoteUser);

// 방 관리
router.get('/rooms', auth, adminAuth, adminController.getAllRooms);
router.delete('/rooms/:roomId', auth, adminAuth, adminController.deleteRoom);
router.get('/rooms/:roomId/logs', auth, adminAuth, adminController.getRoomLogs);

module.exports = router;
