const Room = require('../models/room');
const User = require('../models/user');

// @desc    Create a new coordination room
// @route   POST /api/coordination/rooms
// @access  Private
exports.createRoom = async (req, res) => {
   try {
      const { name, description, maxMembers, settings } = req.body;

      if (!name || name.trim().length === 0) {
         return res.status(400).json({ msg: '방 이름은 필수입니다.' });
      }

      // Generate unique invite code
      let inviteCode;
      let codeExists = true;
      while (codeExists) {
         inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
         const existingRoom = await Room.findOne({ inviteCode });
         if (!existingRoom) codeExists = false;
      }

      const room = new Room({
         name: name.trim(),
         description: description?.trim() || '',
         owner: req.user.id,
         inviteCode,
         maxMembers: maxMembers || 10,
         settings: settings || {},
      });

      // roomExceptions가 존재하면 유효성 검사 및 추가
      if (settings && settings.roomExceptions && Array.isArray(settings.roomExceptions)) {

         settings.roomExceptions.forEach(ex => {
            // 기본적인 유효성 검사 (스키마에 정의된 enum, required 등)
            if (!ex.type || !ex.name || !ex.startTime || !ex.endTime) {
               throw new Error('유효하지 않은 roomException 필드입니다.');
            }
            if (ex.type === 'daily_recurring' && (ex.dayOfWeek === undefined || ex.dayOfWeek === null)) {
               throw new Error('daily_recurring 예외는 dayOfWeek가 필요합니다.');
            }
            if (ex.type === 'date_specific' && (!ex.startDate || !ex.endDate)) {
               throw new Error('date_specific 예외는 startDate와 endDate가 필요합니다.');
            }
         });
         room.settings.roomExceptions = settings.roomExceptions;
      }

      await room.save();
      await room.populate('owner', 'firstName lastName email');
      await room.populate('members.user', 'firstName lastName email');

      res.status(201).json(room);
   } catch (error) {

      // Mongoose validation error
      if (error.name === 'ValidationError') {
         const errors = Object.values(error.errors).map(err => err.message);
         return res.status(400).json({
            msg: 'Validation error',
            errors: errors,
            details: error.message
         });
      }

      // MongoDB duplicate key error
      if (error.code === 11000) {
         return res.status(400).json({
            msg: 'Duplicate key error',
            details: error.message
         });
      }

      // Cast error (invalid ObjectId, etc.)
      if (error.name === 'CastError') {
         return res.status(400).json({
            msg: 'Invalid data type',
            details: error.message
         });
      }

      res.status(500).json({
         msg: 'Server error',
         error: error.message,
         details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
   }
};

// @desc    Update room settings
// @route   PUT /api/coordination/rooms/:roomId
// @access  Private (Owner only)
exports.updateRoom = async (req, res) => {
   try {
      const room = await Room.findById(req.params.roomId);

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      // Check if user is owner
      if (!room.isOwner(req.user.id)) {
         return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
      }

      // Update room properties
      const { name, description, maxMembers, settings } = req.body;

      if (name) room.name = name;
      if (description !== undefined) room.description = description;
      if (maxMembers) room.maxMembers = maxMembers;
      if (settings) {
         room.settings = { ...room.settings.toObject(), ...settings };
      }

      await room.save();

      await room.populate('owner', 'firstName lastName email');
      await room.populate('members.user', 'firstName lastName email');

      res.json(room);
   } catch (error) {
      res.status(500).json({ msg: 'Server error', error: error.message });
   }
};

// @desc    Delete a coordination room
// @route   DELETE /api/coordination/rooms/:roomId
// @access  Private (Owner only)
exports.deleteRoom = async (req, res) => {
   try {
      const room = await Room.findById(req.params.roomId);

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      // Check if user is owner
      if (!room.isOwner(req.user.id)) {
         return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
      }

      await Room.findByIdAndDelete(req.params.roomId);
      res.json({ msg: '방이 삭제되었습니다.' });
   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    Join a coordination room
// @route   POST /api/coordination/rooms/join
// @access  Private
exports.joinRoom = async (req, res) => {
   try {
      const { inviteCode } = req.body;

      if (!inviteCode || inviteCode.trim().length === 0) {
         return res.status(400).json({ msg: '초대 코드를 입력해주세요.' });
      }

      let room = await Room.findOne({ inviteCode: inviteCode.trim().toUpperCase() });

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다. 초대 코드를 확인해주세요.' });
      }

      // Check if user is a member or owner
      const isMember = room.isMember(req.user.id);
      const isOwner = room.isOwner(req.user.id);

      if (isMember || isOwner) {
         // User is already a member, just return the room details
         await room.populate('owner', 'firstName lastName email');
         await room.populate('members.user', 'firstName lastName email');
         return res.json(room);
      }

      // Check room capacity
      if (room.members.length >= room.maxMembers) {
         return res.status(400).json({ msg: '방이 가득 찼습니다.' });
      }

      // Add user to room with unique color
      const { getAvailableColor } = require('../utils/colorUtils');
      const existingColors = room.members.map(member => member.color);
      const newColor = getAvailableColor(existingColors);

      room.members.push({
         user: req.user.id,
         joinedAt: new Date(),
         color: newColor
      });
      await room.save();

      await room.populate('owner', 'firstName lastName email');
      await room.populate('members.user', 'firstName lastName email');

      res.json(room);
   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    Get room details
// @route   GET /api/coordination/rooms/:roomId
// @access  Private (Members only)
exports.getRoomDetails = async (req, res) => {
   try {
      const room = await Room.findById(req.params.roomId)
         .populate('owner', '_id firstName lastName email name defaultSchedule scheduleExceptions personalTimes address addressDetail addressLat addressLng')
         .populate('members.user', '_id firstName lastName email name defaultSchedule address addressDetail addressLat addressLng')
         .populate('timeSlots.user', '_id firstName lastName email name')
         .populate('requests.requester', '_id firstName lastName email name')
         .populate('requests.targetUser', '_id firstName lastName email name')
         .populate('negotiations.conflictingMembers.user', '_id firstName lastName email name');

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      if (!room.isMember(req.user.id) && !room.isOwner(req.user.id)) {
         return res.status(403).json({ msg: '이 방에 접근할 권한이 없습니다.' });
      }

      // 💡 협의에 memberSpecificTimeSlots가 없으면 자동 생성
      let needsSave = false;
      for (const negotiation of room.negotiations) {
         if (negotiation.status === 'active' &&
             (!negotiation.memberSpecificTimeSlots || Object.keys(negotiation.memberSpecificTimeSlots).length === 0)) {
            negotiation.memberSpecificTimeSlots = {};

            const dayString = negotiation.slotInfo.day;
            const conflictDate = new Date(negotiation.slotInfo.date);
            const dayMap = { 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6, 'sunday': 0 };
            const conflictDayOfWeek = dayMap[dayString];

            // 이번 주의 시작일 계산
            const weekStart = new Date(conflictDate);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // 일요일로 이동
            weekStart.setHours(0, 0, 0, 0);

            for (const cm of negotiation.conflictingMembers) {
               const memberId = (cm.user._id || cm.user).toString();
               const roomMember = room.members.find(m => {
                  const mUserId = m.user._id ? m.user._id.toString() : m.user.toString();
                  return mUserId === memberId;
               });

               if (roomMember && roomMember.user && roomMember.user.defaultSchedule) {
                  // 💡 모든 요일의 선호 시간 가져오기
                  const dayPreferences = roomMember.user.defaultSchedule.filter(sched => sched.priority >= 2);

                  // 💡 요일별로 그룹화
                  const dayMap2 = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                  const prefsByDay = {};
                  dayPreferences.forEach(pref => {
                     const dayName = dayMap2[pref.dayOfWeek];
                     if (!prefsByDay[dayName]) prefsByDay[dayName] = [];
                     prefsByDay[dayName].push(pref);
                  });

                  const memberOptions = [];

                  // 💡 각 요일마다 처리
                  for (const [dayName, prefs] of Object.entries(prefsByDay)) {
                     // 연속된 시간 블록 병합
                     const sortedPrefs = prefs.sort((a, b) => a.startTime.localeCompare(b.startTime));
                     const mergedBlocks = [];

                     for (const pref of sortedPrefs) {
                        if (mergedBlocks.length === 0) {
                           mergedBlocks.push({ startTime: pref.startTime, endTime: pref.endTime });
                        } else {
                           const lastBlock = mergedBlocks[mergedBlocks.length - 1];
                           if (lastBlock.endTime === pref.startTime) {
                              lastBlock.endTime = pref.endTime;
                           } else {
                              mergedBlocks.push({ startTime: pref.startTime, endTime: pref.endTime });
                           }
                        }
                     }

                     // 해당 요일의 실제 날짜 계산
                     const targetDayIndex = dayMap2.indexOf(dayName);
                     const currentDayIndex = conflictDate.getDay();
                     let daysToAdd = targetDayIndex - currentDayIndex;
                     if (daysToAdd < 0) daysToAdd += 7;

                     const targetDate = new Date(conflictDate);
                     targetDate.setDate(conflictDate.getDate() + daysToAdd);
                     const targetDateStr = targetDate.toISOString().split('T')[0];
                     const conflictDateStr = conflictDate.toISOString().split('T')[0];
                     const isConflictDate = targetDateStr === conflictDateStr;

                     // 이미 배정받은 시간 제외하고 옵션 생성
                     for (const block of mergedBlocks) {
                        const [startH, startM] = block.startTime.split(':').map(Number);
                        const [endH, endM] = block.endTime.split(':').map(Number);
                        const rangeStartMinutes = startH * 60 + startM;
                        const rangeEndMinutes = endH * 60 + endM;

                        const requiredSlots = cm.requiredSlots || 2;
                        const requiredMinutes = requiredSlots * 30;

                        // 💡 협의 날짜가 아니면 그대로 옵션 생성
                        if (!isConflictDate) {
                           for (let minutes = rangeStartMinutes; minutes + requiredMinutes <= rangeEndMinutes; minutes += requiredMinutes) {
                              const slotEndMinutes = minutes + requiredMinutes;
                              const slotStartTime = `${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`;
                              const slotEndTime = `${Math.floor(slotEndMinutes / 60).toString().padStart(2, '0')}:${(slotEndMinutes % 60).toString().padStart(2, '0')}`;
                              memberOptions.push({ startTime: slotStartTime, endTime: slotEndTime, day: dayName });
                           }
                        }
                     }
                  }

                  negotiation.memberSpecificTimeSlots[memberId] = memberOptions;
               } else {
                  negotiation.memberSpecificTimeSlots[memberId] = [];
               }
            }
            needsSave = true;
         }
      }

      if (needsSave) {
         await room.save();
      }

      // timeSlots의 user._id를 user.id로 변환 (클라이언트 호환성)
      const roomObj = room.toObject();

      if (roomObj.timeSlots && roomObj.timeSlots.length > 0) {
         roomObj.timeSlots.forEach(slot => {
            if (slot.user && slot.user._id) {
               slot.user.id = slot.user._id.toString();
            }
         });
      }

      res.json(roomObj);
   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    Get user's rooms
// @route   GET /api/coordination/my-rooms
// @access  Private
exports.getMyRooms = async (req, res) => {
   try {
      // Rooms where user is owner
      const ownedRooms = await Room.find({ owner: req.user.id })
         .select('name description createdAt maxMembers members inviteCode')
         .populate('members.user', 'firstName lastName email');

      // Rooms where user is a member
      const joinedRooms = await Room.find({
         'members.user': req.user.id,
         owner: { $ne: req.user.id },
      })
         .select('name description createdAt maxMembers members inviteCode')
         .populate('members.user', 'firstName lastName email');

      // Add member count to each room
      const formatRoom = room => ({
         ...room.toObject(),
         memberCount: room.members.length,
      });

      res.json({
         owned: ownedRooms.map(formatRoom),
         joined: joinedRooms.map(formatRoom),
      });
   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    Get counts of pending exchange requests for each room
// @route   GET /api/coordination/rooms/exchange-counts
// @access  Private
exports.getRoomExchangeCounts = async (req, res) => {
   try {
      const userId = req.user.id;

      // Find all rooms where the user is a member or owner
      const userRooms = await Room.find({
         $or: [{ owner: userId }, { 'members.user': userId }],
      }).select('_id requests');

      const roomCounts = {};

      userRooms.forEach(room => {
         const pendingRequests = room.requests.filter(request => {
            return (
               request.status === 'pending' &&
               request.type === 'slot_swap' &&
               request.targetUser &&
               request.targetUser.toString() === userId
            );
         });
         if (pendingRequests.length > 0) {
            roomCounts[room._id.toString()] = pendingRequests.length;
         }
      });

      res.json({ success: true, roomCounts });
   } catch (error) {
      res.status(500).json({ success: false, msg: 'Server error' });
   }
};