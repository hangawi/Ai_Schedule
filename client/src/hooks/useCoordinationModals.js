import { useState } from 'react';

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