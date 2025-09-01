const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const calendarController = require('../controllers/calendarController');

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

module.exports = router;