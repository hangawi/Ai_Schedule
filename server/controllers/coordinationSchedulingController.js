const Room = require('../models/Room');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const schedulingAlgorithm = require('../services/schedulingAlgorithm');

// @desc    Run auto-schedule algorithm for the room
// @route   POST /api/coordination/rooms/:roomId/auto-schedule
// @access  Private (Room Owner only)
exports.runAutoSchedule = async (req, res) => {
   try {
      const { roomId } = req.params;
      const { minHoursPerWeek = 3, numWeeks = 4, currentWeek, ownerFocusTime = 'none' } = req.body;
      const startDate = currentWeek ? new Date(currentWeek) : new Date();
      
      console.log('🔍 ===== [서버] 자동배정 요청 받음 =====');
      console.log('📥 받은 파라미터:', { minHoursPerWeek, numWeeks, currentWeek: currentWeek ? currentWeek : 'undefined', ownerFocusTime });
      console.log('📅 계산된 startDate:', startDate.toISOString().split('T')[0]);
      console.log('🔍 ===================================\n');

      const room = await Room.findById(roomId)
        .populate('owner', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes priority')
        .populate('members.user', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes priority');

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      if (!room.isOwner(req.user.id)) {
         return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
      }

      // Clear previous auto-generated slots before running new schedule
      // 단, 협의로 배정된 슬롯(subject에 '협의'가 포함된 것)은 보존
      room.timeSlots = room.timeSlots.filter(slot => {
         // assignedBy가 없으면 수동 배정 → 유지
         if (!slot.assignedBy) return true;
         // 협의로 배정된 슬롯 → 유지
         if (slot.subject && (slot.subject.includes('협의') || slot.subject === '자동 배정')) {
            // '협의 결과', '협의 결과 (대체시간)', '협의 결과 (시간선택)' 등은 유지
            if (slot.subject.includes('협의')) return true;
            // '자동 배정'은 삭제
            if (slot.subject === '자동 배정') return false;
         }
         // 기타 assignedBy가 있는 슬롯 → 삭제
         return false;
      });

      if (minHoursPerWeek < 1 || minHoursPerWeek > 10) {
         return res.status(400).json({ msg: '주당 최소 할당 시간은 1-10시간 사이여야 합니다.' });
      }

      if (!room.settings.ownerPreferences) {
         room.settings.ownerPreferences = {};
      }
      room.settings.ownerPreferences.focusTimeType = ownerFocusTime;

      // Save minHoursPerWeek for future auto-schedules (when members join)
      room.settings.minHoursPerWeek = minHoursPerWeek;

      await room.save();

      const membersOnly = room.members.filter(m => {
         const memberId = m.user._id ? m.user._id.toString() : m.user.toString();
         const ownerId = room.owner._id ? room.owner._id.toString() : room.owner.toString();
         return memberId !== ownerId;
      });



      const memberIds = membersOnly.map(m => {
        const memberId = m.user._id ? m.user._id.toString() : m.user.toString();
        return memberId;
      });

      // 개인 시간표가 있는지 확인
      let membersWithDefaultSchedule = 0;
      for (const member of membersOnly) {
        if (member.user.defaultSchedule && member.user.defaultSchedule.length > 0) {
          membersWithDefaultSchedule++;
        }
      }

      if (!room.owner || !room.owner.defaultSchedule || room.owner.defaultSchedule.length === 0) {
        const ownerName = `${room.owner?.firstName || ''} ${room.owner?.lastName || ''}`.trim() || '방장';
        return res.status(400).json({
          msg: `방장(${ownerName})이 선호시간표를 설정하지 않았습니다. 내프로필에서 선호시간표를 설정해주세요.`
        });
      }
      const membersWithoutDefaultSchedule = [];
      for (const member of membersOnly) {

        if (!member.user || !member.user.defaultSchedule || member.user.defaultSchedule.length === 0) {
          const userName = member.user?.name || `${member.user?.firstName || ''} ${member.user?.lastName || ''}`.trim() || '알 수 없음';
          membersWithoutDefaultSchedule.push(userName);
        }
      }
      if (membersWithoutDefaultSchedule.length > 0) {
        return res.status(400).json({
          msg: `다음 멤버들이 선호시간표를 설정하지 않았습니다: ${membersWithoutDefaultSchedule.join(', ')}. 각 멤버는 내프로필에서 선호시간표를 설정해야 합니다.`
        });
      }

      // 방장의 차단 시간은 개인 시간표에서 자동으로 처리되므로 별도 처리 불필요
      const ownerBlockedTimes = [];

      const existingCarryOvers = [];
      for (const member of room.members) {
        if (member.carryOver > 0) {
          existingCarryOvers.push({
            memberId: member.user._id.toString(),
            neededHours: member.carryOver,
            priority: member.priority || 3,
            week: startDate
          });
        }
      }

      // 💡 자동배정 실행 전: 기존의 모든 timeSlots와 negotiations 삭제
      const beforeSlotCount = room.timeSlots.length;
      const beforeNegotiationCount = room.negotiations ? room.negotiations.length : 0;

      // 💡 모든 슬롯과 협의 삭제
      room.timeSlots = [];
      room.negotiations = [];

      // 개인 시간표 기반 자동배정으로 변경
      const result = schedulingAlgorithm.runAutoSchedule(
         membersOnly,
         room.owner,
         room.timeSlots, // 💡 협의로 배정된 기존 슬롯 전달 (이미 충족된 멤버 제외용)
         {
            minHoursPerWeek,
            numWeeks,
            currentWeek,
            ownerPreferences: room.settings.ownerPreferences || {},
            roomSettings: {
               ...room.settings,
               ownerBlockedTimes: ownerBlockedTimes
            },
         },
         existingCarryOvers,
      );

      const twoWeeksAgo = new Date(startDate);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const oneWeekAgo = new Date(startDate);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const forcedNegotiationSuggestions = [];

      for (const member of room.members) {
        const memberUser = await User.findById(member.user);
        if (member.carryOver > 0) { // They have a carry-over from last week
            const history = member.carryOverHistory || [];

            const hasConsecutiveCarryOver = history.some(h =>
                new Date(h.week).getTime() >= twoWeeksAgo.getTime() &&
                new Date(h.week).getTime() < oneWeekAgo.getTime() &&
                h.amount > 0
            );

            if (hasConsecutiveCarryOver) {
                const memberName = memberUser.name || `${memberUser.firstName} ${memberUser.lastName}`;
                forcedNegotiationSuggestions.push({
                    title: '장기 이월 멤버 발생',
                    content: `멤버 '${memberName}'의 시간이 2주 이상 연속으로 이월되었습니다. 최소 할당 시간을 줄이거나, 멤버의 참여 가능 시간을 늘리거나, 직접 시간을 할당하여 문제를 해결해야 합니다.`
                });
            }
        }
      }

      // 중복 삭제 방지 - 이미 위에서 삭제했으므로 주석 처리
      // room.timeSlots = room.timeSlots.filter(slot => !slot.assignedBy);



      // 중복 방지를 위한 Set 생성
      const addedSlots = new Set();

      Object.values(result.assignments).forEach(assignment => {

         if (assignment.slots && assignment.slots.length > 0) {
            assignment.slots.forEach((slot, idx) => {
               // 필수 필드 검증
               if (!slot.day || !slot.startTime || !slot.endTime || !slot.date) {
                  return; // 이 슬롯은 건너뛰기
               }

               // 중복 체크를 위한 유니크 키 생성
               const slotKey = `${assignment.memberId}-${slot.day}-${slot.startTime}-${slot.endTime}-${new Date(slot.date).toISOString().split('T')[0]}`;

               if (!addedSlots.has(slotKey)) {
                  const dateStr = new Date(slot.date).toLocaleDateString('ko-KR');

                  const newSlot = {
                     user: assignment.memberId,
                     date: slot.date,
                     startTime: slot.startTime,
                     endTime: slot.endTime,
                     day: slot.day,
                     priority: 3,
                     subject: '자동 배정',
                     assignedBy: req.user.id || req.user._id || 'auto-scheduler',
                     assignedAt: new Date(),
                     status: 'confirmed',
                  };

                  room.timeSlots.push(newSlot);
                  addedSlots.add(slotKey);
               } else {
               }
            });
         }
      });

      const autoAssignedCount = room.timeSlots.filter(slot => slot.assignedBy).length;
      const totalSlotCount = room.timeSlots.length;

      // 다른 방법으로 자동 배정 슬롯 찾기
      const autoSlotsBySubject = room.timeSlots.filter(slot => slot.subject === '자동 배정');

      // 디버깅을 위해 실제 저장된 슬롯들 확인
      const recentlyAdded = room.timeSlots.filter(slot => slot.assignedBy || slot.subject === '자동 배정');

      if (result.negotiations && result.negotiations.length > 0) {
        room.negotiations = room.negotiations.filter(neg => neg.status !== 'active');
        room.negotiations.push(...result.negotiations);
      }

      for (const member of room.members) {
        const memberId = member.user._id.toString();
        const assignment = result.assignments[memberId];

        if (assignment && assignment.assignedHours >= minHoursPerWeek * 2) {
          if (member.carryOver > 0) {
            member.carryOverHistory.push({
              week: startDate,
              amount: -member.carryOver,
              reason: 'resolved_by_auto_schedule',
              timestamp: new Date()
            });
            member.carryOver = 0;
          }
        }
      }

      // 이월시간 처리 개선
      if (result.carryOverAssignments && result.carryOverAssignments.length > 0) {

         for (const carryOver of result.carryOverAssignments) {
            const memberIndex = room.members.findIndex(m =>
               m.user.toString() === carryOver.memberId
            );

            if (memberIndex !== -1) {
               const member = room.members[memberIndex];
               const previousCarryOver = member.carryOver || 0;
               member.carryOver = (member.carryOver || 0) + carryOver.neededHours;

               if (carryOver.neededHours > 0) {
                 // 이월 히스토리 업데이트
                 if (!member.carryOverHistory) {
                   member.carryOverHistory = [];
                 }

                 member.carryOverHistory.push({
                    week: carryOver.week || startDate,
                    amount: carryOver.neededHours,
                    reason: 'unassigned_from_auto_schedule',
                    timestamp: new Date(),
                    priority: carryOver.priority || 3
                 });

                 // 2주 이상 연속 이월 체크
                 const recentCarryOvers = member.carryOverHistory.filter(h => {
                   const historyDate = new Date(h.week);
                   const twoWeeksAgo = new Date(startDate);
                   twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
                   return historyDate >= twoWeeksAgo && h.amount > 0;
                 });

                 if (recentCarryOvers.length >= 2) {
                   // 강제 협의 또는 관리자 개입 플래그 설정
                   member.needsIntervention = true;
                   member.interventionReason = 'consecutive_carryover';
                 }
               }
            }
         }
      }

      // 우선도에 따른 다음 주 우선 배정 정보 업데이트
      Object.values(result.assignments).forEach(assignment => {
        if (assignment.carryOver && assignment.carryOver > 0) {
          const memberIndex = room.members.findIndex(m =>
            m.user.toString() === assignment.memberId
          );

          if (memberIndex !== -1) {
            const member = room.members[memberIndex];
            // 다음 주 우선 배정을 위한 우선도 임시 상승
            if (!member.tempPriorityBoost) {
              member.tempPriorityBoost = assignment.carryOver; // 이월 시간만큼 우선도 부스트
            }
          }
        }
      });

      // 💡 저장 전 최종 슬롯 통계 로그
      console.log('\n📊 ===== [서버] 최종 배정 결과 =====');
      console.log('총 슬롯 수:', room.timeSlots.length);
      
      if (room.timeSlots.length > 0) {
        const dates = room.timeSlots.map(slot => new Date(slot.date).toISOString().split('T')[0]).sort();
        const uniqueDates = [...new Set(dates)];
        console.log('날짜 범위:', uniqueDates[0], '~', uniqueDates[uniqueDates.length - 1]);
        console.log('총 배정일 수:', uniqueDates.length);
        
        // 월별 통계
        const monthCount = {};
        uniqueDates.forEach(date => {
          const month = date.substring(0, 7);
          monthCount[month] = (monthCount[month] || 0) + 1;
        });
        console.log('월별 배정일 수:', monthCount);
      }
      console.log('🔍 ===================================\n');

      await room.save();

      // 활동 로그 기록
      try {
         const ownerUser = await User.findById(req.user.id);
         const ownerName = ownerUser ? `${ownerUser.firstName} ${ownerUser.lastName}` : 'Unknown';
         await ActivityLog.logActivity(
            roomId,
            req.user.id,
            ownerName,
            'auto_assign',
            `자동배정 실행 완료 (주당 ${minHoursPerWeek}시간, ${membersOnly.length}명 배정)`
         );
      } catch (logError) {
         console.error('Activity log error:', logError);
      }

      const freshRoom = await Room.findById(roomId)
         .populate('owner', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes address addressDetail addressLat addressLng')
         .populate('members.user', 'firstName lastName email defaultSchedule address addressDetail addressLat addressLng')
         .populate('timeSlots.user', '_id firstName lastName email')
         .populate('requests.requester', 'firstName lastName email')
         .populate('requests.targetUser', 'firstName lastName email')
         .populate('negotiations.conflictingMembers.user', '_id firstName lastName email')
         .lean();

      if (freshRoom.timeSlots.length > 0) {
         freshRoom.timeSlots.slice(0, 5).forEach((slot, idx) => {
            const userName = slot.user?.name || slot.user?.firstName || '이름없음';
            const userId = slot.user?._id || slot.user;
            const dateStr = new Date(slot.date).toLocaleDateString('ko-KR');
         });
      }
      res.json({
         room: freshRoom,
         unassignedMembersInfo: result.unassignedMembersInfo,
         conflictSuggestions: forcedNegotiationSuggestions, // Use the new suggestions
      });
   } catch (error) {

      if (error.message.includes('defaultSchedule')) {
         res.status(400).json({ msg: '선호시간표 데이터에 오류가 있습니다. 모든 멤버가 내프로필에서 선호시간표를 설정했는지 확인해주세요.' });
      } else if (error.message.includes('timeSlots')) {
         res.status(400).json({ msg: '시간표 데이터에 오류가 있습니다. 멤버들이 선호시간표를 설정했는지 확인해주세요.' });
      } else if (error.message.includes('member')) {
         res.status(400).json({ msg: '멤버 데이터에 오류가 있습니다. 방 설정을 확인해주세요.' });
      } else if (error.message.includes('settings')) {
         res.status(400).json({ msg: '방 설정에 오류가 있습니다. 시간 설정을 확인해주세요.' });
      } else if (error.message.includes('priority')) {
         res.status(400).json({ msg: '우선순위 설정에 오류가 있습니다. 멤버 우선순위를 확인해주세요.' });
      } else {
         res.status(500).json({ msg: `자동 배정 실행 중 오류가 발생했습니다: ${error.message}` });
      }
   }
};

// @desc    Delete all time slots in a room
// @route   DELETE /api/coordination/rooms/:roomId/timeslots
// @access  Private (Room Owner only)
exports.deleteAllTimeSlots = async (req, res) => {
   try {
      const { roomId } = req.params;
      const room = await Room.findById(roomId);

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      if (!room.isOwner(req.user.id)) {
         return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
      }

      // Clear the timeSlots array
      room.timeSlots = [];

      // Also clear all active negotiations and non-pending requests as they are linked to slots
      room.negotiations = [];
      room.requests = room.requests.filter(r => r.status === 'pending');


      await room.save();

      const updatedRoom = await Room.findById(room._id)
         .populate('owner', 'firstName lastName email address addressLat addressLng')
         .populate('members.user', 'firstName lastName email address addressLat addressLng')
         .populate('timeSlots.user', '_id firstName lastName email');

      res.json(updatedRoom);

   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    Clear all negotiations in a room
// @route   DELETE /api/coordination/rooms/:roomId/negotiations
// @access  Private (Room Owner only)
exports.clearAllNegotiations = async (req, res) => {
   try {
      const { roomId } = req.params;
      const room = await Room.findById(roomId);

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      if (!room.isOwner(req.user.id)) {
         return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
      }

      const clearedCount = room.negotiations.length;

      // Clear all negotiations
      room.negotiations = [];
      await room.save();

      const updatedRoom = await Room.findById(room._id)
         .populate('owner', 'firstName lastName email')
         .populate('members.user', 'firstName lastName email')
         .populate('timeSlots.user', '_id firstName lastName email')
         .populate('negotiations.conflictingMembers.user', '_id firstName lastName email');

      res.json({
         msg: `${clearedCount}개의 협의가 삭제되었습니다.`,
         clearedCount,
         room: updatedRoom
      });

   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};
