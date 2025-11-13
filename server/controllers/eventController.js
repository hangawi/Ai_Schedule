const Event = require('../models/event');
const mongoose = require('mongoose');

// @desc    사용자의 모든 일정 조회
// @route   GET /api/events
// @access  Private
exports.getEvents = async (req, res) => {
   try {
      const userId = req.user.id;
      const { page = 1, limit = 50, category, status, priority } = req.query;


      // 필터 조건 구성
      const filter = { userId };
      if (category) filter.category = category;
      if (status) filter.status = status;
      if (priority) filter.priority = parseInt(priority);

      const events = await Event.find(filter)
         .populate('participants.userId', 'name email')
         .sort({ startTime: 1 })
         .limit(limit * 1)
         .skip((page - 1) * limit)
         .lean(); // 성능 향상을 위해 lean() 사용

      const total = await Event.countDocuments(filter);


      res.json({
         events,
         pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total,
         },
      });
   } catch (err) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    특정 기간 내 일정 조회
// @route   GET /api/events/range
// @access  Private
exports.getEventsByRange = async (req, res) => {
   try {
      const userId = req.user.id;
      const { startDate, endDate } = req.query;


      const events = await Event.findByDateRange(userId, new Date(startDate), new Date(endDate)).populate(
         'participants.userId',
         'name email',
      );

      res.json(events);
   } catch (err) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    충돌하는 일정 조회
// @route   GET /api/events/conflicts
// @access  Private
exports.getConflictingEvents = async (req, res) => {
  try {
    const userId = req.user.id;
    const { startTime, endTime, excludeEventId } = req.query;
    
    
    const conflicts = await Event.findConflicting(
      userId,
      new Date(startTime),
      new Date(endTime),
      excludeEventId
    ).populate('participants.userId', 'name email');
    
    res.json(conflicts);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    일정 상세 정보로 조회
// @route   POST /api/events/find
// @access  Private
exports.findEventByDetails = async (req, res) => {
   try {
      const userId = req.user.id;
      const { title, date, time } = req.body; // date and time are YYYY-MM-DD and HH:MM

      if (!title || !date) {
         // Title and date are essential for deletion
         return res.status(400).json({ msg: 'Title and date are required to find an event for deletion.' });
      }

      let searchStartTime;
      let searchEndTime;

      if (time) {
         // If time is provided, search within a specific hour
         searchStartTime = new Date(`${date}T${time}:00`);
         searchEndTime = new Date(searchStartTime.getTime() + 60 * 60 * 1000); // 1 hour duration
      } else {
         // If only date is provided, search for the entire day
         searchStartTime = new Date(`${date}T00:00:00`);
         searchEndTime = new Date(`${date}T23:59:59`);
      }


      const event = await Event.findOne({
         userId,
         title: new RegExp(title, 'i'), // Case-insensitive title search
         startTime: { $gte: searchStartTime, $lte: searchEndTime }, // Use $lte for end of day
      });

      if (!event) {
         return res.status(404).json({ msg: 'Event not found with the provided details.' });
      }

      res.json({ eventId: event._id });
   } catch (err) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    특정 일정 상세 조회
// @route   GET /api/events/:id
// @access  Private
exports.getEventById = async (req, res) => {
   try {
      const userId = req.user.id;
      const eventId = req.params.id;


      const event = await Event.findOne({ _id: eventId, userId }).populate('participants.userId', 'name email');

      if (!event) {
         return res.status(404).json({ msg: 'Event not found or unauthorized' });
      }

      res.json(event);
   } catch (err) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    새 일정 생성 (충돌 감지 및 대화형 처리)
// @route   POST /api/events
// @access  Private
exports.createEvent = async (req, res) => {
   try {
      const {
         date,
         time,
         description,
         priority,
         category,
         isFlexible,
         flexibilityWindow,
         participants,
         externalParticipants,
         sourceCalendarId,
         externalEventId,
         color,
         duration = 60, // 기본 1시간
         forceCreate = false, // 충돌 무시하고 강제 생성
      } = req.body;
      const title = req.body.title || req.body.summary;

      const userId = req.user.id;

      // 날짜와 시간을 결합하여 startTime과 endTime 생성
      const startTime = new Date(`${date}T${time}:00`);
      const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

      // 충돌 검사 - 최소 30분 이상 겹칠 때만 충돌로 판정
      const allConflicts = await Event.findConflicting(userId, startTime, endTime);
      const conflicts = allConflicts.filter(event => {
         const overlapStart = new Date(Math.max(startTime.getTime(), new Date(event.startTime).getTime()));
         const overlapEnd = new Date(Math.min(endTime.getTime(), new Date(event.endTime).getTime()));
         const overlapMinutes = (overlapEnd - overlapStart) / (1000 * 60);
         return overlapMinutes >= 30; // 30분 이상 겹칠 때만 충돌
      });

      if (conflicts.length > 0 && !forceCreate) {
         // 충돌 발견 - 1단계: 사용자에게 선택 요청
         const conflictTitles = conflicts.map(e => e.title).join(', ');
         const timeStr = startTime.toLocaleString('ko-KR', {
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
         });

         // 원본 입력 정보 추출
         const userInput = `${date} ${time}에 ${title || '일정'} 추가`;

         return res.status(409).json({
            status: 'conflict',
            message: `입력: "${userInput}"\n\n${timeStr}에 이미 "${conflictTitles}" 일정이 있습니다.\n\n어떻게 하시겠어요?`,
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

      // 충돌 없음 또는 강제 생성
      const newEvent = new Event({
         userId,
         title,
         description: description || '',
         startTime,
         endTime,
         priority: priority || 3,
         category: category || 'general',
         isFlexible: isFlexible || false,
         flexibilityWindow: flexibilityWindow || { before: 0, after: 0 },
         participants: participants || [],
         externalParticipants: externalParticipants || [],
         sourceCalendarId,
         externalEventId,
         status: 'confirmed',
      });

      const savedEvent = await newEvent.save();
      const populatedEvent = await Event.findById(savedEvent._id).populate('participants.userId', 'name email');

      const responseObject = populatedEvent.toJSON();
      responseObject.color = color || 'blue';

      res.status(201).json(responseObject);
   } catch (err) {
      res.status(500).json({ msg: 'Server error', error: err.message });
   }
};

// @desc    일정 수정
// @route   PUT /api/events/:id
// @access  Private
exports.updateEvent = async (req, res) => {
   try {
      const { id: eventId } = req.params;
      const { id: userId } = req.user;
      const { title, description, date, time, color, priority } = req.body;

      // 1. Find the document
      const event = await Event.findOne({ _id: eventId, userId });
      if (!event) {
         return res.status(404).json({ msg: 'Event not found or unauthorized' });
      }

      // 2. Apply all possible updates
      if (title !== undefined) event.title = title;
      if (description !== undefined) event.description = description;
      if (color !== undefined) event.color = color;
      if (priority !== undefined) event.priority = priority;

      // 3. Handle date and time update
      if (date && time) {
         const newStartTime = new Date(`${date}T${time}`);
         if (isNaN(newStartTime.getTime())) {
            return res.status(400).json({ msg: `Invalid date or time format. Received: ${date} ${time}` });
         }
         const durationMs = event.endTime.getTime() - event.startTime.getTime() || 60 * 60 * 1000;
         event.startTime = newStartTime;
         event.endTime = new Date(newStartTime.getTime() + durationMs);
      }

      // 4. Save the document
      const updatedEvent = await event.save();

      res.json(updatedEvent);
   } catch (err) {
      if (err.name === 'ValidationError') {
         return res.status(400).json({ msg: `Validation failed: ${err.message}` });
      }
      res.status(500).json({ msg: 'Server error', error: err.message });
   }
};

// @desc    일정 상태 변경
// @route   PATCH /api/events/:id/status
// @access  Private
exports.updateEventStatus = async (req, res) => {
   try {
      const userId = req.user.id;
      const eventId = req.params.id;
      const { status } = req.body;


      const event = await Event.findOne({ _id: eventId, userId });

      if (!event) {
         return res.status(404).json({ msg: 'Event not found or unauthorized' });
      }

      event.status = status;
      await event.save();

      res.json(event);
   } catch (err) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    일정 우선순위 설정
// @route   PATCH /api/events/:id/priority
// @access  Private
exports.setPriority = async (req, res) => {
   try {
      const userId = req.user.id;
      const eventId = req.params.id;
      const { priority } = req.body;


      const event = await Event.findOne({ _id: eventId, userId });

      if (!event) {
         return res.status(404).json({ msg: 'Event not found or unauthorized' });
      }

      event.priority = priority;
      await event.save();

      res.json(event);
   } catch (err) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    참석자 추가
// @route   POST /api/events/:id/participants
// @access  Private
exports.addParticipant = async (req, res) => {
   try {
      const userId = req.user.id;
      const eventId = req.params.id;
      const { userId: participantUserId, email, name, isExternal } = req.body;


      const event = await Event.findOne({ _id: eventId, userId });

      if (!event) {
         return res.status(404).json({ msg: 'Event not found or unauthorized' });
      }

      await event.addParticipant(participantUserId, isExternal, email, name);

      const updatedEvent = await Event.findById(eventId).populate('participants.userId', 'name email');

      res.json(updatedEvent);
   } catch (err) {
      res.status(400).json({ msg: err.message });
   }
};

// @desc    참석자 상태 업데이트
// @route   PATCH /api/events/:id/participants/:participantId
// @access  Private
exports.updateParticipantStatus = async (req, res) => {
   try {
      const userId = req.user.id;
      const eventId = req.params.id;
      const participantId = req.params.participantId;
      const { status, isExternal = false } = req.body;


      const event = await Event.findOne({ _id: eventId, userId });

      if (!event) {
         return res.status(404).json({ msg: 'Event not found or unauthorized' });
      }

      await event.updateParticipantStatus(participantId, status, isExternal);

      const updatedEvent = await Event.findById(eventId).populate('participants.userId', 'name email');

      res.json(updatedEvent);
   } catch (err) {
      res.status(400).json({ msg: err.message });
   }
};

// @desc    참석자 제거
// @route   DELETE /api/events/:id/participants/:participantId
// @access  Private
exports.removeParticipant = async (req, res) => {
   try {
      const userId = req.user.id;
      const eventId = req.params.id;
      const participantId = req.params.participantId;
      const { isExternal = false } = req.query;


      const event = await Event.findOne({ _id: eventId, userId });

      if (!event) {
         return res.status(404).json({ msg: 'Event not found or unauthorized' });
      }

      if (isExternal === 'true') {
         event.externalParticipants.id(participantId).remove();
      } else {
         event.participants = event.participants.filter(p => p.userId.toString() !== participantId);
      }

      await event.save();

      const updatedEvent = await Event.findById(eventId).populate('participants.userId', 'name email');

      res.json(updatedEvent);
   } catch (err) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    일정 삭제
// @route   DELETE /api/events/:id
// @access  Private
exports.deleteEvent = async (req, res) => {
   try {
      const userId = req.user.id;
      const eventId = req.params.id;


      const deletedEvent = await Event.findOneAndDelete({ _id: eventId, userId });

      if (!deletedEvent) {
         return res.status(404).json({ msg: 'Event not found or unauthorized' });
      }

      res.json({
         msg: 'Event deleted successfully',
         deletedEvent: { id: deletedEvent._id, title: deletedEvent.title },
      });
   } catch (err) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    일정 복제
// @route   POST /api/events/:id/duplicate
// @access  Private
exports.duplicateEvent = async (req, res) => {
   try {
      const userId = req.user.id;
      const eventId = req.params.id;
      const { newDate, newTime } = req.body;


      const originalEvent = await Event.findOne({ _id: eventId, userId });

      if (!originalEvent) {
         return res.status(404).json({ msg: 'Event not found or unauthorized' });
      }

      const eventData = originalEvent.toObject();
      delete eventData._id;
      delete eventData.createdAt;
      delete eventData.updatedAt;

      // 새로운 날짜/시간이 제공된 경우 업데이트
      if (newDate && newTime) {
         const duration = originalEvent.durationInMinutes;
         eventData.startTime = new Date(`${newDate}T${newTime}:00`);
         eventData.endTime = new Date(eventData.startTime.getTime() + duration * 60 * 1000);
      }

      eventData.title = `${originalEvent.title} (복사본)`;
      eventData.status = 'draft'; // 복제된 일정은 초안 상태로

      const duplicatedEvent = new Event(eventData);
      await duplicatedEvent.save();

      res.status(201).json(duplicatedEvent);
   } catch (err) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    새 일정을 위한 대체 시간 추천 (충돌 해결 - 옵션 1)
// @route   POST /api/events/recommend-alternative
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
      const requestedHour = requestedTime.getHours();
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
               recommendations.push({
                  startTime: new Date(currentTime),
                  endTime: candidateEnd,
                  display: `${currentTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} - ${candidateEnd.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
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
      res.status(500).json({ msg: 'Server error', error: err.message });
   }
};

// @desc    기존 일정 재조정 시간 추천 (충돌 해결 - 옵션 2)
// @route   POST /api/events/recommend-reschedule
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
      res.status(500).json({ msg: 'Server error', error: err.message });
   }
};

// @desc    기존 일정 재조정 및 새 일정 생성 확정
// @route   POST /api/events/confirm-reschedule
// @access  Private
exports.confirmReschedule = async (req, res) => {
   try {
      const userId = req.user.id;
      const {
         conflictingEventId,
         newStartTime,
         pendingEvent
      } = req.body;

      // 1. 기존 일정 업데이트
      const conflictingEvent = await Event.findOne({ _id: conflictingEventId, userId });
      if (!conflictingEvent) {
         return res.status(404).json({ msg: 'Conflicting event not found' });
      }

      const duration = (conflictingEvent.endTime - conflictingEvent.startTime);
      conflictingEvent.startTime = new Date(newStartTime);
      conflictingEvent.endTime = new Date(new Date(newStartTime).getTime() + duration);
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
         message: '일정이 재조정되었습니다.',
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
      res.status(500).json({ msg: 'Server error', error: err.message });
   }
};
