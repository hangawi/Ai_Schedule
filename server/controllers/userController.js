const User = require('../models/user');

exports.getMe = async (req, res) => {
  try {
    // Get user info logic
    res.json({ msg: 'User info' });
  } catch (err) {
    res.status(500).send('Server error');
  }
};

exports.updateMe = async (req, res) => {
  try {
    // Update user info logic
    res.json({ msg: 'User info updated' });
  } catch (err) {
    res.status(500).send('Server error');
  }
};

exports.connectCalendar = async (req, res) => {
  try {
    // Connect calendar service logic (OAuth 2.0)
    res.json({ msg: 'Calendar connected' });
  } catch (err) {
    res.status(500).send('Server error');
  }
};

// @desc    Get user's own schedule (default + exceptions)
// @route   GET /api/users/profile/schedule
// @access  Private
exports.getUserSchedule = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('defaultSchedule scheduleExceptions personalTimes firstName lastName');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // personalTimes 처리: 확정된 일정이면 조원/방장 주소 추가
    let personalTimesWithLocation = [];
    if (user.personalTimes && user.personalTimes.length > 0) {
      personalTimesWithLocation = await Promise.all(
        user.personalTimes.map(async (pt) => {
          const ptObj = pt.toObject ? pt.toObject() : pt;

          // 이미 location이 있으면 그대로 반환
          if (ptObj.location) {
            return ptObj;
          }

          // 확정된 일정인지 확인 (title에 '-'가 포함되어 있음)
          if (ptObj.title && ptObj.title.includes('-')) {
            try {
              // "방이름 - 조원이름" 형식에서 조원 이름 추출
              const parts = ptObj.title.split('-');
              if (parts.length >= 2) {
                const memberName = parts[1].trim();

                // 조원 이름으로 사용자 찾기 (firstName + lastName 또는 lastName + firstName)
                const targetUser = await User.findOne({
                  $or: [
                    { $expr: { $eq: [{ $concat: ['$firstName', ' ', '$lastName'] }, memberName] } },
                    { $expr: { $eq: [{ $concat: ['$lastName', '$firstName'] }, memberName.replace(/\s+/g, '')] } },
                    { name: memberName }
                  ]
                }).select('address addressDetail addressLat addressLng').lean();

                if (targetUser && targetUser.address) {
                  // 조원의 주소 정보 추가
                  return {
                    ...ptObj,
                    location: targetUser.addressDetail
                      ? `${targetUser.address} ${targetUser.addressDetail}`
                      : targetUser.address,
                    locationLat: targetUser.addressLat || null,
                    locationLng: targetUser.addressLng || null
                  };
                }
              }
            } catch (err) {
              console.error('Error finding member address:', err);
            }
          }

          return ptObj;
        })
      );
    }

    res.json({
      defaultSchedule: user.defaultSchedule,
      scheduleExceptions: user.scheduleExceptions,
      personalTimes: personalTimesWithLocation
    });
  } catch (err) {
    console.error('getUserSchedule error:', err);
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

    res.json({
      msg: 'Schedule updated successfully',
      defaultSchedule: updatedUser.defaultSchedule,
      scheduleExceptions: updatedUser.scheduleExceptions,
      personalTimes: updatedUser.personalTimes
    });
  } catch (err) {

    // Mongoose validation 에러인 경우
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({
        msg: 'Validation Error',
        errors: errors,
        details: err.message
      });
    }

    res.status(500).json({
      msg: 'Server Error',
      error: err.message
    });
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
    res.status(500).send('Server Error');
  }
};

// @desc    Get logged in user's profile
// @route   GET /api/users/profile
// @access  Private
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('firstName lastName email phone address addressDetail addressLat addressLng addressPlaceId occupation birthdate');

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.json({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      address: user.address,
      addressDetail: user.addressDetail,
      addressLat: user.addressLat,
      addressLng: user.addressLng,
      addressPlaceId: user.addressPlaceId,
      occupation: user.occupation,
      birthdate: user.birthdate
    });
  } catch (err) {
    res.status(500).send('Server Error');
  }
};

// @desc    Update logged in user's profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateUserProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, address, addressDetail, addressLat, addressLng, addressPlaceId, occupation, birthdate } = req.body;
    

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    // Update fields
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (addressDetail !== undefined) user.addressDetail = addressDetail;
    if (addressLat !== undefined) user.addressLat = addressLat;
    if (addressLng !== undefined) user.addressLng = addressLng;
    if (addressPlaceId !== undefined) user.addressPlaceId = addressPlaceId;
    if (occupation !== undefined) user.occupation = occupation;
    if (birthdate !== undefined) user.birthdate = birthdate;

    await user.save();
    
    res.json({
      msg: 'Profile updated successfully',
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      address: user.address,
      addressDetail: user.addressDetail,
      addressLat: user.addressLat,
      addressLng: user.addressLng,
      addressPlaceId: user.addressPlaceId,
      occupation: user.occupation,
      birthdate: user.birthdate
    });
  } catch (err) {
    res.status(500).send('Server Error');
  }
};

// @desc    Get user profile by ID (주소 포함)
// @route   GET /api/users/profile/:userId
// @access  Private
exports.getUserProfileById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('name firstName lastName email phone address addressDetail addressLat addressLng occupation birthdate');

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

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
    res.status(500).send('Server Error');
  }
};