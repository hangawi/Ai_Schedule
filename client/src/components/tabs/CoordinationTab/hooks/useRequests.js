// Request management hook

import { useState, useCallback, useEffect } from 'react';
import { coordinationService } from '../../../../services/coordinationService';

/**
 * Custom hook for managing sent and received requests
 * @param {string} userId - Current user ID
 * @returns {Object} - Request state and functions
 */
export const useRequests = (userId) => {
  const [sentRequests, setSentRequests] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);

  const loadSentRequests = useCallback(async () => {
    if (!userId) return;
    try {
      const result = await coordinationService.getSentRequests();
      if (result.success) {
        setSentRequests(result.requests);
      }
    } catch (error) {
      // Silent error handling
    }
  }, [userId]);

  const loadReceivedRequests = useCallback(async () => {
    if (!userId) return;
    try {
      const result = await coordinationService.getReceivedRequests();
      if (result.success) {
        setReceivedRequests(result.requests);
      }
    } catch (error) {
      // Silent error handling
    }
  }, [userId]);

  return {
    sentRequests,
    setSentRequests,
    receivedRequests,
    setReceivedRequests,
    loadSentRequests,
    loadReceivedRequests
  };
};

/**
 * Custom hook for managing room exchange counts
 * @param {string} userId - Current user ID
 * @param {Object} myRooms - User's rooms
 * @param {Array} receivedRequests - Received requests
 * @returns {Object} - Exchange counts state and functions
 */
export const useRoomExchangeCounts = (userId, myRooms, receivedRequests) => {
  const [roomExchangeCounts, setRoomExchangeCounts] = useState({});

  const getRoomRequestCount = useCallback((roomId) => {
    return receivedRequests.filter(req =>
      req.status === 'pending' && req.roomId === roomId
    ).length;
  }, [receivedRequests]);

  const loadRoomExchangeCounts = useCallback(async () => {
    if (!userId || !myRooms) return;

    const counts = {};
    const allRooms = [...(myRooms.owned || []), ...(myRooms.joined || [])];

    allRooms.forEach(room => {
      counts[room._id] = getRoomRequestCount(room._id);
    });

    setRoomExchangeCounts(counts);
  }, [userId, myRooms, getRoomRequestCount]);

  // Update counts when receivedRequests changes
  useEffect(() => {
    if (receivedRequests.length > 0 && myRooms) {
      loadRoomExchangeCounts();
    }
  }, [receivedRequests.length, myRooms?.owned?.length, myRooms?.joined?.length, loadRoomExchangeCounts]);

  return {
    roomExchangeCounts,
    getRoomRequestCount,
    loadRoomExchangeCounts
  };
};
