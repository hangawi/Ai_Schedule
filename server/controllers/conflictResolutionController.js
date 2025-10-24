const Event = require('../models/event');

/**
 * 일정 충돌 해결 컨트롤러
 * LLM 강화 대화형 일정 재조정 기능
 */

// @desc    일정 충돌 감지 및 옵션 제공
// @route   POST /api/conflict/detect
// @access  Private
exports.detectConflict = async (req, res) => {
   try {
      const userId = req.user.id;
      const { date, time, duration = 60, title, description, priority, category } = req.body;

      // 날짜와 시간을 결합하여 startTime과 endTime 생성
      const startTime = new Date(`${date}T${time}:00`);
      const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

      // 충돌 검사
      const conflicts = await Event.findConflicting(userId, startTime, endTime);

      if (conflicts.length > 0) {
         // 충돌 발견 - 1단계: 사용자에게 선택 요청
         const conflictTitles = conflicts.map(e => e.title).join(', ');
         const timeStr = startTime.toLocaleString('ko-KR', {
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
         });

         return res.status(200).json({
            hasConflict: true,
            message: `${timeStr}에 이미 "${conflictTitles}" 일정이 있습니다.\n\n어떻게 하시겠어요?`,
            conflictingEvents: conflicts.map(e => ({
               id: e._id,
               title: e.title,
               startTime: e.startTime,
               endTime: e.endTime,
            })),
            pendingEvent: {
               title,
               description,
               startTime,
               endTime,
               duration,
               priority,
               category,
            },
            actions: [
               { id: 1, label: '다른 시간 추천받기', action: 'recommend_alternative' },
               { id: 2, label: '기존 약속 변경하기', action: 'reschedule_existing' }
            ]
         });
      }

      // 충돌 없음
      res.json({
         hasConflict: false,
         message: '해당 시간에 일정을 추가할 수 있습니다.',
      });
   } catch (err) {
      console.error('❌ 충돌 감지 실패:', err.message);
      res.status(500).json({ msg: 'Server error', error: err.message });
   }
};

// @desc    새 일정을 위한 대체 시간 추천 (옵션 1: 다른 시간 추천받기)
// @route   POST /api/conflict/recommend-alternative
// @access  Private
exports.recommendAlternativeTime = async (req, res) => {
   try {
      const userId = req.user.id;
      const { pendingEvent } = req.body; // { title, startTime, endTime, duration }

      const requestedTime = new Date(pendingEvent.startTime);
      const duration = pendingEvent.duration || 60;

      // 해당 날짜의 모든 일정 가져오기
      const dayStart = new Date(requestedTime);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(requestedTime);
      dayEnd.setHours(23, 59, 59, 999);

      const existingEvents = await Event.find({
         userId,
         startTime: { $gte: dayStart, $lte: dayEnd }
      }).sort({ startTime: 1 });

      // 요청 시간 기준 앞뒤로 추천 (예: 18시 요청 -> 15시, 21시 등)
      const searchOffsets = [-180, -120, -60, 60, 120, 180]; // 분 단위: ±3시간, ±2시간, ±1시간
      const recommendations = [];

      for (const offset of searchOffsets) {
         const candidateStart = new Date(requestedTime.getTime() + offset * 60 * 1000);
         const candidateEnd = new Date(candidateStart.getTime() + duration * 60 * 1000);

         // 업무 시간대만 (9시 ~ 22시)
         if (candidateStart.getHours() < 9 || candidateStart.getHours() >= 22) continue;
         if (candidateStart.getDate() !== requestedTime.getDate()) continue;

         // 충돌 확인
         const hasConflict = existingEvents.some(event => {
            return (candidateStart < event.endTime && candidateEnd > event.startTime);
         });

         if (!hasConflict) {
            const hourLabel = candidateStart.getHours();
            const minuteLabel = candidateStart.getMinutes();
            const timeLabel = `${hourLabel}시${minuteLabel > 0 ? ` ${minuteLabel}분` : ''}`;

            recommendations.push({
               startTime: candidateStart,
               endTime: candidateEnd,
               display: `${timeLabel} (${candidateStart.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} - ${candidateEnd.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })})`
            });
         }

         if (recommendations.length >= 5) break;
      }

      // 추천이 없으면 전체 시간대 검색
      if (recommendations.length === 0) {
         let currentTime = new Date(dayStart);
         currentTime.setHours(9, 0, 0, 0);

         while (currentTime.getHours() < 22 && recommendations.length < 5) {
            const candidateEnd = new Date(currentTime.getTime() + duration * 60 * 1000);

            const hasConflict = existingEvents.some(event => {
               return (currentTime < event.endTime && candidateEnd > event.startTime);
            });

            if (!hasConflict) {
               const hourLabel = currentTime.getHours();
               const minuteLabel = currentTime.getMinutes();
               const timeLabel = `${hourLabel}시${minuteLabel > 0 ? ` ${minuteLabel}분` : ''}`;

               recommendations.push({
                  startTime: new Date(currentTime),
                  endTime: candidateEnd,
                  display: `${timeLabel} (${currentTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} - ${candidateEnd.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })})`
               });
            }

            currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
         }
      }

      const message = recommendations.length > 0
         ? `그 시간엔 약속이 있으니, 이 시간은 어떠세요?\n\n${recommendations.map((r, i) => `${i + 1}. ${r.display}`).join('\n')}`
         : '죄송합니다. 해당 날짜에 추천할 만한 시간이 없습니다.';

      res.json({
         status: 'success',
         message,
         recommendations,
         pendingEvent
      });
   } catch (err) {
      console.error('❌ 대체 시간 추천 실패:', err.message);
      res.status(500).json({ msg: 'Server error', error: err.message });
   }
};

// @desc    기존 일정 재조정 시간 추천 (옵션 2: 기존 약속 변경하기)
// @route   POST /api/conflict/recommend-reschedule
// @access  Private
exports.recommendRescheduleTime = async (req, res) => {
   try {
      const userId = req.user.id;
      const { conflictingEventId } = req.body;

      const conflictingEvent = await Event.findOne({ _id: conflictingEventId, userId });
      if (!conflictingEvent) {
         return res.status(404).json({ msg: 'Conflicting event not found' });
      }

      const duration = (conflictingEvent.endTime - conflictingEvent.startTime) / (60 * 1000);
      const originalStart = conflictingEvent.startTime;

      // 같은 날 내에서 가능한 시간대 검색
      const dayStart = new Date(originalStart);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(originalStart);
      dayEnd.setHours(23, 59, 59, 999);

      const existingEvents = await Event.find({
         userId,
         _id: { $ne: conflictingEventId }, // 현재 이벤트 제외
         startTime: { $gte: dayStart, $lte: dayEnd }
      }).sort({ startTime: 1 });

      // 원래 시간 기준 양옆으로 검색 (예: 18시 -> 15시, 21시 등)
      const searchOffsets = [-180, -120, -60, 60, 120, 180]; // 분 단위: ±3시간, ±2시간, ±1시간
      const recommendations = [];

      for (const offset of searchOffsets) {
         const candidateStart = new Date(originalStart.getTime() + offset * 60 * 1000);
         const candidateEnd = new Date(candidateStart.getTime() + duration * 60 * 1000);

         // 업무 시간대만 (9시 ~ 22시)
         if (candidateStart.getHours() < 9 || candidateStart.getHours() >= 22) continue;
         if (candidateStart.getDate() !== originalStart.getDate()) continue;

         // 충돌 확인
         const hasConflict = existingEvents.some(event => {
            return (candidateStart < event.endTime && candidateEnd > event.startTime);
         });

         if (!hasConflict) {
            const hourLabel = candidateStart.getHours();
            const minuteLabel = candidateStart.getMinutes();
            const timeLabel = `${hourLabel}시${minuteLabel > 0 ? ` ${minuteLabel}분` : ''}`;

            recommendations.push({
               startTime: candidateStart,
               endTime: candidateEnd,
               display: `${timeLabel} (${candidateStart.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} - ${candidateEnd.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })})`
            });
         }

         if (recommendations.length >= 5) break;
      }

      const originalTimeStr = `${originalStart.getHours()}시${originalStart.getMinutes() > 0 ? ` ${originalStart.getMinutes()}분` : ''}`;
      const message = recommendations.length > 0
         ? `"${conflictingEvent.title}" (${originalTimeStr})을 언제로 옮기시겠어요?\n\n${recommendations.map((r, i) => `${i + 1}. ${r.display}`).join('\n')}`
         : '죄송합니다. 해당 날짜에 옮길 만한 시간이 없습니다.';

      res.json({
         status: 'success',
         message,
         recommendations,
         conflictingEvent: {
            id: conflictingEvent._id,
            title: conflictingEvent.title,
            originalStartTime: conflictingEvent.startTime,
            originalEndTime: conflictingEvent.endTime
         }
      });
   } catch (err) {
      console.error('❌ 재조정 시간 추천 실패:', err.message);
      res.status(500).json({ msg: 'Server error', error: err.message });
   }
};

// @desc    기존 일정 삭제 (옵션 2 - Step 1)
// @route   POST /api/conflict/delete
// @access  Private
exports.deleteConflictingEvent = async (req, res) => {
   try {
      const userId = req.user.id;
      const { conflictingEventId } = req.body;

      const event = await Event.findOne({ _id: conflictingEventId, userId });
      if (!event) {
         return res.status(404).json({ msg: '삭제할 일정을 찾을 수 없습니다.' });
      }

      const eventTitle = event.title;
      await Event.deleteOne({ _id: conflictingEventId, userId });

      res.json({
         status: 'success',
         message: `${eventTitle} 일정을 삭제했어요!`
      });
   } catch (err) {
      console.error('❌ 일정 삭제 실패:', err.message);
      res.status(500).json({ msg: 'Server error', error: err.message });
   }
};

// @desc    대체 시간 선택 및 새 일정 생성 (옵션 1 확정)
// @route   POST /api/conflict/confirm-alternative
// @access  Private
exports.confirmAlternativeTime = async (req, res) => {
   try {
      const userId = req.user.id;
      const { selectedTime, pendingEvent } = req.body;

      // 선택한 시간으로 새 일정 생성
      const newEvent = new Event({
         userId,
         title: pendingEvent.title,
         description: pendingEvent.description || '',
         startTime: new Date(selectedTime.startTime),
         endTime: new Date(selectedTime.endTime),
         priority: pendingEvent.priority || 3,
         category: pendingEvent.category || 'general',
         status: 'confirmed',
      });

      await newEvent.save();

      res.json({
         status: 'success',
         message: `'${newEvent.title}' 일정이 ${new Date(selectedTime.startTime).toLocaleString('ko-KR')}에 추가되었습니다.`,
         newEvent: {
            id: newEvent._id,
            title: newEvent.title,
            startTime: newEvent.startTime,
            endTime: newEvent.endTime
         }
      });
   } catch (err) {
      console.error('❌ 대체 시간 확정 실패:', err.message);
      res.status(500).json({ msg: 'Server error', error: err.message });
   }
};

// @desc    기존 일정 재조정 및 새 일정 생성 확정 (옵션 2 확정)
// @route   POST /api/conflict/confirm-reschedule
// @access  Private
exports.confirmReschedule = async (req, res) => {
   try {
      const userId = req.user.id;
      const {
         conflictingEventId,
         selectedTime,
         pendingEvent
      } = req.body;

      // 1. 기존 일정 업데이트
      const conflictingEvent = await Event.findOne({ _id: conflictingEventId, userId });
      if (!conflictingEvent) {
         return res.status(404).json({ msg: 'Conflicting event not found' });
      }

      const duration = (conflictingEvent.endTime - conflictingEvent.startTime);
      conflictingEvent.startTime = new Date(selectedTime.startTime);
      conflictingEvent.endTime = new Date(selectedTime.endTime);
      await conflictingEvent.save();

      // 2. 새 일정 생성
      const newEvent = new Event({
         userId,
         title: pendingEvent.title,
         description: pendingEvent.description || '',
         startTime: new Date(pendingEvent.startTime),
         endTime: new Date(pendingEvent.endTime),
         priority: pendingEvent.priority || 3,
         category: pendingEvent.category || 'general',
         status: 'confirmed',
      });

      await newEvent.save();

      res.json({
         status: 'success',
         message: `✓ '${conflictingEvent.title}'을(를) ${new Date(selectedTime.startTime).toLocaleString('ko-KR')}로 옮겼습니다.\n✓ '${newEvent.title}'이(가) ${new Date(pendingEvent.startTime).toLocaleString('ko-KR')}에 추가되었습니다.`,
         rescheduledEvent: {
            id: conflictingEvent._id,
            title: conflictingEvent.title,
            startTime: conflictingEvent.startTime,
            endTime: conflictingEvent.endTime
         },
         newEvent: {
            id: newEvent._id,
            title: newEvent.title,
            startTime: newEvent.startTime,
            endTime: newEvent.endTime
         }
      });
   } catch (err) {
      console.error('❌ 일정 재조정 확정 실패:', err.message);
      res.status(500).json({ msg: 'Server error', error: err.message });
   }
};

// module.exports는 이미 exports.functionName 형식으로 위에 정의되어 있음
