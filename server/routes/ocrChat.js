const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ocrChatController = require('../controllers/ocrChatController');

/**
 * POST /api/ocr-chat/filter
 * OCR 추출 결과를 채팅 메시지로 필터링
 */
router.post('/filter', auth, ocrChatController.filterSchedulesByChat);

module.exports = router;
