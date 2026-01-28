const mongoose = require('mongoose');

const ChatMessageSchema = new mongoose.Schema({
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'system', 'suggestion', 'file', 'ai-suggestion'], // ai-suggestion: AI 일정 제안 알림 (클릭 가능)
    default: 'text'
  },
  suggestionData: {
    // AI가 제안한 일정 데이터 (날짜, 시간 등)
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  // AI 제안 메시지와 연결된 ScheduleSuggestion ID
  suggestionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduleSuggestion',
    default: null
  },
  // 파일 메시지 관련 필드
  fileUrl: {
    type: String,
    default: null
  },
  fileName: {
    type: String,
    default: null
  },
  fileType: {
    type: String,
    default: null
  },
  fileSize: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 인덱스: 특정 방의 메시지를 시간순으로 빠르게 조회
ChatMessageSchema.index({ room: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);
