// View state management hook

import { useState, useCallback } from 'react';
import {
  INITIAL_EXPANDED_SECTIONS,
  REQUEST_VIEW_MODES,
  TAB_TYPES,
  MODAL_DEFAULT_TABS,
  INITIAL_SCHEDULE_OPTIONS
} from '../constants';
import { getViewMode, saveViewMode } from '../../../../utils/coordinationModeUtils';

/**
 * Custom hook for managing view-related states
 * @returns {Object} - View state and functions
 */
export const useViewState = () => {
  // Calendar view states
  const [viewMode, setViewMode] = useState(() => getViewMode());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDetailGrid, setShowDetailGrid] = useState(false);
  const [showMerged, setShowMerged] = useState(true);
  const [showFullDay, setShowFullDay] = useState(false);

  // Request view states
  const [requestViewMode, setRequestViewMode] = useState(REQUEST_VIEW_MODES.RECEIVED);
  const [showAllRequests, setShowAllRequests] = useState({});
  const [expandedSections, setExpandedSections] = useState(INITIAL_EXPANDED_SECTIONS);

  // Tab state
  const [selectedTab, setSelectedTab] = useState(TAB_TYPES.OWNED);

  // Modal default tab
  const [roomModalDefaultTab, setRoomModalDefaultTab] = useState(MODAL_DEFAULT_TABS.INFO);

  // Slot selection
  const [selectedSlots, setSelectedSlots] = useState([]);

  // Schedule options
  const [scheduleOptions, setScheduleOptions] = useState(INITIAL_SCHEDULE_OPTIONS);

  // View mode handlers
  const handleSetViewMode = useCallback((mode) => {
    setViewMode(mode);
    saveViewMode(mode);
  }, []);

  const handleDateClick = useCallback((date) => {
    setSelectedDate(date);
    setShowDetailGrid(true);
  }, []);

  const handleCloseDetailGrid = useCallback(() => {
    setShowDetailGrid(false);
    setSelectedDate(null);
  }, []);

  const handleSlotSelect = useCallback((slotData) => {
    setSelectedSlots(prev => {
      const isSelected = prev.some(slot =>
        slot.date.getTime() === slotData.date.getTime() &&
        slot.day === slotData.day &&
        slot.startTime === slotData.startTime
      );

      if (isSelected) {
        return prev.filter(slot =>
          !(slot.date.getTime() === slotData.date.getTime() &&
            slot.day === slotData.day &&
            slot.startTime === slotData.startTime)
        );
      } else {
        return [...prev, slotData];
      }
    });
  }, []);

  const clearSelectedSlots = useCallback(() => {
    setSelectedSlots([]);
  }, []);

  return {
    // Calendar view
    viewMode,
    setViewMode: handleSetViewMode,
    selectedDate,
    setSelectedDate,
    showDetailGrid,
    setShowDetailGrid,
    showMerged,
    setShowMerged,
    showFullDay,
    setShowFullDay,
    handleDateClick,
    handleCloseDetailGrid,

    // Request view
    requestViewMode,
    setRequestViewMode,
    showAllRequests,
    setShowAllRequests,
    expandedSections,
    setExpandedSections,

    // Tab
    selectedTab,
    setSelectedTab,

    // Modal default tab
    roomModalDefaultTab,
    setRoomModalDefaultTab,

    // Slot selection
    selectedSlots,
    setSelectedSlots,
    handleSlotSelect,
    clearSelectedSlots,

    // Schedule options
    scheduleOptions,
    setScheduleOptions
  };
};
