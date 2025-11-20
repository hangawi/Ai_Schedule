// Scheduler and member state management hook

import { useState, useEffect } from 'react';
import { getCurrentWeekMonday } from '../../../../utils/coordinationUtils';

/**
 * Custom hook for managing scheduler-related states
 * @returns {Object} - Scheduler state and functions
 */
export const useSchedulerState = () => {
  // Current week state
  const [currentWeekStartDate, setCurrentWeekStartDate] = useState(getCurrentWeekMonday());

  // Auto-scheduler states
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState(null);
  const [unassignedMembersInfo, setUnassignedMembersInfo] = useState(null);
  const [conflictSuggestions, setConflictSuggestions] = useState([]);

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
    showDeleteConfirm,
    setShowDeleteConfirm,
    handleDeleteAllSlots
  };
};

/**
 * Custom hook for managing member-related modal states
 * @param {Object} currentRoom - Current room object
 * @returns {Object} - Member modal state and functions
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
