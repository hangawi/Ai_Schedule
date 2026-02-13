/**
 * travelSchedule/index.js - TravelScheduleCalculator 클래스 래퍼
 *
 * 📍 위치: services/travelSchedule/index.js
 * 🔗 원본: ../travelScheduleCalculator.js (이 파일로 대체)
 *
 * 기존 TravelScheduleCalculator 클래스의 메서드들을 개별 모듈에서 import하여
 * 동일한 인터페이스를 유지합니다.
 */

import { formatTime, parseTime, toLocalDateString, unmergeBlock } from './timeUtils';
import { checkOverlap, checkBlockedTimeConflict } from './conflictUtils';
import { buildMemberPreferences, mergeOverlappingSlots, isWithinPreferredTime } from './memberUtils';
import { calculateDistance, sortSlotsByDistance } from './distanceSorting';
import { findAvailableSlot, findAvailableSlotsWithSplit } from './slotPlacement';
import { simulateTimeSlotPlacement, getBlockedTimesForMember, getAvailableTimesForMember } from './simulationUtils';
import { validateWalkingMode } from './validationUtils';
import { recalculateScheduleWithTravel } from './recalculateSchedule';

class TravelScheduleCalculator {

  formatTime(minutes) {
    return formatTime(minutes);
  }

  parseTime(timeString) {
    return parseTime(timeString);
  }

  toLocalDateString(date) {
    return toLocalDateString(date);
  }

  unmergeBlock(block) {
    return unmergeBlock(block);
  }

  checkOverlap(date, startMinutes, endMinutes, assignedSlotsByDate) {
    return checkOverlap(date, startMinutes, endMinutes, assignedSlotsByDate);
  }

  checkBlockedTimeConflict(startMinutes, endMinutes, blockedTimes) {
    return checkBlockedTimeConflict(startMinutes, endMinutes, blockedTimes);
  }

  buildMemberPreferences(currentRoom) {
    return buildMemberPreferences(currentRoom);
  }

  mergeOverlappingSlots(slots) {
    return mergeOverlappingSlots(slots);
  }

  isWithinPreferredTime(userId, dayOfWeek, startMinutes, endMinutes, memberPreferences, dateStr = null) {
    return isWithinPreferredTime(userId, dayOfWeek, startMinutes, endMinutes, memberPreferences, dateStr);
  }

  calculateDistance(lat1, lng1, lat2, lng2) {
    return calculateDistance(lat1, lng1, lat2, lng2);
  }

  sortSlotsByDistance(slots, owner, memberLocations) {
    return sortSlotsByDistance(slots, owner, memberLocations);
  }

  async findAvailableSlot(mergedSlot, userId, memberPreferences, travelDurationMinutes, activityDurationMinutes, blockedTimes, assignedSlotsByDate, startFromLocation, lastLocationByDate, memberLocation, travelMode, travelModeService, minStartMinutes = 0) {
    return findAvailableSlot(mergedSlot, userId, memberPreferences, travelDurationMinutes, activityDurationMinutes, blockedTimes, assignedSlotsByDate, startFromLocation, lastLocationByDate, memberLocation, travelMode, travelModeService, minStartMinutes);
  }

  async findAvailableSlotsWithSplit(mergedSlot, userId, memberPreferences, travelDurationMinutes, totalActivityDurationMinutes, blockedTimes, assignedSlotsByDate, startFromLocation, lastLocationByDate, currentMemberLocation, travelMode, travelModeService, ownerToMemberTravelInfo, minStartMinutes = 0) {
    return findAvailableSlotsWithSplit(mergedSlot, userId, memberPreferences, travelDurationMinutes, totalActivityDurationMinutes, blockedTimes, assignedSlotsByDate, startFromLocation, lastLocationByDate, currentMemberLocation, travelMode, travelModeService, ownerToMemberTravelInfo, minStartMinutes);
  }

  async simulateTimeSlotPlacement(currentRoom, userId, selectedDate, selectedStartMinutes, duration, travelMode = 'normal') {
    return simulateTimeSlotPlacement(currentRoom, userId, selectedDate, selectedStartMinutes, duration, travelMode);
  }

  async getBlockedTimesForMember(currentRoom, userId, selectedDate, travelMode = 'normal') {
    return getBlockedTimesForMember(currentRoom, userId, selectedDate, travelMode);
  }

  async getAvailableTimesForMember(currentRoom, userId, selectedDate, duration, travelMode = 'normal') {
    return getAvailableTimesForMember(currentRoom, userId, selectedDate, duration, travelMode);
  }

  async validateWalkingMode(currentRoom) {
    return validateWalkingMode(currentRoom);
  }

  async recalculateScheduleWithTravel(currentRoom, travelMode = 'normal') {
    return recalculateScheduleWithTravel(currentRoom, travelMode);
  }
}

export default new TravelScheduleCalculator();
