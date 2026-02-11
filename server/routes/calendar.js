const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const calendarController = require('../controllers/calendarController');

// Multer 설정 (메모리 저장)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB 제한
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'), false);
    }
  }
});

// @route   GET api/calendar/events
// @desc    Get Google Calendar events
// @access  Private
router.get('/events', auth, calendarController.getCalendarEvents);

// @route   POST api/calendar/events/google
// @desc    Create Google Calendar event
// @access  Private
router.post('/events/google', auth, calendarController.createGoogleCalendarEvent);

// @route   DELETE api/calendar/events/:eventId
// @desc    Delete Google Calendar event
// @access  Private
router.delete('/events/:eventId', auth, calendarController.deleteGoogleCalendarEvent);

// @route   PUT api/calendar/events/:eventId
// @desc    Update Google Calendar event
// @access  Private
router.put('/events/:eventId', auth, calendarController.updateGoogleCalendarEvent);

// @route   POST api/calendar/sync-to-google
// @desc    Sync existing DB events to Google Calendar
// @access  Private
router.post('/sync-to-google', auth, calendarController.syncEventsToGoogle);

// @route   POST api/calendar/sync-from-google
// @desc    Sync deletions from Google Calendar back to app DB
// @access  Private
router.post('/sync-from-google', auth, calendarController.syncFromGoogle);

// @route   POST api/calendar/analyze-image
// @desc    Analyze image for schedule information using Gemini Vision API
// @access  Private
router.post('/analyze-image', auth, upload.single('image'), calendarController.analyzeImage);

module.exports = router;