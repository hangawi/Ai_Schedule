/**
 * ===================================================================================================
 * coordinationUtils.js - 조율(Coordination) 기능과 관련된 다양한 헬퍼 및 유틸리티 함수 모음
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/utils/coordinationUtils.js
 *
 * 🎯 주요 기능:
 *    - 요일 관련 데이터 및 매핑(`dayMap`, `days`).
 *    - 현재 주의 월요일 날짜 계산 (`getCurrentWeekMonday`).
 *    - 시간 계산 (10분 후 시간 계산) (`calculateEndTime`).
 *    - 설정 객체에서 시간(hour) 추출 (`getHourFromSettings`).
 *    - 사용자 역할 확인 (방장 여부, 현재 사용자 여부 등) (`isRoomOwner`, `isCurrentUser`, `isMemberOwner`).
 *    - 멤버의 표시 이름 생성 (`getMemberDisplayName`).
 *    - 날짜 객체에서 평일 인덱스 추출 (`getDayIndex`).
 *    - 요청 목록 필터링 (`filterRequestsByRoomAndStatus`, `filterRequestsByType`).
 *
 * 🔗 연결된 파일:
 *    - ./coordinationHandlers.js: `createChangeRequestData`에서 `days`, `getDayIndex`, `calculateEndTime` 사용.
 *    - ../components/tabs/CoordinationTab/: 조율 탭의 다양한 UI 컴포넌트에서 사용자 역할 확인 및 데이터 표시를 위해 사용.
 *    - ../components/modals/RequestManagement.js: 요청 목록 필터링에 사용.
 *
 * 💡 UI 위치:
 *    - 조율 탭의 캘린더, 멤버 목록, 요청 관리 등 다양한 곳에서 데이터를 계산하고, 사용자 권한을 확인하며, 정보를 올바르게 표시하기 위한 백그라운드 로직으로 사용됨.
 *
 * ✏️ 수정 가이드:
 *    - 요일 체계(예: 주 시작을 일요일로 변경)가 바뀔 경우: `dayMap`, `days`, `getCurrentWeekMonday`, `getDayIndex` 함수를 수정.
 *    - 시간 슬롯의 기본 간격이 10분이 아닐 경우: `calculateEndTime` 함수를 수정.
 *    - 사용자 역할(방장 등)을 확인하는 기준이 변경될 경우: `isRoomOwner`, `isMemberOwner` 함수의 ID 비교 로직을 수정.
 *
 * 📝 참고사항:
 *    - `getDayIndex`는 주말(토,일)을 제외하고 평일(월~금)에 대해서만 유효한 인덱스(0~4)를 반환.
 *    - `isRoomOwner`는 `currentRoom.owner` 필드가 ObjectId 객체이거나 문자열 ID일 경우를 모두 처리.
 *
 * ===================================================================================================
 */

// Day mappings
export const dayMap = {
  'monday': '월요일', 'tuesday': '화요일', 'wednesday': '수요일',
  'thursday': '목요일', 'friday': '금요일', 'saturday': '토요일', 'sunday': '일요일'
};

export const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

/**
 * getCurrentWeekMonday
 * @description 오늘 날짜를 기준으로 현재 주의 월요일 날짜를 'YYYY-MM-DD' 형식의 문자열로 반환합니다.
 * @returns {string} 'YYYY-MM-DD' 형식의 날짜 문자열.
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
 * calculateEndTime
 * @description 주어진 시작 시간에서 10분을 더한 종료 시간을 계산합니다.
 * @param {string} startTime - HH:MM 형식의 시작 시간.
 * @returns {string} HH:MM 형식의 종료 시간.
 */
export const calculateEndTime = (startTime) => {
  const [hour, minute] = startTime.split(':').map(Number);
  const totalMinutes = hour * 60 + minute + 10; // Changed to 10-minute intervals
  const endHour = Math.floor(totalMinutes / 60);
  const endMinute = totalMinutes % 60;
  return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
};

/**
 * getHourFromSettings
 * @description 다양한 형식의 설정 값에서 시간(hour)을 정수로 추출합니다.
 * @param {string|number} setting - 시간 설정 값 (예: "09:00" 또는 9).
 * @param {string|number} defaultValue - 설정 값이 없을 경우 사용할 기본값.
 * @returns {number} 추출된 시간(hour).
 */
export const getHourFromSettings = (setting, defaultValue) => {
  if (!setting) return parseInt(defaultValue);
  if (typeof setting === 'string') return parseInt(setting.split(':')[0]);
  if (typeof setting === 'number') return setting;
  return parseInt(defaultValue);
};

/**
 * isRoomOwner
 * @description 현재 로그인된 사용자가 주어진 방의 방장인지 확인합니다.
 * @param {object} user - 현재 사용자 정보 객체.
 * @param {object} currentRoom - 현재 방 정보 객체.
 * @returns {boolean} 방장 여부.
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
 * getMemberDisplayName
 * @description 멤버 객체에서 표시할 이름을 생성합니다. (이름 + 성)
 * @param {object} memberData - 멤버 정보 객체.
 * @returns {string} "이름 성" 형식의 문자열. 이름이 없으면 '알 수 없음'을 반환.
 */
export const getMemberDisplayName = (memberData) => {
  return `${memberData.firstName || ''} ${memberData.lastName || ''}`.trim() || '알 수 없음';
};

/**
 * isCurrentUser
 * @description 주어진 멤버가 현재 로그인된 사용자인지 확인합니다.
 * @param {object} memberData - 확인할 멤버 정보 객체.
 * @param {object} user - 현재 사용자 정보 객체.
 * @returns {boolean} 현재 사용자와 일치하는지 여부.
 */
export const isCurrentUser = (memberData, user) => {
  return memberData._id === user?.id || memberData.id === user?.id;
};

/**
 * isMemberOwner
 * @description 주어진 멤버가 방장인지 확인합니다.
 * @param {object} memberData - 확인할 멤버 정보 객체.
 * @param {object} currentRoom - 현재 방 정보 객체.
 * @returns {boolean} 방장 여부.
 */
export const isMemberOwner = (memberData, currentRoom) => {
  if (!currentRoom.owner) return false;

  const ownerId = currentRoom.owner._id || currentRoom.owner.id || currentRoom.owner;
  const memberId = memberData._id || memberData.id;
  return ownerId === memberId;
};

/**
 * getDayIndex
 * @description Date 객체에서 평일 인덱스를 가져옵니다. (월요일=0, ... 금요일=4). 주말은 -1을 반환합니다.
 * @param {Date} date - 날짜 객체.
 * @returns {number} 0~4 사이의 평일 인덱스 또는 -1.
 */
export const getDayIndex = (date) => {
  const dayOfWeek = date.getUTCDay(); // 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
  // We want Monday=0, Tuesday=1, Wednesday=2, Thursday=3, Friday=4
  if (dayOfWeek === 0) return -1; // Sunday, not valid
  if (dayOfWeek === 6) return -1; // Saturday, not valid
  return dayOfWeek - 1; // Monday(1)->0, Tuesday(2)->1, etc.
};

/**
 * filterRequestsByRoomAndStatus
 * @description 요청 목록에서 특정 방 ID와 상태에 해당하는 요청들만 필터링합니다.
 * @param {Array<object>} requests - 필터링할 전체 요청 목록.
 * @param {string} roomId - 필터링할 방의 ID.
 * @param {string} status - 필터링할 요청의 상태 (예: 'pending').
 * @returns {Array<object>} 필터링된 요청 목록.
 */
export const filterRequestsByRoomAndStatus = (requests, roomId, status) => {
  return requests.filter(req => req.roomId === roomId && req.status === status);
};

/**
 * filterRequestsByType
 * @description 요청 목록에서 지정된 유형(들)에 해당하는 요청들만 필터링합니다.
 * @param {Array<object>} requests - 필터링할 전체 요청 목록.
 * @param {Array<string>} types - 필터링할 요청 유형의 배열 (예: ['slot_release', 'time_request']).
 * @returns {Array<object>} 필터링된 요청 목록.
 */
export const filterRequestsByType = (requests, types) => {
  return requests.filter(req => types.includes(req.type));
};