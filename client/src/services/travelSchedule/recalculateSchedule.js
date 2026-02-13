/**
 * recalculateSchedule.js - 이동시간 반영 스케줄 재계산
 *
 * 📍 위치: services/travelSchedule/recalculateSchedule.js
 * 🔗 연결: ../travelScheduleCalculator.js (index.js)
 */

import travelModeService from '../travelModeService';
import { mergeConsecutiveTimeSlots } from '../../utils/timetableHelpers';
import { formatTime, parseTime, toLocalDateString, unmergeBlock } from './timeUtils';
import { checkOverlap } from './conflictUtils';
import { buildMemberPreferences, isWithinPreferredTime } from './memberUtils';
import { sortSlotsByDistance } from './distanceSorting';
import { findAvailableSlot, findAvailableSlotsWithSplit } from './slotPlacement';

export const recalculateScheduleWithTravel = async (currentRoom, travelMode = 'normal') => {
    if (!currentRoom || !currentRoom.timeSlots || currentRoom.timeSlots.length === 0) {
        throw new Error('시간표 데이터가 없습니다.');
    }
    if (travelMode === 'normal') {
        return { timeSlots: currentRoom.timeSlots.map(s => ({...s, isTravel: false})), travelSlots: [], travelMode: 'normal' };
    }

    const owner = currentRoom.owner;

    if (!owner.addressLat || !owner.addressLng) {
        throw new Error('방장의 주소 정보가 필요합니다. 프로필에서 주소를 설정해주세요.');
    }

    const members = currentRoom.members;
    const memberLocations = {};

    members.forEach(m => {

        if (m.user && m.user.addressLat && m.user.addressLng) {
            let userId = m.user._id || m.user.id;
            if (userId) {
                memberLocations[userId.toString()] = {
                    lat: m.user.addressLat,
                    lng: m.user.addressLng,
                    name: `${m.user.firstName} ${m.user.lastName}`,
                    color: m.color || '#9CA3AF'
                };
            }
        }
    });

    // 🆕 학생별 선호시간 정보 생성
    const memberPreferences = buildMemberPreferences(currentRoom);

    // 🔍 디버깅: 선호시간 정보 출력
    // 1. Merge raw slots into activity blocks
    const mergedSlots = mergeConsecutiveTimeSlots(currentRoom.timeSlots);

    // 🆕 이동 모드에 따라 정렬 방식 결정
    let sortedMergedSlots;

    if (travelMode === 'normal') {
        // 일반 모드: 시간 순서대로만 정렬
        sortedMergedSlots = mergedSlots.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            if (dateA.getTime() !== dateB.getTime()) {
                return dateA.getTime() - dateB.getTime();
            }
            return a.startTime.localeCompare(b.startTime);
        });
    } else {
        // 이동 모드 (대중교통, 자동차 등): 날짜별로 거리 순서대로 정렬
        sortedMergedSlots = sortSlotsByDistance(mergedSlots, owner, memberLocations);

        // 🔍 디버깅: 거리 순서 출력
    }

    // 🆕 이동시간 슬롯을 저장할 배열 추가
    const travelSlotsArray = [];

    // 🆕 이전 위치 추적 (초기값: 방장)
    let previousLocation = {
        lat: owner.addressLat,
        lng: owner.addressLng,
        name: '방장',
        color: '#4B5563'  // 방장은 기본 회색
    };

    const allResultSlots = [];

    // 🆕 날짜별로 배정된 슬롯 추적 (겹침 방지)
    const assignedSlotsByDate = {};

    // 🆕 각 날짜별 마지막 위치 추적 (재배정 시 사용)
    const lastLocationByDate = {};

    // 🆕 방장의 스케줄을 assignedSlotsByDate에 미리 추가 (학생들이 방장 시간에 배치되지 않도록)
    const ownerIdStr = owner._id.toString();
    for (const mergedSlot of sortedMergedSlots) {
        let userId = mergedSlot.user;
        if (typeof userId === 'object' && userId !== null) {
            userId = userId._id || userId.id;
        }

        if (userId && userId.toString() === ownerIdStr) {
            // 방장의 슬롯
            const slotDate = toLocalDateString(mergedSlot.date);
            if (!assignedSlotsByDate[slotDate]) {
                assignedSlotsByDate[slotDate] = [];
            }
            assignedSlotsByDate[slotDate].push({
                startMinutes: parseTime(mergedSlot.startTime),
                endMinutes: parseTime(mergedSlot.endTime),
                userId: ownerIdStr,
                isOwner: true
            });
        }
    }

    // 🔧 수정: 거리 순서 연속 배치를 위해 날짜 리셋 로직 제거
    // 이전 슬롯 정보 추적
    let previousSlotOriginalDate = null;  // 거리 정렬 순서상 이전 슬롯의 원본 날짜
    let previousActivityEndMinutes = 0;  // 이전 활동 종료 시간 (분)
    let previousUserId = null;  // 이전 슬롯의 사용자 ID
    let previousSlotIndex = -1;  // 거리 정렬 순서 인덱스

    for (let slotIndex = 0; slotIndex < sortedMergedSlots.length; slotIndex++) {
        const mergedSlot = sortedMergedSlots[slotIndex];
        const slotDate = toLocalDateString(mergedSlot.date);

        // 🔧 수정: 날짜 리셋 로직 제거 - 거리 순서대로 연속 배치
        let userId = mergedSlot.user;
        if (typeof userId === 'object' && userId !== null) {
            userId = userId._id || userId.id;
        }
        if (!userId) {
            allResultSlots.push(...unmergeBlock(mergedSlot));
            continue;
        }

        const userIdStr = userId.toString();

        // 🆕 방장의 슬롯은 이동시간 없이 원본 그대로 추가
        if (userIdStr === owner._id.toString()) {
            allResultSlots.push(...unmergeBlock(mergedSlot));
            // previousLocation은 업데이트하지 않음 (방장은 이동하지 않음)
            // previousActivityEndMinutes도 업데이트하지 않음
            continue;
        }

        const memberLocation = memberLocations[userIdStr];
        if (!memberLocation) {
            allResultSlots.push(...unmergeBlock(mergedSlot));
            continue;
        }

        try {
            // 먼저 현재 슬롯의 시간 정보 파싱
            const slotStartMinutes = parseTime(mergedSlot.startTime);
            const slotEndMinutes = parseTime(mergedSlot.endTime);
            const activityDurationMinutes = slotEndMinutes - slotStartMinutes;

            // 🔧 수정: 같은 날짜 내에서는 이전 학생에서 출발, 다른 날짜면 방장에서 출발
            let actualPreviousLocation;

            // 날짜가 바뀌었거나 첫 슬롯이면 방장에서 출발
            if (!previousSlotOriginalDate || previousSlotOriginalDate !== slotDate) {
                actualPreviousLocation = {
                    lat: owner.addressLat,
                    lng: owner.addressLng,
                    name: '방장',
                    color: '#4B5563'
                };

            } else {
                // 같은 날짜면 이전 학생에서 출발
                actualPreviousLocation = previousLocation;

            }

            // 이전 위치에서 현재 학생 위치로 이동 시간 계산
            const travelInfo = await travelModeService.calculateTravelTime(
                { lat: actualPreviousLocation.lat, lng: actualPreviousLocation.lng },
                { lat: memberLocation.lat, lng: memberLocation.lng },
                travelMode
            );

            const travelDurationSeconds = travelInfo.duration || 0;
            const travelDurationMinutes = Math.ceil(travelDurationSeconds / 60 / 10) * 10;


            if (travelDurationMinutes === 0) {
                allResultSlots.push(...unmergeBlock(mergedSlot));
                // 🔧 수정: previousLocation 업데이트 (같은 날짜 내 연속 이동)
                previousLocation = memberLocation;
                continue;
            }

            // 🔧 수정: 거리 순서로 연속 배치
            let targetDate = slotDate;
            let newActivityStartTimeMinutes, newActivityEndTimeMinutes, newTravelStartMinutes, newTravelEndTimeMinutes;

            // 같은 날짜에 이미 배정된 슬롯이 있는지 확인
            const assignedOnDate = assignedSlotsByDate[slotDate] || [];

            // 🔧 수정: 거리 순서상 이전 학생 정보 사용 (assignedSlotsByDate가 아닌 previousActivityEndMinutes 직접 사용)
            let lastAssignedSlot = null;
            if (previousSlotOriginalDate === slotDate && previousUserId && previousActivityEndMinutes > 0) {
                // 이전 학생이 같은 원본 날짜였으면 연속 배치 (재배정 여부 무관)
                lastAssignedSlot = {
                    userId: previousUserId,
                    endMinutes: previousActivityEndMinutes
                };
            }

            // 같은 날짜 내에서 이미 배정된 슬롯이 있으면 연속 배치
            if (previousSlotOriginalDate === slotDate && lastAssignedSlot && lastAssignedSlot.userId !== userIdStr) {
                // 연속 배치: 마지막 배정 종료 시간부터 시작
                newTravelStartMinutes = lastAssignedSlot.endMinutes;
                newTravelEndTimeMinutes = newTravelStartMinutes + travelDurationMinutes;
                newActivityStartTimeMinutes = newTravelEndTimeMinutes;
                newActivityEndTimeMinutes = newActivityStartTimeMinutes + activityDurationMinutes;


            } else {
                // 새로운 날짜 또는 첫 슬롯: 원래 시간 기준
                newActivityStartTimeMinutes = slotStartMinutes;
                newActivityEndTimeMinutes = slotEndMinutes;
                newTravelStartMinutes = slotStartMinutes - travelDurationMinutes;
                newTravelEndTimeMinutes = slotStartMinutes;


            }




            // 🔒 방 금지시간 체크 - 금지시간을 절대 침범하지 않도록 조정
            // 명시적으로 지정한 금지시간만 사용 (점심시간 등)
            const allBlockedTimes = currentRoom.settings?.blockedTimes || [];

            let canPlace = true;  // 배치 가능 여부 플래그

            for (const blocked of allBlockedTimes) {
                const blockedStart = parseTime(blocked.startTime);
                const blockedEnd = parseTime(blocked.endTime);

                // 이동시간 또는 활동시간이 금지시간과 겹치는지 체크
                const travelOverlap = newTravelStartMinutes < blockedEnd && newTravelEndTimeMinutes > blockedStart;
                const activityOverlap = newActivityStartTimeMinutes < blockedEnd && newActivityEndTimeMinutes > blockedStart;

                if (travelOverlap || activityOverlap) {
                    canPlace = false;
                    break;
                }
            }

            // 🆕 선호시간 체크 (금지시간 체크 통과 후)
            if (canPlace) {
                // 🔧 수정: targetDate의 요일 사용
                const targetDayOfWeek = new Date(targetDate).getDay();

                // 🔧 수정: 이동시간 시작부터 수업 종료까지 전체가 선호시간 내인지 체크
                const isAdjustedPreferred = isWithinPreferredTime(
                    userId,
                    targetDayOfWeek,
                    newTravelStartMinutes,        // 이동시간 시작
                    newActivityEndTimeMinutes,    // 수업 종료
                    memberPreferences,
                    targetDate                    // 날짜 정보 추가
                );

                // 🔧 수정: 선호시간 체크 결과 적용
                if (!isAdjustedPreferred) {
                    canPlace = false;
                    console.log(`❌ [선호시간 벗어남] ${targetDate} ${formatTime(newTravelStartMinutes)}-${formatTime(newActivityEndTimeMinutes)} (이동+수업) - ${memberLocation.name}`);
                }
            }

            // 🔧 추가: 24시간 범위 체크
            if (canPlace && newActivityEndTimeMinutes > 1440) {  // 24:00 = 1440분
                canPlace = false;
                console.log(`❌ [하루 범위 초과] ${targetDate} ${formatTime(newActivityEndTimeMinutes)} - ${memberLocation.name}`);
            }

            // 🆕 겹침 체크 (선호시간 체크 통과 후)
            if (canPlace) {
                // 🔧 수정: targetDate로 겹침 체크
                const travelOverlap = checkOverlap(
                    targetDate,
                    newTravelStartMinutes,
                    newTravelEndTimeMinutes,
                    assignedSlotsByDate
                );

                const activityOverlap = checkOverlap(
                    targetDate,
                    newActivityStartTimeMinutes,
                    newActivityEndTimeMinutes,
                    assignedSlotsByDate
                );

                if (travelOverlap || activityOverlap) {
                    console.log(`❌ [겹침 발견] ${targetDate} - ${memberLocation.name}`, {
                        이동시간: `${formatTime(newTravelStartMinutes)} - ${formatTime(newTravelEndTimeMinutes)}`,
                        수업시간: `${formatTime(newActivityStartTimeMinutes)} - ${formatTime(newActivityEndTimeMinutes)}`,
                        이동시간겹침: travelOverlap,
                        수업시간겹침: activityOverlap,
                        원래날짜: slotDate,
                        배치날짜: targetDate
                    });
                    canPlace = false;
                }
            }

            // 배치 불가능하면 다른 요일로 재배정 시도
            if (!canPlace) {

                // 🆕 재배정 시 날짜별 이동 출발지 확인 (이미 배치된 학생이 있으면 그 위치에서 출발)
                // 원본 날짜의 마지막 위치를 확인 (재배정은 다른 날짜로 하므로, 각 날짜의 마지막 위치 체크)

                // 방장에서 출발하는 이동시간 (기본값)
                const ownerToMemberTravelInfo = await travelModeService.calculateTravelTime(
                    { lat: owner.addressLat, lng: owner.addressLng },
                    { lat: memberLocation.lat, lng: memberLocation.lng },
                    travelMode
                );
                const ownerTravelDurationSeconds = ownerToMemberTravelInfo.duration || 0;
                const ownerTravelDurationMinutes = Math.ceil(ownerTravelDurationSeconds / 60 / 10) * 10;


                // 🆕 연속 배치 실패 시 최소 시작 시간 계산
                let minStartTime = 0;
                if (previousSlotOriginalDate === slotDate && lastAssignedSlot && lastAssignedSlot.userId !== userIdStr) {
                    // 연속 배치 실패: 이전 학생 종료 시간 이후로만 재배정
                    minStartTime = lastAssignedSlot.endMinutes;
                    console.log(`🔧 [연속 배치 재배정] ${memberLocation.name}: 최소 시작 시간 ${formatTime(minStartTime)} (이전 학생 종료 시간)`);
                }

                // 먼저 한 블록으로 배치 시도
                let alternativePlacement = await findAvailableSlot(
                    mergedSlot,
                    userId,
                    memberPreferences,
                    ownerTravelDurationMinutes,
                    activityDurationMinutes,
                    allBlockedTimes,
                    assignedSlotsByDate,
                    { lat: owner.addressLat, lng: owner.addressLng, name: '방장' },
                    lastLocationByDate,  // 🆕 각 날짜의 마지막 위치
                    memberLocation,      // 🆕 현재 학생 위치
                    travelMode,          // 🆕 이동 모드
                    travelModeService,   // 🆕 이동시간 계산 서비스
                    minStartTime         // 🆕 최소 시작 시간
                );

                // 한 블록으로 배치 실패 → 여러 블록으로 분할 시도
                if (!alternativePlacement.success) {
                    alternativePlacement = await findAvailableSlotsWithSplit(
                        mergedSlot,
                        userId,
                        memberPreferences,
                        ownerTravelDurationMinutes,  // ← 수정: 방장 기준 이동시간
                        activityDurationMinutes,
                        allBlockedTimes,
                        assignedSlotsByDate,
                        { lat: owner.addressLat, lng: owner.addressLng, name: '방장' },
                        lastLocationByDate,  // 🆕 각 날짜의 마지막 위치
                        memberLocation,      // 🆕 현재 학생 위치
                        travelMode,          // 🆕 이동 모드
                        travelModeService,   // 🆕 이동시간 계산 서비스
                        ownerToMemberTravelInfo,  // 🆕 방장→학생 이동시간
                        minStartTime         // 🆕 최소 시작 시간
                    );
                }

                if (alternativePlacement.success && alternativePlacement.blocks) {
                    // 여러 블록으로 분할 배치 성공

                    for (const block of alternativePlacement.blocks) {
                        // 🆕 이동시간이 필요한 블록만 이동시간 블록 생성
                        if (block.needsTravel) {
                            const altTravelBlock = {
                            ...mergedSlot,
                            date: block.date,
                            day: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][block.dayOfWeek],
                            isTravel: true,
                            startTime: formatTime(block.travelStartMinutes),
                            endTime: formatTime(block.travelEndMinutes),
                            subject: '이동시간',
                            user: userId,
                            color: memberLocation.color,
                            travelInfo: {
                                duration: block.travelDuration * 60, // 분을 초로 변환
                                durationText: `${block.travelDuration}분`,
                                from: block.fromLocationName || '방장',
                                to: memberLocation.name
                            },
                        };

                        const altActivityBlock = {
                            ...mergedSlot,
                            date: block.date,
                            day: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][block.dayOfWeek],
                            isTravel: false,
                            startTime: formatTime(block.activityStartMinutes),
                            endTime: formatTime(block.activityEndMinutes),
                            subject: `${mergedSlot.subject || '수업'} (${block.activityDuration}분)`,
                            // 🆕 원본 시간 및 이동시간 메타데이터 추가
                            originalStartTime: mergedSlot.originalStartTime || mergedSlot.startTime,
                            originalEndTime: mergedSlot.originalEndTime || mergedSlot.endTime,
                            actualStartTime: formatTime(block.travelStartMinutes),
                            travelTimeBefore: block.travelDuration,
                            adjustedForTravelTime: true
                        };

                        // travelSlots 배열에 추가
                            travelSlotsArray.push({
                                date: block.date,
                                startTime: formatTime(block.travelStartMinutes),
                                endTime: formatTime(block.travelEndMinutes),
                                from: block.fromLocationName || '방장',
                                to: memberLocation.name,
                                user: userId,
                                color: memberLocation.color,
                                travelInfo: {
                                    duration: block.travelDuration * 60, // 분을 초로 변환
                                    durationText: `${block.travelDuration}분`
                                },
                                travelMode: travelMode
                            });

                            // 10분 단위로 분할 후 추가
                            allResultSlots.push(...unmergeBlock(altTravelBlock));
                        }

                        // 수업 블록은 항상 추가
                        const altActivityBlock = {
                            ...mergedSlot,
                            date: block.date,
                            day: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][block.dayOfWeek],
                            isTravel: false,
                            startTime: formatTime(block.activityStartMinutes),
                            endTime: formatTime(block.activityEndMinutes),
                            subject: `${mergedSlot.subject || '수업'} (${block.activityDuration}분)`,
                            // 🆕 원본 시간 및 이동시간 메타데이터 추가
                            originalStartTime: mergedSlot.originalStartTime || mergedSlot.startTime,
                            originalEndTime: mergedSlot.originalEndTime || mergedSlot.endTime,
                            actualStartTime: formatTime(block.travelStartMinutes),
                            travelTimeBefore: block.travelDuration,
                            adjustedForTravelTime: true
                        };
                        allResultSlots.push(...unmergeBlock(altActivityBlock));

                        // 🆕 해당 날짜의 마지막 위치 업데이트 (더 늦게 끝나는 경우만)
                        const blockDateStr = toLocalDateString(block.date);
                        if (!lastLocationByDate[blockDateStr] || block.activityEndMinutes > lastLocationByDate[blockDateStr].endMinutes) {
                            lastLocationByDate[blockDateStr] = {
                                location: memberLocation,
                                endMinutes: block.activityEndMinutes
                            };
                        }
                    }

                    // 🔧 수정: 마지막 블록 정보로 이전 슬롯 정보 업데이트
                    const lastBlock = alternativePlacement.blocks[alternativePlacement.blocks.length - 1];
                    const lastBlockDateStr = new Date(lastBlock.date).toISOString().split('T')[0];
                    previousSlotOriginalDate = slotDate;  // 🔧 거리 순서 유지: 원본 날짜 저장
                    previousActivityEndMinutes = lastBlock.activityEndMinutes;
                    previousUserId = userIdStr;
                    previousSlotIndex = slotIndex;
                    previousLocation = memberLocation;  // 🔧 수정: 같은 날짜 내 연속 이동

                    continue;
                } else if (alternativePlacement.success) {
                    // 다른 요일에 배치 성공

                    // 🔄 실제 이동시간 확인 (findAvailableSlot에서 이미 계산됨)
                    const targetDateStr = alternativePlacement.dateStr;
                    let actualTravelMinutes = alternativePlacement.actualTravelMinutes || ownerTravelDurationMinutes;
                    let actualFromLocationName = '방장';  // 기본값

                    // findAvailableSlot에서 재계산되었는지 확인
                    if (alternativePlacement.actualTravelMinutes && alternativePlacement.actualTravelMinutes !== ownerTravelDurationMinutes) {
                        const lastLocOnTargetDate = lastLocationByDate[targetDateStr];
                        if (lastLocOnTargetDate && lastLocOnTargetDate.location) {
                            actualFromLocationName = lastLocOnTargetDate.location.name;
                        }
                    } else {
                    }

                    // 🔍 추가 확인: assignedSlotsByDate에서 실제 마지막 학생 찾기
                    const assignedSlotsOnTarget = assignedSlotsByDate[targetDateStr] || [];
                    const targetStartMinutes = alternativePlacement.travelStartMinutes || alternativePlacement.activityStartMinutes;

                    // 현재 슬롯보다 먼저 시작하는 슬롯 중 가장 늦게 끝나는 슬롯 찾기
                    const slotsBeforeCurrent = assignedSlotsOnTarget.filter(slot =>
                        slot.startMinutes < targetStartMinutes && slot.endMinutes <= targetStartMinutes
                    );

                    if (slotsBeforeCurrent.length > 0) {
                        const lastSlot = slotsBeforeCurrent.reduce((latest, slot) =>
                            slot.endMinutes > latest.endMinutes ? slot : latest
                        );

                        // 그 슬롯의 사용자 위치 찾기
                        const lastUserId = lastSlot.userId;
                        let actualPreviousLocationForAlt;

                        if (lastUserId === owner._id.toString()) {
                            actualPreviousLocationForAlt = {
                                lat: owner.addressLat,
                                lng: owner.addressLng,
                                name: '방장'
                            };
                        } else {
                            actualPreviousLocationForAlt = memberLocations[lastUserId];
                        }

                        if (actualPreviousLocationForAlt) {
                            try {
                                const lastToCurrentTravel = await travelModeService.calculateTravelTime(
                                    { lat: actualPreviousLocationForAlt.lat, lng: actualPreviousLocationForAlt.lng },
                                    { lat: memberLocation.lat, lng: memberLocation.lng },
                                    travelMode
                                );
                                actualTravelMinutes = Math.ceil(lastToCurrentTravel.duration / 60 / 10) * 10;
                                actualFromLocationName = actualPreviousLocationForAlt.name;
                            } catch (err) {
                            }
                        }
                    } else {
                    }

                    // 재배정된 날짜와 시간으로 블록 생성 (실제 계산된 이동시간 사용)
                    const altTravelBlock = {
                        ...mergedSlot,
                        date: alternativePlacement.date,
                        day: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][alternativePlacement.dayOfWeek],
                        isTravel: true,
                        startTime: formatTime(alternativePlacement.travelStartMinutes),
                        endTime: formatTime(alternativePlacement.travelStartMinutes + actualTravelMinutes),  // ← 실제 이동시간으로 종료 시간 재계산
                        subject: '이동시간',
                        user: userId,
                        color: memberLocation.color,
                        travelInfo: {
                            duration: actualTravelMinutes * 60,  // 분을 초로 변환
                            durationText: `${actualTravelMinutes}분`,
                            from: actualFromLocationName,  // ← 실제 출발지
                            to: memberLocation.name
                        },
                    };

                    // ← 수업 시작/종료 시간도 실제 이동시간에 맞춰 재계산
                    const actualActivityStartMinutes = alternativePlacement.travelStartMinutes + actualTravelMinutes;
                    const actualActivityEndMinutes = actualActivityStartMinutes + activityDurationMinutes;

                    const altActivityBlock = {
                        ...mergedSlot,
                        date: alternativePlacement.date,
                        day: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][alternativePlacement.dayOfWeek],
                        isTravel: false,
                        startTime: formatTime(actualActivityStartMinutes),
                        endTime: formatTime(actualActivityEndMinutes),
                        subject: mergedSlot.subject || '수업',
                        // 🆕 원본 시간 및 이동시간 메타데이터 추가
                        originalStartTime: mergedSlot.originalStartTime || mergedSlot.startTime,
                        originalEndTime: mergedSlot.originalEndTime || mergedSlot.endTime,
                        actualStartTime: formatTime(alternativePlacement.travelStartMinutes),
                        travelTimeBefore: actualTravelMinutes,
                        adjustedForTravelTime: true
                    };

                    // travelSlots 배열에 추가 (실제 계산된 정보 사용)
                    travelSlotsArray.push({
                        date: alternativePlacement.date,
                        startTime: formatTime(alternativePlacement.travelStartMinutes),
                        endTime: formatTime(alternativePlacement.travelStartMinutes + actualTravelMinutes),  // ← 실제 이동시간
                        from: actualFromLocationName,  // ← 실제 출발지
                        to: memberLocation.name,
                        user: userId,
                        color: memberLocation.color,
                        travelInfo: {
                            duration: actualTravelMinutes * 60,  // 분을 초로 변환
                            durationText: `${actualTravelMinutes}분`
                        },
                        travelMode: travelMode
                    });

                    // 10분 단위로 분할 후 추가
                    allResultSlots.push(...unmergeBlock(altTravelBlock), ...unmergeBlock(altActivityBlock));

                    // assignedSlotsByDate에 기록 (실제 계산된 시간 사용)
                    if (!assignedSlotsByDate[alternativePlacement.dateStr]) {
                        assignedSlotsByDate[alternativePlacement.dateStr] = [];
                    }
                    assignedSlotsByDate[alternativePlacement.dateStr].push({
                        startMinutes: alternativePlacement.travelStartMinutes,
                        endMinutes: actualActivityEndMinutes,  // ← 실제 수업 종료 시간
                        userId: userId
                    });

                    // 🆕 해당 날짜의 마지막 위치 업데이트 (더 늦게 끝나는 경우만)
                    if (!lastLocationByDate[alternativePlacement.dateStr] || actualActivityEndMinutes > lastLocationByDate[alternativePlacement.dateStr].endMinutes) {
                        lastLocationByDate[alternativePlacement.dateStr] = {
                            location: memberLocation,
                            endMinutes: actualActivityEndMinutes
                        };
                    }

                    // 🔧 수정: 이전 슬롯 정보 업데이트 (거리 연속 배치용)
                    previousSlotOriginalDate = slotDate;  // 🔧 거리 순서 유지: 원본 날짜 저장
                    previousActivityEndMinutes = actualActivityEndMinutes;
                    previousUserId = userIdStr;
                    previousSlotIndex = slotIndex;
                    previousLocation = memberLocation;  // 🔧 수정: 같은 날짜 내 연속 이동

                    continue;
                } else {
                    console.log(`❌ [재배정 실패] ${slotDate} - ${memberLocation.name}`, {
                        원본시간: `${mergedSlot.startTime} - ${mergedSlot.endTime}`,
                        수업시간: `${activityDurationMinutes}분`,
                        이동시간: `${travelDurationMinutes}분`,
                        사유: '모든 날짜에서 배치 불가능'
                    });

                    // ❌ 원본 슬롯도 추가하지 않음 (선호시간 외 배치 방지)
                    // allResultSlots.push(...unmergeBlock(mergedSlot));

                    // 다음 슬롯으로 이동
                    continue;
                }
            }

            // 🔧 수정: targetDate를 사용해서 블록 생성
            const targetDateObj = new Date(targetDate);
            const targetDayOfWeek = targetDateObj.getDay();
            const targetDayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][targetDayOfWeek];

            const travelBlock = {
                ...mergedSlot,
                date: targetDateObj,  // targetDate 사용
                day: targetDayName,
                isTravel: true,
                startTime: formatTime(newTravelStartMinutes),
                endTime: formatTime(newTravelEndTimeMinutes),
                subject: '이동시간',
                user: userId,
                color: memberLocation.color,
                travelInfo: {
                    ...travelInfo,
                    durationText: `${travelDurationMinutes}분`,
                    from: actualPreviousLocation.name,
                    to: memberLocation.name
                },
            };

            const activityBlock = {
                ...mergedSlot,
                date: targetDateObj,  // targetDate 사용
                day: targetDayName,
                isTravel: false,
                startTime: formatTime(newActivityStartTimeMinutes),
                endTime: formatTime(newActivityEndTimeMinutes),
                subject: mergedSlot.subject || '수업',
                originalStartTime: mergedSlot.originalStartTime || mergedSlot.startTime,
                originalEndTime: mergedSlot.originalEndTime || mergedSlot.endTime,
                actualStartTime: formatTime(newTravelStartMinutes),
                travelTimeBefore: travelDurationMinutes,
                adjustedForTravelTime: true
            };

            // 🆕 travelSlots 배열에 이동시간 슬롯 추가
            const travelSlotData = {
                date: targetDateObj,  // targetDate 사용
                startTime: formatTime(newTravelStartMinutes),
                endTime: formatTime(newTravelEndTimeMinutes),
                from: actualPreviousLocation.name,
                to: memberLocation.name,
                user: userId,  // 🆕 사용자 ID 추가
                color: memberLocation.color,  // 🆕 사용자 색상 추가
                travelInfo: {
                    ...travelInfo,
                    durationText: `${travelDurationMinutes}분`,
                    distanceText: travelInfo.distanceText || `${(travelInfo.distance / 1000).toFixed(1)}km`
                },
                travelMode: travelMode
            };

travelSlotsArray.push(travelSlotData);

            const travelSlots10min = unmergeBlock(travelBlock);
            const activitySlots10min = unmergeBlock(activityBlock);

            allResultSlots.push(...travelSlots10min, ...activitySlots10min);

            // 🔍 배치 성공 로그
            // 🔧 수정: targetDate로 기록 (거리 연속 배치 지원)
            if (!assignedSlotsByDate[targetDate]) {
                assignedSlotsByDate[targetDate] = [];
            }
            assignedSlotsByDate[targetDate].push({
                startMinutes: newTravelStartMinutes,
                endMinutes: newActivityEndTimeMinutes,
                userId: userId
            });

            // 🔧 수정: targetDate로 마지막 위치 업데이트
            if (!lastLocationByDate[targetDate] || newActivityEndTimeMinutes > lastLocationByDate[targetDate].endMinutes) {
                lastLocationByDate[targetDate] = {
                    location: memberLocation,
                    endMinutes: newActivityEndTimeMinutes
                };
            }

            // 🔧 수정: 이전 슬롯 정보 업데이트 (거리 연속 배치용)
            previousSlotOriginalDate = slotDate;  // 🔧 거리 순서 유지: 원본 날짜 저장
            previousActivityEndMinutes = newActivityEndTimeMinutes;
            previousUserId = userIdStr;
            previousSlotIndex = slotIndex;
            previousLocation = memberLocation;  // 🔧 수정: 같은 날짜 내 연속 이동

        } catch (error) {
            allResultSlots.push(...unmergeBlock(mergedSlot));
        }
    }

    // 🔄 [FINAL PASS] 모든 배치 완료 후 이동시간 재계산

    for (let i = 0; i < travelSlotsArray.length; i++) {
        const travelSlot = travelSlotsArray[i];
        const dateStr = toLocalDateString(travelSlot.date);
        const travelStartMinutes = parseTime(travelSlot.startTime);

        // 해당 날짜에서 현재 이동시간 슬롯보다 먼저 끝나는 슬롯 찾기
        const assignedOnDate = assignedSlotsByDate[dateStr] || [];
        const slotsBeforeCurrent = assignedOnDate.filter(slot =>
            slot.endMinutes <= travelStartMinutes && slot.userId !== travelSlot.user
        );

        if (slotsBeforeCurrent.length > 0) {
            // 가장 늦게 끝나는 슬롯 찾기
            const lastSlot = slotsBeforeCurrent.reduce((latest, slot) =>
                slot.endMinutes > latest.endMinutes ? slot : latest
            );
            // 이전 슬롯의 사용자 위치 찾기
            const lastUserId = lastSlot.userId;
            let fromLocation;
            let fromLocationName;

            if (lastUserId === owner._id.toString()) {
                fromLocation = { lat: owner.addressLat, lng: owner.addressLng };
                fromLocationName = '방장';
            } else {
                const lastMemberLocation = memberLocations[lastUserId];
                if (lastMemberLocation) {
                    fromLocation = { lat: lastMemberLocation.lat, lng: lastMemberLocation.lng };
                    fromLocationName = lastMemberLocation.name;
                }
            }

            if (fromLocation && fromLocationName !== travelSlot.from) {
                // 현재와 다른 출발지 → 재계산 필요
                const toUserId = travelSlot.user;
                const toLocation = memberLocations[toUserId];

                if (toLocation) {
                    try {
                        const recalcTravel = await travelModeService.calculateTravelTime(
                            fromLocation,
                            { lat: toLocation.lat, lng: toLocation.lng },
                            travelMode
                        );
                        const newTravelMinutes = Math.ceil(recalcTravel.duration / 60 / 10) * 10;
                        const oldTravelMinutes = parseTime(travelSlot.endTime) - parseTime(travelSlot.startTime);

                        if (newTravelMinutes !== oldTravelMinutes) {

                            // travelSlot 업데이트
                            travelSlot.from = fromLocationName;
                            travelSlot.endTime = formatTime(travelStartMinutes + newTravelMinutes);
                            travelSlot.travelInfo.durationText = `${newTravelMinutes}분`;
                            travelSlot.travelInfo.duration = recalcTravel.duration;

                            // 시간 차이 계산
                            const timeDifference = oldTravelMinutes - newTravelMinutes;
                            const newActivityStartMinutes = travelStartMinutes + newTravelMinutes;
                            const oldActivityStartMinutes = travelStartMinutes + oldTravelMinutes;

                            // allResultSlots에서 해당 이동 슬롯과 수업 슬롯 모두 업데이트
                            const dateObj = new Date(travelSlot.date);
                            let travelSlotsUpdated = 0;
                            let activitySlotsUpdated = 0;

                            allResultSlots.forEach(slot => {
                                // slot.user는 객체일 수 있으므로 ID 추출
                                const slotUserId = typeof slot.user === 'object' && slot.user ? (slot.user._id || slot.user.id) : slot.user;
                                const slotUserIdStr = slotUserId ? slotUserId.toString() : null;

                                if (new Date(slot.date).getTime() === dateObj.getTime() && slotUserIdStr === toUserId.toString()) {
                                    if (slot.isTravel && slot.startTime === travelSlot.startTime) {
                                        // 이동 슬롯 업데이트
                                        slot.endTime = formatTime(travelStartMinutes + newTravelMinutes);
                                        if (slot.travelInfo) {
                                            slot.travelInfo.durationText = `${newTravelMinutes}분`;
                                            slot.travelInfo.from = fromLocationName;
                                        }
                                        travelSlotsUpdated++;
                                    } else if (!slot.isTravel) {
                                        // 수업 슬롯의 시작/종료 시간 조정
                                        const slotStartMinutes = parseTime(slot.startTime);
                                        const slotEndMinutes = parseTime(slot.endTime);

                                        // 원래 수업 시작 시간 이후의 슬롯만 조정
                                        if (slotStartMinutes >= oldActivityStartMinutes) {
                                            const newSlotStartMinutes = slotStartMinutes - timeDifference;
                                            const newSlotEndMinutes = slotEndMinutes - timeDifference;
                                            slot.startTime = formatTime(newSlotStartMinutes);
                                            slot.endTime = formatTime(newSlotEndMinutes);
                                            activitySlotsUpdated++;
                                        }
                                    }
                                }
                            });

                            }
                    } catch (err) {
                    }
                }
            }
        }
    }

    // travelSlots 배열을 실제 데이터와 함께 반환

    return {
        timeSlots: allResultSlots,
        travelSlots: travelSlotsArray,
        travelMode: travelMode
    };
};
