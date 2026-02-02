const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/user');

// @route   GET api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    console.log('[profile.js GET] Fetching profile for user:', req.user.id);
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      console.log('[profile.js GET] User not found');
      return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    }

    const profile = {
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email,
      phone: user.phone || '',
      address: user.address || '',
      addressLat: user.addressLat || null,
      addressLng: user.addressLng || null,
      addressPlaceId: user.addressPlaceId || null,
      occupation: user.occupation || '',
      birthdate: user.birthdate || ''
    };

    console.log('[profile.js GET] Returning profile:', { firstName: profile.firstName, lastName: profile.lastName });
    res.json(profile);
  } catch (err) {
    console.error('[profile.js GET] Error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

// @route   PUT api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/', auth, async (req, res) => {
  try {
    const { firstName, lastName, phone, address, addressDetail, addressLat, addressLng, addressPlaceId, occupation, birthdate } = req.body;
    console.log('[profile.js PUT] Update request for user:', req.user.id);
    console.log('[profile.js PUT] Data received:', { firstName, lastName, phone, occupation });

    const user = await User.findById(req.user.id);

    if (!user) {
      console.log('[profile.js PUT] User not found');
      return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    }

    console.log('[profile.js PUT] Current values:', { firstName: user.firstName, lastName: user.lastName });

    // 업데이트할 필드만 적용
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

    console.log('[profile.js PUT] New values before save:', { firstName: user.firstName, lastName: user.lastName });
    await user.save();
    console.log('[profile.js PUT] Profile updated successfully');

    const profile = {
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
    };

    res.json(profile);
  } catch (err) {
    console.error('[profile.js PUT] Error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

// @route   POST api/users/profile/schedule
// @desc    Add schedule exceptions or personal times
// @access  Private
router.post('/schedule', auth, async (req, res) => {
  try {
    const { scheduleExceptions, personalTimes, defaultSchedule } = req.body;
    console.log('[profile.js POST /schedule] Request for user:', req.user.id);
    console.log('[profile.js POST /schedule] Data:', { scheduleExceptions, personalTimes, defaultSchedule });
    console.log('🔵 [서버] scheduleExceptions 개수:', scheduleExceptions?.length || 0);
    console.log('🔵 [서버] personalTimes 개수:', personalTimes?.length || 0);
    console.log('🔵 [서버] defaultSchedule 개수:', defaultSchedule?.length || 0);

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    }

    let addedCount = 0;
    let duplicateCount = 0;

    // Add schedule exceptions (선호시간) - 중복 체크
    if (scheduleExceptions && Array.isArray(scheduleExceptions)) {
      scheduleExceptions.forEach(exception => {
        // 같은 날짜, 같은 시간 범위가 이미 있는지 체크
        const isDuplicate = user.scheduleExceptions.some(existing => {
          return existing.specificDate === exception.specificDate &&
                 new Date(existing.startTime).getTime() === new Date(exception.startTime).getTime() &&
                 new Date(existing.endTime).getTime() === new Date(exception.endTime).getTime();
        });

        if (isDuplicate) {
          duplicateCount++;
        } else {
          user.scheduleExceptions.push(exception);
          addedCount++;
        }
      });
    }

    // Add personal times (개인시간) - 중복 체크
    if (personalTimes && Array.isArray(personalTimes)) {
      personalTimes.forEach(personalTime => {
        // 같은 날짜, 같은 시간 범위가 이미 있는지 체크
        const isDuplicate = user.personalTimes.some(existing => {
          return existing.specificDate === personalTime.specificDate &&
                 existing.startTime === personalTime.startTime &&
                 existing.endTime === personalTime.endTime;
        });

        if (isDuplicate) {
          duplicateCount++;
        } else {
          user.personalTimes.push(personalTime);
          addedCount++;
        }
      });
    }

    // 🆕 Add defaultSchedule (선호시간) - 중복 체크
    if (defaultSchedule && Array.isArray(defaultSchedule)) {
      defaultSchedule.forEach(schedule => {
        // 같은 날짜, 같은 시간 범위가 이미 있는지 체크
        const isDuplicate = user.defaultSchedule.some(existing => {
          return existing.specificDate === schedule.specificDate &&
                 existing.startTime === schedule.startTime &&
                 existing.endTime === schedule.endTime;
        });

        if (isDuplicate) {
          duplicateCount++;
        } else {
          user.defaultSchedule.push(schedule);
          addedCount++;
        }
      });
    }

    await user.save();
    console.log('[profile.js POST /schedule] Added:', addedCount, 'Duplicates:', duplicateCount);
    console.log('🔵 [서버] 최종 user.defaultSchedule 개수:', user.defaultSchedule?.length || 0);
    console.log('🔵 [서버] 최종 user.scheduleExceptions 개수:', user.scheduleExceptions?.length || 0);

    res.json({
      success: true,
      scheduleExceptions: user.scheduleExceptions,
      personalTimes: user.personalTimes,
      defaultSchedule: user.defaultSchedule,
      addedCount,
      duplicateCount,
      isDuplicate: duplicateCount > 0 && addedCount === 0
    });
  } catch (err) {
    console.error('[profile.js POST /schedule] Error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

// @route   DELETE api/users/profile/schedule/:personalTimeId
// @desc    Delete a personal time entry
// @access  Private
router.delete('/schedule/:personalTimeId', auth, async (req, res) => {
  try {
    const { personalTimeId } = req.params;
    console.log('[profile.js DELETE /schedule] Request for user:', req.user.id, 'personalTimeId:', personalTimeId);

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    }

    const initialLength = user.personalTimes.length;
    user.personalTimes = user.personalTimes.filter(pt => pt._id.toString() !== personalTimeId);

    if (user.personalTimes.length === initialLength) {
      return res.status(404).json({ msg: '해당 개인 일정을 찾을 수 없습니다.' });
    }

    await user.save();
    console.log('[profile.js DELETE /schedule] Personal time deleted successfully');

    res.json({
      success: true,
      msg: '개인 일정이 삭제되었습니다.',
      personalTimes: user.personalTimes
    });
  } catch (err) {
    console.error('[profile.js DELETE /schedule] Error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
