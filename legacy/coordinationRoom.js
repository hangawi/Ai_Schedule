const mongoose = require('mongoose');
const crypto = require('crypto');

const CoordinationRoomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, '방 이름은 필수입니다.'],
    trim: true,
    maxlength: 100
  },
  roomMasterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  inviteCode: {
    type: String,
    default: () => crypto.randomBytes(4).toString('hex'), // 8-char hex string
    unique: true,
    index: true
  },
  settings: {
    scheduleStart: { type: String, default: '09:00' },
    scheduleEnd: { type: String, default: '18:00' },
    lunchStart: { type: String, default: '12:00' },
    lunchEnd: { type: String, default: '13:00' },
    maxMembers: { type: Number, default: 10, max: 50 }
  },
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Limit the number of members
CoordinationRoomSchema.path('members').validate(function(value) {
  if (this.settings && typeof this.settings.maxMembers === 'number') {
    return value.length <= this.settings.maxMembers;
  }
  return true;
}, '멤버 정원을 초과할 수 없습니다.');

module.exports = mongoose.model('CoordinationRoom', CoordinationRoomSchema);
