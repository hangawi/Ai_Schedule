const mongoose = require('mongoose');
const Room = require('../models/room');
const User = require('../models/user');
const Event = require('../models/event');
const ActivityLog = require('../models/ActivityLog');
const { findOptimalSlots } = require('../services/schedulingAnalysisService');
const schedulingAlgorithm = require('../services/schedulingAlgorithm');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Import separated controllers
const roomController = require('./roomController');
const timeSlotController = require('./timeSlotController');
const requestController = require('./coordinationRequestController');
const memberController = require('./coordinationMemberController');
const schedulingController = require('./coordinationSchedulingController');
const exchangeController = require('./coordinationExchangeController');

const dayMap = { 0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday' };

// Helper function to handle negotiation resolution
async function handleNegotiationResolution(room, negotiation, userId) {
   const members = negotiation.conflictingMembers;

   // 응답 분류
   const yieldedMembers = members.filter(m => m.response === 'yield');
   const claimedMembers = members.filter(m => m.response === 'claim');
   const splitFirstMembers = members.filter(m => m.response === 'split_first');
   const splitSecondMembers = members.filter(m => m.response === 'split_second');
   const chooseSlotMembers = members.filter(m => m.response === 'choose_slot');

   // Case 1: full_conflict + n-1명이 양보 (부분 양보)
   if (negotiation.type === 'full_conflict' && yieldedMembers.length >= 1 && claimedMembers.length >= 1) {
      // n명 중 n-1명이 양보했는지 확인
      if (yieldedMembers.length === members.length - 1) {
         const claimedMember = claimedMembers[0];

         // 주장한 사람에게 선택한 시간대로 배정 (전체 시간이 아닌 필요한 시간만)
         let assignStartTime, assignEndTime;

         // 주장한 사람이 time_slot_choice에서 선택한 시간이 있다면 그 시간 사용
         if (claimedMember.chosenSlot && claimedMember.chosenSlot.startTime && claimedMember.chosenSlot.endTime) {
            assignStartTime = claimedMember.chosenSlot.startTime;
            assignEndTime = claimedMember.chosenSlot.endTime;
         } else {
            // chosenSlot이 없으면 필요한 시간만큼만 할당
            const requiredSlots = claimedMember.requiredSlots || 2; // 기본값 1시간(2슬롯)
            const requiredMinutes = requiredSlots * 30; // 슬롯 당 30분

            const [startH, startM] = negotiation.slotInfo.startTime.split(':').map(Number);
            const startMinutes = startH * 60 + startM;
            const endMinutes = startMinutes + requiredMinutes;

            assignStartTime = negotiation.slotInfo.startTime;
            assignEndTime = `${Math.floor(endMinutes/60).toString().padStart(2,'0')}:${(endMinutes%60).toString().padStart(2,'0')}`;
         }

         // startTime과 endTime이 유효한지 확인
         if (!assignStartTime || !assignEndTime) {
            throw new Error('시간 정보가 올바르지 않습니다.');
         }

         // 💡 30분 단위로 슬롯 분할하여 추가
         const [startH, startM] = assignStartTime.split(':').map(Number);
         const [endH, endM] = assignEndTime.split(':').map(Number);
         const startMinutes = startH * 60 + startM;
         const endMinutes = endH * 60 + endM;

         for (let currentMinutes = startMinutes; currentMinutes < endMinutes; currentMinutes += 30) {
            const slotStartTime = `${Math.floor(currentMinutes/60).toString().padStart(2,'0')}:${(currentMinutes%60).toString().padStart(2,'0')}`;
            const slotEndTime = `${Math.floor((currentMinutes+30)/60).toString().padStart(2,'0')}:${((currentMinutes+30)%60).toString().padStart(2,'0')}`;

            const existingSlot = room.timeSlots.find(slot =>
               slot.user.toString() === (claimedMember.user._id || claimedMember.user).toString() &&
               slot.date.toISOString() === new Date(negotiation.slotInfo.date).toISOString() &&
               slot.startTime === slotStartTime &&
               slot.endTime === slotEndTime
            );

            if (!existingSlot) {
               const newSlot = {
                  user: claimedMember.user._id || claimedMember.user,
                  date: negotiation.slotInfo.date,
                  startTime: slotStartTime,
                  endTime: slotEndTime,
                  day: negotiation.slotInfo.day,
                  subject: '협의 결과',
                  status: 'confirmed',
                  assignedBy: userId
               };
               room.timeSlots.push(newSlot);
            } else {
            }
         }

         yieldedMembers.forEach(yieldedMember => {
            const yieldedUserId = (yieldedMember.user._id || yieldedMember.user).toString();
            const roomMember = room.members.find(m => {
               const mUserId = m.user._id ? m.user._id.toString() : m.user.toString();
               return mUserId === yieldedUserId;
            });

            if (yieldedMember.yieldOption === 'carry_over') {
               // 이월 처리 (중복 방지를 위해 이미 이월된 내역이 있는지 확인)
               // 💡 멤버의 requiredSlots 기준으로 이월 (실제 필요한 시간만 이월)
               const requiredSlots = yieldedMember.requiredSlots || 2; // 기본값 1시간(2슬롯)
               const carryOverHours = (requiredSlots * 30) / 60; // 슬롯당 30분

               if (roomMember) {
                  // 해당 협의에 대한 이월 내역이 이미 있는지 확인
                  const alreadyCarriedOver = roomMember.carryOverHistory.some(history =>
                     history.negotiationId && history.negotiationId.toString() === negotiation._id.toString()
                  );

                  if (!alreadyCarriedOver) {
                     const beforeCarryOver = roomMember.carryOver;
                     roomMember.carryOver += carryOverHours;
                     roomMember.carryOverHistory.push({
                        week: new Date(),
                        amount: carryOverHours,
                        reason: 'negotiation_yield',
                        timestamp: new Date(),
                        negotiationId: negotiation._id
                     });
                  } else {
                  }
               } else {
               }
            } else if (yieldedMember.yieldOption === 'alternative_time' && yieldedMember.alternativeSlots) {
               yieldedMember.alternativeSlots.forEach(slotKey => {
                  // 형식: '2025-10-13-13:00-14:00'
                  const parts = slotKey.split('-');
                  const date = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
                  const startTime = parts[3];
                  const endTime = parts[4];

                  // 요일 계산
                  const dayOfWeek = date.getDay();
                  const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                  const dayName = dayMap[dayOfWeek];

                  // 💡 30분 단위로 슬롯 분할
                  const [startH, startM] = startTime.split(':').map(Number);
                  const [endH, endM] = endTime.split(':').map(Number);
                  const startMinutes = startH * 60 + startM;
                  const endMinutes = endH * 60 + endM;

                  for (let currentMinutes = startMinutes; currentMinutes < endMinutes; currentMinutes += 30) {
                     const slotStartTime = `${Math.floor(currentMinutes/60).toString().padStart(2,'0')}:${(currentMinutes%60).toString().padStart(2,'0')}`;
                     const slotEndTime = `${Math.floor((currentMinutes+30)/60).toString().padStart(2,'0')}:${((currentMinutes+30)%60).toString().padStart(2,'0')}`;

                     const existingSlot = room.timeSlots.find(slot =>
                        (slot.user._id ? slot.user._id.toString() : slot.user.toString()) === (yieldedMember.user._id || yieldedMember.user).toString() &&
                        new Date(slot.date).toISOString().split('T')[0] === date.toISOString().split('T')[0] &&
                        slot.startTime === slotStartTime &&
                        slot.endTime === slotEndTime
                     );

                     if (!existingSlot) {
                        room.timeSlots.push({
                           user: yieldedMember.user._id || yieldedMember.user,
                           date: date,
                           startTime: slotStartTime,
                           endTime: slotEndTime,
                           day: dayName,
                           subject: '협의 결과 (대체시간)',
                           status: 'confirmed',
                           assignedBy: userId
                        });
                     } else {
                     }
                  }
               });
            }
         });

         negotiation.status = 'resolved';
         negotiation.resolution = {
            type: 'yielded',
            assignments: [{
               user: claimedMember.user._id || claimedMember.user,
               slots: [`${negotiation.slotInfo.date}-${assignStartTime}`],
               isCarryOver: false
            }],
            resolvedAt: new Date(),
            resolvedBy: userId
         };

         const claimedMemberName = claimedMember.user.firstName || claimedMember.user.name || '멤버';
         negotiation.messages.push({
            message: `협의가 완료되었습니다. ${claimedMemberName}님이 ${assignStartTime}-${assignEndTime} 시간을 배정받았습니다.`,
            timestamp: new Date(),
            isSystemMessage: true
         });
      }
   }
   // Case 1-2: time_slot_choice + 각자 다른 시간대 선택
   else if (negotiation.type === 'time_slot_choice' && chooseSlotMembers.length === members.length) {
      // 선택한 시간대가 겹치지 않는지 확인 (같은 날짜 + 같은 시간일 때만 충돌)
      const chosenSlots = chooseSlotMembers.map(m => ({
         ...m.chosenSlot,
         userId: (m.user._id || m.user).toString(),
         // date가 없으면 기본 협의 날짜 사용
         date: m.chosenSlot.date || negotiation.slotInfo.date
      }));

      const slotsOverlap = chosenSlots.some((slot1, i) => {
         return chosenSlots.some((slot2, j) => {
            if (i >= j) return false;

            // 다른 날짜면 충돌 없음
            const date1 = new Date(slot1.date).toISOString().split('T')[0];
            const date2 = new Date(slot2.date).toISOString().split('T')[0];
            if (date1 !== date2) {
               return false;
            }

            // 같은 날짜에서 시간 충돌 확인
            const overlap = !(slot1.endTime <= slot2.startTime || slot2.endTime <= slot1.startTime);
            if (overlap) {
            }
            return overlap;
         });
      });

      if (!slotsOverlap) {
         // 겹치지 않음 - 각자 선택한 시간대 배정 (30분 단위로 분할)
         chooseSlotMembers.forEach(member => {
            // 멤버가 선택한 날짜 (없으면 기본 협의 날짜)
            const chosenDate = member.chosenSlot.date || negotiation.slotInfo.date;
            const chosenDateObj = new Date(chosenDate);

            // 선택한 날짜의 요일 계산 (0=일, 1=월, ..., 6=토)
            const dayOfWeek = chosenDateObj.getDay();
            const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const chosenDay = dayMap[dayOfWeek];


            // chosenSlot을 30분 단위로 분할
            const [startH, startM] = member.chosenSlot.startTime.split(':').map(Number);
            const [endH, endM] = member.chosenSlot.endTime.split(':').map(Number);
            const startMinutes = startH * 60 + startM;
            const endMinutes = endH * 60 + endM;

            // 30분 단위로 슬롯 생성
            for (let currentMinutes = startMinutes; currentMinutes < endMinutes; currentMinutes += 30) {
               const slotStartTime = `${Math.floor(currentMinutes/60).toString().padStart(2,'0')}:${(currentMinutes%60).toString().padStart(2,'0')}`;
               const slotEndTime = `${Math.floor((currentMinutes+30)/60).toString().padStart(2,'0')}:${((currentMinutes+30)%60).toString().padStart(2,'0')}`;

               const existingSlot = room.timeSlots.find(slot =>
                  slot.user.toString() === (member.user._id || member.user).toString() &&
                  slot.date.toISOString() === chosenDateObj.toISOString() &&
                  slot.startTime === slotStartTime &&
                  slot.endTime === slotEndTime
               );

               if (!existingSlot) {
                  room.timeSlots.push({
                     user: member.user._id || member.user,
                     date: chosenDateObj,
                     startTime: slotStartTime,
                     endTime: slotEndTime,
                     day: chosenDay,
                     subject: '협의 결과 (시간선택)',
                     status: 'confirmed',
                     assignedBy: userId
                  });
               }
            }
         });

         negotiation.status = 'resolved';
         negotiation.resolution = {
            type: 'time_slot_choice',
            assignments: chooseSlotMembers.map(m => ({
               user: m.user._id || m.user,
               slots: [`${negotiation.slotInfo.date}-${m.chosenSlot.startTime}-${m.chosenSlot.endTime}`],
               isCarryOver: false
            })),
            resolvedAt: new Date(),
            resolvedBy: userId
         };

         negotiation.messages.push({
            message: `협의가 완료되었습니다. 각자 선택한 시간대로 배정되었습니다.`,
            timestamp: new Date(),
            isSystemMessage: true
         });

      } else {
         // 겹침 - full_conflict로 전환 (양보/주장 또는 랜덤)
         negotiation.type = 'full_conflict';
         negotiation.messages.push({
            message: `선택한 시간대가 겹칩니다. 양보하거나 주장하여 해결하세요. 둘 다 주장하면 랜덤으로 결정됩니다.`,
            timestamp: new Date(),
            isSystemMessage: true
         });
         // 응답만 초기화 (chosenSlot은 유지!)
         members.forEach(m => {
            m.response = 'pending';
            // m.chosenSlot = null; // 제거: 선택한 시간 정보 유지
         });

         // 상태를 'active'로 유지하여 계속 협의 가능하도록
         negotiation.status = 'active';

         negotiation.memberSpecificTimeSlots = {};

         const dayString = negotiation.slotInfo.day;
         const conflictDate = new Date(negotiation.slotInfo.date);

         for (const cm of negotiation.conflictingMembers) {
            const memberId = (cm.user._id || cm.user).toString();
            const roomMember = room.members.find(m => {
               const mUserId = m.user._id ? m.user._id.toString() : m.user.toString();
               return mUserId === memberId;
            });

            if (roomMember && roomMember.user && roomMember.user.defaultSchedule) {
               const dayMap = { 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6, 'sunday': 0 };
               const targetDayOfWeek = dayMap[dayString];

               const dayPreferences = roomMember.user.defaultSchedule.filter(sched =>
                  sched.dayOfWeek === targetDayOfWeek && sched.priority >= 2
               );

               // 연속된 시간 블록을 병합
               const sortedPrefs = dayPreferences.sort((a, b) => a.startTime.localeCompare(b.startTime));
               const mergedBlocks = [];

               for (const pref of sortedPrefs) {
                  if (mergedBlocks.length === 0) {
                     mergedBlocks.push({ startTime: pref.startTime, endTime: pref.endTime });
                  } else {
                     const lastBlock = mergedBlocks[mergedBlocks.length - 1];
                     if (lastBlock.endTime === pref.startTime) {
                        lastBlock.endTime = pref.endTime;
                     } else {
                        mergedBlocks.push({ startTime: pref.startTime, endTime: pref.endTime });
                     }
                  }
               }

               const memberOptions = [];
               for (const block of mergedBlocks) {
                  const isAlreadyAssigned = room.timeSlots.some(slot => {
                     const slotDate = new Date(slot.date);
                     if (slotDate.toDateString() !== conflictDate.toDateString()) return false;
                     return !(slot.endTime <= block.startTime || block.endTime <= slot.startTime);
                  });

                  if (!isAlreadyAssigned) {
                     memberOptions.push({ startTime: block.startTime, endTime: block.endTime });
                  }
               }

               negotiation.memberSpecificTimeSlots[memberId] = memberOptions;
            } else {
               negotiation.memberSpecificTimeSlots[memberId] = [];
            }
         }
      }
   }
   // Case 2: partial_conflict + 모두 같은 시간 선택 -> full_conflict로 전환
   else if (negotiation.type === 'partial_conflict' &&
            (splitFirstMembers.length === members.length || splitSecondMembers.length === members.length)) {
      // 모두 앞 시간 또는 모두 뒷 시간 선택

      // split_first/split_second 정보를 chosenSlot으로 변환
      const [startH, startM] = negotiation.slotInfo.startTime.split(':').map(Number);
      const [endH, endM] = negotiation.slotInfo.endTime.split(':').map(Number);

      members.forEach(m => {
         if (m.response === 'split_first') {
            // 앞시간 선택한 사람: 필요한 슬롯 수만큼
            const requiredSlots = m.requiredSlots || 1;
            const requiredMinutes = requiredSlots * 30;
            const midMinutes = startH * 60 + startM + requiredMinutes;
            const midTime = `${Math.floor(midMinutes/60).toString().padStart(2,'0')}:${(midMinutes%60).toString().padStart(2,'0')}`;

            m.chosenSlot = {
               startTime: negotiation.slotInfo.startTime,
               endTime: midTime
            };
         } else if (m.response === 'split_second') {
            // 뒷시간 선택한 사람: 필요한 슬롯 수만큼
            const requiredSlots = m.requiredSlots || 1;
            const requiredMinutes = requiredSlots * 30;
            const startMinutes = endH * 60 + endM - requiredMinutes;
            const startTime = `${Math.floor(startMinutes/60).toString().padStart(2,'0')}:${(startMinutes%60).toString().padStart(2,'0')}`;

            m.chosenSlot = {
               startTime: startTime,
               endTime: negotiation.slotInfo.endTime
            };
         }

         // 응답 초기화
         m.response = 'pending';
      });

      negotiation.type = 'full_conflict';
      negotiation.messages.push({
         message: `선택한 시간대가 겹칩니다. 양보하거나 주장하여 해결하세요. 둘 다 주장하면 랜덤으로 결정됩니다.`,
         timestamp: new Date(),
         isSystemMessage: true
      });

      // 상태를 'active'로 유지하여 계속 협의 가능하도록
      negotiation.status = 'active';

      // 💡 full_conflict로 전환 시 memberSpecificTimeSlots 생성
      negotiation.memberSpecificTimeSlots = {};

      const dayString = negotiation.slotInfo.day;
      const conflictDate = new Date(negotiation.slotInfo.date);

      for (const cm of negotiation.conflictingMembers) {
         const memberId = (cm.user._id || cm.user).toString();
         const roomMember = room.members.find(m => {
            const mUserId = m.user._id ? m.user._id.toString() : m.user.toString();
            return mUserId === memberId;
         });

         if (roomMember && roomMember.user && roomMember.user.defaultSchedule) {
            const dayMap = { 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6, 'sunday': 0 };
            const targetDayOfWeek = dayMap[dayString];

            const dayPreferences = roomMember.user.defaultSchedule.filter(sched =>
               sched.dayOfWeek === targetDayOfWeek && sched.priority >= 2
            );

            // 연속된 시간 블록을 병합
            const sortedPrefs = dayPreferences.sort((a, b) => a.startTime.localeCompare(b.startTime));
            const mergedBlocks = [];

            for (const pref of sortedPrefs) {
               if (mergedBlocks.length === 0) {
                  mergedBlocks.push({ startTime: pref.startTime, endTime: pref.endTime });
               } else {
                  const lastBlock = mergedBlocks[mergedBlocks.length - 1];
                  if (lastBlock.endTime === pref.startTime) {
                     lastBlock.endTime = pref.endTime;
                  } else {
                     mergedBlocks.push({ startTime: pref.startTime, endTime: pref.endTime });
                  }
               }
            }

            const memberOptions = [];
            for (const block of mergedBlocks) {
               const isAlreadyAssigned = room.timeSlots.some(slot => {
                  const slotDate = new Date(slot.date);
                  if (slotDate.toDateString() !== conflictDate.toDateString()) return false;
                  return !(slot.endTime <= block.startTime || block.endTime <= slot.startTime);
               });

               if (!isAlreadyAssigned) {
                  memberOptions.push({ startTime: block.startTime, endTime: block.endTime });
               }
            }

            negotiation.memberSpecificTimeSlots[memberId] = memberOptions;
         } else {
            negotiation.memberSpecificTimeSlots[memberId] = [];
         }
      }
   }
   // Case 3: partial_conflict + 시간 분할 (각자 다른 시간 선택)
   else if (negotiation.type === 'partial_conflict' && splitFirstMembers.length === 1 && splitSecondMembers.length === 1) {
      const firstMember = splitFirstMembers[0];
      const secondMember = splitSecondMembers[0];

      // 각 멤버의 필요 슬롯 수 확인
      const firstRequiredSlots = firstMember.requiredSlots || 1;
      const firstRequiredMinutes = firstRequiredSlots * 30; // 1슬롯 = 30분

      const [startH, startM] = negotiation.slotInfo.startTime.split(':').map(Number);
      const [endH, endM] = negotiation.slotInfo.endTime.split(':').map(Number);

      // 첫 번째 멤버의 필요 시간만큼만 할당
      const midMinutes = startH * 60 + startM + firstRequiredMinutes;
      const midTime = `${Math.floor(midMinutes/60).toString().padStart(2,'0')}:${(midMinutes%60).toString().padStart(2,'0')}`;

      // 앞 시간대 (첫 번째 멤버에게 필요한 만큼만)
      const existingFirstSlot = room.timeSlots.find(slot =>
         slot.user.toString() === (firstMember.user._id || firstMember.user).toString() &&
         slot.date.toISOString() === new Date(negotiation.slotInfo.date).toISOString() &&
         slot.startTime === negotiation.slotInfo.startTime &&
         slot.endTime === midTime
      );

      if (!existingFirstSlot) {
         room.timeSlots.push({
            user: firstMember.user._id || firstMember.user,
            date: negotiation.slotInfo.date,
            startTime: negotiation.slotInfo.startTime,
            endTime: midTime,
            day: negotiation.slotInfo.day,
            subject: '협의 결과 (분할)',
            status: 'confirmed',
            assignedBy: userId
         });
      }

      // 뒷 시간대 (나머지 시간 전부)
      const existingSecondSlot = room.timeSlots.find(slot =>
         slot.user.toString() === (secondMember.user._id || secondMember.user).toString() &&
         slot.date.toISOString() === new Date(negotiation.slotInfo.date).toISOString() &&
         slot.startTime === midTime &&
         slot.endTime === negotiation.slotInfo.endTime
      );

      if (!existingSecondSlot) {
         room.timeSlots.push({
            user: secondMember.user._id || secondMember.user,
            date: negotiation.slotInfo.date,
            startTime: midTime,
            endTime: negotiation.slotInfo.endTime,
            day: negotiation.slotInfo.day,
            subject: '협의 결과 (분할)',
            status: 'confirmed',
            assignedBy: userId
         });
      }

      negotiation.status = 'resolved';
      negotiation.resolution = {
         type: 'split',
         assignments: [
            {
               user: firstMember.user._id || firstMember.user,
               slots: [`${negotiation.slotInfo.date}-${negotiation.slotInfo.startTime}-${midTime}`],
               isCarryOver: false
            },
            {
               user: secondMember.user._id || secondMember.user,
               slots: [`${negotiation.slotInfo.date}-${midTime}-${negotiation.slotInfo.endTime}`],
               isCarryOver: false
            }
         ],
         resolvedAt: new Date(),
         resolvedBy: userId
      };

      negotiation.messages.push({
         message: `협의가 완료되었습니다. 시간대가 분할되었습니다.`,
         timestamp: new Date(),
         isSystemMessage: true
      });

   }
   // Case 4: 모두 양보 -> 모두 이월
   else if (yieldedMembers.length === members.length) {
      // 모든 멤버가 양보한 경우 - 모두 이월 처리
      yieldedMembers.forEach(member => {
         const yieldedUserId = (member.user._id || member.user).toString();
         const roomMember = room.members.find(m => {
            const mUserId = m.user._id ? m.user._id.toString() : m.user.toString();
            return mUserId === yieldedUserId;
         });

         if (member.yieldOption === 'carry_over') {
            const [startH, startM] = negotiation.slotInfo.startTime.split(':').map(Number);
            const [endH, endM] = negotiation.slotInfo.endTime.split(':').map(Number);
            const carryOverHours = ((endH * 60 + endM) - (startH * 60 + startM)) / 60;

            if (roomMember) {
               const alreadyCarriedOver = roomMember.carryOverHistory.some(history =>
                  history.negotiationId && history.negotiationId.toString() === negotiation._id.toString()
               );

               if (!alreadyCarriedOver) {
                  roomMember.carryOver += carryOverHours;
                  roomMember.carryOverHistory.push({
                     week: new Date(),
                     amount: carryOverHours,
                     reason: 'negotiation_yield',
                     timestamp: new Date(),
                     negotiationId: negotiation._id
                  });
               }
            }
         }
      });

      negotiation.status = 'resolved';
      negotiation.messages.push({
         message: `모든 멤버가 양보했습니다. 시간이 이월됩니다.`,
         timestamp: new Date(),
         isSystemMessage: true
      });
   }
   // Case 5: 모두 주장 -> 랜덤 또는 다른 시간 선택
   else if (claimedMembers.length === members.length) {
      negotiation.messages.push({
         message: `모두 주장했습니다. 랜덤으로 결정하거나 다른 시간을 선택하세요.`,
         timestamp: new Date(),
         isSystemMessage: true
      });

      // 랜덤 선택
      const randomIndex = Math.floor(Math.random() * claimedMembers.length);
      const winner = claimedMembers[randomIndex];
      const losers = claimedMembers.filter((_, i) => i !== randomIndex);

      // 승자에게 시간 배정 (필요한 시간만큼만)
      let assignStartTime, assignEndTime;

      // chosenSlot이 있으면 그 시간 사용, 없으면 필요한 시간만큼만 할당
      if (winner.chosenSlot && winner.chosenSlot.startTime && winner.chosenSlot.endTime) {
         assignStartTime = winner.chosenSlot.startTime;
         assignEndTime = winner.chosenSlot.endTime;
      } else {
         // chosenSlot이 없으면 필요한 시간만큼만 할당
         const requiredSlots = winner.requiredSlots || 2; // 기본값 1시간(2슬롯)
         const requiredMinutes = requiredSlots * 30;

         const [startH, startM] = negotiation.slotInfo.startTime.split(':').map(Number);
         const startMinutes = startH * 60 + startM;
         const endMinutes = startMinutes + requiredMinutes;

         assignStartTime = negotiation.slotInfo.startTime;
         assignEndTime = `${Math.floor(endMinutes/60).toString().padStart(2,'0')}:${(endMinutes%60).toString().padStart(2,'0')}`;

      }

      const existingSlot = room.timeSlots.find(slot =>
         slot.user.toString() === (winner.user._id || winner.user).toString() &&
         slot.date.toISOString() === new Date(negotiation.slotInfo.date).toISOString() &&
         slot.startTime === assignStartTime &&
         slot.endTime === assignEndTime
      );

      if (!existingSlot) {
         room.timeSlots.push({
            user: winner.user._id || winner.user,
            date: negotiation.slotInfo.date,
            startTime: assignStartTime,
            endTime: assignEndTime,
            day: negotiation.slotInfo.day,
            subject: '협의 결과 (랜덤)',
            status: 'confirmed',
            assignedBy: userId
         });
      }

      // 패자들은 이월 처리
      losers.forEach(loser => {
         const loserUserId = (loser.user._id || loser.user).toString();
         const roomMember = room.members.find(m => {
            const mUserId = m.user._id ? m.user._id.toString() : m.user.toString();
            return mUserId === loserUserId;
         });

         if (roomMember) {
            const [startH, startM] = negotiation.slotInfo.startTime.split(':').map(Number);
            const [endH, endM] = negotiation.slotInfo.endTime.split(':').map(Number);
            const carryOverHours = ((endH * 60 + endM) - (startH * 60 + startM)) / 60;

            const alreadyCarriedOver = roomMember.carryOverHistory.some(history =>
               history.negotiationId && history.negotiationId.toString() === negotiation._id.toString()
            );

            if (!alreadyCarriedOver) {
               roomMember.carryOver += carryOverHours;
               roomMember.carryOverHistory.push({
                  week: new Date(),
                  amount: carryOverHours,
                  reason: 'negotiation_random_loss',
                  timestamp: new Date(),
                  negotiationId: negotiation._id
               });
            }
         }
      });

      negotiation.status = 'resolved';
      negotiation.resolution = {
         type: 'random',
         assignments: [{
            user: winner.user._id || winner.user,
            slots: [`${negotiation.slotInfo.date}-${negotiation.slotInfo.startTime}`],
            isCarryOver: false
         }],
         resolvedAt: new Date(),
         resolvedBy: userId
      };

      const winnerName = winner.user.firstName || winner.user.name || '멤버';
      negotiation.messages.push({
         message: `랜덤으로 ${winnerName}님이 선택되었습니다. 나머지 멤버는 이월됩니다.`,
         timestamp: new Date(),
         isSystemMessage: true
      });
   }

   // Mongoose에게 timeSlots 배열 변경 알림
   room.markModified('timeSlots');
}

// Re-export from separated controllers
exports.createRoom = roomController.createRoom;
exports.updateRoom = roomController.updateRoom;
exports.deleteRoom = roomController.deleteRoom;
exports.joinRoom = roomController.joinRoom;
exports.getRoomDetails = roomController.getRoomDetails;
exports.getMyRooms = roomController.getMyRooms;
exports.getRoomExchangeCounts = roomController.getRoomExchangeCounts;

// Re-export from timeSlotController
exports.submitTimeSlots = timeSlotController.submitTimeSlots;
exports.removeTimeSlot = timeSlotController.removeTimeSlot;
exports.assignTimeSlot = timeSlotController.assignTimeSlot;
exports.findCommonSlots = timeSlotController.findCommonSlots;
exports.resetCarryOverTimes = timeSlotController.resetCarryOverTimes;
exports.resetCompletedTimes = timeSlotController.resetCompletedTimes;

// Re-export from requestController
exports.createRequest = requestController.createRequest;
exports.handleRequest = requestController.handleRequest;
exports.cancelRequest = requestController.cancelRequest;
exports.getSentRequests = requestController.getSentRequests;
exports.getReceivedRequests = requestController.getReceivedRequests;
exports.handleChainConfirmation = requestController.handleChainConfirmation;

// Re-export from memberController
exports.removeMember = memberController.removeMember;
exports.leaveRoom = memberController.leaveRoom;
exports.getExchangeRequestsCount = memberController.getExchangeRequestsCount;

// Re-export from schedulingController
exports.runAutoSchedule = schedulingController.runAutoSchedule;
exports.deleteAllTimeSlots = schedulingController.deleteAllTimeSlots;

// Re-export from exchangeController
exports.parseExchangeRequest = exchangeController.parseExchangeRequest;
exports.smartExchange = exchangeController.smartExchange;

// 💡 Helper function: full_conflict 협의의 memberSpecificTimeSlots 실시간 재생성
async function regenerateMemberSpecificTimeSlots(negotiation, room) {
   negotiation.memberSpecificTimeSlots = {};

   const conflictDate = new Date(negotiation.slotInfo.date);

   // 💡 현재 주의 범위 계산 (weekStartDate 기준)
   let weekStartDate, weekEndDate;
   if (negotiation.weekStartDate) {
      weekStartDate = new Date(negotiation.weekStartDate);
      weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekStartDate.getDate() + 7);
   }

   for (const cm of negotiation.conflictingMembers) {
      const memberId = (cm.user._id || cm.user).toString();
      const roomMember = room.members.find(m => {
         const mUserId = m.user._id ? m.user._id.toString() : m.user.toString();
         return mUserId === memberId;
      });

      if (roomMember && roomMember.user && roomMember.user.defaultSchedule) {
         const dayMap = { 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6, 'sunday': 0 };
         const dayPreferences = roomMember.user.defaultSchedule.filter(sched => sched.priority >= 2);

         // 💡 현재 주의 슬롯만 체크 (weekStartDate가 있으면)
         const memberExistingSlots = room.timeSlots.filter(slot => {
            const slotUserId = slot.user._id ? slot.user._id.toString() : slot.user.toString();
            if (slotUserId !== memberId) return false;

            // 주간 범위 체크
            if (weekStartDate && weekEndDate) {
               const slotDate = new Date(slot.date);
               if (slotDate < weekStartDate || slotDate >= weekEndDate) return false;
            }

            return true;
         });

         // 💡 멤버가 필요한 시간 계산
         const memberInNego = negotiation.conflictingMembers.find(c =>
            (c.user._id || c.user).toString() === memberId
         );
         const requiredSlots = memberInNego?.requiredSlots || 2;
         const requiredMinutes = requiredSlots * 30;

         const memberOptions = [];
         const dayMap2 = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

         for (let dow = 0; dow <= 6; dow++) {
            const dayName = dayMap2[dow];
            const dayScheds = dayPreferences.filter(sched => sched.dayOfWeek === dow);
            if (dayScheds.length === 0) continue;

            const sortedPrefs = dayScheds.sort((a, b) => a.startTime.localeCompare(b.startTime));

            // 💡 연속된 시간 블록 병합 (10분 이내 간격은 허용)
            const mergedBlocks = [];
            for (const pref of sortedPrefs) {
               if (mergedBlocks.length === 0) {
                  mergedBlocks.push({ startTime: pref.startTime, endTime: pref.endTime });
               } else {
                  const lastBlock = mergedBlocks[mergedBlocks.length - 1];
                  // 💡 10분 이내 간격이면 병합 (선호시간 사이의 작은 간격 무시)
                  const [lastEndH, lastEndM] = lastBlock.endTime.split(':').map(Number);
                  const [prefStartH, prefStartM] = pref.startTime.split(':').map(Number);
                  const lastEndMinutes = lastEndH * 60 + lastEndM;
                  const prefStartMinutes = prefStartH * 60 + prefStartM;
                  const gap = prefStartMinutes - lastEndMinutes;

                  if (gap <= 10) {
                     // 10분 이내 간격이면 병합
                     lastBlock.endTime = pref.endTime;
                  } else {
                     mergedBlocks.push({ startTime: pref.startTime, endTime: pref.endTime });
                  }
               }
            }
            const targetDayIndex = dayMap2.indexOf(dayName);
            const currentDate = new Date(conflictDate);
            const currentDayIndex = currentDate.getDay();
            let daysToAdd = targetDayIndex - currentDayIndex;
            if (daysToAdd < 0) daysToAdd += 7;

            const targetDate = new Date(currentDate);
            targetDate.setDate(currentDate.getDate() + daysToAdd);
            const targetDateStr = targetDate.toISOString().split('T')[0];
            const conflictDateStr = conflictDate.toISOString().split('T')[0];
            const isConflictDate = targetDateStr === conflictDateStr;

            for (const block of mergedBlocks) {
               // 💡 모든 멤버의 슬롯을 체크하여 겹치는 부분 제외 (현재 주의 슬롯만)
               const overlappingSlots = room.timeSlots
                  .filter(slot => {
                     const slotDate = new Date(slot.date);
                     if (slotDate.toDateString() !== targetDate.toDateString()) return false;

                     // 주간 범위 체크
                     if (weekStartDate && weekEndDate) {
                        if (slotDate < weekStartDate || slotDate >= weekEndDate) return false;
                     }

                     return !(slot.endTime <= block.startTime || block.endTime <= slot.startTime);
                  })
                  .sort((a, b) => a.startTime.localeCompare(b.startTime));

               // 가용 시간대 계산 (블록 분할)
               const availableRanges = [];
               if (overlappingSlots.length === 0) {
                  availableRanges.push({ startTime: block.startTime, endTime: block.endTime });
               } else {
                  let currentStart = block.startTime;
                  for (const assigned of overlappingSlots) {
                     if (currentStart < assigned.startTime) {
                        availableRanges.push({
                           startTime: currentStart,
                           endTime: assigned.startTime
                        });
                     }
                     currentStart = assigned.endTime > currentStart ? assigned.endTime : currentStart;
                  }
                  if (currentStart < block.endTime) {
                     availableRanges.push({
                        startTime: currentStart,
                        endTime: block.endTime
                     });
                  }
               }

               // 💡 각 가용 범위에서 필요한 시간 단위로 슬라이딩하여 옵션 생성
               for (const range of availableRanges) {
                  const [startH, startM] = range.startTime.split(':').map(Number);
                  const [endH, endM] = range.endTime.split(':').map(Number);
                  const rangeStartMinutes = startH * 60 + startM;
                  const rangeEndMinutes = endH * 60 + endM;
                  const rangeDuration = rangeEndMinutes - rangeStartMinutes;

                  // 필요한 시간보다 짧으면 스킵
                  if (rangeDuration < requiredMinutes) {
                     continue;
                  }

                  // 💡 원래 협의 발생한 시간 확인
                  const [origStartH, origStartM] = negotiation.slotInfo.startTime.split(':').map(Number);
                  const [origEndH, origEndM] = negotiation.slotInfo.endTime.split(':').map(Number);
                  const origStartMinutes = origStartH * 60 + origStartM;
                  const origEndMinutes = origEndH * 60 + origEndM;

                  // 필요한 시간 단위로 슬라이딩
                  for (let slideStart = rangeStartMinutes; slideStart + requiredMinutes <= rangeEndMinutes; slideStart += requiredMinutes) {
                     const optionStartTime = `${Math.floor(slideStart/60).toString().padStart(2,'0')}:${(slideStart%60).toString().padStart(2,'0')}`;
                     const optionEndTime = `${Math.floor((slideStart+requiredMinutes)/60).toString().padStart(2,'0')}:${((slideStart+requiredMinutes)%60).toString().padStart(2,'0')}`;
                     const optionStartMinutes = slideStart;
                     const optionEndMinutes = slideStart + requiredMinutes;

                     // 협의 발생 날짜에서만 충돌 시간대와 겹치는지 확인
                     if (isConflictDate) {
                        const overlapsConflict = !(optionEndMinutes <= origStartMinutes || optionStartMinutes >= origEndMinutes);
                        if (overlapsConflict) {
                           continue;
                        }
                     }

                     // 💡 주간 범위 체크: weekStartDate가 설정되어 있으면 해당 주의 옵션만 포함
                     if (weekStartDate && weekEndDate) {
                        if (targetDate < weekStartDate || targetDate >= weekEndDate) {
                           continue;
                        }
                     }

                     memberOptions.push({
                        startTime: optionStartTime,
                        endTime: optionEndTime,
                        date: targetDate,
                        day: dayName
                     });
                  }
               }
            }
         }

         negotiation.memberSpecificTimeSlots[memberId] = memberOptions;
      }
   }
}

// Negotiation management functions
exports.getNegotiations = async (req, res) => {
   try {
      const { roomId } = req.params;
      const userId = req.user.id;

      const room = await Room.findById(roomId)
         .populate('negotiations.conflictingMembers.user', '_id firstName lastName email')
         .populate('negotiations.participants', '_id firstName lastName email')
         .populate('negotiations.resolution.assignments.user', '_id firstName lastName email')
         .populate('owner', 'firstName lastName email')
         .populate('members.user', 'firstName lastName email defaultSchedule');

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      // 사용자가 참여 가능한 협의만 필터링 (participants에 포함되고 status가 'active'인 협의만)
      const accessibleNegotiations = room.negotiations.filter(negotiation => {
         const isParticipant = negotiation.participants.some(p => p._id.toString() === userId);
         const isActive = negotiation.status === 'active';
         return isParticipant && isActive;
      });

      // 💡 각 full_conflict 협의에 대해 memberSpecificTimeSlots를 실시간으로 재생성
      for (const negotiation of accessibleNegotiations) {
         if (negotiation.type === 'full_conflict') {
            await regenerateMemberSpecificTimeSlots(negotiation, room);
         }
      }

      res.json({ negotiations: accessibleNegotiations });
   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

exports.addNegotiationMessage = async (req, res) => {
   try {
      const { roomId, negotiationId } = req.params;
      // Add your message logic here
      res.json({ success: true });
   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

exports.resolveNegotiation = async (req, res) => {
   try {
      const { roomId, negotiationId } = req.params;
      // Add your resolve logic here
      res.json({ success: true });
   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

exports.respondToNegotiation = async (req, res) => {
   try {
      const { roomId, negotiationId } = req.params;
      const { response, yieldOption, alternativeSlots, chosenSlot } = req.body;
      // response: 'yield', 'claim', 'split_first', 'split_second', 'choose_slot'
      // yieldOption: 'carry_over', 'alternative_time'
      // alternativeSlots: ['2025-09-30-14:00', ...]
      // chosenSlot: { startTime: '13:00', endTime: '14:00' }
      const userId = req.user.id;

      if (!['yield', 'claim', 'split_first', 'split_second', 'choose_slot'].includes(response)) {
         return res.status(400).json({ msg: '유효하지 않은 응답입니다.' });
      }

      const room = await Room.findById(roomId)
         .populate('negotiations.conflictingMembers.user', '_id firstName lastName email')
         .populate('owner', '_id firstName lastName email')
         .populate('members.user', 'firstName lastName email defaultSchedule');

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      const negotiation = room.negotiations.id(negotiationId);
      if (!negotiation) {
         return res.status(404).json({ msg: '협의를 찾을 수 없습니다.' });
      }

      if (negotiation.status !== 'active') {
         return res.status(400).json({ msg: '이미 해결된 협의입니다.' });
      }

      // 💡 full_conflict인 경우 memberSpecificTimeSlots를 실시간으로 재생성
      if (negotiation.type === 'full_conflict') {
         await regenerateMemberSpecificTimeSlots(negotiation, room);
      }

      // 접근 권한 확인: participants (당사자들 + 방장)
      const isParticipant = negotiation.participants.some(p => p.toString() === userId);
      if (!isParticipant) {
         return res.status(403).json({ msg: '이 협의에 참여할 권한이 없습니다.' });
      }

      // 사용자가 conflictingMember인지 확인
      const userMember = negotiation.conflictingMembers.find(cm =>
         (cm.user._id || cm.user).toString() === userId
      );

      if (!userMember) {
         return res.status(403).json({ msg: '협의 당사자만 응답할 수 있습니다.' });
      }

      // 이미 응답했는지 확인
      if (userMember.response && userMember.response !== 'pending') {
         return res.status(400).json({ msg: '이미 응답하셨습니다.' });
      }

      // 💡 다른 협의에 이미 응답했는지 확인 (중복 선택 방지)
      // 💡 같은 주의 협의만 체크 (weekStartDate가 같은 경우)
      const otherActiveNegotiations = room.negotiations.filter(nego => {
         if (nego.status !== 'active') return false;
         if (nego._id.toString() === negotiationId) return false;

         // 💡 weekStartDate가 있는 경우: 같은 주의 협의만 필터링
         if (negotiation.weekStartDate && nego.weekStartDate) {
            // weekStartDate가 다르면 다른 주차이므로 제외
            if (nego.weekStartDate !== negotiation.weekStartDate) {
               return false;
            }
         }

         return nego.conflictingMembers.some(cm => (cm.user._id || cm.user).toString() === userId);
      });

      const hasRespondedToOtherNego = otherActiveNegotiations.some(nego => {
         const memberInOtherNego = nego.conflictingMembers.find(cm =>
            (cm.user._id || cm.user).toString() === userId
         );
         return memberInOtherNego && memberInOtherNego.response && memberInOtherNego.response !== 'pending';
      });

      if (hasRespondedToOtherNego) {
         return res.status(400).json({
            msg: '이번 주 다른 협의에 이미 응답하셨습니다. 먼저 응답한 협의를 취소하거나 해결한 후 다시 시도해주세요.'
         });
      }

      // 응답 저장
      userMember.response = response;
      userMember.respondedAt = new Date();

      if (response === 'yield') {
         if (!yieldOption || !['carry_over', 'alternative_time'].includes(yieldOption)) {
            return res.status(400).json({ msg: '양보 시 이월 또는 대체시간을 선택해야 합니다.' });
         }
         userMember.yieldOption = yieldOption;

         if (yieldOption === 'alternative_time') {
            if (!alternativeSlots || alternativeSlots.length === 0) {
               return res.status(400).json({ msg: '대체 시간을 선택해주세요.' });
            }
            // 객체 배열을 문자열 배열로 변환: { startTime, endTime, date } -> '날짜-시작시간-종료시간'
            userMember.alternativeSlots = alternativeSlots.map(slot => {
               const slotDate = slot.date || negotiation.slotInfo.date;
               const dateStr = new Date(slotDate).toISOString().split('T')[0];
               return `${dateStr}-${slot.startTime}-${slot.endTime}`;
            });
         }
      } else if (response === 'claim') {
         // 주장할 때도 chosenSlot 저장 (time_slot_choice에서 선택한 시간)
         if (chosenSlot && chosenSlot.startTime && chosenSlot.endTime) {
            userMember.chosenSlot = chosenSlot;
         } else {
         }
      } else if (response === 'choose_slot') {
         if (!chosenSlot || !chosenSlot.startTime || !chosenSlot.endTime) {
            return res.status(400).json({ msg: '시간대를 선택해주세요.' });
         }
         userMember.chosenSlot = chosenSlot;

         // 💡 다른 멤버가 이미 겹치는 시간을 선택했는지 확인
         const chosenDate = chosenSlot.date || negotiation.slotInfo.date;
         const chosenDateObj = new Date(chosenDate);

         // chosenSlot의 시간 파싱 (안전하게 처리)
         let currentStartMinutes, currentEndMinutes;
         try {
            const [startH, startM] = chosenSlot.startTime.split(':').map(Number);
            const [endH, endM] = chosenSlot.endTime.split(':').map(Number);
            currentStartMinutes = startH * 60 + startM;
            currentEndMinutes = endH * 60 + endM;
         } catch (error) {
            return res.status(400).json({ msg: '시간 형식이 올바르지 않습니다.' });
         }

         let hasConflict = false;
         let conflictingMemberName = null;

         for (const otherMember of negotiation.conflictingMembers) {
            const otherUserId = (otherMember.user._id || otherMember.user).toString();
            if (otherUserId === userId) continue; // 자기 자신은 스킵
            if (!otherMember.chosenSlot) continue; // 아직 선택 안 한 멤버는 스킵

            // otherMember.chosenSlot의 시간 파싱 (안전하게 처리)
            let otherStartMinutes, otherEndMinutes;
            try {
               if (!otherMember.chosenSlot.startTime || !otherMember.chosenSlot.endTime) {
                  continue;
               }
               const [otherStartH, otherStartM] = otherMember.chosenSlot.startTime.split(':').map(Number);
               const [otherEndH, otherEndM] = otherMember.chosenSlot.endTime.split(':').map(Number);
               otherStartMinutes = otherStartH * 60 + otherStartM;
               otherEndMinutes = otherEndH * 60 + otherEndM;
            } catch (error) {
               continue;
            }

            // 시간 겹침 확인 (날짜는 같은 협의이므로 체크 불필요)
            if (!(currentEndMinutes <= otherStartMinutes || currentStartMinutes >= otherEndMinutes)) {
               hasConflict = true;
               conflictingMemberName = otherMember.user.firstName || otherMember.user.name || '다른 멤버';
               break;
            }
         }

         // 💡 충돌이 발견되면 full_conflict로 전환하고 슬롯 추가하지 않음
         if (hasConflict) {
            negotiation.type = 'full_conflict';

            // 💡 slotInfo를 실제 충돌한 시간대로 업데이트
            negotiation.slotInfo.startTime = chosenSlot.startTime;
            negotiation.slotInfo.endTime = chosenSlot.endTime;

            // 기존에 추가된 chosenSlot 슬롯들을 모두 제거 (현재 협의 날짜만)
            const conflictingMemberIds = negotiation.conflictingMembers.map(cm =>
               (cm.user._id || cm.user).toString()
            );
            const negotiationDateStr = new Date(negotiation.slotInfo.date).toISOString().split('T')[0];

            // 💡 충돌한 시간대의 슬롯만 삭제 (다른 시간대의 슬롯은 유지)
            const [conflictStartH, conflictStartM] = negotiation.slotInfo.startTime.split(':').map(Number);
            const [conflictEndH, conflictEndM] = negotiation.slotInfo.endTime.split(':').map(Number);
            const conflictStartMinutes = conflictStartH * 60 + conflictStartM;
            const conflictEndMinutes = conflictEndH * 60 + conflictEndM;

            room.timeSlots = room.timeSlots.filter(slot => {
               const isNegotiationChoice = slot.subject === '협의 응답 (시간선택)';
               if (!isNegotiationChoice) return true;

               const slotUserId = slot.user._id ? slot.user._id.toString() : slot.user.toString();
               const slotDateStr = new Date(slot.date).toISOString().split('T')[0];

               // 현재 협의의 날짜이고, 협의 멤버의 슬롯인 경우
               if (conflictingMemberIds.includes(slotUserId) && slotDateStr === negotiationDateStr) {
                  // 💡 충돌한 시간대와 겹치는지 확인
                  const [slotStartH, slotStartM] = slot.startTime.split(':').map(Number);
                  const [slotEndH, slotEndM] = slot.endTime.split(':').map(Number);
                  const slotStartMinutes = slotStartH * 60 + slotStartM;
                  const slotEndMinutes = slotEndH * 60 + slotEndM;

                  // 슬롯이 충돌 시간대와 겹치면 삭제
                  const overlaps = !(slotEndMinutes <= conflictStartMinutes || slotStartMinutes >= conflictEndMinutes);
                  if (overlaps) {
                     return false;
                  }
               }
               return true;
            });

            // 모든 멤버의 response를 pending으로 초기화
            negotiation.conflictingMembers.forEach(cm => {
               cm.response = 'pending';
               cm.chosenSlot = undefined;
            });

            negotiation.messages.push({
               message: `선택한 시간대가 겹칩니다. 양보하거나 주장하여 해결하세요. 둘 다 주장하면 랜덤으로 결정됩니다.`,
               timestamp: new Date(),
               isSystemMessage: true
            });

            negotiation.memberSpecificTimeSlots = {};

            const dayString = negotiation.slotInfo.day;
            const conflictDate = new Date(negotiation.slotInfo.date);
            const conflictDateStr = conflictDate.toISOString().split('T')[0];

            for (const cm of negotiation.conflictingMembers) {
               const memberId = (cm.user._id || cm.user).toString();
               const roomMember = room.members.find(m => {
                  const mUserId = m.user._id ? m.user._id.toString() : m.user.toString();
                  return mUserId === memberId;
               });

               if (roomMember && roomMember.user && roomMember.user.defaultSchedule) {
                  // 💡 모든 요일의 선호 시간 가져오기 (협의 발생한 요일 포함)
                  const dayMap = { 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6, 'sunday': 0 };
                  const conflictDayOfWeek = dayMap[dayString];

                  // 모든 선호 시간 가져오기 (priority >= 2)
                  const dayPreferences = roomMember.user.defaultSchedule.filter(sched =>
                     sched.priority >= 2
                  );


                  // 현재 멤버의 기존 배정 슬롯 확인
                  const memberExistingSlots = room.timeSlots.filter(slot => {
                     const slotUserId = slot.user._id ? slot.user._id.toString() : slot.user.toString();
                     return slotUserId === memberId;
                  });

                  // 💡 멤버가 필요한 시간 계산
                  const requiredSlots = cm.requiredSlots || 2;
                  const requiredMinutes = requiredSlots * 30;

                  // 요일별로 그룹화
                  const dayMap2 = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                  const prefsByDay = {};

                  dayPreferences.forEach(pref => {
                     const dayName = dayMap2[pref.dayOfWeek];
                     if (!prefsByDay[dayName]) prefsByDay[dayName] = [];
                     prefsByDay[dayName].push(pref);
                  });

                  const memberOptions = [];

                  // 각 요일마다 처리
                  for (const [dayName, prefs] of Object.entries(prefsByDay)) {
                     // 연속된 시간 블록 병합 (10분 이내 간격은 허용)
                     const sortedPrefs = prefs.sort((a, b) => a.startTime.localeCompare(b.startTime));
                     const mergedBlocks = [];

                     for (const pref of sortedPrefs) {
                        if (mergedBlocks.length === 0) {
                           mergedBlocks.push({ startTime: pref.startTime, endTime: pref.endTime });
                        } else {
                           const lastBlock = mergedBlocks[mergedBlocks.length - 1];
                           // 💡 10분 이내 간격이면 병합 (선호시간 사이의 작은 간격 무시)
                           const [lastEndH, lastEndM] = lastBlock.endTime.split(':').map(Number);
                           const [prefStartH, prefStartM] = pref.startTime.split(':').map(Number);
                           const lastEndMinutes = lastEndH * 60 + lastEndM;
                           const prefStartMinutes = prefStartH * 60 + prefStartM;
                           const gap = prefStartMinutes - lastEndMinutes;

                           if (gap <= 10) {
                              // 10분 이내 간격이면 병합
                              lastBlock.endTime = pref.endTime;
                           } else {
                              mergedBlocks.push({ startTime: pref.startTime, endTime: pref.endTime });
                           }
                        }
                     }


                     // 해당 요일의 실제 날짜 계산 (이번 주)
                     const targetDayIndex = dayMap2.indexOf(dayName);
                     const currentDate = new Date(conflictDate);
                     const currentDayIndex = currentDate.getDay();
                     let daysToAdd = targetDayIndex - currentDayIndex;
                     if (daysToAdd < 0) daysToAdd += 7;

                     const targetDate = new Date(currentDate);
                     targetDate.setDate(currentDate.getDate() + daysToAdd);
                     const targetDateStr = targetDate.toISOString().split('T')[0];

                     // 💡 협의 발생 날짜인지 확인
                     const isConflictDate = targetDateStr === conflictDateStr;

                     // 이미 배정받은 시간 제외하고 슬라이딩 윈도우로 옵션 생성
                     for (const block of mergedBlocks) {

                        // 💡 이 블록과 겹치는 모든 멤버의 기존 슬롯 찾기
                        const overlappingSlots = room.timeSlots
                           .filter(slot => {
                              const slotDate = new Date(slot.date);
                              if (slotDate.toDateString() !== targetDate.toDateString()) return false;
                              return !(slot.endTime <= block.startTime || block.endTime <= slot.startTime);
                           })
                           .sort((a, b) => a.startTime.localeCompare(b.startTime));

                        // 가용 시간대 계산 (블록 분할)
                        const availableRanges = [];
                        if (overlappingSlots.length === 0) {
                           availableRanges.push({ startTime: block.startTime, endTime: block.endTime });
                        } else {
                           let currentStart = block.startTime;
                           for (const assigned of overlappingSlots) {
                              if (currentStart < assigned.startTime) {
                                 availableRanges.push({
                                    startTime: currentStart,
                                    endTime: assigned.startTime
                                 });
                              }
                              currentStart = assigned.endTime > currentStart ? assigned.endTime : currentStart;
                           }
                           if (currentStart < block.endTime) {
                              availableRanges.push({
                                 startTime: currentStart,
                                 endTime: block.endTime
                              });
                           }
                        }

                        // 💡 각 가용 범위에서 필요한 시간 단위로 슬라이딩하여 옵션 생성
                        for (const range of availableRanges) {
                           const [startH, startM] = range.startTime.split(':').map(Number);
                           const [endH, endM] = range.endTime.split(':').map(Number);
                           const rangeStartMinutes = startH * 60 + startM;
                           const rangeEndMinutes = endH * 60 + endM;
                           const rangeDuration = rangeEndMinutes - rangeStartMinutes;

                           // 필요한 시간보다 짧으면 스킵
                           if (rangeDuration < requiredMinutes) {
                              continue;
                           }

                           // 💡 원래 협의 발생한 시간 확인
                           const [origStartH, origStartM] = negotiation.slotInfo.startTime.split(':').map(Number);
                           const [origEndH, origEndM] = negotiation.slotInfo.endTime.split(':').map(Number);
                           const origStartMinutes = origStartH * 60 + origStartM;
                           const origEndMinutes = origEndH * 60 + origEndM;

                           // 필요한 시간 단위로 슬라이딩
                           for (let slideStart = rangeStartMinutes; slideStart + requiredMinutes <= rangeEndMinutes; slideStart += requiredMinutes) {
                              const optionStartTime = `${Math.floor(slideStart/60).toString().padStart(2,'0')}:${(slideStart%60).toString().padStart(2,'0')}`;
                              const optionEndTime = `${Math.floor((slideStart+requiredMinutes)/60).toString().padStart(2,'0')}:${((slideStart+requiredMinutes)%60).toString().padStart(2,'0')}`;
                              const optionStartMinutes = slideStart;
                              const optionEndMinutes = slideStart + requiredMinutes;

                              // 협의 발생 날짜에서만 충돌 시간대와 겹치는지 확인
                              if (isConflictDate) {
                                 const overlapsConflict = !(optionEndMinutes <= origStartMinutes || optionStartMinutes >= origEndMinutes);
                                 if (overlapsConflict) {
                                    continue;
                                 }
                              }

                              memberOptions.push({
                                 startTime: optionStartTime,
                                 endTime: optionEndTime,
                                 date: targetDate,
                                 day: dayName
                              });
                           }
                        }
                     }
                  }

                  negotiation.memberSpecificTimeSlots[memberId] = memberOptions;
               } else {
                  negotiation.memberSpecificTimeSlots[memberId] = [];
               }
            }

            await room.save();
            const updatedRoom = await Room.findById(roomId)
               .populate('owner', 'firstName lastName email')
               .populate('members.user', 'firstName lastName email')
               .populate('negotiations.conflictingMembers.user', 'firstName lastName email');

            const updatedNegotiation = updatedRoom.negotiations.id(negotiation._id);

            return res.json({
               msg: '시간대가 겹쳐 양보/주장 단계로 전환되었습니다.',
               room: updatedRoom,
               negotiation: updatedNegotiation
            });
         }

         // 💡 충돌이 없으면 즉시 슬롯 추가
         const dayOfWeek = chosenDateObj.getDay();
         const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
         const chosenDay = dayMap[dayOfWeek];

         // 30분 단위로 분할
         for (let currentMinutes = currentStartMinutes; currentMinutes < currentEndMinutes; currentMinutes += 30) {
            const slotStartTime = `${Math.floor(currentMinutes/60).toString().padStart(2,'0')}:${(currentMinutes%60).toString().padStart(2,'0')}`;
            const slotEndTime = `${Math.floor((currentMinutes+30)/60).toString().padStart(2,'0')}:${((currentMinutes+30)%60).toString().padStart(2,'0')}`;

            const existingSlot = room.timeSlots.find(slot =>
               slot.user.toString() === userId &&
               slot.date.toISOString() === chosenDateObj.toISOString() &&
               slot.startTime === slotStartTime &&
               slot.endTime === slotEndTime
            );

            if (!existingSlot) {
               room.timeSlots.push({
                  user: userId,
                  date: chosenDateObj,
                  startTime: slotStartTime,
                  endTime: slotEndTime,
                  day: chosenDay,
                  subject: '협의 응답 (시간선택)',
                  status: 'confirmed',
                  assignedBy: userId
               });
            }
         }
      }

      // 시스템 메시지 추가
      const userName = userMember.user.firstName || userMember.user.name || '멤버';
      let responseText = '';
      if (response === 'yield') {
         responseText = yieldOption === 'carry_over' ? '양보하고 이월하기로 했습니다' : '양보하고 다른 시간을 선택했습니다';
      } else if (response === 'claim') {
         responseText = '이 시간을 원한다고 주장했습니다';
      } else if (response === 'split_first') {
         responseText = '앞 시간대를 선택했습니다';
      } else if (response === 'split_second') {
         responseText = '뒤 시간대를 선택했습니다';
      } else if (response === 'choose_slot') {
         responseText = `${chosenSlot.startTime}-${chosenSlot.endTime} 시간대를 선택했습니다`;
      }

      negotiation.messages.push({
         message: `${userName}님이 ${responseText}.`,
         timestamp: new Date(),
         isSystemMessage: true
      });

      // 협의 해결 조건 확인
      const allResponded = negotiation.conflictingMembers.every(cm =>
         cm.response && cm.response !== 'pending'
      );

      // 부분 양보 확인: n명 중 n-1명이 양보했는지
      const yieldedCount = negotiation.conflictingMembers.filter(cm => cm.response === 'yield').length;
      const claimedCount = negotiation.conflictingMembers.filter(cm => cm.response === 'claim').length;
      const pendingCount = negotiation.conflictingMembers.filter(cm => cm.response === 'pending').length;
      const totalMembers = negotiation.conflictingMembers.length;

      // n-1명이 양보하고 나머지 1명이 pending이거나 claim인 경우
      const canResolvePartially = (yieldedCount === totalMembers - 1 && (claimedCount === 1 || pendingCount === 1));

      // 분할 협의 확인: 2명이 각각 앞/뒤 시간 선택
      const splitFirstCount = negotiation.conflictingMembers.filter(cm => cm.response === 'split_first').length;
      const splitSecondCount = negotiation.conflictingMembers.filter(cm => cm.response === 'split_second').length;
      const canResolveSplit = (splitFirstCount === 1 && splitSecondCount === 1);

      // 1. 모든 멤버가 응답했거나
      // 2. n-1명이 양보했거나 (부분 양보)
      // 3. 분할 협의가 성립했으면 바로 해결
      if (allResponded || canResolvePartially || canResolveSplit) {

         // 부분 양보인 경우, pending인 사람을 자동으로 claim으로 설정
         if (canResolvePartially && pendingCount === 1) {
            const pendingMember = negotiation.conflictingMembers.find(cm => cm.response === 'pending');
            if (pendingMember) {
               pendingMember.response = 'claim';
            }
         }

         await handleNegotiationResolution(room, negotiation, userId);
      }

      await room.save();

      const memberSatisfactionMap = {}; // memberId -> isSatisfied

      // 💡 현재 주의 시작일과 종료일 계산 (weekStartDate 기준)
      const currentWeekStart = negotiation.weekStartDate ? new Date(negotiation.weekStartDate) : null;
      let currentWeekEnd = null;
      if (currentWeekStart) {
         currentWeekEnd = new Date(currentWeekStart);
         currentWeekEnd.setDate(currentWeekStart.getDate() + 7); // 7일 후
      }

      // 1. 방에 있는 모든 멤버에 대해 만족도 맵을 생성한다.
      for (const member of room.members) {
         const memberId = (member.user._id || member.user).toString();
         // room.settings에서 주당 최소 시간을 가져오고, 없으면 2슬롯(1시간)을 기본값으로 사용
         const requiredSlots = (room.settings.minTime / 30) || 2;

         // 💡 현재 주의 슬롯만 카운트
         const assignedSlots = room.timeSlots.filter(slot => {
            const slotUserId = slot.user._id ? slot.user._id.toString() : slot.user.toString();
            if (slotUserId !== memberId) return false;

            // 💡 weekStartDate가 있으면 현재 주의 슬롯만 계산
            if (currentWeekStart && currentWeekEnd) {
               const slotDate = new Date(slot.date);
               return slotDate >= currentWeekStart && slotDate < currentWeekEnd;
            }

            return true;
         }).length;

         const isSatisfied = assignedSlots >= requiredSlots;
         memberSatisfactionMap[memberId] = isSatisfied;

      }

      let autoResolvedCount = 0;

      // 2. 현재 협의를 포함한 모든 활성 협의를 순회한다.
      room.negotiations.forEach(nego => {
         if (nego.status !== 'active') return;

         // 💡 같은 주의 협의만 자동 해결 (weekStartDate가 다르면 스킵)
         if (negotiation.weekStartDate && nego.weekStartDate) {
            if (nego.weekStartDate !== negotiation.weekStartDate) {
               return; // 다른 주의 협의는 건드리지 않음
            }
         }

         const negoMemberIds = nego.conflictingMembers.map(m =>
            (m.user._id || m.user).toString()
         );

         // 3. 해당 협의의 모든 멤버가 '처리'되었는지 확인한다.
         const allMembersAccountedFor = negoMemberIds.every(id => {
            // 조건 1: 멤버의 시간이 완전히 할당되어 만족한 경우
            if (memberSatisfactionMap[id]) {
               return true;
            }

            // 조건 2: 현재 처리된 협의에서 해당 멤버가 '이월'을 선택한 경우
            const justResolvedNego = negotiation; // 응답이 들어온 바로 그 협의
            if (justResolvedNego.status === 'resolved') {
                const memberInThatNego = justResolvedNego.conflictingMembers.find(m => (m.user._id || m.user).toString() === id);
                if (memberInThatNego && memberInThatNego.yieldOption === 'carry_over') {
                    return true;
                }
            }
            return false;
         });

         // 💡 현재 응답이 들어온 협의인 경우:
         // 시간이 충족되지 않은 멤버는 모두 응답해야 함
         if (nego._id.toString() === negotiation._id.toString()) {
            const allRequiredMembersResponded = nego.conflictingMembers.every(m => {
               const memberId = (m.user._id || m.user).toString();

               // 이미 시간이 충족된 멤버는 응답 안 해도 됨
               if (memberSatisfactionMap[memberId]) {
                  return true;
               }

               // 시간이 충족되지 않은 멤버는 응답해야 함
               return m.response && m.response !== 'pending';
            });

            if (!allRequiredMembersResponded) {
               // 아직 응답하지 않은 멤버가 있으면 자동 해결 불가
               return;
            }
         }

         if (allMembersAccountedFor) {

            nego.status = 'resolved';
            nego.resolution = {
               type: 'auto_resolved',
               resolvedAt: new Date(),
               resolvedBy: userId,
               reason: 'all_members_accounted_for'
            };

            nego.messages.push({
               message: `모든 참여 멤버의 필요 시간이 충족되거나 이월되어 협의가 자동으로 해결되었습니다.`,
               timestamp: new Date(),
               isSystemMessage: true
            });

            autoResolvedCount++;
         }
      });

      if (autoResolvedCount > 0) {
         await room.save();
      } else {
      }

      // 업데이트된 협의 정보 반환
      const updatedRoom = await Room.findById(roomId)
         .populate('owner', 'firstName lastName email')
         .populate('members.user', 'firstName lastName email')
         .populate('timeSlots.user', '_id firstName lastName email')
         .populate('negotiations.conflictingMembers.user', '_id firstName lastName email')
         .populate('negotiations.resolution.assignments.user', '_id firstName lastName email');

      const updatedNegotiation = updatedRoom.negotiations.id(negotiationId);

      updatedRoom.members.forEach(m => {
         const userId = m.user._id || m.user;
      });

      res.json({
         success: true,
         negotiation: updatedNegotiation,
         room: updatedRoom
      });

   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// 💡 협의 응답 취소 기능
exports.cancelNegotiationResponse = async (req, res) => {
   try {
      const { roomId, negotiationId } = req.params;
      const userId = req.user.id;

      const room = await Room.findById(roomId)
         .populate('negotiations.conflictingMembers.user', '_id firstName lastName email')
         .populate('owner', '_id firstName lastName email')
         .populate('members.user', 'firstName lastName email defaultSchedule');

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      const negotiation = room.negotiations.id(negotiationId);
      if (!negotiation) {
         return res.status(404).json({ msg: '협의를 찾을 수 없습니다.' });
      }

      if (negotiation.status !== 'active') {
         return res.status(400).json({ msg: '이미 해결된 협의는 취소할 수 없습니다.' });
      }

      const userMember = negotiation.conflictingMembers.find(cm =>
         (cm.user._id || cm.user).toString() === userId
      );

      if (!userMember) {
         return res.status(403).json({ msg: '협의 당사자만 취소할 수 있습니다.' });
      }

      if (!userMember.response || userMember.response === 'pending') {
         return res.status(400).json({ msg: '취소할 응답이 없습니다.' });
      }

      // 💡 choose_slot으로 추가된 슬롯 삭제
      if (userMember.response === 'choose_slot' && userMember.chosenSlot) {
         const negotiationDateStr = new Date(negotiation.slotInfo.date).toISOString().split('T')[0];
         room.timeSlots = room.timeSlots.filter(slot => {
            const isNegotiationChoice = slot.subject === '협의 응답 (시간선택)';
            if (!isNegotiationChoice) return true;

            const slotUserId = slot.user._id ? slot.user._id.toString() : slot.user.toString();
            const slotDateStr = new Date(slot.date).toISOString().split('T')[0];

            if (slotUserId === userId && slotDateStr === negotiationDateStr) {
               return false;
            }
            return true;
         });
      }

      // 응답 초기화
      userMember.response = 'pending';
      userMember.chosenSlot = undefined;
      userMember.yieldOption = undefined;
      userMember.alternativeSlots = undefined;
      userMember.respondedAt = undefined;

      negotiation.messages.push({
         message: `${userMember.user.firstName || '멤버'}님이 응답을 취소했습니다.`,
         timestamp: new Date(),
         isSystemMessage: true
      });

      await room.save();

      const updatedRoom = await Room.findById(roomId)
         .populate('owner', 'firstName lastName email')
         .populate('members.user', 'firstName lastName email')
         .populate('negotiations.conflictingMembers.user', '_id firstName lastName email')
         .populate('negotiations.resolution.assignments.user', '_id firstName lastName email');

      const updatedNegotiation = updatedRoom.negotiations.id(negotiationId);

      res.json({
         success: true,
         negotiation: updatedNegotiation,
         room: updatedRoom
      });

   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

exports.autoResolveTimeoutNegotiations = async (req, res) => {
   try {
      const { roomId } = req.params;
      // Add your auto-resolve logic here
      res.json({ success: true });
   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

exports.forceResolveNegotiation = async (req, res) => {
   try {
      const { roomId, negotiationId } = req.params;
      // Add your force resolve logic here
      res.json({ success: true });
   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// 방장용 방 활동 로그 조회
exports.getRoomLogs = async (req, res) => {
   try {
      const { roomId } = req.params;
      const userId = req.user.id;  // MongoDB ObjectId string
      const { page = 1, limit = 50 } = req.query;

      const room = await Room.findById(roomId);
      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      // 방장인지 확인
      const roomOwnerId = room.ownerId?.toString() || room.owner?.toString();
      if (!roomOwnerId || roomOwnerId !== userId) {
         return res.status(403).json({ msg: '방장만 로그를 조회할 수 있습니다.' });
      }

      // 초기화 시점 이후의 로그만 조회
      const clearedAt = room.logsClearedAt?.owner;
      console.log('Owner clearedAt:', clearedAt);

      const query = { roomId };
      if (clearedAt) {
         query.createdAt = { $gt: clearedAt };
         console.log('Filtering logs after:', clearedAt);
      }

      const allLogs = await ActivityLog.find(query)
         .sort({ createdAt: -1 });

      // 멤버별 초기화 시점도 필터링
      const memberClearedAt = room.memberLogsClearedAt?.owner || {};
      const filteredLogs = allLogs.filter(log => {
         const userClearedAt = memberClearedAt[log.userId];
         if (userClearedAt && log.createdAt <= userClearedAt) {
            return false; // 이 멤버의 로그는 방장이 초기화함
         }
         return true;
      });

      // 페이지네이션 적용
      const total = filteredLogs.length;
      const paginatedLogs = filteredLogs.slice((page - 1) * limit, page * limit);

      res.json({
         logs: paginatedLogs,
         roomName: room.name,
         pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total
         }
      });
   } catch (error) {
      console.error('Get room logs error:', error);
      res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
   }
};

// Clear room logs for owner
exports.clearRoomLogs = async (req, res) => {
   try {
      const { roomId } = req.params;
      const userId = req.user.id;

      const room = await Room.findById(roomId);
      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      // 방장인지 확인
      const roomOwnerId = room.ownerId?.toString() || room.owner?.toString();
      if (!roomOwnerId || roomOwnerId !== userId) {
         return res.status(403).json({ msg: '방장만 로그를 초기화할 수 있습니다.' });
      }

      // 방장의 초기화 시점 업데이트
      if (!room.logsClearedAt) {
         room.logsClearedAt = { owner: null, admin: null };
      }
      room.logsClearedAt.owner = new Date();
      room.markModified('logsClearedAt');
      await room.save();
      
      console.log('Owner cleared logs at:', room.logsClearedAt.owner);

      res.json({
         success: true,
         msg: '로그가 초기화되었습니다.',
         clearedAt: room.logsClearedAt.owner
      });
   } catch (error) {
      console.error('Clear room logs error:', error);
      res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
   }
};

// 특정 사용자의 로그만 삭제 (방장 전용 - 타임스탬프 방식)
exports.clearUserLogs = async (req, res) => {
   try {
      const { roomId, userId } = req.params;
      const currentUserId = req.user.id;

      // 방 존재 확인
      const room = await Room.findById(roomId);
      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      // 방장 권한 확인
      if (room.owner.toString() !== currentUserId) {
         return res.status(403).json({ msg: '방장만 로그를 삭제할 수 있습니다.' });
      }

      // 방장의 멤버별 초기화 시점 업데이트 (실제 삭제 대신)
      if (!room.memberLogsClearedAt) {
         room.memberLogsClearedAt = { owner: {}, admin: {} };
      }
      if (!room.memberLogsClearedAt.owner) {
         room.memberLogsClearedAt.owner = {};
      }
      room.memberLogsClearedAt.owner[userId] = new Date();
      room.markModified('memberLogsClearedAt');
      await room.save();

      console.log('Owner cleared member logs for user:', userId, 'at:', room.memberLogsClearedAt.owner[userId]);

      res.json({
         success: true,
         msg: '로그가 초기화되었습니다.',
         clearedAt: room.memberLogsClearedAt.owner[userId]
      });
   } catch (error) {
      console.error('Clear user logs error:', error);
      res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
   }
};
