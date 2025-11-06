const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ocrChatController = require('../controllers/ocrChatController');

/**
 * POST /api/ocr-chat/filter
 * OCR 추출 결과를 채팅 메시지로 필터링
 */
router.post('/filter', auth, ocrChatController.filterSchedulesByChat);

/**
 * POST /api/ocr-chat/recommend
 * 대화형 시간표 추천 (컨텍스트 유지형)
 */
router.post('/recommend', auth, ocrChatController.conversationalRecommend);

module.exports = router;
