const mongoose = require('mongoose');
const Room = require('../models/room');
const User = require('../models/user');
const Event = require('../models/event');
const { findOptimalSlots } = require('../services/schedulingAnalysisService');
const schedulingAlgorithm = require('../services/schedulingAlgorithm');
const { OWNER_COLOR, getAvailableColor } = require('../utils/colorUtils');

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
    const room = await Room.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    if (!room.isOwner(req.user.id)) {
      return res.status(403).json({ msg: '방장만 시간을 배정할 수 있습니다.' });
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
      user: userId,
      status: 'assigned'
    });

    await room.save();
    await room.populate('timeSlots.user', 'firstName lastName email');
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
    const { minHoursPerWeek = 3, numWeeks = 4, currentWeek } = req.body;
    console.log('자동 배정 요청 - 받은 옵션:', { minHoursPerWeek, numWeeks, currentWeek });
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

    // 1. Create deferredAssignments from existing carryOver values
    const deferredAssignments = room.members
      .filter(m => m.carryOver && m.carryOver > 0)
      .map(m => ({
        memberId: m.user._id.toString(),
        neededHours: m.carryOver,
      }));

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
    const result = schedulingAlgorithm.runAutoSchedule(membersOnly, room.owner, finalAvailabilitySlots, { minHoursPerWeek, numWeeks, currentWeek }, deferredAssignments);
    console.log('runAutoSchedule: result from algorithm:', result);
    console.log('runAutoSchedule: result.assignments from algorithm:', result.assignments);
    console.log('runAutoSchedule: result.unassignedMembersInfo from algorithm:', result.unassignedMembersInfo);

    // Clear existing auto-assigned slots and apply new ones
    // Keep only user-submitted slots (not auto-assigned ones)
    const originalSlotsCount = room.timeSlots.length;
    room.timeSlots = room.timeSlots.filter(slot => 
      slot.status === 'confirmed' && slot.subject !== '자동 배정'
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
      const unassignedInfo = result.unassignedMembersInfo.find(info => info.memberId === memberId);
      const carryOverHours = unassignedInfo ? Math.max(0, unassignedInfo.neededHours) : 0;
      console.log(`Member ${memberId} - 이월시간: ${carryOverHours}시간, 기존 이월: ${member.carryOver || 0}시간`);
      return {
        ...member.toObject(), // Convert subdocument to plain object to avoid issues
        carryOver: carryOverHours,
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

    res.json({
        room: freshRoom, // Send the fresh copy
        unassignedMembersInfo: result.unassignedMembersInfo
    });
    console.log('runAutoSchedule: freshRoom.timeSlots sent in response:', freshRoom.timeSlots.length, freshRoom.timeSlots);

  } catch (error) {
    console.error('Error running auto-schedule:', error);
    res.status(500).json({ msg: '자동 배정 실행 중 서버 오류가 발생했습니다.' });
  }
};

