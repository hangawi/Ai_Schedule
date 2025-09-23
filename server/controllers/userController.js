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
    const user = await User.findById(req.user.id).select('defaultSchedule scheduleExceptions personalTimes');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    console.log('서버에서 조회한 personalTimes:', user.personalTimes);
    res.json({
      defaultSchedule: user.defaultSchedule,
      scheduleExceptions: user.scheduleExceptions,
      personalTimes: user.personalTimes || []
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
  const { defaultSchedule, scheduleExceptions, personalTimes } = req.body;

  console.log('=== 서버 업데이트 요청 ===');
  console.log('받은 personalTimes:', personalTimes);

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
            _id: ex._id, // ID 필드 추가
            title: ex.title,
            startTime: ex.startTime,
            endTime: ex.endTime,
            isHoliday: ex.isHoliday,
            isAllDay: ex.isAllDay,
            specificDate: ex.specificDate,
            priority: ex.priority
        }));
        console.log('서버에서 scheduleExceptions 저장:', user.scheduleExceptions.length, '개');
    } else {
        user.scheduleExceptions = [];
    }

    // Explicitly rebuild the personalTimes array
    if (personalTimes) {
        user.personalTimes = personalTimes.map(pt => ({
            id: pt.id, // ID 필드 추가
            title: pt.title,
            type: pt.type,
            startTime: pt.startTime,
            endTime: pt.endTime,
            days: pt.days,
            isRecurring: pt.isRecurring || true
        }));
        console.log('서버에서 personalTimes 저장:', user.personalTimes);
    } else {
        user.personalTimes = [];
    }

    // 버전 충돌을 방지하기 위해 findOneAndUpdate 사용
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        defaultSchedule: user.defaultSchedule,
        scheduleExceptions: user.scheduleExceptions,
        personalTimes: user.personalTimes
      },
      { new: true }
    );

    res.json({
      msg: 'Schedule updated successfully',
      defaultSchedule: updatedUser.defaultSchedule,
      scheduleExceptions: updatedUser.scheduleExceptions,
      personalTimes: updatedUser.personalTimes
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
    const user = await User.findById(userId).select('defaultSchedule scheduleExceptions personalTimes firstName lastName'); // Include name for display
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.json({
      defaultSchedule: user.defaultSchedule,
      scheduleExceptions: user.scheduleExceptions,
      personalTimes: user.personalTimes || [],
      firstName: user.firstName,
      lastName: user.lastName
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};