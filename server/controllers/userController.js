const User = require('../models/user');

exports.getMe = async (req, res) => {
  try {
    // Get user info logic
    res.json({ msg: 'User info' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

exports.updateMe = async (req, res) => {
  try {
    // Update user info logic
    res.json({ msg: 'User info updated' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

exports.connectCalendar = async (req, res) => {
  try {
    // Connect calendar service logic (OAuth 2.0)
    res.json({ msg: 'Calendar connected' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// @desc    Get user's own schedule (default + exceptions)
// @route   GET /api/users/profile/schedule
// @access  Private
exports.getUserSchedule = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('defaultSchedule scheduleExceptions');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.json({
      defaultSchedule: user.defaultSchedule,
      scheduleExceptions: user.scheduleExceptions
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @desc    Update user's own schedule (default + exceptions)
// @route   PUT /api/users/profile/schedule
// @access  Private
exports.updateUserSchedule = async (req, res) => {
  const { defaultSchedule, scheduleExceptions } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Explicitly rebuild the defaultSchedule array to ensure all fields are correctly processed
    if (defaultSchedule) {
      user.defaultSchedule = defaultSchedule.map(slot => ({
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        priority: slot.priority || 2, // Ensure priority has a value, defaulting to 2
      }));
    } else {
      user.defaultSchedule = [];
    }

    // Explicitly rebuild the scheduleExceptions array
    if (scheduleExceptions) {
        user.scheduleExceptions = scheduleExceptions.map(ex => ({
            title: ex.title,
            startTime: ex.startTime,
            endTime: ex.endTime,
        }));
    } else {
        user.scheduleExceptions = [];
    }

    await user.save();

    res.json({
      msg: 'Schedule updated successfully',
      defaultSchedule: user.defaultSchedule,
      scheduleExceptions: user.scheduleExceptions
    });
  } catch (err) {
    console.error('Error updating user schedule:', err);
    res.status(500).send('Server Error');
  }
};

// @desc    Get any user's schedule by ID
// @route   GET /api/users/:userId/schedule
// @access  Private (auth middleware ensures user is logged in)
exports.getUserScheduleById = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('defaultSchedule scheduleExceptions firstName lastName'); // Include name for display
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.json({
      defaultSchedule: user.defaultSchedule,
      scheduleExceptions: user.scheduleExceptions,
      firstName: user.firstName,
      lastName: user.lastName
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};