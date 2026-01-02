/**
 * ===================================================================================================
 * useTravelMode.js - 이동 시간을 고려한 스케줄 재계산 및 표시를 관리하는 React Hook
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/hooks
 *
 * 🎯 주요 기능:
 *    - '일반 모드'와 '이동 시간 모드'(대중교통/자가용) 간의 상태 전환 관리
 *    - 이동 시간 모드 선택 시 `travelScheduleCalculator` 서비스를 호출하여 스케줄 재계산
 *    - 재계산된 스케줄(이동 시간 포함) 및 계산 상태(로딩, 에러) 관리
 *    - 현재 모드에 맞는 시간표 데이터를 주간/월간 뷰 형식으로 가공하여 제공
 *
 * 🔗 연결된 파일:
 *    - src/services/travelScheduleCalculator.js - 실제 이동 시간 계산 및 스케줄 재구성을 담당하는 서비스
 *    - src/components/tabs/CoordinationTab/index.js - 협업 탭에서 이동 모드 버튼과 상호작용하며 이 훅을 사용
 *    - src/components/coordination/TravelModeButtons.js - 이 훅의 `handleModeChange` 함수를 호출하는 UI 컴포넌트
 *
 * ✏️ 수정 가이드:
 *    - 새로운 이동 수단 추가: `handleModeChange` 함수에서 새로운 `newMode`에 대한 처리를 추가하고, `travelScheduleCalculator`에도 관련 로직을 구현
 *    - 에러 메시지 변경: `handleModeChange` 함수의 `catch` 블록에서 에러 처리 로직 수정
 *    - 뷰 데이터 가공 방식 변경: `getWeekViewData` 또는 `getMonthViewData` 함수 내부의 포맷팅 로직 수정
 *
 * 📝 참고사항:
 *    - 이 훅은 `currentRoom` 데이터가 있어야 정상적으로 동작합니다.
 *    - 이동 시간 계산을 위해서는 방 멤버들의 프로필에 주소 정보가 필수로 입력되어 있어야 합니다.
 *    - `currentRoom`이 변경되면 모든 상태가 '일반 모드'로 초기화됩니다.
 *
 * ===================================================================================================
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import travelScheduleCalculator from '../services/travelScheduleCalculator';
import { coordinationService } from '../services/coordinationService';
import travelModeService from '../services/travelModeService';
import { auth } from '../config/firebaseConfig'; // 🆕 Firebase Auth 임포트

/**
 * useTravelMode - 이동 시간 계산 모드를 관리하고, 모드에 따라 스케줄 데이터를 변환하여 제공하는 훅
 *
 * @description 사용자가 선택한 이동 수단(일반, 대중교통, 자가용)에 따라
 *              기존 스케줄에 이동 시간을 포함하여 재계산하고,
 *              계산된 데이터를 다양한 뷰(주간, 월간)에 맞게 가공하여 반환합니다.
 * @param {object|null} currentRoom - 현재 선택된 방 정보 객체
 * @param {boolean} isOwner - 현재 사용자가 방장인지 여부 (기본값: true)
 * @returns {object} 이동 모드 상태 및 관련 함수들을 포함하는 객체
 * @property {string} travelMode - 현재 선택된 이동 모드 ('normal', 'transit', 'driving', 'bicycling', 'walking')
 * @property {Function} handleModeChange - 이동 모드를 변경하고 스케줄 재계산을 트리거하는 함수
 * @property {boolean} isCalculating - 이동 시간 계산이 진행 중인지 여부
 * @property {string|null} error - 계산 중 발생한 에러 메시지
 * @property {object|null} enhancedSchedule - 이동 시간이 포함된 재계산된 스케줄 데이터
 * @property {Function} getCurrentScheduleData - 현재 모드에 맞는 원본 또는 재계산된 스케줄 데이터를 반환하는 함수
 * @property {Function} getWeekViewData - 주간 뷰에 맞게 포맷된 스케줄 데이터를 반환하는 함수
 * @property {Function} getMonthViewData - 월간 뷰에 맞게 포맷된 스케줄 데이터를 반환하는 함수
 */
export const useTravelMode = (currentRoom, isOwner = true, currentUser = null) => {
  const [travelMode, setTravelMode] = useState('normal');
  const [enhancedSchedule, setEnhancedSchedule] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState(null);
  const [myTravelDuration, setMyTravelDuration] = useState(0); // 🆕 나의 이동시간 (분 단위)

  // 이전 방 ID를 추적하여 실제로 방이 변경되었을 때만 상태 초기화
  const prevRoomIdRef = useRef(null);
  // 🆕 이전 timeSlots 참조 저장 (자동배정 등으로 인한 데이터 변경 감지용)
  // 🆕 이전 서버 모드 참조 저장 (서버 상태 변경 감지용)
  const prevServerModeRef = useRef(currentRoom?.confirmedTravelMode || currentRoom?.currentTravelMode || 'normal');
  // 🆕 확정 중인지 여부 (이동시간 깜빡임 방지)
  const isConfirmingRef = useRef(false);

  // 🆕 방장 -> 나(조원) 이동시간 계산
  useEffect(() => {
    const calculateMyTravel = async () => {
      // 1. 사용자 ID 확인 (currentUser 또는 Firebase Auth)
      let myId = currentUser?._id || currentUser?.id;
      let myUid = currentUser?.firebaseUid;

      if (!myId && !myUid) {
          const fbUser = auth.currentUser;
          if (fbUser) {
              myUid = fbUser.uid; // Firebase UID 사용
          }
      }

      // 1. 조건 체크: 방 정보 없음, 방장임, 일반 모드 -> 계산 안 함
      // (currentUser가 없어도 myUid가 있으면 진행)
      if (!currentRoom || isOwner || travelMode === 'normal' || (!myId && !myUid)) {
        setMyTravelDuration(0);
        return;
      }

      // 2. 방장 위치 정보 확인
      const owner = currentRoom.owner;
      // 방장 정보가 객체인지 ID 문자열인지 확인
      const ownerLat = owner?.addressLat;
      const ownerLng = owner?.addressLng;

      if (!ownerLat || !ownerLng) {
        setMyTravelDuration(0);
        return;
      }

      // 3. 내 위치 정보 확인
      // currentUser 객체 우선 확인
      let myLat = currentUser?.addressLat;
      let myLng = currentUser?.addressLng;
      let source = 'currentUser';

      // currentUser에 없으면 members 배열에서 확인
      if (!myLat || !myLng) {

        const myMemberInfo = currentRoom.members?.find(m => {
            const mUser = m.user;
            if (!mUser) return false;
            
            // 객체인 경우
            if (mUser._id || mUser.id) {
                const mId = (mUser._id || mUser.id).toString();
                if (myId && mId === myId.toString()) return true;
                if (myUid && mUser.firebaseUid === myUid) return true;
            } 
            // ID 문자열인 경우
            else if (typeof mUser === 'string') {
                if (myId && mUser === myId.toString()) return true;
            }
            
            return false;
        });
        
        // member.user가 populate된 객체일 경우
        if (myMemberInfo?.user?.addressLat) {
            myLat = myMemberInfo.user.addressLat;
            myLng = myMemberInfo.user.addressLng;
            source = 'room.members';
        }
      }


      try {
        const travelInfo = await travelModeService.calculateTravelTime(
          { lat: ownerLat, lng: ownerLng },
          { lat: myLat, lng: myLng },
          travelMode
        );

        // 10분 단위 올림 계산 (초 -> 분 -> 10분 단위 올림)
        const durationMinutes = Math.ceil(travelInfo.duration / 60 / 10) * 10;
        
        setMyTravelDuration(durationMinutes);

      } catch (err) {
        
        // 🆕 수동 계산 로직 (백엔드와 동일한 Haversine 공식)
        const calculateDistance = (lat1, lon1, lat2, lon2) => {
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = 0.5 - Math.cos(dLat)/2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * (1 - Math.cos(dLon))/2;
            return R * 2 * Math.asin(Math.sqrt(a));
        };

        const distance = calculateDistance(ownerLat, ownerLng, myLat, myLng);
        const speeds = { driving: 40, transit: 30, walking: 5, bicycling: 15 };
        const speed = speeds[travelMode] || 30;
        const durationMinutes = Math.ceil((distance / speed) * 60 / 10) * 10;

        setMyTravelDuration(durationMinutes);
      }
    };
    
    calculateMyTravel();
  }, [currentRoom, isOwner, travelMode, currentUser]);

  const handleModeChange = useCallback(async (newMode) => {
    // ⚠️ 확정된 방은 재계산하지 않음 (조회만 가능)
    if (currentRoom?.confirmedAt) {
      setTravelMode(newMode);
      return;
    }

    if (!currentRoom || !currentRoom.timeSlots || currentRoom.timeSlots.length === 0) {
      setError('시간표 데이터가 없습니다. 먼저 자동 배정을 실행해주세요.');
      return;
    }

    setTravelMode(newMode);
    setError(null);

    if (newMode === 'normal') {
      setEnhancedSchedule(null);
      return;
    }

    // ✅ 이미 조정된 슬롯이면 재계산하지 않고 서버 데이터를 그대로 사용
    const isAlreadyAdjusted = currentRoom.timeSlots.some(slot => slot.adjustedForTravelTime);
    if (isAlreadyAdjusted) {
      // 🔧 수정: enhancedSchedule을 null로 설정하여 getCurrentScheduleData가 currentRoom을 사용하도록 유도
      // 이렇게 하면 서버에서 데이터가 갱신(챗봇 변경 등)되었을 때 즉시 반영됨
      setEnhancedSchedule(null);
      return;
    }

    setIsCalculating(true);
    try {
      // 도보 모드일 때 먼저 검증
      if (newMode === 'walking') {
        const validation = await travelScheduleCalculator.validateWalkingMode(currentRoom);
        if (!validation.isValid) {
          throw new Error(validation.message);
        }
      }

      const result = await travelScheduleCalculator.recalculateScheduleWithTravel(
        currentRoom,
        newMode
      );

      setEnhancedSchedule(result);

      // ⚠️ 서버 저장은 "적용" 버튼 클릭 시에만 수행
      // (모드 선택만으로는 서버에 저장하지 않음)
    } catch (err) {
      if (err.message.includes('주소 정보가 필요합니다')) {
        setError(err.message);
      } else if (err.message.includes('도보 이동 시간이 1시간을 초과') || err.message.includes('차단되었습니다')) {
        setError(err.message);
      } else {
        setError('이동 시간 계산 중 오류가 발생했습니다. 모든 사용자가 프로필에서 주소를 입력했는지 확인해주세요.');
      }
      setTravelMode('normal');
      setEnhancedSchedule(null);
    } finally {
      setIsCalculating(false);
    }

  }, [currentRoom, isOwner]);

  const getCurrentScheduleData = useCallback(() => {
    // 1. Enhanced Schedule (로컬 계산 결과)가 있으면 최우선 사용
    if (enhancedSchedule) {
      if (!isOwner) {
        return {
          timeSlots: enhancedSchedule.timeSlots.filter(slot => !slot.isTravel),
          travelSlots: [],
          travelMode: travelMode,
          myTravelDuration // 🆕 추가
        };
      }
      return {
        timeSlots: enhancedSchedule.timeSlots.filter(slot => !slot.isTravel),
        travelSlots: enhancedSchedule.travelSlots,
        travelMode: travelMode,
        myTravelDuration // 🆕 추가
      };
    }

    // 2. 로컬 계산 결과가 없으면 서버 데이터(currentRoom) 사용
    // 일반 모드이거나, 서버에 travelTimeSlots가 없는 경우
    if (travelMode === 'normal' || !currentRoom?.travelTimeSlots) {
       return {
         timeSlots: currentRoom?.timeSlots || [],
         travelSlots: [],
         travelMode: travelMode,
         myTravelDuration // 🆕 추가
       };
    }
    
    // 3. 서버에 저장된 이동시간 데이터가 있는 경우 (방장만 보기)
    if (isOwner) {
        // ✅ 명확하게 분리 (null 체크 강화)
        const allSlots = currentRoom?.timeSlots || [];
        const mixedTravelSlots = allSlots.filter(slot => 
          slot?.isTravel === true || slot?.subject === '이동시간'
        );
        const regularSlots = allSlots.filter(slot => 
          slot?.isTravel !== true && slot?.subject !== '이동시간'
        );
        
        // ✅ travelTimeSlots와 mixedTravelSlots 병합
        const combinedTravelSlots = [
            ...(currentRoom?.travelTimeSlots || []),
            ...mixedTravelSlots
        ];

        return {
            timeSlots: regularSlots, // 수업 시간만 반환
            // ✅ travelMode를 슬롯에 명시적으로 주입 + color 추가
            travelSlots: combinedTravelSlots.map(slot => {
                // color가 없으면 room.members에서 가져오기
                let slotColor = slot.color;
                if (!slotColor && slot.user) {
                    const userId = slot.user._id || slot.user;
                    const member = currentRoom.members.find(m => 
                        (m.user._id || m.user).toString() === userId.toString()
                    );
                    slotColor = member?.color || '#87CEEB';
                }
                
                return {
                    ...slot,
                    isTravel: true,  // 명시적으로 설정
                    travelMode: travelMode,
                    color: slotColor  // ✅ 조원 색상 추가
                };
            }), 
            travelMode: travelMode,
            myTravelDuration // 🆕 추가
        };
    } 
    
    // 4. 조원도 방장과 동일하게 이동시간 슬롯 받음 (WeekView에서 "배정불가"로 표시)
    // ✅ 명확하게 분리 (방장 로직과 동일)
    const allSlots = currentRoom?.timeSlots || [];
    const mixedTravelSlots = allSlots.filter(slot => 
      slot?.isTravel === true || slot?.subject === '이동시간'
    );
    const regularSlots = allSlots.filter(slot => 
      slot?.isTravel !== true && slot?.subject !== '이동시간'
    );
    
    // ✅ travelTimeSlots와 mixedTravelSlots 병합 (방장과 동일)
    const combinedTravelSlots = [
        ...(currentRoom?.travelTimeSlots || []),
        ...mixedTravelSlots
    ];

    return {
        timeSlots: regularSlots, // 수업 시간만 반환
        // ✅ 조원도 이동시간 슬롯 받음 (방장과 동일한 구조)
        travelSlots: combinedTravelSlots.map(slot => {
            // color가 없으면 room.members에서 가져오기
            let slotColor = slot.color;
            if (!slotColor && slot.user) {
                const userId = slot.user._id || slot.user;
                const member = currentRoom.members.find(m => 
                    (m.user._id || m.user).toString() === userId.toString()
                );
                slotColor = member?.color || '#87CEEB';
            }
            
            return {
                ...slot,
                isTravel: true,  // 명시적으로 설정
                travelMode: travelMode,
                color: slotColor  // ✅ 조원 색상 추가
            };
        }), 
        travelMode: travelMode,
        myTravelDuration // 🆕 추가
    };

  }, [travelMode, enhancedSchedule, currentRoom, isCalculating, isOwner, myTravelDuration]);

  const getWeekViewData = useCallback((weekStartDate) => {
    const scheduleData = getCurrentScheduleData();
    return travelScheduleCalculator.formatForWeekView(
      scheduleData.timeSlots,
      scheduleData.travelSlots,
      weekStartDate
    );
  }, [getCurrentScheduleData]);

  const getMonthViewData = useCallback(() => {
    const scheduleData = getCurrentScheduleData();
    return travelScheduleCalculator.formatForMonthView(
      scheduleData.timeSlots,
      scheduleData.travelSlots
    );
  }, [getCurrentScheduleData]);

  /**
   * 현재 선택된 이동시간 모드를 확정합니다 (조원들에게 표시)
   * 방장만 호출 가능
   */
  const confirmTravelMode = useCallback(async () => {
    if (!isOwner) {
      setError('방장만 모드를 확정할 수 있습니다.');
      return false;
    }

    if (!currentRoom?._id) {
      setError('방 정보가 없습니다.');
      return false;
    }

    isConfirmingRef.current = true;
    try {
      const result = await coordinationService.confirmTravelMode(currentRoom._id, travelMode);
      // 서버 데이터가 반영될 때까지 잠시 대기 후 플래그 해제
      setTimeout(() => {
        isConfirmingRef.current = false;
      }, 2000);
      return true;
    } catch (err) {
      setError('모드 확정에 실패했습니다.');
      isConfirmingRef.current = false;
      return false;
    }
  }, [currentRoom, travelMode, isOwner]);

  // 현재 방이 변경되면 모든 관련 상태를 초기화합니다.
  // 🔧 버그 수정: 같은 방 ID가 재fetch되어도 상태를 유지하도록 수정
  // 🆕 버그 수정: 방의 currentTravelMode를 기본값으로 사용하여 서버 상태 유지
  useEffect(() => {
    const currentRoomId = currentRoom?._id?.toString();

    // 실제로 다른 방으로 변경되었을 때만 초기화 (같은 방 재fetch는 무시)
    if (currentRoomId !== prevRoomIdRef.current) {
      // 🆕 서버의 currentTravelMode를 초기값으로 사용 (confirmedTravelMode 우선)
      const initialMode = currentRoom?.confirmedTravelMode || currentRoom?.currentTravelMode || 'normal';
      setTravelMode(initialMode);
      setEnhancedSchedule(null);
      setError(null);
      prevRoomIdRef.current = currentRoomId;
    }
  }, [currentRoom?._id, currentRoom?.currentTravelMode, currentRoom?.confirmedTravelMode]);

  // ⚠️ 자동배정 후 무한 루프 방지를 위해 모든 재계산 effect 제거
  // 사용자가 수동으로 이동시간 모드를 다시 선택하도록 함

  // 🆕 방장이 travelMode를 변경했을 때 조원이 동기화 받을 수 있도록 처리
  useEffect(() => {
    const currentRoomId = currentRoom?._id?.toString();
    const serverMode = currentRoom?.confirmedTravelMode || currentRoom?.currentTravelMode || 'normal';

    // 같은 방 내에서
    if (currentRoomId === prevRoomIdRef.current) {
      // 서버의 모드 값이 실제로 변경되었을 때만 로컬 상태 업데이트
      if (serverMode !== prevServerModeRef.current) {
        if (travelMode !== serverMode && !isCalculating) {
            setTravelMode(serverMode);
         }
         prevServerModeRef.current = serverMode;
      }
    } else {
      // 방이 바뀌었으면 ref 업데이트만 (초기화는 위쪽 useEffect에서 함)
      prevServerModeRef.current = serverMode;
    }
  }, [currentRoom?.currentTravelMode, currentRoom?.confirmedTravelMode, currentRoom?._id, isCalculating, travelMode]);

  return {
    travelMode,
    handleModeChange,
    confirmTravelMode,
    isCalculating,
    error,
    enhancedSchedule,
    getCurrentScheduleData,
    getWeekViewData,
    getMonthViewData
  };
};