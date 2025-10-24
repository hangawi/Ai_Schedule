const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const chatbotController = require('../controllers/chatbotController');

/**
 * @route   POST /api/chatbot/parse
 * @desc    자연어 텍스트에서 의도와 엔티티 추출
 * @access  Private
 */
router.post('/parse', auth, chatbotController.parseIntent);

/**
 * @route   POST /api/chatbot/voice
 * @desc    음성 명령 처리
 * @access  Private
 */
router.post('/voice', auth, chatbotController.processVoiceCommand);

module.exports = router;
