const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/user');
const ScheduleSuggestion = require('../models/ScheduleSuggestion');
const ChatMessage = require('../models/ChatMessage');
const { deleteFromGoogleCalendar } = require('../services/confirmScheduleService');

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

// @route   DELETE api/users/profile/schedule/google/:suggestionId
// @desc    Delete a Google Calendar event (+ auto reject if from suggestion)
// @access  Private
// 🆕 이 라우트가 :personalTimeId보다 먼저 와야 함!
router.delete('/schedule/google/:suggestionId', auth, async (req, res) => {
  try {
    const { suggestionId } = req.params;
    console.log('[profile.js DELETE /schedule/google] Request for user:', req.user.id, 'suggestionId:', suggestionId);

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    }

    // 구글 사용자 확인
    const isGoogleUser = !!(user.google && user.google.refreshToken);
    if (!isGoogleUser) {
      return res.status(400).json({ msg: '구글 사용자가 아닙니다.' });
    }

    // suggestion 찾기
    const suggestion = await ScheduleSuggestion.findById(suggestionId);
    if (!suggestion) {
      return res.status(404).json({ msg: '해당 일정을 찾을 수 없습니다.' });
    }

    // 🆕 accepted 멤버 수 확인 (참여 인원별 분기)
    const acceptedCount = suggestion.memberResponses.filter(
      r => r.status === 'accepted'
    ).length;
    const userName = user.firstName || user.email?.split('@')[0] || '사용자';

    if (acceptedCount >= 2) {
      // ✅ 2명 이상 참여 → 본인만 불참 처리
      // 본인 Google Calendar에서 삭제
      try {
        const ptData = {
          title: `[약속] ${suggestion.summary}`,
          specificDate: suggestion.date,
          startTime: suggestion.startTime,
          suggestionId: suggestionId
        };
        await deleteFromGoogleCalendar(user, ptData);
      } catch (gcErr) {
        console.warn('[profile.js DELETE /schedule/google] Google Calendar 삭제 실패:', gcErr.message);
      }

      const userResponse = suggestion.memberResponses.find(
        r => (r.user._id?.toString() || r.user.toString()) === req.user.id.toString()
      );
      if (userResponse && userResponse.status === 'accepted') {
        userResponse.status = 'rejected';
        userResponse.respondedAt = new Date();
        userResponse.personalTimeId = null;
        await suggestion.save();

        // 다른 참여자들의 participants 수 업데이트
        const newAcceptedCount = acceptedCount - 1;
        for (const mr of suggestion.memberResponses) {
          if (mr.status === 'accepted' && mr.personalTimeId) {
            const otherUserId = mr.user._id?.toString() || mr.user.toString();
            if (otherUserId !== req.user.id.toString()) {
              const otherUser = await User.findById(otherUserId);
              if (otherUser) {
                const otherPt = otherUser.personalTimes.find(
                  pt => pt.suggestionId === suggestionId
                );
                if (otherPt) {
                  otherPt.participants = newAcceptedCount;
                  await otherUser.save();
                }
              }
            }
          }
        }
      }

      // 시스템 메시지: 불참
      const systemMsg = new ChatMessage({
        room: suggestion.room,
        sender: user._id,
        content: `${userName}님이 ${suggestion.date} ${suggestion.summary} 일정에 불참했습니다.`,
        type: 'system'
      });
      await systemMsg.save();

      if (global.io && suggestion.room) {
        global.io.to(`room-${suggestion.room}`).emit('chat-message', systemMsg);
        global.io.to(`room-${suggestion.room}`).emit('suggestion-updated', {
          suggestionId: suggestion._id,
          suggestion: suggestion
        });
      }

      return res.json({ success: true, action: 'rejected', msg: '불참 처리되었습니다.' });

    } else {
      // ✅ 1명 이하 참여 → 일정 완전 삭제
      suggestion.status = 'cancelled';

      // 모든 accepted 멤버 처리
      for (const mr of suggestion.memberResponses) {
        const memberId = mr.user._id?.toString() || mr.user.toString();
        if (mr.status === 'accepted' && memberId !== req.user.id.toString()) {
          const memberUser = await User.findById(memberId);
          if (memberUser) {
            const isGoogleMember = !!(memberUser.google && memberUser.google.refreshToken);
            if (isGoogleMember) {
              try {
                const ptData = {
                  title: `[약속] ${suggestion.summary}`,
                  specificDate: suggestion.date,
                  startTime: suggestion.startTime,
                  suggestionId: suggestionId
                };
                await deleteFromGoogleCalendar(memberUser, ptData);
              } catch (gcErr) {
                console.warn('[profile.js DELETE /schedule/google] 다른 멤버 Google Calendar 삭제 실패:', gcErr.message);
              }
            } else {
              memberUser.personalTimes = memberUser.personalTimes.filter(
                pt => pt.suggestionId !== suggestionId
              );
              await memberUser.save();
            }
          }
        }
        mr.status = 'rejected';
        mr.respondedAt = new Date();
        mr.personalTimeId = null;
      }
      await suggestion.save();

      // 본인 Google Calendar에서 삭제
      try {
        const ptData = {
          title: `[약속] ${suggestion.summary}`,
          specificDate: suggestion.date,
          startTime: suggestion.startTime,
          suggestionId: suggestionId
        };
        await deleteFromGoogleCalendar(user, ptData);
      } catch (gcErr) {
        console.warn('[profile.js DELETE /schedule/google] 본인 Google Calendar 삭제 실패:', gcErr.message);
      }

      // 시스템 메시지: 삭제
      const systemMsg = new ChatMessage({
        room: suggestion.room,
        sender: user._id,
        content: `${userName}님이 ${suggestion.date} ${suggestion.summary} 일정을 삭제했습니다.`,
        type: 'system'
      });
      await systemMsg.save();

      if (global.io && suggestion.room) {
        global.io.to(`room-${suggestion.room}`).emit('chat-message', systemMsg);
        global.io.to(`room-${suggestion.room}`).emit('suggestion-updated', {
          suggestionId: suggestion._id,
          suggestion: suggestion
        });
      }

      return res.json({ success: true, action: 'deleted', msg: '일정이 삭제되었습니다.' });
    }
  } catch (err) {
    console.error('[profile.js DELETE /schedule/google] Error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

// @route   DELETE api/users/profile/schedule/:personalTimeId
// @desc    Delete a personal time entry (+ auto reject if from suggestion)
// @access  Private
router.delete('/schedule/:personalTimeId', auth, async (req, res) => {
  try {
    const { personalTimeId } = req.params;
    console.log('[profile.js DELETE /schedule] Request for user:', req.user.id, 'personalTimeId:', personalTimeId);

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    }

    // 🆕 삭제할 personalTime 찾기 (suggestionId 확인용)
    const targetPt = user.personalTimes.find(pt =>
      pt._id.toString() === personalTimeId || pt.id?.toString() === personalTimeId
    );

    if (!targetPt) {
      return res.status(404).json({ msg: '해당 개인 일정을 찾을 수 없습니다.' });
    }

    // 🆕 suggestionId가 있으면 참여 인원 수에 따라 삭제/불참 분기 처리
    if (targetPt.suggestionId) {
      try {
        const suggestion = await ScheduleSuggestion.findById(targetPt.suggestionId);
        if (suggestion) {
          // accepted 멤버 수 확인
          const acceptedCount = suggestion.memberResponses.filter(
            r => r.status === 'accepted'
          ).length;
          const userName = user.firstName || user.email?.split('@')[0] || '사용자';

          if (acceptedCount >= 2) {
            // ✅ 2명 이상 참여 → 본인만 불참 처리 (일정 유지)
            const userResponse = suggestion.memberResponses.find(
              r => (r.user._id?.toString() || r.user.toString()) === req.user.id.toString()
            );
            if (userResponse && userResponse.status === 'accepted') {
              userResponse.status = 'rejected';
              userResponse.respondedAt = new Date();
              userResponse.personalTimeId = null;
              await suggestion.save();
              console.log(`[profile.js DELETE] 🔄 불참 처리 (${acceptedCount}명 중 1명 불참): suggestionId=${targetPt.suggestionId}`);

              // 다른 참여자들의 participants 수 업데이트
              const newAcceptedCount = acceptedCount - 1;
              for (const mr of suggestion.memberResponses) {
                if (mr.status === 'accepted' && mr.personalTimeId) {
                  const otherUserId = mr.user._id?.toString() || mr.user.toString();
                  if (otherUserId !== req.user.id.toString()) {
                    const otherUser = await User.findById(otherUserId);
                    if (otherUser) {
                      const otherPt = otherUser.personalTimes.find(
                        pt => pt.suggestionId === targetPt.suggestionId
                      );
                      if (otherPt) {
                        otherPt.participants = newAcceptedCount;
                        await otherUser.save();
                      }
                    }
                  }
                }
              }

              // 시스템 메시지: 불참
              const systemMsg = new ChatMessage({
                room: suggestion.room,
                sender: user._id,
                content: `${userName}님이 ${suggestion.date} ${suggestion.summary} 일정에 불참했습니다.`,
                type: 'system'
              });
              await systemMsg.save();

              if (global.io && suggestion.room) {
                global.io.to(`room-${suggestion.room}`).emit('chat-message', systemMsg);
                global.io.to(`room-${suggestion.room}`).emit('suggestion-updated', {
                  suggestionId: suggestion._id,
                  suggestion: suggestion
                });
              }
            }

            // 본인 personalTime만 삭제
            user.personalTimes = user.personalTimes.filter(pt =>
              pt._id.toString() !== personalTimeId && pt.id?.toString() !== personalTimeId
            );
            await user.save();

            return res.json({
              success: true,
              action: 'rejected',
              msg: '불참 처리되었습니다.',
              personalTimes: user.personalTimes
            });

          } else {
            // ✅ 1명 이하 참여 → 일정 완전 삭제
            suggestion.status = 'cancelled';

            // 모든 accepted 멤버의 personalTimes에서 해당 일정 삭제
            for (const mr of suggestion.memberResponses) {
              const memberId = mr.user._id?.toString() || mr.user.toString();
              if (mr.status === 'accepted' && memberId !== req.user.id.toString()) {
                const memberUser = await User.findById(memberId);
                if (memberUser) {
                  const isGoogleMember = !!(memberUser.google && memberUser.google.refreshToken);
                  if (isGoogleMember) {
                    // 구글 사용자: Google Calendar에서 삭제
                    try {
                      const ptData = {
                        title: `[약속] ${suggestion.summary}`,
                        specificDate: suggestion.date,
                        startTime: suggestion.startTime,
                        suggestionId: targetPt.suggestionId
                      };
                      await deleteFromGoogleCalendar(memberUser, ptData);
                    } catch (gcErr) {
                      console.warn('[profile.js DELETE] 다른 멤버 Google Calendar 삭제 실패:', gcErr.message);
                    }
                  } else {
                    // 일반 사용자: personalTimes에서 삭제
                    memberUser.personalTimes = memberUser.personalTimes.filter(
                      pt => pt.suggestionId !== targetPt.suggestionId
                    );
                    await memberUser.save();
                  }
                }
              }
              // 모든 멤버 응답 상태 업데이트
              mr.status = 'rejected';
              mr.respondedAt = new Date();
              mr.personalTimeId = null;
            }
            await suggestion.save();
            console.log(`[profile.js DELETE] ❌ 일정 완전 삭제: suggestionId=${targetPt.suggestionId}`);

            // 시스템 메시지: 삭제
            const systemMsg = new ChatMessage({
              room: suggestion.room,
              sender: user._id,
              content: `${userName}님이 ${suggestion.date} ${suggestion.summary} 일정을 삭제했습니다.`,
              type: 'system'
            });
            await systemMsg.save();

            if (global.io && suggestion.room) {
              global.io.to(`room-${suggestion.room}`).emit('chat-message', systemMsg);
              global.io.to(`room-${suggestion.room}`).emit('suggestion-updated', {
                suggestionId: suggestion._id,
                suggestion: suggestion
              });
            }

            // 본인 personalTime도 삭제
            user.personalTimes = user.personalTimes.filter(pt =>
              pt._id.toString() !== personalTimeId && pt.id?.toString() !== personalTimeId
            );
            await user.save();

            return res.json({
              success: true,
              action: 'deleted',
              msg: '일정이 삭제되었습니다.',
              personalTimes: user.personalTimes
            });
          }
        }
      } catch (suggErr) {
        console.warn('[profile.js DELETE] Suggestion 처리 실패:', suggErr.message);
      }
    }

    // suggestionId가 없는 일반 personalTime 삭제
    user.personalTimes = user.personalTimes.filter(pt =>
      pt._id.toString() !== personalTimeId && pt.id?.toString() !== personalTimeId
    );
    await user.save();
    console.log('[profile.js DELETE /schedule] Personal time deleted successfully');

    res.json({
      success: true,
      action: 'deleted',
      msg: '개인 일정이 삭제되었습니다.',
      personalTimes: user.personalTimes
    });
  } catch (err) {
    console.error('[profile.js DELETE /schedule] Error:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
