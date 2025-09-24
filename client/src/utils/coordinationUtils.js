/**
 * Coordination utilities and helper functions
 */

// Day mappings
export const dayMap = {
  'monday': '월요일', 'tuesday': '화요일', 'wednesday': '수요일',
  'thursday': '목요일', 'friday': '금요일', 'saturday': '토요일', 'sunday': '일요일'
};

export const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

/**
 * Calculate the current week's Monday date
 */
export const getCurrentWeekMonday = () => {
  const today = new Date();
  const day = today.getUTCDay();
  const diff = today.getUTCDate() - day + (day === 0 ? -6 : 1);
  today.setUTCDate(diff);
  today.setUTCHours(0, 0, 0, 0);
  return today.toISOString().split('T')[0]; // Return YYYY-MM-DD format
};

/**
 * Calculate end time based on start time (adds 10 minutes)
 */
export const calculateEndTime = (startTime) => {
  const [hour, minute] = startTime.split(':').map(Number);
  const totalMinutes = hour * 60 + minute + 10; // Changed to 10-minute intervals
  const endHour = Math.floor(totalMinutes / 60);
  const endMinute = totalMinutes % 60;
  return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
};

/**
 * Get hour from various setting formats
 */
export const getHourFromSettings = (setting, defaultValue) => {
  if (!setting) return parseInt(defaultValue);
  if (typeof setting === 'string') return parseInt(setting.split(':')[0]);
  if (typeof setting === 'number') return setting;
  return parseInt(defaultValue);
};

/**
 * Check if user is room owner
 */
export const isRoomOwner = (user, currentRoom) => {
  if (!user?.id || !currentRoom) return false;

  const currentUserId = user.id;
  const roomOwnerId = currentRoom.owner?._id || currentRoom.owner?.id || currentRoom.owner;

  if (roomOwnerId && currentUserId.toString() === roomOwnerId.toString()) {
    return true;
  }
  if (currentRoom.roomMasterId && currentUserId.toString() === currentRoom.roomMasterId._id?.toString()) {
    return true;
  }
  return false;
};

/**
 * Get member display name
 */
export const getMemberDisplayName = (memberData) => {
  return memberData.name || `${memberData.firstName || ''} ${memberData.lastName || ''}`.trim() || '알 수 없음';
};

/**
 * Check if user is current user
 */
export const isCurrentUser = (memberData, user) => {
  return memberData._id === user?.id || memberData.id === user?.id;
};

/**
 * Check if member is room owner
 */
export const isMemberOwner = (memberData, currentRoom) => {
  if (!currentRoom.owner) return false;

  const ownerId = currentRoom.owner._id || currentRoom.owner.id || currentRoom.owner;
  const memberId = memberData._id || memberData.id;
  return ownerId === memberId;
};

/**
 * Get day index from Date object for weekdays (Monday=0, Tuesday=1, etc.)
 */
export const getDayIndex = (date) => {
  const dayOfWeek = date.getUTCDay(); // 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
  // We want Monday=0, Tuesday=1, Wednesday=2, Thursday=3, Friday=4
  if (dayOfWeek === 0) return -1; // Sunday, not valid
  if (dayOfWeek === 6) return -1; // Saturday, not valid
  return dayOfWeek - 1; // Monday(1)->0, Tuesday(2)->1, etc.
};

/**
 * Filter requests by room and status
 */
export const filterRequestsByRoomAndStatus = (requests, roomId, status) => {
  return requests.filter(req => req.roomId === roomId && req.status === status);
};

/**
 * Filter requests by type
 */
export const filterRequestsByType = (requests, types) => {
  return requests.filter(req => types.includes(req.type));
};

/**
 * Count active negotiations in room
 */
export const countActiveNegotiations = (currentRoom) => {
  if (!currentRoom?.negotiations) return 0;

  const activeNegotiations = currentRoom.negotiations.filter(neg => {
    const isActive = neg.status === 'active';
    const hasMembers = neg.conflictingMembers && Array.isArray(neg.conflictingMembers);
    const hasConflict = hasMembers && neg.conflictingMembers.length > 1;

    return isActive && hasMembers && hasConflict;
  });

  return activeNegotiations.length;
};

/**
 * Check if user is involved in negotiation
 */
export const isUserInvolvedInNegotiation = (negotiation, userId) => {
  return negotiation.conflictingMembers?.some(cm =>
    (cm.user._id || cm.user) === userId
  );
};

/**
 * Get member names from negotiation
 */
export const getNegotiationMemberNames = (negotiation) => {
  return negotiation.conflictingMembers?.map(cm => {
    // Use name field first, then firstName/lastName combination
    if (cm.user?.name) {
      return cm.user.name;
    } else if (cm.user?.firstName || cm.user?.lastName) {
      return `${cm.user.firstName || ''} ${cm.user.lastName || ''}`.trim();
    } else {
      return '멤버';
    }
  }).join(', ') || '';
};