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

    console.log('🔍 [userController] 스케줄 조회:', {
      userId: req.user.id,
      personalTimesCount: user.personalTimes ? user.personalTimes.length : 0,
      personalTimesSample: user.personalTimes ? user.personalTimes.slice(0, 3) : []
    });

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

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    console.log('🔍 [userController] 업데이트 요청:', {
      userId: req.user.id,
      existingPersonalTimesCount: user.personalTimes ? user.personalTimes.length : 0,
      newPersonalTimesCount: personalTimes ? personalTimes.length : 0,
      requestPersonalTimes: personalTimes
    });

    if (defaultSchedule) {
      user.defaultSchedule = defaultSchedule.map(slot => ({
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        priority: slot.priority || 2,
        specificDate: slot.specificDate
      }));
    } else {
      user.defaultSchedule = [];
    }
    user.markModified('defaultSchedule');

    if (scheduleExceptions) {
        user.scheduleExceptions = scheduleExceptions.map(ex => ({
            _id: ex._id,
            title: ex.title,
            startTime: ex.startTime,
            endTime: ex.endTime,
            isHoliday: ex.isHoliday,
            isAllDay: ex.isAllDay,
            specificDate: ex.specificDate,
            priority: ex.priority
        }));
    } else {
        user.scheduleExceptions = [];
    }
    user.markModified('scheduleExceptions');

    if (personalTimes) {
        user.personalTimes = personalTimes.map(pt => ({
            id: pt.id,
            title: pt.title,
            type: pt.type,
            startTime: pt.startTime,
            endTime: pt.endTime,
            days: pt.days,
            isRecurring: pt.isRecurring !== undefined ? pt.isRecurring : true,
            specificDate: pt.specificDate,
            color: pt.color
        }));
    } else {
        user.personalTimes = [];
    }
    user.markModified('personalTimes');

    await user.save({ validateModifiedOnly: true });

    const updatedUser = user;

    console.log('🔍 [userController] 업데이트 완료:', {
      userId: req.user.id,
      finalPersonalTimesCount: updatedUser.personalTimes ? updatedUser.personalTimes.length : 0,
      finalPersonalTimesSample: updatedUser.personalTimes ? updatedUser.personalTimes.slice(0, 3) : []
    });

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
    const user = await User.findById(userId).select('defaultSchedule scheduleExceptions personalTimes firstName lastName name'); // Include name for display
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.json({
      defaultSchedule: user.defaultSchedule,
      scheduleExceptions: user.scheduleExceptions,
      personalTimes: user.personalTimes || [],
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @desc    Get user profile by ID (주소 포함)
// @route   GET /api/users/profile/:userId
// @access  Private
exports.getUserProfileById = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('프로필 조회 요청:', userId);

    const user = await User.findById(userId).select('name firstName lastName email phone address addressDetail addressLat addressLng occupation birthdate');

    if (!user) {
      console.log('사용자 없음:', userId);
      return res.status(404).json({ msg: 'User not found' });
    }

    console.log('프로필 조회 성공:', user.name);

    res.json({
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      address: user.address,
      addressDetail: user.addressDetail,
      addressLat: user.addressLat,
      addressLng: user.addressLng,
      occupation: user.occupation,
      birthdate: user.birthdate
    });
  } catch (err) {
    console.error('프로필 조회 오류:', err.message);
    res.status(500).send('Server Error');
  }
};