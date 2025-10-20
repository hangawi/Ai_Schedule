import React, { useState, useEffect } from 'react';
import { coordinationService } from '../../services/coordinationService';
import { Check, MessageSquare, Clock, Users } from 'lucide-react';
import CustomAlertModal from './CustomAlertModal';

const NegotiationModal = ({ isOpen, onClose, negotiation, currentUser, roomId, onRefresh }) => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedYieldOption, setSelectedYieldOption] = useState('carry_over');
  const [alternativeSlots, setAlternativeSlots] = useState([]);
  const [chosenSlot, setChosenSlot] = useState(null);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [currentNegotiation, setCurrentNegotiation] = useState(negotiation);
  const [showYieldOptions, setShowYieldOptions] = useState(false);
  const [showClaimConfirm, setShowClaimConfirm] = useState(false);
  const [originalTimeSlot, setOriginalTimeSlot] = useState(null); // time_slot_choice에서 선택한 원래 시간
  const [conflictChoice, setConflictChoice] = useState(null); // full_conflict에서 선택 (yield/claim)

  useEffect(() => {
    if (negotiation) {
      setMessages(negotiation.messages || []);
      setCurrentNegotiation(negotiation);

      // 💡 협의 정보 상세 로그
      console.log('[협의 모달] 협의 정보:', {
        _id: negotiation._id,
        weekStartDate: negotiation.weekStartDate,
        status: negotiation.status,
        type: negotiation.type,
        멤버수: negotiation.conflictingMembers?.length
      });

      // 💡 모든 멤버의 응답 상태 로그
      console.log('[협의 모달] 모든 멤버 응답 상태:');
      negotiation.conflictingMembers?.forEach((cm, idx) => {
        const cmUserId = typeof cm.user === 'object' ? (cm.user._id || cm.user.id) : cm.user;
        const cmName = cm.user?.firstName || cm.user?.name || '이름없음';
        console.log(`  멤버 ${idx + 1}: ${cmName} (${cmUserId?.toString().substring(0, 8)})`, {
          response: cm.response,
          chosenSlot: cm.chosenSlot
        });
      });

      // 현재 유저의 chosenSlot 복원 (서버에서 가져옴)
      const currentUserMember = negotiation.conflictingMembers?.find(
        cm => {
          const cmUserId = typeof cm.user === 'object' ? (cm.user._id || cm.user.id) : cm.user;
          return cmUserId === currentUser?.id || cmUserId?.toString() === currentUser?.id?.toString();
        }
      );

      if (currentUserMember && currentUserMember.chosenSlot) {
        console.log('[useEffect] chosenSlot 복원:', currentUserMember.chosenSlot);
        setOriginalTimeSlot(currentUserMember.chosenSlot);
      } else {
        console.log('[useEffect] chosenSlot 없음');
      }
    }
  }, [negotiation, currentUser, roomId]);

  if (!isOpen || !negotiation) {
    return null;
  }

  // 현재 협의 데이터 사용 (업데이트된 데이터)
  const activeNegotiation = currentNegotiation || negotiation;

  // 접근 권한 확인: 당사자인지, 방장인지 구분
  const isConflictingMember = activeNegotiation.conflictingMembers?.some(cm => {
    let cmUserId;
    if (typeof cm.user === 'object' && cm.user !== null) {
      cmUserId = cm.user._id || cm.user.id;
    } else {
      cmUserId = cm.user;
    }

    const userId = currentUser?.id;
    return cmUserId === userId || cmUserId?.toString() === userId?.toString();
  });

  // 방장인지 확인 (participants에는 있지만 conflictingMembers에는 없음)
  const isOwnerViewing = !isConflictingMember && activeNegotiation.participants?.some(p => {
    const pUserId = typeof p === 'object' ? (p._id || p.id) : p;
    return pUserId?.toString() === currentUser?.id;
  });

  const handleResponse = async (response) => {
    setIsLoading(true);
    setError(null);

    try {
      const payload = { response };

      console.log('[NegotiationModal] handleResponse 호출:', {
        response,
        chosenSlot,
        originalTimeSlot,
        negotiationType: activeNegotiation.type
      });

      if (response === 'yield') {
        payload.yieldOption = selectedYieldOption;
        if (selectedYieldOption === 'alternative_time' && alternativeSlots.length === 0) {
          setAlertMessage('대체 시간을 선택해주세요.');
          setShowAlert(true);
          setIsLoading(false);
          return;
        }
        payload.alternativeSlots = alternativeSlots;
        // originalTimeSlot이 있으면 그것을 전달 (time_slot_choice에서 선택한 원래 시간)
        if (originalTimeSlot) {
          payload.chosenSlot = originalTimeSlot;
          console.log('[yield] originalTimeSlot 전달:', originalTimeSlot);
        }
      } else if (response === 'claim') {
        // originalTimeSlot이 있으면 그것을 전달 (time_slot_choice에서 선택한 원래 시간)
        if (originalTimeSlot) {
          payload.chosenSlot = originalTimeSlot;
          console.log('[claim] originalTimeSlot 전달:', originalTimeSlot);
        } else {
          console.log('[claim] originalTimeSlot 없음!');
        }
      } else if (response === 'choose_slot') {
        if (!chosenSlot) {
          setAlertMessage('시간대를 선택해주세요.');
          setShowAlert(true);
          setIsLoading(false);
          return;
        }
        payload.chosenSlot = chosenSlot;
        // time_slot_choice에서 선택한 시간을 originalTimeSlot에 저장
        setOriginalTimeSlot(chosenSlot);
        console.log('[choose_slot] chosenSlot 전달 및 저장:', chosenSlot);
      }

      console.log('[NegotiationModal] 최종 payload:', payload);

      const result = await coordinationService.respondToNegotiation(roomId, negotiation._id, payload);

      // 즉시 협의 데이터 업데이트 (UI가 바로 변경됨)
      setCurrentNegotiation(result.negotiation);
      setMessages(result.negotiation.messages);

      // Refresh parent component to update room data
      if (onRefresh) {
        await onRefresh();
      }

      // 협의가 해결된 경우
      if (result.negotiation.status === 'resolved') {
        setAlertMessage('협의가 완료되었습니다!');
        setShowAlert(true);
        setTimeout(() => {
          onClose();
        }, 1500);
      } else if (result.negotiation.type !== negotiation.type) {
        // 타입이 변경된 경우 (time_slot_choice -> full_conflict, partial_conflict -> full_conflict)
        console.log('[협의 타입 변경]', negotiation.type, '->', result.negotiation.type);
        // 선택 초기화하여 새로운 타입의 옵션을 표시
        setChosenSlot(null);
        setSelectedYieldOption('carry_over');
        setConflictChoice(null);
        setAlternativeSlots([]);
        // 알림 표시 후 UI가 즉시 변경됨
        setAlertMessage(`협의 방식이 변경되었습니다. ${result.negotiation.type === 'full_conflict' ? '양보/주장 중 선택해주세요.' : '시간대를 선택해주세요.'}`);
        setShowAlert(true);
        // 즉시 UI가 변경됨 (currentNegotiation이 업데이트되었으므로)
      } else {
        // 응답했지만 아직 해결되지 않은 경우
        const currentUserMember = result.negotiation.conflictingMembers?.find(
          cm => {
            const cmUserId = typeof cm.user === 'object' ? (cm.user._id || cm.user.id) : cm.user;
            return cmUserId === currentUser?.id || cmUserId?.toString() === currentUser?.id?.toString();
          }
        );

        if (currentUserMember && currentUserMember.response !== 'pending') {
          // 모달을 닫지 않고 즉시 응답 완료 상태로 UI 업데이트
          console.log('[응답 완료] UI가 즉시 응답 완료 상태로 변경됨');
          // currentNegotiation이 이미 업데이트되어 UI가 자동으로 변경됨
        }
      }
    } catch (err) {
      setAlertMessage(err.message || '오류가 발생했습니다.');
      setShowAlert(true);
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentUserResponse = () => {
    const currentUserMember = activeNegotiation.conflictingMembers?.find(
      cm => {
        const cmUserId = typeof cm.user === 'object' ? (cm.user._id || cm.user.id) : cm.user;
        return cmUserId === currentUser?.id || cmUserId?.toString() === currentUser?.id?.toString();
      }
    );
    return currentUserMember?.response || 'pending';
  };

  const getConflictingMemberNames = () => {
    return activeNegotiation.conflictingMembers?.map(cm => {
      if (cm.user?.name) {
        return cm.user.name;
      } else if (cm.user?.firstName || cm.user?.lastName) {
        return `${cm.user.firstName || ''} ${cm.user.lastName || ''}`.trim();
      } else {
        return '멤버';
      }
    }).join(', ') || '';
  };

  const userResponse = getCurrentUserResponse();
  const conflictingMembers = activeNegotiation.conflictingMembers || [];
  const memberNames = getConflictingMemberNames();

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-auto max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <Users size={20} className="mr-2 text-orange-500" />
              시간 충돌 협의
            </h3>
            <div className="mt-2 text-sm text-gray-600">
              <div className="flex items-center mb-1">
                <Clock size={16} className="mr-1" />
                {new Date(activeNegotiation.slotInfo.date).toLocaleDateString('ko-KR')} {activeNegotiation.slotInfo.startTime}-{activeNegotiation.slotInfo.endTime}
              </div>
              <div className="flex items-center">
                <Users size={16} className="mr-1" />
                충돌 멤버: {memberNames}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {/* Messages */}
            <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <MessageSquare size={16} className="mr-1" />
                협의 메시지
              </h4>
              <div className="space-y-3">
                {messages.map((message, index) => (
                  <div key={index} className={`p-3 rounded-lg ${
                    message.isSystemMessage
                      ? 'bg-blue-50 border border-blue-200'
                      : 'bg-white border border-gray-200'
                  }`}>
                    <div className="text-sm text-gray-800">{message.message}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(message.timestamp).toLocaleString('ko-KR')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Member responses */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">멤버 응답 현황</h4>
              <div className="space-y-2">
                {conflictingMembers.map((member, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-white rounded border">
                    <div className="flex-1">
                      <span className="text-sm font-medium">
                        {member.user?.name ||
                         (member.user?.firstName || member.user?.lastName ?
                          `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim() :
                          '멤버')}
                      </span>
                      {member.requiredSlots && (
                        <span className="ml-2 text-xs text-gray-500">
                          (필요: {member.requiredSlots}슬롯)
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        member.response === 'yield'
                          ? 'bg-green-100 text-green-800'
                          : member.response === 'claim'
                          ? 'bg-red-100 text-red-800'
                          : member.response === 'split_first'
                          ? 'bg-blue-100 text-blue-800'
                          : member.response === 'split_second'
                          ? 'bg-purple-100 text-purple-800'
                          : member.response === 'choose_slot'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {member.response === 'yield' ? '양보' :
                         member.response === 'claim' ? '주장' :
                         member.response === 'split_first' ? '앞시간' :
                         member.response === 'split_second' ? '뒷시간' :
                         member.response === 'choose_slot' ? '시간선택' : '대기중'}
                      </span>
                      {member.yieldOption && (
                        <span className="text-xs text-gray-600 mt-1">
                          {member.yieldOption === 'carry_over' ? '이월' : '대체시간'}
                        </span>
                      )}
                      {member.chosenSlot && (
                        <span className="text-xs text-gray-600 mt-1">
                          {member.chosenSlot.startTime}-{member.chosenSlot.endTime}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 방장이 조회하는 경우 안내 메시지 */}
            {isOwnerViewing && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-800">
                  방장은 협의 내용을 조회만 할 수 있습니다. 시간 결정은 당사자들이 합니다.
                </p>
              </div>
            )}

            {/* 응답 완료 상태 표시 */}
            {activeNegotiation.status === 'active' && userResponse !== 'pending' && isConflictingMember && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm font-medium text-green-800">
                  ✅ 응답을 완료했습니다. 상대방의 응답을 기다리는 중입니다...
                </p>
                <p className="text-xs text-green-600 mt-2">
                  당신의 선택: {
                    userResponse === 'yield' ? '양보' :
                    userResponse === 'claim' ? '주장' :
                    userResponse === 'split_first' ? '앞시간 선택' :
                    userResponse === 'split_second' ? '뒷시간 선택' :
                    userResponse === 'choose_slot' ? '시간대 선택' : userResponse
                  }
                </p>
                <button
                  onClick={async () => {
                    if (window.confirm('응답을 취소하시겠습니까? 다른 협의를 선택할 수 있게 됩니다.')) {
                      try {
                        setIsLoading(true);
                        const result = await coordinationService.cancelNegotiationResponse(roomId, activeNegotiation._id);
                        setCurrentNegotiation(result.negotiation);
                        setMessages(result.negotiation.messages || []);
                        setChosenSlot(null);
                        setConflictChoice(null);
                        setOriginalTimeSlot(null);
                        if (onRefresh) await onRefresh();
                        setAlertMessage('응답이 취소되었습니다.');
                        setShowAlert(true);
                      } catch (err) {
                        setAlertMessage(err.message || '응답 취소 중 오류가 발생했습니다.');
                        setShowAlert(true);
                      } finally {
                        setIsLoading(false);
                      }
                    }
                  }}
                  disabled={isLoading}
                  className="mt-3 w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                >
                  응답 취소
                </button>
              </div>
            )}

            {/* Response section */}
            {activeNegotiation.status === 'active' && userResponse === 'pending' && isConflictingMember && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-orange-800 mb-3">
                  협의 참여
                </h4>

                {activeNegotiation.type === 'time_slot_choice' ? (
                  <>
                    <p className="text-sm text-orange-700 mb-4">
                      선호 가능한 시간대 중 하나를 선택하세요. 서로 다른 시간대를 선택하면 각자 배정됩니다.
                    </p>

                    {/* 시간대 선택 */}
                    <div className="mb-4 bg-white p-3 rounded-lg border border-orange-200">
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        시간대 선택:
                      </label>
                      <div className="space-y-2">
                        {(() => {
                          // 💡 memberSpecificTimeSlots가 있으면 현재 유저의 가능한 시간대만 표시
                          let slotsToShow = activeNegotiation.availableTimeSlots || [];
                          
                          if (activeNegotiation.memberSpecificTimeSlots && currentUser?.id) {
                            const userSpecificSlots = activeNegotiation.memberSpecificTimeSlots[currentUser.id];
                            if (userSpecificSlots && userSpecificSlots.length > 0) {
                              console.log('[시간대 필터링] 현재 유저:', currentUser.id.substring(0,8));
                              console.log('[시간대 필터링] 유저별 가능 시간:', userSpecificSlots);
                              slotsToShow = userSpecificSlots;
                            }
                          }
                          
                          return slotsToShow.map((slot, index) => (
                            <label key={index} className="flex items-center p-2 border rounded hover:bg-gray-50 cursor-pointer">
                              <input
                                type="radio"
                                name="timeSlot"
                                value={index}
                                checked={chosenSlot?.startTime === slot.startTime}
                                onChange={() => setChosenSlot(slot)}
                                className="mr-2"
                              />
                              <span className="text-sm font-medium">{slot.startTime} - {slot.endTime}</span>
                            </label>
                          ));
                        })()}
                      </div>
                    </div>

                    <button
                      onClick={() => handleResponse('choose_slot')}
                      disabled={isLoading || !chosenSlot}
                      className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:bg-blue-300"
                    >
                      시간대 선택 완료
                    </button>

                    <div className="mt-2 text-xs text-gray-600 text-center">
                      시간대가 겹치면 양보/주장으로 다시 선택하게 됩니다
                    </div>
                  </>
                ) : activeNegotiation.type === 'full_conflict' ? (
                  <>
                    <p className="text-sm text-orange-700 mb-4">
                      전체 시간이 필요한 충돌입니다. 양보하거나 주장하세요.
                    </p>

                    <div className="mb-4 bg-white p-3 rounded-lg border border-orange-200">
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        선택:
                      </label>
                      <div className="space-y-2">
                        {/* 양보 옵션 */}
                        <label className="flex items-center p-2 border rounded hover:bg-gray-50 cursor-pointer">
                          <input
                            type="radio"
                            name="conflictOption"
                            value="yield"
                            checked={conflictChoice === 'yield'}
                            onChange={() => setConflictChoice('yield')}
                            className="mr-2"
                          />
                          <span className="text-sm font-medium">양보하기</span>
                        </label>

                        {/* 양보 선택 시 이월 옵션 표시 */}
                        {conflictChoice === 'yield' && (
                          <div className="ml-6 mt-2 space-y-2 bg-green-50 p-3 rounded">
                            <label className="flex items-center">
                              <input
                                type="radio"
                                name="yieldOption"
                                value="carry_over"
                                checked={selectedYieldOption === 'carry_over'}
                                onChange={(e) => setSelectedYieldOption(e.target.value)}
                                className="mr-2"
                              />
                              <span className="text-sm">이월하기 (다음 주로 넘김)</span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="radio"
                                name="yieldOption"
                                value="alternative_time"
                                checked={selectedYieldOption === 'alternative_time'}
                                onChange={(e) => setSelectedYieldOption(e.target.value)}
                                className="mr-2"
                              />
                              <span className="text-sm">다른 선호 시간 선택</span>
                            </label>
                            {selectedYieldOption === 'alternative_time' && (
                              <div className="mt-2 bg-blue-50 p-3 rounded border border-blue-200">
                                <div className="text-xs font-medium text-gray-700 mb-2">
                                  대체 시간대를 선택하세요:
                                </div>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                  {(() => {
                                    // --- Final "All-in-One" Logic ---

                                    // --- 1. Date calculation helpers ---
                                    const conflictDate = new Date(activeNegotiation.slotInfo.date);
                                    const dayOfWeek = conflictDate.getUTCDay();
                                    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                                    const mondayDate = new Date(conflictDate);
                                    mondayDate.setUTCDate(conflictDate.getUTCDate() + diffToMonday);
                                    const dayNameToIndex = { 'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3, 'friday': 4, 'saturday': 5, 'sunday': 6 };

                                    const getSlotDateString = (slot) => {
                                        if (slot.date) {
                                            let dateStr = slot.date;
                                            if (typeof dateStr === 'string' && dateStr.length === 10 && !dateStr.includes('T')) {
                                                return dateStr; // Already YYYY-MM-DD
                                            }
                                            return new Date(dateStr).toISOString().split('T')[0];
                                        }
                                        if (slot.day && dayNameToIndex.hasOwnProperty(slot.day.toLowerCase())) {
                                            const targetDate = new Date(mondayDate);
                                            targetDate.setUTCDate(mondayDate.getUTCDate() + dayNameToIndex[slot.day.toLowerCase()]);
                                            return targetDate.toISOString().split('T')[0];
                                        }
                                        return activeNegotiation.slotInfo.date.split('T')[0];
                                    };

                                    // --- 2. Slot Processing ---

                                    // A. Process same-day slots (add date context)
                                    const negotiationDateStr = activeNegotiation.slotInfo.date.split('T')[0];
                                    // 💡 full_conflict 타입에서는 availableTimeSlots 사용하지 않음
                                    const sameDaySlots = activeNegotiation.type === 'full_conflict' ? [] : (activeNegotiation.availableTimeSlots || []).map(slot => ({
                                        ...slot,
                                        date: negotiationDateStr
                                    }));

                                    // B. 💡 백엔드가 이미 할당 시간 단위로 분할해서 보냈으므로 그대로 사용
                                    let otherPreferredSlots = [];
                                    console.log('[대체시간] memberSpecificTimeSlots:', activeNegotiation.memberSpecificTimeSlots);
                                    console.log('[대체시간] currentUser.id:', currentUser.id);
                                    const memberSlots = (activeNegotiation.memberSpecificTimeSlots && activeNegotiation.memberSpecificTimeSlots[currentUser.id]) || [];
                                    console.log('[대체시간] memberSlots:', memberSlots);
                                    if (memberSlots.length > 0) {
                                        memberSlots.forEach(slot => {
                                            const slotDateStr = getSlotDateString(slot);
                                            if (!slot.startTime || !slot.endTime) return;
                                            otherPreferredSlots.push({
                                                ...slot,
                                                date: slotDateStr,
                                                startTime: slot.startTime,
                                                endTime: slot.endTime,
                                            });
                                        });
                                    }

                                    // --- 3. Combine, De-duplicate, and Filter ---
                                    const combinedSlots = [...sameDaySlots, ...otherPreferredSlots];
                                    const uniqueSlots = [];
                                    const seenSlots = new Set();
                                    for (const slot of combinedSlots) {
                                        const identifier = `${getSlotDateString(slot)}-${slot.startTime}-${slot.endTime}`;
                                        if (!seenSlots.has(identifier)) {
                                            uniqueSlots.push(slot);
                                            seenSlots.add(identifier);
                                        }
                                    }

                                    let availableSlots = uniqueSlots;
                                    if (originalTimeSlot) {
                                        const originalIdentifier = `${getSlotDateString(originalTimeSlot)}-${originalTimeSlot.startTime}-${originalTimeSlot.endTime}`;
                                        availableSlots = availableSlots.filter(slot => {
                                            const slotIdentifier = `${getSlotDateString(slot)}-${slot.startTime}-${slot.endTime}`;
                                            return slotIdentifier !== originalIdentifier;
                                        });
                                    }

                                    // --- 4. Rendering ---
                                    if (availableSlots.length === 0) {
                                      return <div className="text-xs text-gray-600">사용 가능한 다른 시간대가 없습니다.</div>;
                                    }

                                    return availableSlots.map((slot, index) => {
                                      const slotDateStr = getSlotDateString(slot);
                                      const slotDate = new Date(slotDateStr + 'T00:00:00Z');
                                      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
                                      const dayName = dayNames[slotDate.getUTCDay()];
                                      const dateStr = `${slotDate.getUTCMonth() + 1}/${slotDate.getUTCDate()}(${dayName})`;

                                      return (
                                        <label key={index} className="flex items-center p-2 bg-white border rounded hover:bg-gray-50 cursor-pointer">
                                          <input
                                            type="radio"
                                            name="alternativeSlot"
                                            checked={alternativeSlots.length === 1 && alternativeSlots[0].startTime === slot.startTime && alternativeSlots[0].endTime === slot.endTime && getSlotDateString(alternativeSlots[0]) === slotDateStr}
                                            onChange={() => setAlternativeSlots([slot])}
                                            className="mr-2"
                                          />
                                          <span className="text-xs">{dateStr} {slot.startTime} - {slot.endTime}</span>
                                        </label>
                                      );
                                    });
                                  })()}
                                </div>
                                {alternativeSlots.length > 0 && (
                                  <div className="mt-2 text-xs text-green-600">
                                    {`${alternativeSlots[0].startTime} - ${alternativeSlots[0].endTime} 시간표를 선택했습니다`}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 주장 옵션 */}
                        <label className="flex items-center p-2 border rounded hover:bg-gray-50 cursor-pointer">
                          <input
                            type="radio"
                            name="conflictOption"
                            value="claim"
                            checked={conflictChoice === 'claim'}
                            onChange={() => setConflictChoice('claim')}
                            className="mr-2"
                          />
                          <span className="text-sm font-medium">주장하기</span>
                        </label>
                      </div>

                      <button
                        onClick={() => handleResponse(conflictChoice)}
                        disabled={isLoading || !conflictChoice}
                        className="w-full mt-3 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:bg-blue-300"
                      >
                        선택 완료
                      </button>
                    </div>
                  </>
) : (
                  <>
                    <p className="text-sm text-orange-700 mb-4">
                      시간을 분할하여 배정할 수 있습니다. 원하는 시간대를 선택하세요.
                    </p>
                    {(() => {
                      // 시간을 분할 계산
                      const startTime = activeNegotiation.slotInfo?.startTime || '';
                      const endTime = activeNegotiation.slotInfo?.endTime || '';

                      if (!startTime || !endTime) {
                        return <p className="text-sm text-red-600">시간 정보를 불러올 수 없습니다.</p>;
                      }

                      // 시작과 종료 시간을 분 단위로 변환
                      const [startHour, startMin] = startTime.split(':').map(Number);
                      const [endHour, endMin] = endTime.split(':').map(Number);
                      const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);

                      // 각 멤버의 필요 슬롯 수 확인
                      const currentUserMember = activeNegotiation.conflictingMembers?.find(
                        cm => (cm.user?._id || cm.user) === currentUser?.id
                      );
                      const requiredSlots = currentUserMember?.requiredSlots || 1;
                      const requiredMinutes = requiredSlots * 30; // 1슬롯 = 30분

                      // 첫 번째 사람의 필요 시간만큼만 할당
                      const midMinutes = startHour * 60 + startMin + requiredMinutes;
                      const midHour = Math.floor(midMinutes / 60);
                      const midMin = midMinutes % 60;
                      const midTime = `${String(midHour).padStart(2, '0')}:${String(midMin).padStart(2, '0')}`;

                      const firstHalfTime = `${startTime}-${midTime}`;
                      const secondHalfTime = `${midTime}-${endTime}`;

                      // 한시간 협의와 동일한 라디오 버튼 스타일로 변경
                      return (
                        <div className="mb-4 bg-white p-3 rounded-lg border border-orange-200">
                          <label className="text-sm font-medium text-gray-700 mb-2 block">
                            시간대 선택:
                          </label>
                          <div className="space-y-2">
                            <label className="flex items-center p-2 border rounded hover:bg-gray-50 cursor-pointer">
                              <input
                                type="radio"
                                name="splitTime"
                                value="first"
                                checked={chosenSlot?.type === 'split_first'}
                                onChange={() => setChosenSlot({ type: 'split_first', time: firstHalfTime })}
                                className="mr-2"
                              />
                              <span className="text-sm font-medium">앞 시간: {firstHalfTime}</span>
                            </label>
                            <label className="flex items-center p-2 border rounded hover:bg-gray-50 cursor-pointer">
                              <input
                                type="radio"
                                name="splitTime"
                                value="second"
                                checked={chosenSlot?.type === 'split_second'}
                                onChange={() => setChosenSlot({ type: 'split_second', time: secondHalfTime })}
                                className="mr-2"
                              />
                              <span className="text-sm font-medium">뒷 시간: {secondHalfTime}</span>
                            </label>
                          </div>

                          <button
                            onClick={() => handleResponse(chosenSlot?.type)}
                            disabled={isLoading || !chosenSlot}
                            className="w-full mt-3 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:bg-blue-300"
                          >
                            시간대 선택 완료
                          </button>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            )}

            {userResponse !== 'pending' && (
              <div className={`border rounded-lg p-4 ${
                userResponse === 'yield'
                  ? 'bg-green-50 border-green-200'
                  : userResponse === 'claim'
                  ? 'bg-red-50 border-red-200'
                  : userResponse === 'choose_slot'
                  ? 'bg-indigo-50 border-indigo-200'
                  : 'bg-blue-50 border-blue-200'
              }`}>
                <p className="text-sm font-medium">
                  이미 {
                    userResponse === 'yield' ? '양보' :
                    userResponse === 'claim' ? '주장' :
                    userResponse === 'split_first' ? '앞 시간 선택' :
                    userResponse === 'split_second' ? '뒤 시간 선택' :
                    userResponse === 'choose_slot' ? '시간대 선택' : '응답'
                  }하셨습니다.
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  다른 멤버들의 응답을 기다리고 있습니다.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300"
          >
            닫기
          </button>
        </div>
      </div>

      <CustomAlertModal
        isOpen={showAlert}
        onClose={() => setShowAlert(false)}
        title="알림"
        message={alertMessage}
        type="warning"
        showCancel={false}
      />
    </div>
  );
};

export default NegotiationModal;