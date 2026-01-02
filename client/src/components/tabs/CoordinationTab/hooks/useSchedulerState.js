/**
 * ===================================================================================================
 * useSchedulerState.js - 스케줄러 및 멤버 상태 관리 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/CoordinationTab/hooks
 *
 * 🎯 주요 기능:
 *    - 현재 주(currentWeek) 상태 관리 및 변경
 *    - 자동 배정(auto-scheduler) 실행 상태 및 에러 관리
 *    - 미배정 멤버 정보 및 충돌 제안사항 관리
 *    - 멤버 모달(통계, 스케줄 보기) 상태 관리
 *    - 방장 스케줄 캐시 관리
 *
 * 🔗 연결된 파일:
 *    - ../../../../utils/coordinationUtils.js - getCurrentWeekMonday 유틸리티
 *    - ../index.js - CoordinationTab 메인 컴포넌트에서 사용
 *    - ../components/RoomHeader.js - 주 변경 컨트롤
 *    - ../../modals/MemberStatsModal.js - 멤버 통계 모달
 *    - ../../modals/MemberScheduleModal.js - 멤버 스케줄 모달
 *
 * 💡 UI 위치:
 *    - 탭: 조율 탭 (CoordinationTab)
 *    - 섹션: 주 선택 컨트롤, 자동 배정 패널, 멤버 목록
 *    - 경로: 앱 실행 > 조율 탭 > 방 선택
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 조율 탭의 스케줄러 및 멤버 모달 관련 상태 관리 로직 변경
 *    - 주 변경 로직 수정: handleWeekChange 함수 수정
 *    - 새로운 모달 추가: 새로운 state와 handler 함수 추가
 *    - 자동 배정 상태 추가: useSchedulerState의 return 객체에 추가
 *
 * 📝 참고사항:
 *    - 현재 주는 월요일 기준으로 시작 (getCurrentWeekMonday 사용)
 *    - 방장 스케줄은 캐시되어 재사용됨 (성능 최적화)
 *    - 모든 모달 상태는 독립적으로 관리됨
 *
 * ===================================================================================================
 */

import { useState, useEffect } from 'react';
import { getCurrentWeekMonday } from '../../../../utils/coordinationUtils';

/**
 * useSchedulerState - 스케줄러 상태 관리 훅
 *
 * @description 자동 배정 및 주 선택 관련 상태를 관리하는 커스텀 훅
 * @returns {Object} 스케줄러 상태 및 제어 함수
 * @returns {Date} returns.currentWeekStartDate - 현재 표시 중인 주의 월요일 날짜
 * @returns {Function} returns.setCurrentWeekStartDate - 주 시작 날짜 설정 함수
 * @returns {Function} returns.handleWeekChange - 주 변경 핸들러
 * @returns {boolean} returns.isScheduling - 자동 배정 실행 중 여부
 * @returns {Function} returns.setIsScheduling - 자동 배정 상태 설정 함수
 * @returns {string} returns.scheduleError - 배정 에러 메시지
 * @returns {Function} returns.setScheduleError - 에러 메시지 설정 함수
 * @returns {Object} returns.unassignedMembersInfo - 미배정 멤버 정보
 * @returns {Function} returns.setUnassignedMembersInfo - 미배정 멤버 정보 설정 함수
 * @returns {Array} returns.conflictSuggestions - 충돌 제안사항 목록
 * @returns {Function} returns.setConflictSuggestions - 충돌 제안사항 설정 함수
 * @returns {boolean} returns.showDeleteConfirm - 삭제 확인 모달 표시 여부
 * @returns {Function} returns.setShowDeleteConfirm - 삭제 확인 모달 상태 설정 함수
 * @returns {Function} returns.handleDeleteAllSlots - 전체 슬롯 삭제 핸들러
 *
 * @example
 * const {
 *   currentWeekStartDate,
 *   handleWeekChange,
 *   isScheduling,
 *   setIsScheduling
 * } = useSchedulerState();
 *
 * @note
 * - 주는 항상 월요일 기준으로 시작
 * - 자동 배정 실행 중에는 UI 차단 권장
 */
export const useSchedulerState = () => {
  // Current week state
  const [currentWeekStartDate, setCurrentWeekStartDate] = useState(getCurrentWeekMonday());

  // Auto-scheduler states
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState(null);
  const [unassignedMembersInfo, setUnassignedMembersInfo] = useState(null);
  const [conflictSuggestions, setConflictSuggestions] = useState([]);
  const [warnings, setWarnings] = useState([]);

  // Delete confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleWeekChange = (date) => {
    setCurrentWeekStartDate(date);
  };

  const handleDeleteAllSlots = () => {
    setShowDeleteConfirm(true);
  };

  return {
    currentWeekStartDate,
    setCurrentWeekStartDate,
    handleWeekChange,
    isScheduling,
    setIsScheduling,
    scheduleError,
    setScheduleError,
    unassignedMembersInfo,
    setUnassignedMembersInfo,
    conflictSuggestions,
    setConflictSuggestions,
    warnings,
    setWarnings,
    showDeleteConfirm,
    setShowDeleteConfirm,
    handleDeleteAllSlots
  };
};

/**
 * useMemberModalState - 멤버 관련 모달 상태 관리 훅
 *
 * @description 멤버 통계 모달, 스케줄 모달 등의 상태를 관리하고 방장 스케줄을 캐시하는 커스텀 훅
 * @param {Object} currentRoom - 현재 선택된 방 객체 (owner, members 포함)
 * @returns {Object} 멤버 모달 상태 및 제어 함수
 * @returns {Object} returns.memberStatsModal - 멤버 통계 모달 상태 { isOpen, member }
 * @returns {Function} returns.setMemberStatsModal - 멤버 통계 모달 상태 설정 함수
 * @returns {boolean} returns.showMemberScheduleModal - 멤버 스케줄 모달 표시 여부
 * @returns {Function} returns.setShowMemberScheduleModal - 멤버 스케줄 모달 상태 설정 함수
 * @returns {string} returns.selectedMemberId - 선택된 멤버 ID
 * @returns {Function} returns.setSelectedMemberId - 선택된 멤버 ID 설정 함수
 * @returns {Object} returns.ownerScheduleCache - 방장 스케줄 캐시 { defaultSchedule, scheduleExceptions, personalTimes }
 * @returns {Function} returns.handleMemberClick - 멤버 클릭 핸들러 (통계 모달 오픈)
 * @returns {Function} returns.handleMemberScheduleClick - 멤버 스케줄 보기 핸들러
 * @returns {Function} returns.closeMemberStatsModal - 멤버 통계 모달 닫기 함수
 * @returns {Function} returns.closeMemberScheduleModal - 멤버 스케줄 모달 닫기 함수
 *
 * @example
 * const {
 *   memberStatsModal,
 *   handleMemberClick,
 *   closeMemberStatsModal
 * } = useMemberModalState(currentRoom);
 * handleMemberClick(memberId); // 멤버 통계 모달 열기
 *
 * @note
 * - 방장 스케줄은 currentRoom 변경 시 자동으로 캐시 업데이트
 * - 모달 닫을 때는 관련 state도 함께 초기화됨
 * - 멤버 ID는 user._id 또는 user.id 모두 지원
 */
export const useMemberModalState = (currentRoom) => {
  // Member stats modal states
  const [memberStatsModal, setMemberStatsModal] = useState({ isOpen: false, member: null });

  // Member schedule modal states
  const [showMemberScheduleModal, setShowMemberScheduleModal] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState(null);

  // Owner schedule cache
  const [ownerScheduleCache, setOwnerScheduleCache] = useState(null);

  // Update owner schedule cache when currentRoom changes
  useEffect(() => {
    if (currentRoom?.owner?.defaultSchedule) {
      setOwnerScheduleCache({
        defaultSchedule: currentRoom.owner.defaultSchedule,
        scheduleExceptions: currentRoom.owner.scheduleExceptions,
        personalTimes: currentRoom.owner.personalTimes
      });
    }
  }, [currentRoom]);

  const handleMemberClick = (memberId) => {
    const member = currentRoom?.members?.find(m => (m.user._id || m.user.id) === memberId);
    if (member) {
      setMemberStatsModal({ isOpen: true, member });
    }
  };

  const handleMemberScheduleClick = (memberId) => {
    setSelectedMemberId(memberId);
    setShowMemberScheduleModal(true);
  };

  const closeMemberStatsModal = () => {
    setMemberStatsModal({ isOpen: false, member: null });
  };

  const closeMemberScheduleModal = () => {
    setShowMemberScheduleModal(false);
    setSelectedMemberId(null);
  };

  return {
    memberStatsModal,
    setMemberStatsModal,
    showMemberScheduleModal,
    setShowMemberScheduleModal,
    selectedMemberId,
    setSelectedMemberId,
    ownerScheduleCache,
    handleMemberClick,
    handleMemberScheduleClick,
    closeMemberStatsModal,
    closeMemberScheduleModal
  };
};
