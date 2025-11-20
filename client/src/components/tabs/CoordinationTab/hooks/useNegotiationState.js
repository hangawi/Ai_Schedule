// Negotiation state management hook

import { useState, useCallback } from 'react';

/**
 * Custom hook for managing negotiation-related states
 * @param {Object} currentRoom - Current room object
 * @param {Object} user - Current user
 * @returns {Object} - Negotiation state and functions
 */
export const useNegotiationState = (currentRoom, user) => {
  // Negotiation notification states
  const [showNegotiationAlert, setShowNegotiationAlert] = useState(false);
  const [negotiationAlertData, setNegotiationAlertData] = useState(null);

  // Negotiation modal states
  const [showNegotiationModal, setShowNegotiationModal] = useState(false);
  const [selectedNegotiation, setSelectedNegotiation] = useState(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictNegotiation, setConflictNegotiation] = useState(null);

  // Current week negotiations
  const [currentWeekNegotiations, setCurrentWeekNegotiations] = useState([]);

  // Handle opening negotiation modal
  const handleOpenNegotiation = useCallback((negotiationData) => {
    // 다른 협의에 이미 응답했는지 확인
    // 같은 주의 협의만 필터링 (weekStartDate가 같은 협의끼리만 상호 배타적)
    const otherActiveNegotiations = (currentRoom?.negotiations || []).filter(nego => {
      if (nego.status !== 'active') return false;
      if (nego._id === negotiationData._id) return false;

      // weekStartDate가 있는 경우: 같은 주차의 협의만 필터링
      if (negotiationData.weekStartDate && nego.weekStartDate) {
        if (nego.weekStartDate !== negotiationData.weekStartDate) {
          return false;
        }
      }

      // 내가 당사자인 협의만 필터링
      return nego.conflictingMembers?.some(cm => {
        const cmUserId = cm.user?._id || cm.user?.id || cm.user;
        return cmUserId === user?.id || cmUserId?.toString() === user?.id?.toString();
      });
    });

    const hasRespondedToOther = otherActiveNegotiations.some(nego => {
      const memberInOtherNego = nego.conflictingMembers?.find(cm => {
        const cmUserId = cm.user?._id || cm.user?.id || cm.user;
        return cmUserId === user?.id || cmUserId?.toString() === user?.id?.toString();
      });
      return memberInOtherNego && memberInOtherNego.response && memberInOtherNego.response !== 'pending';
    });

    if (hasRespondedToOther) {
      const respondedNego = otherActiveNegotiations.find(nego => {
        const memberInOtherNego = nego.conflictingMembers?.find(cm => {
          const cmUserId = cm.user?._id || cm.user?.id || cm.user;
          return cmUserId === user?.id || cmUserId?.toString() === user?.id?.toString();
        });
        return memberInOtherNego && memberInOtherNego.response && memberInOtherNego.response !== 'pending';
      });

      // 커스텀 모달 표시 (같은 주의 다른 협의에 응답한 경우)
      setConflictNegotiation(respondedNego);
      setShowConflictModal(true);
      return;
    }

    setSelectedNegotiation(negotiationData);
    setShowNegotiationModal(true);
  }, [currentRoom?.negotiations, user?.id]);

  // Handle closing negotiation modal
  const handleCloseNegotiation = useCallback(() => {
    setShowNegotiationModal(false);
    setSelectedNegotiation(null);
  }, []);

  return {
    // Alert
    showNegotiationAlert,
    setShowNegotiationAlert,
    negotiationAlertData,
    setNegotiationAlertData,

    // Modal
    showNegotiationModal,
    setShowNegotiationModal,
    selectedNegotiation,
    setSelectedNegotiation,
    showConflictModal,
    setShowConflictModal,
    conflictNegotiation,
    setConflictNegotiation,

    // Current week
    currentWeekNegotiations,
    setCurrentWeekNegotiations,

    // Handlers
    handleOpenNegotiation,
    handleCloseNegotiation
  };
};
