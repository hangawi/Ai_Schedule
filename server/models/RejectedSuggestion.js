const mongoose = require('mongoose');

/**
 * 거절된 AI 일정 제안 모델
 *
 * 목적: 사용자가 거절한 일정 제안을 기록하여 중복 제안 방지
 */
const rejectedSuggestionSchema = new mongoose.Schema({
  // 방 ID
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
    index: true
  },

  // 거절된 제안 내용
  suggestion: {
    summary: {
      type: String,
      required: true
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true
    },
    startTime: {
      type: String, // HH:MM
      required: true
    },
    endTime: {
      type: String, // HH:MM
      required: true
    },
    location: {
      type: String,
      default: ''
    }
  },

  // 거절한 사용자 (선택적)
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // 거절 시간
  rejectedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// 복합 인덱스: 같은 방에서 같은 날짜/시간의 제안을 빠르게 조회
rejectedSuggestionSchema.index({
  room: 1,
  'suggestion.date': 1,
  'suggestion.startTime': 1
});

/**
 * 특정 제안이 이미 거절되었는지 확인
 * @param {string} roomId - 방 ID
 * @param {object} suggestion - 제안 내용 {date, startTime, summary}
 * @returns {boolean} 거절된 제안이면 true
 */
rejectedSuggestionSchema.statics.isRejected = async function(roomId, suggestion) {
  const rejected = await this.findOne({
    room: roomId,
    'suggestion.date': suggestion.date,
    'suggestion.startTime': suggestion.startTime,
    'suggestion.summary': suggestion.summary
  });

  return !!rejected;
};

/**
 * 오래된 거절 내역 삭제 (7일 이상 지난 것)
 * 정기적으로 실행하여 DB 정리
 */
rejectedSuggestionSchema.statics.cleanOldRejections = async function() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const result = await this.deleteMany({
    rejectedAt: { $lt: sevenDaysAgo }
  });

  console.log(`🗑️ [RejectedSuggestion] Cleaned ${result.deletedCount} old rejections`);
  return result.deletedCount;
};

const RejectedSuggestion = mongoose.model('RejectedSuggestion', rejectedSuggestionSchema);

module.exports = RejectedSuggestion;
