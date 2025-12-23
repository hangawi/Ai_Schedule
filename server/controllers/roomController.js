const Room = require('../models/room');
const User = require('../models/user');
const ActivityLog = require('../models/ActivityLog');
const schedulingAlgorithm = require('../services/schedulingAlgorithm');

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

      // 방 금지시간을 방장 프로필에 동기화
      if (settings && settings.blockedTimes && settings.blockedTimes.length > 0) {
         try {
            const owner = await User.findById(req.user.id);
            if (owner) {
               // 기존 방 금지시간 제거 (중복 방지)
               owner.personalTimes = owner.personalTimes.filter(pt => pt.type !== 'room_blocked');
               
               // 새로운 방 금지시간 추가
               settings.blockedTimes.forEach(bt => {
                  owner.personalTimes.push({
                     id: Date.now() + Math.floor(Math.random() * 1000), // 고유 ID 생성
                     type: 'room_blocked',
                     title: bt.name,
                     startTime: bt.startTime,
                     endTime: bt.endTime,
                     days: [1, 2, 3, 4, 5, 6, 7], // 숫자 배열: 1=월요일, 7=일요일
                     isRecurring: true
                  });
               });
               
               await owner.save();
               console.log(`✅ [방 생성] ${settings.blockedTimes.length}개 금지시간을 방장 프로필에 동기화`);
            }
         } catch (syncError) {
            console.error('❌ [방 생성] 금지시간 동기화 실패:', syncError);
            // 동기화 실패해도 방 생성은 성공
         }
      }

      await room.populate('owner', 'firstName lastName email firebaseUid');
      await room.populate('members.user', 'firstName lastName email firebaseUid');

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
         
         // 방 금지시간이 변경되면 방장 프로필에 동기화
         if (settings.blockedTimes !== undefined) {
            try {
               const owner = await User.findById(room.owner);
               if (owner) {
                  // 기존 방 금지시간 제거
                  owner.personalTimes = owner.personalTimes.filter(pt => pt.type !== 'room_blocked');
                  
                  // 새로운 방 금지시간 추가
                  if (settings.blockedTimes && settings.blockedTimes.length > 0) {
                     settings.blockedTimes.forEach(bt => {
                        owner.personalTimes.push({
                           id: Date.now() + Math.floor(Math.random() * 1000), // 고유 ID 생성
                           type: 'room_blocked',
                           title: bt.name,
                           startTime: bt.startTime,
                           endTime: bt.endTime,
                           days: [1, 2, 3, 4, 5, 6, 7], // 숫자 배열: 1=월요일, 7=일요일
                           isRecurring: true
                        });
                     });
                     console.log(`✅ [방 수정] ${settings.blockedTimes.length}개 금지시간을 방장 프로필에 동기화`);
                  } else {
                     console.log(`✅ [방 수정] 금지시간 제거됨 - 방장 프로필에서도 제거`);
                  }
                  
                  // ⚠️ VersionError 방지를 위한 retry 로직
                  let saved = false;
                  for (let attempt = 1; attempt <= 3; attempt++) {
                     try {
                        await owner.save();
                        saved = true;
                        break;
                     } catch (saveError) {
                        if (saveError.name === 'VersionError' && attempt < 3) {
                           console.log(`⚠️ [방 수정] VersionError, 재시도 (${attempt}/3)...`);
                           const freshOwner = await User.findById(room.owner);
                           if (freshOwner) {
                              freshOwner.personalTimes = owner.personalTimes;
                              owner = freshOwner;
                           }
                           await new Promise(resolve => setTimeout(resolve, 100 * attempt));
                        } else {
                           throw saveError;
                        }
                     }
                  }
                  if (!saved) throw new Error('Failed to save owner after retries');
               }
            } catch (syncError) {
               console.error('❌ [방 수정] 금지시간 동기화 실패:', syncError);
               // 동기화 실패해도 방 수정은 성공
            }
         }
      }

      await room.save();

      await room.populate('owner', 'firstName lastName email firebaseUid');
      await room.populate('members.user', 'firstName lastName email firebaseUid');

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
         await room.populate('owner', 'firstName lastName email firebaseUid');
         await room.populate('members.user', 'firstName lastName email firebaseUid');
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

      // 🚀 Phase 2: 조원 입장 시 자동배정 트리거
      // 방장이 한 번이라도 자동배정을 실행한 적이 있어야 함 (timeSlots 존재 여부로 확인)
      const hasRunAutoScheduleBefore = room.timeSlots && room.timeSlots.length > 0;

      console.log('🔍 Auto-schedule check:', {
         hasRunAutoScheduleBefore,
         timeSlotsCount: room.timeSlots?.length || 0,
         newMember: req.user.id
      });

      // Populate with full schedule info for auto-scheduling
      await room.populate('owner', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes priority');
      await room.populate('members.user', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes priority');

      // Check if all members have schedule set before running auto-schedule
      const allMembersHaveSchedule = room.members.every(m =>
         m.user.defaultSchedule && m.user.defaultSchedule.length > 0
      );
      const ownerHasSchedule = room.owner.defaultSchedule && room.owner.defaultSchedule.length > 0;

      console.log('🔍 Schedule check:', {
         ownerHasSchedule,
         allMembersHaveSchedule,
         totalMembers: room.members.length,
         membersWithSchedule: room.members.filter(m => m.user.defaultSchedule?.length > 0).length
      });

      // 방장이 이미 자동배정을 실행한 적이 있고, 모든 조건이 충족되면 자동 재배정
      if (hasRunAutoScheduleBefore && ownerHasSchedule && allMembersHaveSchedule) {
         console.log('✅ Running auto-schedule on member join...');
         try {
            // Run auto-schedule automatically when new member joins
            const membersOnly = room.members.filter(m => {
               const memberId = m.user._id ? m.user._id.toString() : m.user.toString();
               const ownerId = room.owner._id ? room.owner._id.toString() : room.owner.toString();
               return memberId !== ownerId;
            });

            const minHoursPerWeek = room.settings?.minHoursPerWeek || 3;
            const numWeeks = 4;

            // 🔧 Use the same week as the last auto-schedule run
            // Find the earliest date from existing timeSlots (BEFORE filtering) to determine the start week
            let startDate = new Date();
            if (room.timeSlots && room.timeSlots.length > 0) {
               const dates = room.timeSlots
                  .map(slot => new Date(slot.date))
                  .filter(d => !isNaN(d.getTime()));
               if (dates.length > 0) {
                  const earliestDate = new Date(Math.min(...dates));
                  // Get Monday of that week
                  const day = earliestDate.getUTCDay();
                  const diff = earliestDate.getUTCDate() - day + (day === 0 ? -6 : 1);
                  earliestDate.setUTCDate(diff);
                  earliestDate.setUTCHours(0, 0, 0, 0);
                  startDate = earliestDate;
                  console.log('📅 Using existing schedule start date:', startDate.toISOString().split('T')[0]);
               }
            } else {
               console.log('📅 No existing slots, using current date:', startDate.toISOString().split('T')[0]);
            }

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

            // Clear previous auto-generated slots (keep manually assigned slots)
            room.timeSlots = room.timeSlots.filter(slot => {
               // Keep manually assigned slots (no assignedBy)
               if (!slot.assignedBy) return true;
               // Remove auto-generated slots
               return false;
            });

            console.log('🔍 Before runAutoSchedule:', {
               membersOnlyCount: membersOnly.length,
               membersOnlyIds: membersOnly.map(m => m.user._id || m.user),
               ownerHasDefaultSchedule: !!(room.owner.defaultSchedule?.length),
               ownerId: room.owner._id,
               minHoursPerWeek,
               numWeeks,
               remainingTimeSlotsCount: room.timeSlots.length
            });

            const result = await schedulingAlgorithm.runAutoSchedule(
               membersOnly,
               room.owner,
               room.timeSlots,
               {
                  minHoursPerWeek,
                  numWeeks,
                  currentWeek: startDate,
                  ownerPreferences: room.settings.ownerPreferences || {},
                  roomSettings: {
                     ...room.settings,
                     ownerBlockedTimes: ownerBlockedTimes
                  },
               },
               existingCarryOvers,
            );

            console.log('🔍 Auto-schedule result:', {
               hasAssignments: !!result.assignments,
               assignmentCount: result.assignments ? Object.keys(result.assignments).length : 0
            });

            // schedulingAlgorithm returns assignments, not timeSlots directly
            // Process assignments and convert to timeSlots (same logic as coordinationController)
            if (result.assignments) {
               console.log('✅ Auto-schedule successful, processing assignments...');

               // Convert assignments to timeSlots
               const addedSlots = new Set();
               Object.values(result.assignments).forEach(assignment => {
                  if (assignment.slots && assignment.slots.length > 0) {
                     assignment.slots.forEach(slot => {
                        // Validate required fields
                        if (!slot.day || !slot.startTime || !slot.endTime || !slot.date) {
                           return;
                        }

                        // Create unique key to prevent duplicates
                        const slotKey = `${assignment.memberId}-${slot.day}-${slot.startTime}-${slot.endTime}-${new Date(slot.date).toISOString().split('T')[0]}`;

                        if (!addedSlots.has(slotKey)) {
                           const newSlot = {
                              user: assignment.memberId,
                              date: slot.date,
                              startTime: slot.startTime,
                              endTime: slot.endTime,
                              day: slot.day,
                              priority: 3,
                              subject: '자동 배정',
                              assignedBy: room.owner._id,  // Use owner ID, not string
                              assignedAt: new Date(),
                              status: 'confirmed',
                           };

                           room.timeSlots.push(newSlot);
                           addedSlots.add(slotKey);
                        }
                     });
                  }
               });

               console.log('✅ Added', room.timeSlots.length, 'time slots from auto-schedule');

               await room.save();
               console.log('✅ Room saved successfully after auto-schedule');
            } else {
               console.log('⚠️ No assignments returned from auto-schedule');
            }
         } catch (autoScheduleError) {
            console.error('❌ Auto-schedule error on member join:', autoScheduleError);
            console.error('Error stack:', autoScheduleError.stack);
            // Don't fail the join if auto-schedule fails, just log it
         }
      } else {
         console.log('⏭️ Skipping auto-schedule:', {
            hasRunAutoScheduleBefore,
            ownerHasSchedule,
            allMembersHaveSchedule
         });
      }

      // Re-populate with full schedule info for response (needed for frontend to show owner's schedule)
      await room.populate('owner', '_id firstName lastName email defaultSchedule scheduleExceptions personalTimes address addressDetail addressLat addressLng');
      await room.populate('members.user', '_id firstName lastName email defaultSchedule address addressDetail addressLat addressLng');
      await room.populate('timeSlots.user', '_id firstName lastName email');
      await room.populate('requests.requester', '_id firstName lastName email');
      await room.populate('requests.targetUser', '_id firstName lastName email');

      // 활동 로그 기록 - 멤버 입장
      try {
         const joiningUser = await User.findById(req.user.id);
         const userName = joiningUser ? `${joiningUser.firstName} ${joiningUser.lastName}` : 'Unknown';
         await ActivityLog.logActivity(
            room._id,
            req.user.id,
            userName,
            'member_join',
            '방에 입장'
         );
      } catch (logError) {
         console.error('Activity log error:', logError);
      }

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
         .populate('owner', '_id firstName lastName email firebaseUid defaultSchedule scheduleExceptions personalTimes address addressDetail addressLat addressLng')
         .populate('members.user', '_id firstName lastName email firebaseUid defaultSchedule personalTimes address addressDetail addressLat addressLng')
         .populate('timeSlots.user', '_id firstName lastName email firebaseUid')
         .populate('requests.requester', '_id firstName lastName email firebaseUid')
         .populate('requests.targetUser', '_id firstName lastName email firebaseUid');

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      if (!room.isMember(req.user.id) && !room.isOwner(req.user.id)) {
         return res.status(403).json({ msg: '이 방에 접근할 권한이 없습니다.' });
      }

      // Negotiation feature removed

      // timeSlots의 user._id를 user.id로 변환 (클라이언트 호환성)
      const roomObj = room.toObject();

      // 조원은 확정된 이동시간 모드만 볼 수 있음
      const isOwner = room.owner._id.toString() === req.user.id.toString();

      if (roomObj.timeSlots && roomObj.timeSlots.length > 0) {
         // 🆕 조원 프라이버시 보호: 이동시간 슬롯 자체를 제거
         if (!isOwner) {
            roomObj.timeSlots = roomObj.timeSlots.filter(slot => {
               // 이동시간 슬롯이면 제거
               const isTravel = slot.isTravel === true || slot.subject === '이동시간' || slot.subject === 'Travel Time';
               return !isTravel;
            });
         }

         roomObj.timeSlots.forEach(slot => {
            if (slot.user && slot.user._id) {
               slot.user.id = slot.user._id.toString();
            }

            // 🆕 Phase 3: 조원 프라이버시 보호 - 이동시간 메타데이터 숨김 (혹시 필터링 놓친 것 대비)
            if (!isOwner) {
               // 조원에게는 actualStartTime과 travelTimeBefore 절대 노출 금지!
               delete slot.actualStartTime;
               delete slot.travelTimeBefore;
            }
         });
      }

      if (!isOwner) {
         // 조원에게는 travelTimeSlots 노출 (빗금 표시 계산용) - 대신 민감 정보 제거 가능
         // roomObj.travelTimeSlots = []; // <-- REMOVED
         
         if (!roomObj.confirmedAt) {
             // 조원이고 아직 확정 안 된 경우, currentTravelMode 숨김 (필요시 노출 검토)
             // roomObj.currentTravelMode = 'normal';
         }
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
         .populate('owner', 'firstName lastName email firebaseUid')
         .populate('members.user', 'firstName lastName email firebaseUid');

      // Rooms where user is a member
      const joinedRooms = await Room.find({
         'members.user': req.user.id,
         owner: { $ne: req.user.id },
      })
         .select('name description createdAt maxMembers members inviteCode')
         .populate('owner', 'firstName lastName email firebaseUid')
         .populate('members.user', 'firstName lastName email firebaseUid');

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