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
      console.error('❌ 이벤트 조회 실패:', err.message);
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
      console.error('❌ 기간별 이벤트 조회 실패:', err.message);
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
    console.error('❌ 충돌 일정 조회 실패:', err.message);
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
      console.error('❌ 이벤트 상세 정보로 조회 실패:', err.message);
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
      console.error('❌ 이벤트 상세 조회 실패:', err.message);
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    새 일정 생성
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
      } = req.body;
      const title = req.body.title || req.body.summary;

      const userId = req.user.id;


      // 날짜와 시간을 결합하여 startTime과 endTime 생성
      const startTime = new Date(`${date}T${time}:00`);
      const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

      // 충돌 검사
      const conflicts = await Event.findConflicting(userId, startTime, endTime);
      if (conflicts.length > 0) {
         // 충돌이 있어도 생성하되, 경고 메시지와 함께 반환
      }

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

      // 참조된 데이터와 함께 반환
      const populatedEvent = await Event.findById(savedEvent._id).populate('participants.userId', 'name email');


      const responseObject = populatedEvent.toJSON();
      responseObject.color = color || 'blue';

      res.status(201).json(responseObject);
   } catch (err) {
      console.error('❌ 이벤트 생성 실패:', err.message);
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
      console.error('❌ 이벤트 업데이트 실패 (최종 수정):', err.message);
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
      console.error('❌ 이벤트 상태 변경 실패:', err.message);
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
      console.error('❌ 이벤트 우선순위 설정 실패:', err.message);
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
      console.error('❌ 참석자 추가 실패:', err.message);
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
      console.error('❌ 참석자 상태 업데이트 실패:', err.message);
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
      console.error('❌ 참석자 제거 실패:', err.message);
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
      console.error('❌ 이벤트 삭제 실패:', err.message);
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
      console.error('❌ 이벤트 복제 실패:', err.message);
      res.status(500).json({ msg: 'Server error' });
   }
};
