const Room = require('../models/room');
const User = require('../models/user');
const ActivityLog = require('../models/ActivityLog');
const schedulingAlgorithm = require('../services/schedulingAlgorithm');

// @desc    Run auto-schedule algorithm for the room
// @route   POST /api/coordination/rooms/:roomId/auto-schedule
// @access  Private (Room Owner only)
exports.runAutoSchedule = async (req, res) => {
   try {
      const { roomId } = req.params;
      const { minHoursPerWeek = 3, numWeeks = 4, currentWeek, assignmentMode } = req.body;
      
      const validModes = ['normal', 'first_come_first_served', 'from_today'];
      const mode = assignmentMode && validModes.includes(assignmentMode)
        ? assignmentMode
        : 'normal';

      const startDate = currentWeek ? new Date(currentWeek) : new Date();
      
      console.log('🔍 ===== [서버] 자동배정 요청 받음 =====');
      console.log('📥 받은 파라미터:', { minHoursPerWeek, numWeeks, currentWeek: currentWeek ? currentWeek : 'undefined', assignmentMode: mode });
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

      if (minHoursPerWeek < 0.167 || minHoursPerWeek > 10) {
         return res.status(400).json({ msg: '주당 최소 할당 시간은 10분-10시간 사이여야 합니다.' });
      }
      
      // Save settings to room
      room.settings.minHoursPerWeek = minHoursPerWeek;
      room.settings.assignmentMode = mode;

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

      // 개인 시간표가 있는지 확인 (defaultSchedule 또는 scheduleExceptions 중 하나라도 있으면 OK)
      let membersWithDefaultSchedule = 0;
      for (const member of membersOnly) {
        const hasDefaultSchedule = member.user.defaultSchedule && member.user.defaultSchedule.length > 0;
        const hasScheduleExceptions = member.user.scheduleExceptions && member.user.scheduleExceptions.length > 0;
        if (hasDefaultSchedule || hasScheduleExceptions) {
          membersWithDefaultSchedule++;
        }
      }

      // 방장 선호시간 확인 (defaultSchedule 또는 scheduleExceptions 중 하나라도 있으면 OK)
      const ownerHasDefaultSchedule = room.owner?.defaultSchedule && room.owner.defaultSchedule.length > 0;
      const ownerHasScheduleExceptions = room.owner?.scheduleExceptions && room.owner.scheduleExceptions.length > 0;

      if (!room.owner || (!ownerHasDefaultSchedule && !ownerHasScheduleExceptions)) {
        const ownerName = `${room.owner?.firstName || ''} ${room.owner?.lastName || ''}`.trim() || '방장';
        return res.status(400).json({
          msg: `방장(${ownerName})이 선호시간표를 설정하지 않았습니다. 내프로필에서 선호시간표를 설정해주세요.`
        });
      }

      const membersWithoutDefaultSchedule = [];
      for (const member of membersOnly) {
        const hasDefaultSchedule = member.user?.defaultSchedule && member.user.defaultSchedule.length > 0;
        const hasScheduleExceptions = member.user?.scheduleExceptions && member.user.scheduleExceptions.length > 0;

        if (!member.user || (!hasDefaultSchedule && !hasScheduleExceptions)) {
          const userName = member.user?.name || `${member.user?.firstName || ''} ${member.user?.lastName || ''}`.trim() || '알 수 없음';
          membersWithoutDefaultSchedule.push(userName);
        }
      }
      if (membersWithoutDefaultSchedule.length > 0) {
        return res.status(400).json({
          msg: `다음 멤버들이 선호시간표를 설정하지 않았습니다: ${membersWithoutDefaultSchedule.join(', ')}. 각 멤버는 내프로필에서 선호시간표를 설정해야 합니다.`
        });
      }

      // 방 설정의 금지 시간(점심시간 등) 적용
      const ownerBlockedTimes = room.settings.blockedTimes || [];

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

      // 💡 자동배정 실행 전: 기존의 모든 timeSlots 삭제
      const beforeSlotCount = room.timeSlots.length;

      // 💡 모든 슬롯 삭제
      room.timeSlots = [];

      // 개인 시간표 기반 자동배정으로 변경
      const result = schedulingAlgorithm.runAutoSchedule(
         membersOnly,
         room.owner,
         room.timeSlots, // 💡 협의로 배정된 기존 슬롯 전달 (이미 충족된 멤버 제외용)
         {
            assignmentMode: mode,
            minHoursPerWeek,
            numWeeks,
            currentWeek,
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

      const conflictSuggestions = [];

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
                conflictSuggestions.push({
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

      // Negotiations feature removed

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
         conflictSuggestions: conflictSuggestions,
         assignmentMode: mode,
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
exports.deleteAllTimeSlots = exports.deleteAllTimeSlots = async (req, res) => {
   try {
      const { roomId } = req.params;
      const room = await Room.findById(roomId)
        .populate('owner', 'personalTimes')
        .populate('members.user', 'personalTimes');

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      if (!room.isOwner(req.user.id)) {
         return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
      }

      // Clear the timeSlots array
      room.timeSlots = [];

      // Also clear non-pending requests as they are linked to slots
      room.requests = room.requests.filter(r => r.status === 'pending');

      await room.save();

      // 확정된 개인일정도 삭제 (personalTimes 중 방 이름이 포함된 것)
      const updatePromises = [];
      
      // 조원들의 personalTimes에서 해당 방 관련 항목 삭제
      for (const member of room.members) {
        const memberUser = await User.findById(member.user._id || member.user);
        if (memberUser && memberUser.personalTimes) {
          memberUser.personalTimes = memberUser.personalTimes.filter(pt => 
            !pt.title || !pt.title.includes(room.name)
          );
          updatePromises.push(memberUser.save());
        }
      }
      
      // 방장의 personalTimes에서 해당 방 관련 항목 삭제
      const owner = await User.findById(room.owner._id || room.owner);
      if (owner && owner.personalTimes) {
        owner.personalTimes = owner.personalTimes.filter(pt => 
          !pt.title || !pt.title.includes(room.name)
        );
        updatePromises.push(owner.save());
      }
      
      await Promise.all(updatePromises);

      const updatedRoom = await Room.findById(room._id)
         .populate('owner', 'firstName lastName email address addressLat addressLng')
         .populate('members.user', 'firstName lastName email address addressLat addressLng')
         .populate('timeSlots.user', '_id firstName lastName email');

      res.json(updatedRoom);

   } catch (error) {
      console.error('Error deleting all time slots:', error);
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    자동배정된 시간을 각 조원과 방장의 개인일정으로 확정
// @route   POST /api/coordination/rooms/:roomId/confirm-schedule
// @access  Private (Room Owner only)
exports.confirmSchedule = exports.confirmSchedule = async (req, res) => {
  try {
    const { roomId } = req.params;
    
    // 1. 방 조회 (populate members)
    const room = await Room.findById(roomId)
      .populate('owner', 'firstName lastName email personalTimes defaultSchedule scheduleExceptions')
      .populate('members.user', '_id firstName lastName email personalTimes defaultSchedule scheduleExceptions');
    
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }
    
    // 2. 방장 권한 확인
    if (!room.isOwner(req.user.id)) {
      return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
    }
    
    // 3. 자동배정된 슬롯 필터링 (assignedBy가 있고 status가 'confirmed'인 것)
    const autoAssignedSlots = room.timeSlots.filter(slot => 
      slot.assignedBy && slot.status === 'confirmed'
    );
    
    if (autoAssignedSlots.length === 0) {
      return res.status(400).json({ msg: '확정할 자동배정 시간이 없습니다.' });
    }
    
    // 헬퍼 함수: 시간 문자열을 분 단위로 변환 (예: "09:30" -> 570)
    const timeToMinutes = (timeStr) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    // 헬퍼 함수: 분을 시간 문자열로 변환 (예: 570 -> "09:30")
    const minutesToTime = (minutes) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    };
    
    // 헬퍼 함수: 연속된 슬롯 병합
    const mergeConsecutiveSlots = (slots) => {
      if (slots.length === 0) return [];
      
      // 시간순으로 정렬
      slots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
      
      const merged = [];
      let current = { ...slots[0] };
      
      for (let i = 1; i < slots.length; i++) {
        const slot = slots[i];
        
        // 현재 슬롯의 끝 시간과 다음 슬롯의 시작 시간이 연속되는지 확인
        if (current.endTime === slot.startTime) {
          // 연속되면 병합 (끝 시간만 업데이트)
          current.endTime = slot.endTime;
        } else {
          // 연속되지 않으면 현재 블록을 결과에 추가하고 새 블록 시작
          merged.push(current);
          current = { ...slot };
        }
      }
      
      // 마지막 블록 추가
      merged.push(current);
      
      return merged;
    };
    
    // 4. 조원별, 날짜별로 그룹화 후 병합
    const slotsByUserAndDate = {};
    autoAssignedSlots.forEach(slot => {
      const userId = slot.user.toString();
      const dateStr = slot.date.toISOString().split('T')[0];
      const key = `${userId}_${dateStr}`;
      
      if (!slotsByUserAndDate[key]) {
        slotsByUserAndDate[key] = {
          userId,
          date: slot.date,
          day: slot.day,
          slots: []
        };
      }
      slotsByUserAndDate[key].slots.push(slot);
    });
    
    // 각 그룹의 슬롯을 병합
    const mergedSlotsByUser = {};
    for (const [key, group] of Object.entries(slotsByUserAndDate)) {
      const mergedSlots = mergeConsecutiveSlots(group.slots);
      
      if (!mergedSlotsByUser[group.userId]) {
        mergedSlotsByUser[group.userId] = [];
      }
      
      mergedSlots.forEach(slot => {
        mergedSlotsByUser[group.userId].push({
          ...slot,
          date: group.date,
          day: group.day
        });
      });
    }
    
    // 헬퍼 함수: day 문자열을 숫자로 변환
    const getDayOfWeekNumber = (day) => {
      const dayMap = {
        'monday': 1,
        'tuesday': 2,
        'wednesday': 3,
        'thursday': 4,
        'friday': 5,
        'saturday': 6,
        'sunday': 7
      };
      return dayMap[day] || 1;
    };
    
    // 헬퍼 함수: 선호시간 삭제 (defaultSchedule + scheduleExceptions에서)
    const removePreferenceTimes = (user, slots) => {
      slots.forEach(slot => {
        const dateStr = slot.date.toISOString().split('T')[0];
        const dayOfWeek = getDayOfWeekNumber(slot.day);
        
        // defaultSchedule에서 삭제 (해당 날짜의 선호시간)
        if (user.defaultSchedule) {
          user.defaultSchedule = user.defaultSchedule.filter(schedule => {
            // specificDate가 있는 경우: 날짜가 일치하면 삭제
            if (schedule.specificDate) {
              return schedule.specificDate !== dateStr;
            }
            // specificDate가 없는 경우: dayOfWeek가 일치하면 삭제
            // (주의: 요일은 0-6이고 우리는 1-7을 사용하므로 변환 필요)
            const scheduleDayOfWeek = schedule.dayOfWeek === 0 ? 7 : schedule.dayOfWeek;
            return scheduleDayOfWeek !== dayOfWeek;
          });
        }
        
        // scheduleExceptions에서 삭제 (해당 날짜의 예외 일정)
        if (user.scheduleExceptions) {
          user.scheduleExceptions = user.scheduleExceptions.filter(exception => {
            if (exception.specificDate) {
              return exception.specificDate !== dateStr;
            }
            return true; // specificDate가 없으면 유지
          });
        }
      });
    };
    
    // 5. 각 조원의 personalTimes에 추가 + 선호시간 삭제
    const updatePromises = [];
    const ownerName = `${room.owner.firstName || ''} ${room.owner.lastName || ''}`.trim() || '방장';
    
    for (const [userId, mergedSlots] of Object.entries(mergedSlotsByUser)) {
      const user = await User.findById(userId);
      if (!user) continue;
      
      // personalTimes 배열이 없으면 초기화
      if (!user.personalTimes) {
        user.personalTimes = [];
      }
      
      // 선호시간 삭제 (원본 슬롯 사용)
      const originalSlots = autoAssignedSlots.filter(s => s.user.toString() === userId);
      removePreferenceTimes(user, originalSlots);
      
      // 다음 ID 계산
      const maxId = user.personalTimes.reduce((max, pt) => Math.max(max, pt.id || 0), 0);
      let nextId = maxId + 1;
      
      // 병합된 각 슬롯을 personalTimes로 변환
      mergedSlots.forEach(slot => {
        const dayOfWeek = getDayOfWeekNumber(slot.day);
        const dateStr = slot.date.toISOString().split('T')[0];
        
        // 중복 체크 (같은 날짜, 같은 시간)
        const isDuplicate = user.personalTimes.some(pt => 
          pt.specificDate === dateStr &&
          pt.startTime === slot.startTime &&
          pt.endTime === slot.endTime
        );
        
        if (!isDuplicate) {
          user.personalTimes.push({
            id: nextId++,
            title: `${room.name} - ${ownerName}`,
            type: 'event',
            startTime: slot.startTime,
            endTime: slot.endTime,
            days: [dayOfWeek],
            isRecurring: false,
            specificDate: dateStr,
            color: '#10B981' // 초록색
          });
        }
      });
      
      updatePromises.push(user.save());
    }
    
    // 6. 방장의 personalTimes에도 추가 (각 조원별로 개별 수업 시간) + 선호시간 삭제
    const owner = await User.findById(room.owner._id || room.owner);
    if (owner) {
      if (!owner.personalTimes) {
        owner.personalTimes = [];
      }
      
      // 방장의 선호시간 삭제
      removePreferenceTimes(owner, autoAssignedSlots);
      
      const maxId = owner.personalTimes.reduce((max, pt) => Math.max(max, pt.id || 0), 0);
      let nextId = maxId + 1;
      
      // 각 조원별로 병합된 슬롯을 방장의 개인일정으로 추가
      for (const [userId, mergedSlots] of Object.entries(mergedSlotsByUser)) {
        // 해당 조원 정보 찾기
        const memberUser = room.members.find(m => 
          m.user._id?.toString() === userId || 
          m.user.toString() === userId
        );
        
        if (!memberUser) continue;
        
        const memberName = `${memberUser.user.firstName || ''} ${memberUser.user.lastName || ''}`.trim() || '조원';
        
        mergedSlots.forEach(slot => {
          const dayOfWeek = getDayOfWeekNumber(slot.day);
          const dateStr = slot.date.toISOString().split('T')[0];
          
          // 중복 체크 (같은 날짜, 같은 시간, 같은 조원)
          const isDuplicate = owner.personalTimes.some(pt => 
            pt.specificDate === dateStr &&
            pt.startTime === slot.startTime &&
            pt.endTime === slot.endTime &&
            pt.title.includes(memberName)
          );
          
          if (!isDuplicate) {
            owner.personalTimes.push({
              id: nextId++,
              title: `${room.name} - ${memberName}`,
              type: 'event',
              startTime: slot.startTime,
              endTime: slot.endTime,
              days: [dayOfWeek],
              isRecurring: false,
              specificDate: dateStr,
              color: '#3B82F6' // 파란색 (방장 수업 시간)
            });
          }
        });
      }
      
      updatePromises.push(owner.save());
    }
    
    await Promise.all(updatePromises);
    
    // 7. 활동 로그 기록
    await ActivityLog.logActivity(
      roomId,
      req.user.id,
      `${req.user.firstName} ${req.user.lastName}`,
      'confirm_schedule',
      `자동배정 시간 확정 완료 (${autoAssignedSlots.length}개 슬롯 → ${Object.values(mergedSlotsByUser).reduce((sum, slots) => sum + slots.length, 0)}개 병합, 조원 ${Object.keys(mergedSlotsByUser).length}명 + 방장)`
    );
    
    // 8. 성공 응답
    res.json({
      msg: '배정 시간이 각 조원과 방장의 개인일정으로 확정되었습니다.',
      confirmedSlotsCount: autoAssignedSlots.length,
      mergedSlotsCount: Object.values(mergedSlotsByUser).reduce((sum, slots) => sum + slots.length, 0),
      affectedMembersCount: Object.keys(mergedSlotsByUser).length
    });
    
  } catch (error) {
    console.error('Error confirming schedule:', error);
    res.status(500).json({ msg: `확정 처리 중 오류가 발생했습니다: ${error.message}` });
  }
};
