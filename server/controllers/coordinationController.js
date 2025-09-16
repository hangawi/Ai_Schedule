const mongoose = require('mongoose');
const Room = require('../models/room');
const User = require('../models/user');
const Event = require('../models/event');
const { findOptimalSlots } = require('../services/schedulingAnalysisService');
const schedulingAlgorithm = require('../services/schedulingAlgorithm');
const { OWNER_COLOR, getAvailableColor } = require('../utils/colorUtils');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const dayMap = { 0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday' };

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
      settings: settings || {}
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

// @desc    Update room details (owner only)
// @route   PUT /api/coordination/rooms/:roomId
// @access  Private
exports.updateRoom = async (req, res) => {
  try {
    const { name, description, maxMembers, settings } = req.body;
    
    const room = await Room.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // Check if user is owner
    if (!room.isOwner(req.user.id)) {
      return res.status(403).json({ msg: '방장만 수정할 수 있습니다.' });
    }

    // Update room fields
    if (name && name.trim()) room.name = name.trim();
    if (description !== undefined) room.description = description.trim();
    if (maxMembers && maxMembers >= 2 && maxMembers <= 20) {
      // Check if current members exceed new limit
      if (room.members.length > maxMembers) {
        return res.status(400).json({ msg: `현재 멤버 수(${room.members.length}명)보다 적게 설정할 수 없습니다.` });
      }
      room.maxMembers = maxMembers;
    }
    if (settings) room.settings = { ...room.settings, ...settings };

    await room.save();
    await room.populate('owner', 'firstName lastName email');
    await room.populate('members.user', 'firstName lastName email');

    res.json(room);
  } catch (error) {
    console.error('Error updating room:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Delete room (owner only)
// @route   DELETE /api/coordination/rooms/:roomId
// @access  Private
exports.deleteRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // Check if user is owner
    if (!room.isOwner(req.user.id)) {
      return res.status(403).json({ msg: '방장만 삭제할 수 있습니다.' });
    }

    await Room.findByIdAndDelete(req.params.roomId);
    res.json({ msg: '방이 삭제되었습니다.' });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Join a coordination room
// @route   POST /api/coordination/rooms/:inviteCode/join
// @access  Private
exports.joinRoom = async (req, res) => {
  try {
    const room = await Room.findOne({ inviteCode: req.params.inviteCode.toUpperCase() });
    if (!room) {
      return res.status(404).json({ msg: '초대 코드가 유효하지 않습니다.' });
    }

    // Check if user is the room owner
    if (room.isOwner(req.user.id)) {
      const populatedRoom = await Room.findById(room._id)
        .populate('owner', 'firstName lastName email')
        .populate('members.user', 'firstName lastName email');
      return res.json(populatedRoom);
    }

    // Data cleanup and deduplication
    const existingEntries = room.members.filter(m => m.user && m.user.toString() === req.user.id);
    if (existingEntries.length > 1) {
      room.members = room.members.filter(m => !m.user || m.user.toString() !== req.user.id);
      const existingColors = room.members.map(m => m.color);
      const newColor = getAvailableColor(existingColors);
      room.members.push({ user: req.user.id, color: newColor });
      await room.save();
    }

    // Check room capacity
    if (room.members.length >= room.maxMembers) {
      const isAlreadyMember = room.isMember(req.user.id);
      if (!isAlreadyMember) {
        return res.status(400).json({ msg: '방이 가득 찼습니다.' });
      }
    }

    // Get existing colors before adding new member
    const existingColors = room.members.map(m => m.color);
    const newColor = getAvailableColor(existingColors);
    
    // Add user to members array if not already in it
    const updatedRoom = await Room.findOneAndUpdate(
      { 
        _id: room._id, 
        'members.user': { $ne: req.user.id }
      },
      { 
        $push: { members: { user: req.user.id, color: newColor } }
      },
      { new: true }
    )
    .populate('owner', 'firstName lastName email')
    .populate('members.user', 'firstName lastName email');

    if (updatedRoom) {
      return res.json(updatedRoom);
    }

    // User is already a member, return current room state
    const currentRoom = await Room.findById(room._id)
      .populate('owner', 'firstName lastName email')
      .populate('members.user', 'firstName lastName email');
    res.json(currentRoom);
  } catch (error) {
    console.error('Error joining room:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Get room details
// @route   GET /api/coordination/rooms/:roomId
// @access  Private
exports.getRoomDetails = async (req, res) => {
  try {
    let room = await Room.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // Check if user is a member or owner
    if (!room.isOwner(req.user.id) && !room.isMember(req.user.id)) {
      return res.status(403).json({ msg: '이 방에 접근할 권한이 없습니다.' });
    }

    // Clean up invalid timeSlots (missing date field)
    const originalTimeSlotCount = room.timeSlots.length;
    room.timeSlots = room.timeSlots.filter(slot => slot.date);
    if (originalTimeSlotCount !== room.timeSlots.length) {
      console.log(`정리됨: ${originalTimeSlotCount - room.timeSlots.length}개의 유효하지 않은 timeSlots 제거`);
    }

    // Clean up invalid requests with missing targetSlot.date
    const originalRequestCount = room.requests.length;
    room.requests = room.requests.filter(request =>
      !request.targetSlot || request.targetSlot.date
    );
    if (originalRequestCount !== room.requests.length) {
      console.log(`정리됨: ${originalRequestCount - room.requests.length}개의 유효하지 않은 requests 제거`);
    }

    // Fix owner color to ensure it's different from members
    const ownerMember = room.members.find(member => 
      member.user?.toString() === room.owner?._id?.toString() || 
      member.user?.toString() === room.owner?.toString()
    );
    
    if (ownerMember && ownerMember.color !== OWNER_COLOR) {
      ownerMember.color = OWNER_COLOR;
    }
    
    await room.save();
    
    // Populate all necessary fields
    await room.populate('owner', 'firstName lastName email');
    await room.populate('members.user', 'firstName lastName email');
    await room.populate('timeSlots.user', 'firstName lastName email');
    await room.populate('requests.requester', '_id firstName lastName email');

    res.json(room);
  } catch (error) {
    console.error('Error fetching room details:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Submit time slots for a room
// @route   POST /api/coordination/rooms/:roomId/slots
// @access  Private
exports.submitTimeSlots = async (req, res) => {
  try {
    const { slots } = req.body;
    const room = await Room.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    if (!room.isMember(req.user.id) && !room.isOwner(req.user.id)) {
      return res.status(403).json({ msg: '이 방의 멤버가 아닙니다.' });
    }

    // Handle slot removal if slots array is empty
    if (!slots || slots.length === 0) {
      room.timeSlots = room.timeSlots.filter(slot => slot.user.toString() !== req.user.id);
    } else {
      // Add new slots (only if they don't already exist for this user)
      slots.forEach(slot => {
        const existingSlot = room.timeSlots.find(existing => 
          existing.user.toString() === req.user.id &&
          existing.day === slot.day &&
          existing.startTime === slot.startTime &&
          existing.endTime === slot.endTime
        );
        if (!existingSlot) {
          const newSlot = {
            _id: new mongoose.Types.ObjectId(),
            ...slot,
            user: req.user.id,
            status: 'confirmed'
          };
          room.timeSlots.push(newSlot);
        }
      });
    }

    await room.save();
    await room.populate('timeSlots.user', 'firstName lastName email');
    res.json(room);
  } catch (error) {
    console.error('Error submitting time slots:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Remove a specific time slot
// @route   POST /api/coordination/rooms/:roomId/slots/remove
// @access  Private
exports.removeTimeSlot = async (req, res) => {
  try {
    const { day, startTime, endTime } = req.body;
    const room = await Room.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // Remove the specific slot
    room.timeSlots = room.timeSlots.filter(slot => 
      !(slot.user.toString() === req.user.id &&
        slot.day === day &&
        slot.startTime === startTime &&
        slot.endTime === endTime)
    );

    await room.save();
    res.json({ msg: '시간표가 제거되었습니다.' });
  } catch (error) {
    console.error('Error removing time slot:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Get my rooms
// @route   GET /api/coordination/my-rooms
// @access  Private
exports.getMyRooms = async (req, res) => {
  try {
    const newOwnedRooms = await Room.find({ owner: req.user.id })
      .populate('owner', 'firstName lastName email')
      .populate('members.user', 'firstName lastName email')
      .sort({ createdAt: -1 });
      
    const newJoinedRooms = await Room.find({
      'members.user': req.user.id,
      owner: { $ne: req.user.id }
    })
      .populate('owner', 'firstName lastName email')
      .populate('members.user', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json({
      owned: newOwnedRooms,
      joined: newJoinedRooms
    });
  } catch (error) {
    console.error('Error fetching my rooms:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Assign time slot to user (owner only)
// @route   POST /api/coordination/rooms/:roomId/assign
// @access  Private
exports.assignTimeSlot = async (req, res) => {
  try {
    const { day, startTime, endTime, userId } = req.body;

    if (!day || !startTime || !endTime || !userId) {
      return res.status(400).json({ msg: '필수 필드가 누락되었습니다.' });
    }

    const room = await Room.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    if (!room.isOwner(req.user.id)) {
      return res.status(403).json({ msg: '방장만 시간을 배정할 수 있습니다.' });
    }

    // 배정할 사용자가 방 멤버인지 확인
    const targetMember = room.members.find(member => {
      const memberUserId = member.user?._id || member.user;
      return memberUserId.toString() === userId.toString();
    });

    if (!targetMember) {
      return res.status(400).json({ msg: '해당 사용자는 이 방의 멤버가 아닙니다.' });
    }

    // Remove existing assignment for this slot
    room.timeSlots = room.timeSlots.filter(slot =>
      !(slot.day === day && slot.startTime === startTime && slot.endTime === endTime)
    );

    // Add new assignment
    room.timeSlots.push({
      _id: new mongoose.Types.ObjectId(),
      day,
      startTime,
      endTime,
      subject: '배정된 시간',
      user: new mongoose.Types.ObjectId(userId),
      status: 'assigned'
    });

    await room.save();
    await room.populate([
      { path: 'members.user', select: 'firstName lastName email name' },
      { path: 'timeSlots.user', select: 'firstName lastName email name' },
      { path: 'owner', select: 'firstName lastName email name' }
    ]);

    res.json(room);
  } catch (error) {
    console.error('Error assigning time slot:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Create request
// @route   POST /api/coordination/requests
// @access  Private
exports.createRequest = async (req, res) => {
  try {
    const { roomId, type, timeSlot, targetUserId, message } = req.body;
    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // 중복 요청 체크
    const existingRequest = room.requests.find(request => 
      request.requester.toString() === req.user.id &&
      request.status === 'pending' &&
      request.type === type &&
      request.timeSlot.day === timeSlot.day &&
      request.timeSlot.startTime === timeSlot.startTime &&
      request.timeSlot.endTime === timeSlot.endTime &&
      (targetUserId ? request.targetUserId === targetUserId : true)
    );

    if (existingRequest) {
      return res.status(400).json({ 
        msg: '동일한 시간표에 대한 교환요청이 이미 존재합니다.',
        duplicateRequest: true 
      });
    }

    const newRequest = {
      _id: new mongoose.Types.ObjectId(),
      requester: req.user.id,
      type,
      timeSlot,
      targetUserId,
      message,
      status: 'pending'
    };

    if (type === 'slot_swap') {
      newRequest.targetSlot = req.body.targetSlot; // Assuming targetSlot is sent in req.body
    }

    room.requests.push(newRequest);
    await room.save();
    await room.populate('requests.requester', '_id firstName lastName email');
    res.json(room);
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Handle request (approve/reject)
// @route   POST /api/coordination/requests/:requestId/:action
// @access  Private
exports.handleRequest = async (req, res) => {
  try {
    const { requestId, action } = req.params;
    console.log('=== 교환 요청 처리 시작 ===');
    console.log('requestId:', requestId);
    console.log('action:', action);
    console.log('user:', req.user.id);
    const room = await Room.findOne({ 'requests._id': requestId });

    if (!room) {
      return res.status(404).json({ msg: '요청을 찾을 수 없습니다.' });
    }

    const request = room.requests.id(requestId);
    if (!request) {
      console.log('요청을 찾을 수 없음 - requestId:', requestId);
      console.log('방의 모든 요청들:', room.requests.map(r => ({ id: r._id, type: r.type })));
      return res.status(404).json({ msg: '요청을 찾을 수 없습니다.' });
    }
    
    console.log('찾은 요청:', {
      id: request._id,
      type: request.type,
      status: request.status,
      requester: request.requester,
      targetUserId: request.targetUserId,
      timeSlot: request.timeSlot,
      targetSlot: request.targetSlot
    });

    if (action === 'approved') {
      request.status = 'approved';
      // Handle the request based on type
      if (request.type === 'time_request') {
        // Add the requested time slot
        room.timeSlots.push({
          _id: new mongoose.Types.ObjectId(),
          ...request.timeSlot,
          user: request.requester,
          status: 'confirmed'
        });
      } else if (request.type === 'slot_swap') {
        const requesterSlot = request.timeSlot; // Slot requester wants to give
        const targetSlot = request.targetSlot;   // Slot target user wants to give
        
        // targetSlot 유효성 검사
        if (!targetSlot) {
          console.error('targetSlot이 없습니다:', request);
          request.status = 'failed';
          return res.status(400).json({ msg: '교환 대상 시간대 정보가 없습니다.' });
        }

        console.log('교환 요청 처리 시작:', {
          requestId: requestId,
          requesterId: request.requester,
          targetUserId: request.targetUserId,
          requesterSlot,
          targetSlot
        });
        
        console.log('현재 방의 모든 타임슬롯:', room.timeSlots.map(slot => ({
          day: slot.day,
          startTime: slot.startTime,
          endTime: slot.endTime,
          user: slot.user?.toString(),
          status: slot.status
        })));

        // 양보 개념: 요청자가 원하는 타겟 사용자의 시간대만 찾으면 됨
        const roomTargetSlot = room.timeSlots.find(slot =>
          slot.day === targetSlot.day &&
          slot.startTime === targetSlot.startTime &&
          slot.endTime === targetSlot.endTime &&
          (slot.user.toString() === request.targetUserId || 
           slot.user.toString() === request.targetUserId?.toString() ||
           slot.user === request.targetUserId ||
           slot.user === request.targetUserId?.toString()) // More flexible comparison
        );

        console.log('양보할 슬롯 검색 결과:', {
          roomTargetSlot: roomTargetSlot ? 'found' : 'not found',
          searchCriteria: {
            targetSlot: {
              day: targetSlot.day,
              startTime: targetSlot.startTime,
              endTime: targetSlot.endTime,
              expectedUser: request.targetUserId
            }
          }
        });

        if (roomTargetSlot) {
          console.log('양보 전 상태:', {
            targetSlotUser: roomTargetSlot.user.toString(),
            requesterWhoWantsIt: request.requester.toString()
          });

          // 양보 로직: 타겟의 시간을 요청자에게 넘겨줌 (교환이 아닌 양보)
          roomTargetSlot.user = request.requester;
          
          console.log('양보 완료:', {
            슬롯: `${roomTargetSlot.day} ${roomTargetSlot.startTime}-${roomTargetSlot.endTime}`,
            새소유자: request.requester.toString()
          });

          // Update status to confirmed (양보 시에는 타겟 슬롯만 업데이트)
          roomTargetSlot.status = 'confirmed';

          console.log('양보 후 상태:', {
            양보받은슬롯사용자: roomTargetSlot.user.toString(),
            슬롯상태: roomTargetSlot.status
          });
        } else {
          console.error('양보 실패 - 양보할 슬롯을 찾을 수 없음:', {
            targetSlotFound: !!roomTargetSlot,
            allTimeSlots: room.timeSlots.map(slot => ({
              day: slot.day,
              startTime: slot.startTime,
              endTime: slot.endTime,
              user: slot.user.toString()
            }))
          });
          request.status = 'failed';
          return res.status(400).json({ msg: '양보할 시간대를 찾을 수 없습니다.' });
        }
      }
    } else if (action === 'rejected') {
      request.status = 'rejected';
    }

    await room.save();
    
    // Populate all necessary fields for updated response
    await room.populate('owner', 'firstName lastName email');
    await room.populate('members.user', 'firstName lastName email');
    await room.populate('timeSlots.user', 'firstName lastName email');
    await room.populate('requests.requester', '_id firstName lastName email');

    res.json({ 
      msg: `요청이 ${action === 'approved' ? '승인' : '거절'}되었습니다.`,
      room: room
    });
  } catch (error) {
    console.error('Error handling request:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Get exchange requests count for user
// @route   GET /api/coordination/exchange-requests-count
// @access  Private
exports.getExchangeRequestsCount = async (req, res) => {
  try {
    // Find all rooms where user is a member
    const rooms = await Room.find({
      $or: [
        { owner: req.user.id },
        { 'members.user': req.user.id }
      ]
    });

    let totalExchangeRequests = 0;

    // Count exchange requests targeting this user across all rooms
    rooms.forEach(room => {
      if (room.requests) {
        const userExchangeRequests = room.requests.filter(request =>
          request.status === 'pending' &&
          request.type === 'slot_swap' &&
          (request.targetUserId === req.user.id || 
           request.targetUserId === req.user.email || 
           request.targetUserId?.toString() === req.user.id?.toString())
        );
        totalExchangeRequests += userExchangeRequests.length;
      }
    });

    res.json({ 
      success: true, 
      count: totalExchangeRequests 
    });
  } catch (error) {
    console.error('Error getting exchange requests count:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Get exchange requests count per room (for room-specific badges)
// @route   GET /api/coordination/rooms/exchange-counts  
// @access  Private
exports.getRoomExchangeCounts = async (req, res) => {
  try {
    const rooms = await Room.find({
      $or: [
        { owner: req.user.id },
        { 'members.user': req.user.id }
      ]
    });

    const roomCounts = {};
    rooms.forEach(room => {
      if (room.requests) {
        // Filter for exchange requests targeting this user in this specific room
        const userExchangeRequests = room.requests.filter(request =>
          request.status === 'pending' &&
          request.type === 'slot_swap' &&
          (
            request.targetUserId === req.user.id ||
            request.targetUserId === req.user.email ||
            request.targetUserId?.toString() === req.user.id?.toString()
          )
        );
        roomCounts[room._id.toString()] = userExchangeRequests.length;
      } else {
        roomCounts[room._id.toString()] = 0;
      }
    });

    res.json({
      success: true,
      roomCounts
    });

  } catch (error) {
    console.error('Error getting room exchange counts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get room exchange counts',
      error: error.message
    });
  }
};

// @desc    Get sent requests by user
// @route   GET /api/coordination/sent-requests
// @access  Private
exports.getSentRequests = async (req, res) => {
  try {
    const rooms = await Room.find({
      'members.user': req.user.id
    }).populate('requests.requester', '_id firstName lastName email');

    const sentRequests = [];

    rooms.forEach(room => {
      if (room.requests && room.requests.length > 0) {
        const userSentRequests = room.requests.filter(request => 
          request.requester._id.toString() === req.user.id
        );
        
        userSentRequests.forEach(request => {
          sentRequests.push({
            _id: request._id,
            roomId: room._id,
            roomName: room.name,
            type: request.type,
            timeSlot: request.timeSlot,
            targetSlot: request.targetSlot,
            targetUserId: request.targetUserId,
            message: request.message,
            status: request.status,
            createdAt: request.createdAt
          });
        });
      }
    });

    // 최신순으로 정렬
    sentRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      requests: sentRequests
    });

  } catch (error) {
    console.error('Error getting sent requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get sent requests',
      error: error.message
    });
  }
};

// @desc    Cancel request (only by requester)
// @route   DELETE /api/coordination/requests/:requestId
// @access  Private
exports.cancelRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    
    const room = await Room.findOne({
      'requests._id': requestId
    });

    if (!room) {
      return res.status(404).json({ msg: '요청을 찾을 수 없습니다.' });
    }

    const request = room.requests.id(requestId);
    if (!request) {
      return res.status(404).json({ msg: '요청을 찾을 수 없습니다.' });
    }

    // 요청자 또는 타겟 사용자가 삭제 가능 (처리된 요청 내역 삭제용)
    if (request.requester.toString() !== req.user.id && request.targetUserId?.toString() !== req.user.id) {
      return res.status(403).json({ msg: '관련된 사용자만 요청을 삭제할 수 있습니다.' });
    }

    // 처리된 요청도 내역 삭제 가능하도록 변경

    // 요청 삭제
    room.requests.pull(requestId);
    await room.save();
    await room.populate('requests.requester', '_id firstName lastName email');

    res.json({
      success: true,
      message: '요청이 성공적으로 취소되었습니다.',
      room
    });

  } catch (error) {
    console.error('Error canceling request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel request',
      error: error.message
    });
  }
};


// @desc    Find common available slots using AI
// @route   POST /api/coordination/rooms/:roomId/find-common-slots
// @access  Private (Owner only)
exports.findCommonSlots = async (req, res) => {
  try {
    const { roomId } = req.params;
    const constraints = req.body; // { durationMinutes, timeOfDay, numberOfOptions, dateRange: { start, end } }

    const room = await Room.findById(roomId).populate('members.user', 'id firstName lastName defaultSchedule scheduleExceptions');
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    if (!room.isOwner(req.user.id)) {
      return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
    }

    const memberIds = room.members.map(m => m.user.id);

    const searchStartDate = new Date(constraints.dateRange.start);
    const searchEndDate = new Date(constraints.dateRange.end);

    // Fetch all personal events for all members in the given date range
    const memberEvents = await Event.find({
      user: { $in: memberIds },
      startTime: { $lt: searchEndDate },
      endTime: { $gt: searchStartDate },
    });

    const membersAvailability = room.members.map(member => {
      const user = member.user;
      const userEvents = memberEvents.filter(e => e.user.toString() === user.id.toString());
      
      let availability = [];
      // Iterate through each day in the date range
      for (let d = new Date(searchStartDate); d <= searchEndDate; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        const dateStr = d.toISOString().split('T')[0];

        // Get default slots for the day
        const defaultSlots = user.defaultSchedule.filter(s => s.dayOfWeek === dayOfWeek);

        defaultSlots.forEach(slot => {
          const start = new Date(`${dateStr}T${slot.startTime}:00.000Z`);
          const end = new Date(`${dateStr}T${slot.endTime}:00.000Z`);
          availability.push({ start, end });
        });
      }

      // Subtract exceptions
      user.scheduleExceptions.forEach(exc => {
        const excStart = new Date(exc.startTime);
        const excEnd = new Date(exc.endTime);
        availability = availability.flatMap(slot => {
          // Case 1: Exception covers the whole slot -> remove slot
          if (excStart <= slot.start && excEnd >= slot.end) return [];
          // Case 2: Exception splits the slot -> create two new slots
          if (excStart > slot.start && excEnd < slot.end) return [{ start: slot.start, end: excStart }, { start: excEnd, end: slot.end }];
          // Case 3: Exception truncates the start -> move slot start
          if (excStart <= slot.start && excEnd > slot.start) return [{ start: excEnd, end: slot.end }];
          // Case 4: Exception truncates the end -> move slot end
          if (excStart < slot.end && excEnd >= slot.end) return [{ start: slot.start, end: excStart }];
          // No overlap
          return [slot];
        });
      });

      // Subtract personal events
      userEvents.forEach(event => {
        const eventStart = new Date(event.startTime);
        const eventEnd = new Date(event.endTime);
         availability = availability.flatMap(slot => {
          if (eventStart <= slot.start && eventEnd >= slot.end) return [];
          if (eventStart > slot.start && eventEnd < slot.end) return [{ start: slot.start, end: eventStart }, { start: eventEnd, end: slot.end }];
          if (eventStart <= slot.start && eventEnd > slot.start) return [{ start: eventEnd, end: slot.end }];
          if (eventStart < slot.end && eventEnd >= slot.end) return [{ start: slot.start, end: eventStart }];
          return [slot];
        });
      });

      return {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        availability: availability
      };
    });

    const result = await findOptimalSlots(membersAvailability, constraints);

    res.json(result);

  } catch (error) {
    console.error('Error finding common slots:', error);
    res.status(500).json({ msg: 'Server error while finding common slots' });
  }
};

// @desc    Run auto-scheduling algorithm
// @route   POST /api/coordination/rooms/:roomId/run-schedule
// @access  Private (Owner only)
exports.runAutoSchedule = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { minHoursPerWeek = 3, numWeeks = 4, currentWeek, ownerFocusTime = 'none' } = req.body;
    console.log('자동 배정 요청 - 받은 옵션:', { minHoursPerWeek, numWeeks, currentWeek, ownerFocusTime });
    const startDate = currentWeek ? new Date(currentWeek) : new Date(); // Define startDate here

    const room = await Room.findById(roomId)
      .populate('owner', 'defaultSchedule scheduleExceptions') // Populate owner's defaultSchedule and exceptions
      .populate('members.user', 'defaultSchedule scheduleExceptions'); // Populate members' defaultSchedule and exceptions

    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    if (!room.isOwner(req.user.id)) {
      return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
    }

    // Update owner preferences in room settings
    if (!room.settings.ownerPreferences) {
      room.settings.ownerPreferences = {};
    }
    room.settings.ownerPreferences.focusTimeType = ownerFocusTime;

    // 1. Create deferredAssignments from existing carryOver values
    const deferredAssignments = room.members
      .filter(m => m.carryOver && m.carryOver > 0)
      .map(m => ({
        memberId: m.user._id.toString(),
        neededHours: m.carryOver,
      }));

    console.log('Deferred assignments from carryOver:', deferredAssignments);

    // Filter out the owner from the members list before passing to the algorithm
    const membersOnly = room.members.filter(member => member.user._id.toString() !== room.owner._id.toString());

    let allMemberAvailabilitySlots = [];

    // Helper function to process default schedule and exceptions
    const processUserAvailability = (userObj, userId, startDate, numWeeks) => { // Added startDate, numWeeks
        if (!userObj || !userObj.defaultSchedule) return;

        // Iterate through the scheduling period (numWeeks) to create concrete dates for each default schedule entry
        for (let w = 0; w < numWeeks; w++) {
            const weekStartDate = new Date(startDate);
            weekStartDate.setDate(startDate.getDate() + (w * 7)); // Start of the current week in the scheduling period

            userObj.defaultSchedule.forEach(ds => {
                const dayOfWeek = ds.dayOfWeek; // 0=Sun, 1=Mon, ..., 6=Sat

                // Find the specific date for this dayOfWeek within the current week
                const targetDate = new Date(weekStartDate);
                targetDate.setDate(weekStartDate.getDate() + (dayOfWeek - weekStartDate.getDay() + 7) % 7); // Adjust to the correct day of week

                allMemberAvailabilitySlots.push({
                    user: userId,
                    date: targetDate, // <--- Now includes a concrete Date object
                    day: dayMap[dayOfWeek], // Still include day string for potential other uses
                    startTime: ds.startTime,
                    endTime: ds.endTime,
                    status: 'confirmed',
                    priority: ds.priority || 2
                });
            });
        }
    };

    // Process owner's default schedule
    if (room.owner) {
        processUserAvailability(room.owner, room.owner._id, startDate, numWeeks); // Pass startDate, numWeeks
    }

    // Process members' default schedules
    room.members.forEach(member => {
        if (member.user) {
            processUserAvailability(member.user, member.user._id, startDate, numWeeks); // Pass startDate, numWeeks
        }
    });

    // Filter user-submitted slots for the algorithm input
    // const userSubmittedTimeSlots = room.timeSlots.filter(slot => slot.status === 'confirmed'); // Old line, now replaced by allMemberAvailabilitySlots

    // 2. Pass combined availability to the algorithm
    // Helper function to apply room-level exceptions to availability slots
    const applyRoomExceptions = (slots, roomExceptions) => {
      if (!roomExceptions || roomExceptions.length === 0) return slots;

      let filteredSlots = [...slots];

      roomExceptions.forEach(exception => {
        filteredSlots = filteredSlots.flatMap(slot => {
          if (exception.type === 'daily_recurring') {
            // Check if the slot's dayOfWeek matches the exception's dayOfWeek
            const slotDayOfWeek = slot.date.getDay(); // 0 for Sunday, 1 for Monday, etc.
            if (slotDayOfWeek === exception.dayOfWeek) {
              // Convert slot and exception times to comparable format
              const slotStart = new Date(slot.date);
              slotStart.setHours(parseInt(slot.startTime.split(':')[0]), parseInt(slot.startTime.split(':')[1]), 0, 0);
              const slotEnd = new Date(slot.date);
              slotEnd.setHours(parseInt(slot.endTime.split(':')[0]), parseInt(slot.endTime.split(':')[1]), 0, 0);

              const exceptionStart = new Date(slot.date);
              exceptionStart.setHours(parseInt(exception.startTime.split(':')[0]), parseInt(exception.startTime.split(':')[1]), 0, 0);
              const exceptionEnd = new Date(slot.date);
              exceptionEnd.setHours(parseInt(exception.endTime.split(':')[0]), parseInt(exception.endTime.split(':')[1]), 0, 0);

              // Apply exception logic (similar to scheduleExceptions)
              if (exceptionStart <= slotStart && exceptionEnd >= slotEnd) return [];
              if (exceptionStart > slotStart && exceptionEnd < slotEnd) return [{ ...slot, end: exceptionStart }, { ...slot, start: exceptionEnd }];
              if (exceptionStart <= slotStart && exceptionEnd > slotStart) return [{ ...slot, start: exceptionEnd }];
              if (exceptionStart < slotEnd && exceptionEnd >= slotEnd) return [{ ...slot, end: exceptionStart }];
            }
          } else if (exception.type === 'date_specific') {
            const excStart = new Date(exception.startDate);
            const excEnd = new Date(exception.endDate);

            // Convert slot times to Date objects for comparison
            const slotStart = new Date(slot.date);
            slotStart.setHours(parseInt(slot.startTime.split(':')[0]), parseInt(slot.startTime.split(':')[1]), 0, 0);
            const slotEnd = new Date(slot.date);
            slotEnd.setHours(parseInt(slot.endTime.split(':')[0]), parseInt(slot.endTime.split(':')[1]), 0, 0);

            // Apply exception logic
            if (excStart <= slotStart && excEnd >= slotEnd) return [];
            if (excStart > slotStart && excEnd < slotEnd) return [{ ...slot, end: excStart }, { ...slot, start: excEnd }];
            if (excStart <= slotStart && excEnd > slotStart) return [{ ...slot, start: excEnd }];
            if (excStart < slotEnd && excEnd >= slotEnd) return [{ ...slot, end: excStart }];
          }
          return [slot];
        });
      });
      return filteredSlots;
    };

    // Apply room-level exceptions
    const roomExceptions = room.settings?.roomExceptions || [];
    let finalAvailabilitySlots = applyRoomExceptions(allMemberAvailabilitySlots, roomExceptions);

    console.log('runAutoSchedule: allMemberAvailabilitySlots (input to algorithm):', finalAvailabilitySlots.length, finalAvailabilitySlots);
    console.log('runAutoSchedule: deferredAssignments (input to algorithm):', deferredAssignments);
    const result = schedulingAlgorithm.runAutoSchedule(membersOnly, room.owner, finalAvailabilitySlots, {
      minHoursPerWeek,
      numWeeks,
      currentWeek,
      ownerPreferences: room.settings.ownerPreferences || {}
    }, deferredAssignments);
    console.log('runAutoSchedule: result from algorithm:', result);
    console.log('runAutoSchedule: result.assignments from algorithm:', result.assignments);
    console.log('runAutoSchedule: result.unassignedMembersInfo from algorithm:', result.unassignedMembersInfo);

    // Clear existing auto-assigned slots and apply new ones
    // Keep only user-submitted slots (not auto-assigned ones) and slots with valid date
    const originalSlotsCount = room.timeSlots.length;
    room.timeSlots = room.timeSlots.filter(slot =>
      slot.status === 'confirmed' &&
      slot.subject !== '자동 배정' &&
      slot.date // Only keep slots with valid date field
    );
    console.log(`자동 배정 초기화: ${originalSlotsCount}개 슬롯에서 ${room.timeSlots.length}개 슬롯으로 필터링됨`);
    
    Object.values(result.assignments).forEach(assignment => {
      room.timeSlots.push(...assignment.slots); // Add new auto-assigned slots
    });
    console.log('runAutoSchedule: room.timeSlots after algorithm and before save:', room.timeSlots.length, room.timeSlots);

    // 3. Create a new members array with updated carryOver values
    console.log('이월 시간 계산 시작:', result.unassignedMembersInfo);

    const updatedMembers = room.members.map(member => {
      const memberId = member.user._id.toString();
      const isOwner = room.owner._id.toString() === memberId;

      // 방장은 이월시간 계산에서 제외
      if (isOwner) {
        return {
          ...member.toObject(),
          carryOver: 0,
          carryOverHistory: member.carryOverHistory || [],
          totalProgressTime: member.totalProgressTime || 0,
        };
      }

      const unassignedInfo = result.unassignedMembersInfo.find(info => info.memberId === memberId);
      const previousCarryOver = member.carryOver || 0;

      // Count actual assigned slots for this member from the algorithm result
      let actualAssignedHours = 0;
      Object.values(result.assignments || {}).forEach(assignment => {
        if (assignment.memberId === memberId) {
          actualAssignedHours += assignment.slots.length * 0.5; // Assuming 30-minute slots
        }
      });

      // Calculate how much was needed vs how much was assigned
      // Total needed = minimum hours per week + previous carryover
      const minHoursThisWeek = minHoursPerWeek || 3; // Default to 3 if not specified
      const totalNeeded = minHoursThisWeek + previousCarryOver;
      const remainingCarryOver = Math.max(0, totalNeeded - actualAssignedHours);

      console.log(`Member ${memberId} - 이전 이월: ${previousCarryOver}시간, 실제 할당: ${actualAssignedHours}시간, 총 필요: ${totalNeeded}시간, 남은 이월: ${remainingCarryOver}시간`);
      console.log(`Member ${memberId} - unassignedInfo:`, unassignedInfo);

      // Update carryover history if there's new carryover time
      const carryOverHistory = [...(member.carryOverHistory || [])];
      const newCarryOverFromThisWeek = Math.max(0, remainingCarryOver - previousCarryOver);
      if (newCarryOverFromThisWeek > 0) {
        carryOverHistory.push({
          week: startDate,
          amount: newCarryOverFromThisWeek,
          reason: 'unassigned',
          timestamp: new Date()
        });
      }

      // Calculate total progress time (assigned hours)
      const totalProgressTime = (member.totalProgressTime || 0) + actualAssignedHours;

      return {
        ...member.toObject(), // Convert subdocument to plain object to avoid issues
        carryOver: remainingCarryOver,
        carryOverHistory,
        totalProgressTime,
      };
    });

    // Mark members as modified to ensure Mongoose saves the changes
    room.markModified('members');
    room.members = updatedMembers; // Replace the entire array to ensure Mongoose detects the change

    // 5. Save the updated room
    await room.save();
    
    // After saving, fetch a fresh copy of the room and populate that.
    const freshRoom = await Room.findById(room._id)
        .populate('timeSlots.user', 'firstName lastName email')
        .populate('members.user', 'firstName lastName email name');

    // Generate AI-powered conflict resolution suggestions
    let conflictSuggestions = [];
    if (result.unresolvableConflicts && result.unresolvableConflicts.length > 0) {
      conflictSuggestions = await generateConflictSuggestions(result.unresolvableConflicts, result.unassignedMembersInfo, room.members);

      // Create negotiations for unresolvable conflicts
      // Re-populate room with member details for negotiation creation
      const roomForNegotiations = await Room.findById(room._id)
        .populate('members.user', 'firstName lastName email name')
        .populate('owner', 'firstName lastName email name');
      await createNegotiations(roomForNegotiations, result.unresolvableConflicts);
    }

    res.json({
        room: freshRoom, // Send the fresh copy
        unassignedMembersInfo: result.unassignedMembersInfo,
        conflictSuggestions: conflictSuggestions
    });
    console.log('runAutoSchedule: freshRoom.timeSlots sent in response:', freshRoom.timeSlots.length, freshRoom.timeSlots);

  } catch (error) {
    console.error('Error running auto-schedule:', error);
    res.status(500).json({ msg: '자동 배정 실행 중 서버 오류가 발생했습니다.' });
  }
};

// AI-powered conflict resolution suggestions
async function generateConflictSuggestions(unresolvableConflicts, unassignedMembersInfo, members) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.log('GEMINI_API_KEY not found, skipping AI suggestions');
      return [];
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const conflictDescription = unresolvableConflicts.map((conflict, index) => {
      const availableMembers = conflict.availableMembers.map(memberId => {
        const member = members.find(m => m.user._id.toString() === memberId);
        return member ? (member.user.name || `${member.user.firstName} ${member.user.lastName}`) : '알 수 없음';
      }).join(', ');

      return `충돌 ${index + 1}: ${conflict.date.toLocaleDateString('ko-KR')} - 가능한 멤버: ${availableMembers}`;
    }).join('\n');

    const unassignedDescription = unassignedMembersInfo.map(info => {
      const member = members.find(m => m.user._id.toString() === info.memberId);
      const memberName = member ? (member.user.name || `${member.user.firstName} ${member.user.lastName}`) : '알 수 없음';
      return `${memberName}: ${info.neededHours}시간 부족`;
    }).join('\n');

    const prompt = `
다음은 팀 프로젝트 시간표 조율에서 발생한 충돌 상황입니다:

해결되지 않은 충돌:
${conflictDescription}

시간이 부족한 멤버들:
${unassignedDescription}

이 상황을 해결하기 위한 구체적이고 실용적인 제안을 3가지 해주세요. 각 제안은:
1. 문제 해결 방법
2. 예상되는 결과
3. 구현 난이도 (쉬움/보통/어려움)

제안은 한국어로 작성하고, 실제 팀원들이 따라할 수 있는 구체적인 행동 지침을 포함해주세요.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const suggestions = response.text();

    return [{
      type: 'ai_suggestion',
      title: 'AI 충돌 해결 제안',
      content: suggestions,
      timestamp: new Date()
    }];

  } catch (error) {
    console.error('Error generating conflict suggestions:', error);
    return [{
      type: 'fallback_suggestion',
      title: '기본 충돌 해결 방법',
      content: `
충돌 해결을 위한 제안:

1. **직접 협의**: 해당 시간에 가능한 멤버들끼리 직접 대화하여 조정
2. **우선순위 재조정**: 각 멤버의 선호도를 다시 검토하여 낮은 우선순위 시간으로 이동
3. **추가 시간 검토**: 현재 설정된 시간 외에 다른 시간대도 고려
4. **이월 시스템 활용**: 이번 주에 시간이 부족한 멤버는 다음 주에 우선 배정

방장은 "방 관리"에서 멤버별 일정을 확인하고 수동으로 시간을 배정할 수 있습니다.
      `,
      timestamp: new Date()
    }];
  }
}

// Create negotiations for conflicting time slots
async function createNegotiations(room, unresolvableConflicts) {
  try {
    for (const conflict of unresolvableConflicts) {
      // Check if negotiation already exists for this slot
      const existingNegotiation = room.negotiations.find(neg =>
        neg.status === 'active' &&
        neg.slotInfo.date.toISOString().split('T')[0] === conflict.date.toISOString().split('T')[0] &&
        neg.slotInfo.startTime === conflict.slotKey.split('-')[1]
      );

      if (!existingNegotiation) {
        const dayMap = { 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday' };
        const dayOfWeek = conflict.date.getUTCDay();
        const [startTime] = conflict.slotKey.split('-').slice(-1);
        const [hour, minute] = startTime.split(':').map(Number);
        const endHour = minute === 30 ? hour + 1 : hour;
        const endMinute = minute === 30 ? 0 : 30;
        const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;

        const conflictingMembers = conflict.availableMembers.map(memberId => {
          const member = room.members.find(m => m.user._id.toString() === memberId);
          return {
            user: new mongoose.Types.ObjectId(memberId),
            priority: 3 // Default high priority
          };
        });

        // Generate AI message for negotiation
        const memberNames = conflictingMembers.map(cm => {
          const member = room.members.find(m => m.user._id.toString() === cm.user.toString());
          const memberData = member?.user;
          // Ensure we have the proper user data - check if it's populated or not
          if (memberData && typeof memberData === 'object' && memberData.name) {
            return memberData.name;
          } else if (memberData && typeof memberData === 'object' && (memberData.firstName || memberData.lastName)) {
            return `${memberData.firstName || ''} ${memberData.lastName || ''}`.trim();
          } else {
            // If member data is not populated, find from room members
            const roomMember = room.members.find(m => (m.user._id || m.user).toString() === cm.user.toString());
            if (roomMember && roomMember.user && typeof roomMember.user === 'object') {
              return roomMember.user.name || `${roomMember.user.firstName || ''} ${roomMember.user.lastName || ''}`.trim() || '멤버';
            }
            return '멤버';
          }
        }).join(', ');

        const aiMessage = await generateNegotiationMessage(conflict.date, startTime, endTime, memberNames);

        const negotiation = {
          _id: new mongoose.Types.ObjectId(),
          slotInfo: {
            day: dayMap[dayOfWeek],
            startTime: startTime,
            endTime: endTime,
            date: conflict.date
          },
          conflictingMembers: conflictingMembers.map(cm => ({
            ...cm,
            response: 'pending' // pending, accept, reject
          })),
          messages: [{
            from: room.owner,
            message: aiMessage,
            timestamp: new Date(),
            isSystemMessage: true
          }],
          status: 'active'
        };

        room.negotiations.push(negotiation);
      }
    }

    await room.save();
  } catch (error) {
    console.error('Error creating negotiations:', error);
  }
}

// API endpoint to get negotiations for a room
exports.getNegotiations = async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId)
      .populate('negotiations.conflictingMembers.user', 'firstName lastName email name')
      .populate('negotiations.messages.from', 'firstName lastName email name')
      .populate('negotiations.resolution.assignedTo', 'firstName lastName email name');

    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    if (!room.isOwner(req.user.id) && !room.isMember(req.user.id)) {
      return res.status(403).json({ msg: '이 방에 접근할 권한이 없습니다.' });
    }

    const activeNegotiations = room.negotiations.filter(neg => neg.status === 'active');
    res.json(activeNegotiations);
  } catch (error) {
    console.error('Error getting negotiations:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// API endpoint to add message to negotiation
exports.addNegotiationMessage = async (req, res) => {
  try {
    const { roomId, negotiationId } = req.params;
    const { message } = req.body;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    if (!room.isOwner(req.user.id) && !room.isMember(req.user.id)) {
      return res.status(403).json({ msg: '이 방에 접근할 권한이 없습니다.' });
    }

    const negotiation = room.negotiations.id(negotiationId);
    if (!negotiation) {
      return res.status(404).json({ msg: '협상을 찾을 수 없습니다.' });
    }

    negotiation.messages.push({
      from: req.user.id,
      message: message,
      timestamp: new Date()
    });

    await room.save();

    const updatedRoom = await Room.findById(roomId)
      .populate('negotiations.conflictingMembers.user', 'firstName lastName email name')
      .populate('negotiations.messages.from', 'firstName lastName email name');

    const updatedNegotiation = updatedRoom.negotiations.id(negotiationId);
    res.json(updatedNegotiation);
  } catch (error) {
    console.error('Error adding negotiation message:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// API endpoint to resolve negotiation
exports.resolveNegotiation = async (req, res) => {
  try {
    const { roomId, negotiationId } = req.params;
    const { assignedTo } = req.body;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    if (!room.isOwner(req.user.id)) {
      return res.status(403).json({ msg: '방장만 협상을 해결할 수 있습니다.' });
    }

    const negotiation = room.negotiations.id(negotiationId);
    if (!negotiation) {
      return res.status(404).json({ msg: '협상을 찾을 수 없습니다.' });
    }

    // Assign the time slot
    const { slotInfo } = negotiation;
    room.timeSlots.push({
      _id: new mongoose.Types.ObjectId(),
      day: slotInfo.day,
      date: slotInfo.date,
      startTime: slotInfo.startTime,
      endTime: slotInfo.endTime,
      subject: '협상 해결',
      user: new mongoose.Types.ObjectId(assignedTo),
      status: 'confirmed'
    });

    // Mark negotiation as resolved
    negotiation.status = 'resolved';
    negotiation.resolution = {
      assignedTo: new mongoose.Types.ObjectId(assignedTo),
      resolvedAt: new Date()
    };

    await room.save();
    res.json({ msg: '협상이 해결되었습니다.' });
  } catch (error) {
    console.error('Error resolving negotiation:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Auto-resolve negotiations that have timed out
exports.autoResolveTimeoutNegotiations = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { negotiationTimeoutHours = 24 } = req.body; // Default 24 hours timeout

    const room = await Room.findById(roomId).populate('members.user', 'firstName lastName email name');
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    if (!room.isOwner(req.user.id)) {
      return res.status(403).json({ msg: '방장만 자동 해결을 실행할 수 있습니다.' });
    }

    const now = new Date();
    const timeoutThreshold = new Date(now.getTime() - (negotiationTimeoutHours * 60 * 60 * 1000));

    let resolvedCount = 0;
    const notifications = [];

    for (const negotiation of room.negotiations) {
      if (negotiation.status === 'active' && negotiation.createdAt < timeoutThreshold) {
        // Auto-resolve using random or owner assignment
        const { assignedUserId, assignmentMethod } = await autoAssignSlot(room, negotiation);

        // Assign the time slot
        const { slotInfo } = negotiation;
        room.timeSlots.push({
          _id: new mongoose.Types.ObjectId(),
          day: slotInfo.day,
          date: slotInfo.date,
          startTime: slotInfo.startTime,
          endTime: slotInfo.endTime,
          subject: `자동 배정 (${assignmentMethod})`,
          user: new mongoose.Types.ObjectId(assignedUserId),
          status: 'confirmed'
        });

        // Mark negotiation as resolved
        negotiation.status = 'resolved';
        negotiation.resolution = {
          assignedTo: new mongoose.Types.ObjectId(assignedUserId),
          resolvedAt: new Date()
        };

        // Add auto-resolution message
        negotiation.messages.push({
          from: room.owner,
          message: `협의 시간이 만료되어 자동으로 ${assignmentMethod}에 의해 배정되었습니다.`,
          timestamp: new Date()
        });

        resolvedCount++;

        // Prepare notification data
        const assignedMember = room.members.find(m => m.user._id.toString() === assignedUserId);
        if (assignedMember) {
          notifications.push({
            slotInfo: slotInfo,
            assignedTo: assignedMember.user,
            assignmentMethod: assignmentMethod
          });
        }
      }
    }

    await room.save();

    res.json({
      message: `${resolvedCount}개의 협의가 자동으로 해결되었습니다.`,
      resolvedCount,
      notifications
    });
  } catch (error) {
    console.error('Error auto-resolving negotiations:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Helper function to auto-assign a slot
async function autoAssignSlot(room, negotiation) {
  const conflictingMembers = negotiation.conflictingMembers;

  if (conflictingMembers.length === 0) {
    // No conflicting members, assign to owner
    return {
      assignedUserId: room.owner.toString(),
      assignmentMethod: '방장 배정'
    };
  }

  if (conflictingMembers.length === 1) {
    // Only one member, assign to them
    return {
      assignedUserId: conflictingMembers[0].user.toString(),
      assignmentMethod: '단독 배정'
    };
  }

  // Multiple members - use priority or random assignment
  // Sort by priority (higher priority first)
  const sortedMembers = [...conflictingMembers].sort((a, b) => b.priority - a.priority);

  // If there's a clear priority winner
  if (sortedMembers[0].priority > sortedMembers[1].priority) {
    return {
      assignedUserId: sortedMembers[0].user.toString(),
      assignmentMethod: '우선순위 배정'
    };
  }

  // Random assignment among members with same highest priority
  const highestPriority = sortedMembers[0].priority;
  const topPriorityMembers = sortedMembers.filter(m => m.priority === highestPriority);
  const randomIndex = Math.floor(Math.random() * topPriorityMembers.length);

  return {
    assignedUserId: topPriorityMembers[randomIndex].user.toString(),
    assignmentMethod: '랜덤 배정'
  };
}

// Manual trigger for negotiation timeout resolution
exports.forceResolveNegotiation = async (req, res) => {
  try {
    const { roomId, negotiationId } = req.params;
    const { method = 'random' } = req.body; // 'random', 'owner', or 'priority'

    const room = await Room.findById(roomId).populate('members.user', 'firstName lastName email name');
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    if (!room.isOwner(req.user.id)) {
      return res.status(403).json({ msg: '방장만 강제 해결을 실행할 수 있습니다.' });
    }

    const negotiation = room.negotiations.id(negotiationId);
    if (!negotiation) {
      return res.status(404).json({ msg: '협상을 찾을 수 없습니다.' });
    }

    if (negotiation.status !== 'active') {
      return res.status(400).json({ msg: '이미 해결된 협상입니다.' });
    }

    let assignedUserId;
    let assignmentMethod;

    if (method === 'owner') {
      assignedUserId = room.owner.toString();
      assignmentMethod = '방장 지정';
    } else if (method === 'priority') {
      const result = await autoAssignSlot(room, negotiation);
      assignedUserId = result.assignedUserId;
      assignmentMethod = '우선순위 지정';
    } else {
      // Random assignment
      const conflictingMembers = negotiation.conflictingMembers;
      if (conflictingMembers.length > 0) {
        const randomIndex = Math.floor(Math.random() * conflictingMembers.length);
        assignedUserId = conflictingMembers[randomIndex].user.toString();
        assignmentMethod = '랜덤 지정';
      } else {
        assignedUserId = room.owner.toString();
        assignmentMethod = '방장 지정 (대체)';
      }
    }

    // Assign the time slot
    const { slotInfo } = negotiation;
    room.timeSlots.push({
      _id: new mongoose.Types.ObjectId(),
      day: slotInfo.day,
      date: slotInfo.date,
      startTime: slotInfo.startTime,
      endTime: slotInfo.endTime,
      subject: `강제 배정 (${assignmentMethod})`,
      user: new mongoose.Types.ObjectId(assignedUserId),
      status: 'confirmed'
    });

    // Mark negotiation as resolved
    negotiation.status = 'resolved';
    negotiation.resolution = {
      assignedTo: new mongoose.Types.ObjectId(assignedUserId),
      resolvedAt: new Date()
    };

    // Add resolution message
    negotiation.messages.push({
      from: room.owner,
      message: `방장에 의해 ${assignmentMethod}으로 강제 배정되었습니다.`,
      timestamp: new Date()
    });

    await room.save();

    const assignedMember = room.members.find(m => m.user._id.toString() === assignedUserId);

    res.json({
      message: '협의가 강제로 해결되었습니다.',
      assignedTo: assignedMember?.user,
      assignmentMethod
    });
  } catch (error) {
    console.error('Error force resolving negotiation:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Generate AI-powered negotiation message
async function generateNegotiationMessage(date, startTime, endTime, memberNames) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
일정 조율 시스템에서 시간 충돌이 발생했습니다.

상황:
- 날짜: ${date.toLocaleDateString('ko-KR')}
- 시간: ${startTime}-${endTime}
- 충돌한 멤버들: ${memberNames}

위 멤버들이 같은 시간대를 원하고 있어서 협의가 필요합니다.
친근하면서도 정중한 톤으로 협의를 요청하는 메시지를 작성해주세요.
메시지에는 다음 내용이 포함되어야 합니다:
1. 시간 충돌 상황 설명
2. 협의 필요성 안내
3. 수락/거절 선택 안내 (한 명이 양보하면 해결됨)
4. 모두 거절 시 이월 처리 안내

150자 이내로 작성해주세요.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error('Error generating negotiation message:', error);
    return `${date.toLocaleDateString('ko-KR')} ${startTime}-${endTime} 시간에 ${memberNames}님들의 일정이 겹쳤습니다. 협의해주세요. 한 분이 양보하시거나, 모두 거절하시면 이월됩니다.`;
  }
}

// API endpoint to respond to negotiation
exports.respondToNegotiation = async (req, res) => {
  try {
    const { roomId, negotiationId } = req.params;
    const { response } = req.body; // 'accept' or 'reject'

    const room = await Room.findById(roomId).populate('members.user', 'firstName lastName email name');
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // Check if user is member or owner
    const isOwner = room.isOwner(req.user.id);
    const isMember = room.isMember(req.user.id);


    if (!isOwner && !isMember) {
      return res.status(403).json({ msg: '이 방의 멤버만 협의에 참여할 수 있습니다.' });
    }

    const negotiation = room.negotiations.id(negotiationId);
    if (!negotiation) {
      return res.status(404).json({ msg: '협의를 찾을 수 없습니다.' });
    }

    if (negotiation.status !== 'active') {
      return res.status(400).json({ msg: '이미 해결된 협의입니다.' });
    }

    // Update user's response
    const memberResponse = negotiation.conflictingMembers.find(
      cm => cm.user.toString() === req.user.id
    );

    if (!memberResponse) {
      return res.status(403).json({ msg: '이 협의에 참여할 권한이 없습니다.' });
    }

    memberResponse.response = response;

    // Add message about the response
    const user = room.members.find(m => m.user._id.toString() === req.user.id);
    const userName = user?.user?.name || user?.user?.firstName || '멤버';

    negotiation.messages.push({
      from: req.user.id,
      message: `${userName}님이 ${response === 'accept' ? '양보' : '거절'}하셨습니다.`,
      timestamp: new Date()
    });

    // Check if negotiation should be resolved
    const responses = negotiation.conflictingMembers.map(cm => cm.response);
    const acceptCount = responses.filter(r => r === 'accept').length;
    const rejectCount = responses.filter(r => r === 'reject').length;
    const pendingCount = responses.filter(r => r === 'pending').length;

    if (pendingCount === 0) {
      // All members have responded
      if (acceptCount === 1 && rejectCount === responses.length - 1) {
        // One accept, others reject - assign to the one who rejected (others gave up)
        const acceptingMember = negotiation.conflictingMembers.find(cm => cm.response === 'accept');
        const rejectingMembers = negotiation.conflictingMembers.filter(cm => cm.response === 'reject');

        // Assign to one of the rejecting members (they get the slot, accepting member gave up)
        const assignedMember = rejectingMembers[0];

        // Assign the time slot
        const { slotInfo } = negotiation;
        room.timeSlots.push({
          _id: new mongoose.Types.ObjectId(),
          day: slotInfo.day,
          date: slotInfo.date,
          startTime: slotInfo.startTime,
          endTime: slotInfo.endTime,
          subject: '협의 해결',
          user: new mongoose.Types.ObjectId(assignedMember.user),
          status: 'confirmed'
        });

        // Mark negotiation as resolved
        negotiation.status = 'resolved';
        negotiation.resolution = {
          assignedTo: new mongoose.Types.ObjectId(assignedMember.user),
          resolvedAt: new Date()
        };

        negotiation.messages.push({
          from: room.owner,
          message: `협의가 완료되어 ${rejectingMembers.map(rm => {
            const member = room.members.find(m => m.user._id.toString() === rm.user.toString());
            return member?.user?.name || member?.user?.firstName || '멤버';
          })[0]}님에게 배정되었습니다.`,
          timestamp: new Date(),
          isSystemMessage: true
        });

      } else if (rejectCount === responses.length) {
        // All rejected - carry over to next period
        negotiation.status = 'resolved';
        negotiation.resolution = {
          assignedTo: null,
          resolvedAt: new Date(),
          carryOver: true
        };

        // Add carry over time to all conflicting members
        const carryOverHours = 0.5; // Assuming 30-minute slots
        negotiation.conflictingMembers.forEach(cm => {
          const member = room.members.find(m => m.user._id.toString() === cm.user.toString());
          if (member) {
            member.carryOver = (member.carryOver || 0) + carryOverHours;

            // Add to carryover history
            if (!member.carryOverHistory) {
              member.carryOverHistory = [];
            }
            member.carryOverHistory.push({
              week: new Date(negotiation.slotInfo.date),
              amount: carryOverHours,
              reason: 'negotiation_rejected',
              timestamp: new Date()
            });
          }
        });

        negotiation.messages.push({
          from: room.owner,
          message: `모든 멤버가 거절하여 해당 시간이 이월되었습니다.`,
          timestamp: new Date(),
          isSystemMessage: true
        });
      }
    }

    await room.save();

    const updatedRoom = await Room.findById(roomId)
      .populate('negotiations.conflictingMembers.user', 'firstName lastName email name')
      .populate('negotiations.messages.from', 'firstName lastName email name');

    const updatedNegotiation = updatedRoom.negotiations.id(negotiationId);
    res.json({
      negotiation: updatedNegotiation,
      room: updatedRoom
    });
  } catch (error) {
    console.error('Error responding to negotiation:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

