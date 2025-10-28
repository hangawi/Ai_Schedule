const express = require('express');
const router = express.Router();
const multer = require('multer');
const ocrController = require('../controllers/ocrController');
const auth = require('../middleware/auth');

// Multer 설정 (메모리 저장)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB 제한
  },
  fileFilter: (req, file, cb) => {
    // 이미지 파일만 허용
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
  }
});

/**
 * @route   POST /api/ocr/extract
 * @desc    단일 이미지에서 텍스트 추출
 * @access  Private
 */
router.post('/extract', auth, upload.single('image'), ocrController.extractTextFromImage);

/**
 * @route   POST /api/ocr/extract-multiple
 * @desc    여러 이미지에서 텍스트 추출
 * @access  Private
 */
router.post('/extract-multiple', auth, upload.array('images', 10), ocrController.extractTextFromImages);

/**
 * @route   POST /api/ocr/analyze-schedule
 * @desc    시간표 이미지 분석 및 구조화된 데이터 반환
 * @access  Private
 */
router.post('/analyze-schedule', auth, upload.array('images', 10), ocrController.analyzeScheduleImages);

module.exports = router;
