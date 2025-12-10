/**
 * ===================================================================================================
 * useCoordinationModals.js - 협업 기능 관련 모달 상태를 관리하는 React Hook
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/hooks
 *
 * 🎯 주요 기능:
 *    - 방 생성, 참여, 관리 모달의 열림/닫힘 상태 관리
 *    - 시간 요청, 변경 요청 모달의 열림/닫힘 상태 관리
 *    - 모달에 필요한 데이터(예: 선택된 시간 슬롯) 상태 관리
 *    - 각 모달을 열고 닫는 핸들러 함수 제공
 *
 * 🔗 연결된 파일:
 *    - src/components/tabs/CoordinationTab/index.js - 협업 탭에서 모달들을 제어하기 위해 사용
 *    - src/components/modals/RoomCreationModal.js - 방 생성 모달
 *    - src/components/modals/RoomJoinModal.js - 방 참여 모달
 *    - src/components/modals/RoomManagementModal.js - 방 관리 모달
 *    - src/components/modals/RequestSlotModal.js - 시간 요청 모달
 *
 * ✏️ 수정 가이드:
 *    - 새로운 협업 관련 모달 추가: useState를 사용하여 새 모달의 상태를 추가하고, 이를 제어하는 open/close 함수들을 추가한 후 반환 객체에 포함
 *
 * 📝 참고사항:
 *    - 이 훅은 단순히 모달의 '보임' 상태와 모달에 전달할 데이터를 관리하는 역할만 합니다.
 *    - 실제 모달의 렌더링 및 로직은 각 모달 컴포넌트에서 처리됩니다.
 *
 * ===================================================================================================
 */
import { useState } from 'react';

/**
 * useCoordinationModals - 협업 관련 모달들의 상태 및 제어 함수를 제공하는 커스텀 훅
 *
 * @description 이 훅은 방 생성, 참여, 관리 및 시간 요청과 관련된 여러 모달의 열림/닫힘 상태를 캡슐화하여 관리합니다.
 * @returns {object} 모달 상태 및 제어 함수들을 포함하는 객체
 * @property {boolean} showCreateRoomModal - 방 생성 모달 표시 여부
 * @property {boolean} showJoinRoomModal - 방 참여 모달 표시 여부
 * @property {boolean} showManageRoomModal - 방 관리 모달 표시 여부
 * @property {boolean} showRequestModal - 시간 요청 모달 표시 여부
 * @property {boolean} showChangeRequestModal - 시간 변경 요청 모달 표시 여부
 * @property {object|null} slotToRequest - 시간 요청 모달에 전달될 슬롯 데이터
 * @property {object|null} slotToChange - 시간 변경 요청 모달에 전달될 슬롯 데이터
 * @property {Function} openCreateRoomModal - 방 생성 모달을 여는 함수
 * @property {Function} closeCreateRoomModal - 방 생성 모달을 닫는 함수
 * @property {Function} openJoinRoomModal - 방 참여 모달을 여는 함수
 * @property {Function} closeJoinRoomModal - 방 참여 모달을 닫는 함수
 * @property {Function} openManageRoomModal - 방 관리 모달을 여는 함수
 * @property {Function} closeManageRoomModal - 방 관리 모달을 닫는 함수
 * @property {Function} openRequestModal - 시간 요청 모달을 열고 슬롯 데이터를 설정하는 함수
 * @property {Function} closeRequestModal - 시간 요청 모달을 닫고 슬롯 데이터를 초기화하는 함수
 * @property {Function} openChangeRequestModal - 시간 변경 요청 모달을 열고 슬롯 데이터를 설정하는 함수
 * @property {Function} closeChangeRequestModal - 시간 변경 요청 모달을 닫고 슬롯 데이터를 초기화하는 함수
 */
export const useCoordinationModals = () => {
  // Room creation and management modals
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [showJoinRoomModal, setShowJoinRoomModal] = useState(false);
  const [showManageRoomModal, setShowManageRoomModal] = useState(false);
  
  // Timetable interaction modals
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [slotToRequest, setSlotToRequest] = useState(null);
  const [showChangeRequestModal, setShowChangeRequestModal] = useState(false);
  const [slotToChange, setSlotToChange] = useState(null);

  // Modal control functions
  const openCreateRoomModal = () => setShowCreateRoomModal(true);
  const closeCreateRoomModal = () => setShowCreateRoomModal(false);
  
  const openJoinRoomModal = () => setShowJoinRoomModal(true);
  const closeJoinRoomModal = () => setShowJoinRoomModal(false);
  
  const openManageRoomModal = () => setShowManageRoomModal(true);
  const closeManageRoomModal = () => setShowManageRoomModal(false);
  
  const openRequestModal = (slot) => {
    setSlotToRequest(slot);
    setShowRequestModal(true);
  };
  const closeRequestModal = () => {
    setShowRequestModal(false);
    setSlotToRequest(null);
  };
  
  const openChangeRequestModal = (slot) => {
    setSlotToChange(slot);
    setShowChangeRequestModal(true);
  };
  const closeChangeRequestModal = () => {
    setShowChangeRequestModal(false);
    setSlotToChange(null);
  };

  return {
    // Modal states
    showCreateRoomModal,
    showJoinRoomModal,
    showManageRoomModal,
    showRequestModal,
    showChangeRequestModal,

    // Slot data
    slotToRequest,
    slotToChange,

    // Modal controls
    openCreateRoomModal,
    closeCreateRoomModal,
    openJoinRoomModal,
    closeJoinRoomModal,
    openManageRoomModal,
    closeManageRoomModal,
    openRequestModal,
    closeRequestModal,
    openChangeRequestModal,
    closeChangeRequestModal
  };
};
