const Room = require('../models/room');
const User = require('../models/user');

// @desc    Create a new coordination room
// @route   POST /api/coordination/rooms
// @access  Private
exports.createRoom = async (req, res) => {
   try {
      console.log('Backend createRoom: roomData received:', req.body);
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

      console.log('Backend createRoom: new room created (before save):', room);
      await room.save();
      await room.populate('owner', 'firstName lastName email');
      await room.populate('members.user', 'firstName lastName email');
      console.log('Backend createRoom: room saved and populated (before response):', room);

      res.status(201).json(room);
   } catch (error) {
      console.error('Backend createRoom: error:', error);
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    Update room settings
// @route   PUT /api/coordination/rooms/:roomId
// @access  Private (Owner only)
exports.updateRoom = async (req, res) => {
   try {
      console.log('updateRoom called with roomId:', req.params.roomId);
      console.log('updateRoom body:', req.body);
      console.log('updateRoom user:', req.user.id);

      const room = await Room.findById(req.params.roomId);

      if (!room) {
         console.log('Room not found:', req.params.roomId);
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      console.log('Found room:', room.name);
      console.log('Room owner:', room.owner);
      console.log('Is owner check:', room.isOwner(req.user.id));

      // Check if user is owner
      if (!room.isOwner(req.user.id)) {
         console.log('User is not owner');
         return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
      }

      // Update room properties
      const { name, description, maxMembers, settings } = req.body;
      console.log('Updating room with:', { name, description, maxMembers, settings });

      if (name) room.name = name;
      if (description !== undefined) room.description = description;
      if (maxMembers) room.maxMembers = maxMembers;
      if (settings) {
         console.log('Merging settings:', room.settings, settings);
         room.settings = { ...room.settings, ...settings };
      }

      console.log('Saving room...');
      await room.save();
      console.log('Room saved successfully');

      await room.populate('owner', 'firstName lastName email');
      await room.populate('members.user', 'firstName lastName email');

      console.log('Room populated and ready to send');
      res.json(room);
   } catch (error) {
      console.error('Error updating room:', error);
      console.error('Error stack:', error.stack);
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
      console.error('Error deleting room:', error);
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
      console.error('Error joining room:', error);
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    Get room details
// @route   GET /api/coordination/rooms/:roomId
// @access  Private (Members only)
exports.getRoomDetails = async (req, res) => {
   try {
      const room = await Room.findById(req.params.roomId)
         .populate('owner', 'firstName lastName email')
         .populate('members.user', 'firstName lastName email')
         .populate('timeSlots.user', 'firstName lastName email')
         .populate('requests.requester', 'firstName lastName email')
         .populate('requests.targetUser', 'firstName lastName email')
         .populate('negotiations.conflictingMembers.user', 'firstName lastName email name');

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      if (!room.isMember(req.user.id) && !room.isOwner(req.user.id)) {
         return res.status(403).json({ msg: '이 방에 접근할 권한이 없습니다.' });
      }

      console.log('getRoomDetails: Requests count:', room.requests?.length || 0);
      console.log('getRoomDetails: Sample requests:', room.requests?.slice(0, 2).map(req => ({
         id: req._id,
         type: req.type,
         status: req.status,
         requester: req.requester?._id || req.requester,
         targetUser: req.targetUser?._id || req.targetUser
      })));

      console.log('🔍 [DEBUG] getRoomDetails: timeSlots count:', room.timeSlots?.length || 0);
      console.log('🔍 [DEBUG] getRoomDetails: sample timeSlots:', room.timeSlots?.slice(0, 3).map(slot => ({
         user: slot.user?._id || slot.user,
         day: slot.day,
         startTime: slot.startTime,
         endTime: slot.endTime,
         assignedBy: slot.assignedBy ? 'auto' : 'manual'
      })));

      const autoAssignedSlots = room.timeSlots?.filter(slot => slot.subject === '자동 배정') || [];
      const manualSlots = room.timeSlots?.filter(slot => slot.subject !== '자동 배정') || [];
      console.log(`🔍 [DEBUG] getRoomDetails: ${autoAssignedSlots.length}개 자동배정 슬롯, ${manualSlots.length}개 수동 슬롯`);

      res.json(room);
   } catch (error) {
      console.error('Error fetching room details:', error);
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
      console.error('Error fetching user rooms:', error);
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
      console.error('Error fetching room exchange counts:', error);
      res.status(500).json({ success: false, msg: 'Server error' });
   }
};