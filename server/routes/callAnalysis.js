const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const callAnalysisController = require('../controllers/callAnalysisController');

// @route   POST /api/call-analysis/analyze
// @desc    통화 내용에서 일정 정보 분석
// @access  Private
router.post('/analyze', auth, callAnalysisController.analyzeCallTranscript);

// @route   POST /api/call-analysis/detect-keywords
// @desc    실시간 키워드 감지
// @access  Private
router.post('/detect-keywords', auth, callAnalysisController.detectScheduleKeywords);

module.exports = router;