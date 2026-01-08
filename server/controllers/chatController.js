const ChatMessage = require('../models/ChatMessage');
const Room = require('../models/room');
const aiScheduleService = require('../services/aiScheduleService');

// @desc    Get chat history
// @route   GET /api/chat/:roomId
// @access  Private
exports.getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, before } = req.query;

    const query = { room: roomId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await ChatMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('sender', 'firstName lastName email');

    res.json(messages.reverse());
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Send a message
// @route   POST /api/chat/:roomId
// @access  Private
exports.sendMessage = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { content, type = 'text' } = req.body;
    const userId = req.user.id;

    // 1. Save Message
    const message = new ChatMessage({
      room: roomId,
      sender: userId,
      content,
      type
    });
    await message.save();
    
    // Update Room's lastMessageAt
    await Room.findByIdAndUpdate(roomId, { lastMessageAt: new Date() });
    
    // Populate sender info for frontend
    await message.populate('sender', 'firstName lastName email');

    // 2. Broadcast via Socket
    if (global.io) {
      global.io.to(`room-${roomId}`).emit('chat-message', message);
    }

    // 3. Trigger AI Analysis (Async - don't wait)
    // Only analyze for text messages
    if (type === 'text') {
      aiScheduleService.analyzeConversation(roomId).catch(err => {
        console.error('AI Analysis Trigger Error:', err);
      });
    }

    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Confirm suggested schedule
// @route   POST /api/chat/:roomId/confirm
// @access  Private
exports.confirmSchedule = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { date, startTime, endTime, summary } = req.body;
    const userId = req.user.id;

    // 1. Create TimeSlot
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ msg: 'Room not found' });

    // 요일 계산
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = dayNames[new Date(date).getDay()];

    const newSlot = {
      user: userId, // 확정한 사람을 할당자로? 혹은 빈 배정? -> 여기서는 확정된 일정이므로 'confirmed' 상태로 모두에게 보이면 됨.
      // 하지만 Room 스키마 구조상 user 필드가 필수일 수 있음. 보통은 '공통 일정' 개념이 필요하지만,
      // 현재 구조에서는 assignedBy(확정자)와 user(대상)가 있음.
      // 공통 일정이라면 모든 멤버에게 슬롯을 추가하거나, '공통' 표시가 필요함.
      // 여기서는 일단 확정자를 user로 등록하거나, 또는 별도의 로직이 필요.
      // *간소화를 위해 확정자를 user로 등록하고, subject에 [공통] 태그 추가.*
      user: userId,
      date: new Date(date),
      day: dayOfWeek,
      startTime,
      endTime,
      subject: `[확정] ${summary}`,
      status: 'confirmed',
      assignedBy: userId,
      assignedAt: new Date()
    };

    room.timeSlots.push(newSlot);
    await room.save();

    // 2. Broadcast System Message
    const systemMsg = new ChatMessage({
      room: roomId,
      sender: userId, // or system
      content: `📅 일정이 확정되었습니다: ${date} ${startTime}~${endTime} (${summary})`,
      type: 'system'
    });
    await systemMsg.save();
    await systemMsg.populate('sender', 'firstName lastName');

    if (global.io) {
      global.io.to(`room-${roomId}`).emit('chat-message', systemMsg);
      global.io.to(`room-${roomId}`).emit('schedule-confirmed-refresh'); // 클라이언트가 일정표 새로고침하도록
    }

    res.json({ success: true, slot: newSlot });

  } catch (error) {
    console.error('Confirm schedule error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Mark room messages as read
// @route   POST /api/chat/:roomId/read
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    await Room.updateOne(
      { _id: roomId, 'members.user': userId },
      { $set: { 'members.$.lastReadAt': new Date() } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};
