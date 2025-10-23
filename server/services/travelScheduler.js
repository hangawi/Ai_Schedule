class TravelScheduler {

    /**
     * Calculates the distance between two lat/lng points in kilometers using the Haversine formula.
     */
    _getDistance(lat1, lon1, lat2, lon2) {
        if (!lat1 || !lon1 || !lat2 || !lon2) {
            return Infinity; // Return a large distance if coordinates are missing
        }
        const R = 6371; // Radius of the Earth in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            0.5 - Math.cos(dLat)/2 + 
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            (1 - Math.cos(dLon))/2;

        return R * 2 * Math.asin(Math.sqrt(a));
    }

    /**
     * Estimates travel time in 30-minute slots.
     * Assumes an average speed of 30 km/h.
     */
    _getTravelTimeSlots(distance) {
        if (distance === Infinity) {
            return Infinity;
        }
        const averageSpeedKmh = 30;
        const travelHours = distance / averageSpeedKmh;
        const travelMinutes = travelHours * 60;
        // Round up to the nearest 30-minute slot
        return Math.ceil(travelMinutes / 30);
    }

    /**
     * Main function to run the travel-based scheduling simulation.
     */
    runTravelSchedule(members, owner, options) {
        console.log('\n--- Running Travel-Based Schedule Simulation ---');

        const { minHoursPerWeek = 3, currentWeek } = options;
        const minSlotsPerWeek = minHoursPerWeek * 2;
        const startDate = currentWeek ? new Date(currentWeek) : new Date();

        // 1. Prepare member data and initial state
        let unvisitedMembers = [...members].map(m => ({
            ...m,
            user: m.user,
            id: m.user._id.toString(),
            lat: m.user.addressLat,
            lng: m.user.addressLng,
        }));

        const ownerData = {
            ...owner,
            id: owner._id.toString(),
            lat: owner.addressLat,
            lng: owner.addressLng,
        };

        let assignments = {};
        members.forEach(m => {
            assignments[m.user._id.toString()] = { slots: [], assignedSlots: 0 };
        });

        let schedule = [];
        let currentTime = new Date(startDate);
        currentTime.setHours(9, 0, 0, 0); // Start at 9 AM on the first day
        let currentLocation = ownerData;
        let dayIndex = 0;
        const maxDays = 5; // Monday to Friday

        // 2. Main scheduling loop
        while (unvisitedMembers.length > 0 && dayIndex < maxDays) {
            // Find the nearest unvisited member
            let nearestMember = null;
            let shortestTravelSlots = Infinity;
            let travelDistance = 0;

            unvisitedMembers.forEach(member => {
                const distance = this._getDistance(currentLocation.lat, currentLocation.lng, member.lat, member.lng);
                const travelSlots = this._getTravelTimeSlots(distance);
                if (travelSlots < shortestTravelSlots) {
                    shortestTravelSlots = travelSlots;
                    nearestMember = member;
                    travelDistance = distance;
                }
            });

            if (!nearestMember) {
                console.log('No more reachable members.');
                break;
            }

            // 3. Calculate arrival time and find an available slot
            const travelMinutes = shortestTravelSlots * 30;
            let arrivalTime = new Date(currentTime.getTime() + travelMinutes * 60000);

            // Add travel time to the schedule
            if (shortestTravelSlots > 0) {
                schedule.push({
                    user: null, // Or a generic travel user
                    date: new Date(currentTime),
                    startTime: `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`,
                    endTime: `${String(arrivalTime.getHours()).padStart(2, '0')}:${String(arrivalTime.getMinutes()).padStart(2, '0')}`,
                    day: currentTime.toLocaleString('en-US', { weekday: 'long' }).toLowerCase(),
                    subject: '이동 ('.concat(Math.round(travelDistance)).concat('km)') ,
                    isTravel: true,
                });
            }

            // Find the first available slot for the nearest member after arrival
            const requiredSlots = minSlotsPerWeek - (assignments[nearestMember.id]?.assignedSlots || 0);
            if (requiredSlots <= 0) {
                // Member already has enough hours, remove from unvisited and continue
                unvisitedMembers = unvisitedMembers.filter(m => m.id !== nearestMember.id);
                continue;
            }

            const appointmentSlots = 2; // 1-hour appointment
            const foundSlot = this._findNextAvailableSlot(nearestMember, arrivalTime, appointmentSlots, schedule, options.roomSettings);

            if (foundSlot) {
                // 4. Assign the slot
                const { startTime, endTime, date } = foundSlot;
                const newSlot = {
                    user: nearestMember.user,
                    date: date,
                    startTime: startTime,
                    endTime: endTime,
                    day: date.toLocaleString('en-US', { weekday: 'long' }).toLowerCase(),
                    subject: '방문 일정',
                    isTravel: false,
                };
                schedule.push(newSlot);
                assignments[nearestMember.id].slots.push(newSlot);
                assignments[nearestMember.id].assignedSlots += appointmentSlots;

                // Update current time and location
                currentTime = new Date(date);
                const [endH, endM] = endTime.split(':').map(Number);
                currentTime.setHours(endH, endM, 0, 0);
                currentLocation = nearestMember;

                // Mark member as visited for this round
                unvisitedMembers = unvisitedMembers.filter(m => m.id !== nearestMember.id);

            } else {
                // No slot found for today, move to next day
                dayIndex++;
                currentTime = new Date(startDate);
                currentTime.setDate(currentTime.getDate() + dayIndex);
                currentTime.setHours(9, 0, 0, 0);
                currentLocation = ownerData; // Reset location to owner for the new day
                // Keep the member in unvisited to try again tomorrow
            }
        }

        return { timeSlots: schedule, members: members, name: '이동 기반 시뮬레이션', description: '이동 시간을 고려한 시뮬레이션 결과입니다.', settings: options.roomSettings };
    }

    /**
     * Finds the next available slot for a member respecting their preferences.
     */
    _findNextAvailableSlot(member, afterTime, durationSlots, schedule, roomSettings) {
        let searchTime = new Date(afterTime);
        const scheduleStartHour = roomSettings?.scheduleStart || 9;
        const scheduleEndHour = roomSettings?.scheduleEnd || 18;

        for (let i = 0; i < 100; i++) { // Limit search to prevent infinite loops
            const dayOfWeek = searchTime.getDay(); // 0=Sun, 1=Mon, ...

            // Check if it's a weekday and within working hours
            if (dayOfWeek > 0 && dayOfWeek < 6) {
                const searchHour = searchTime.getHours();
                if (searchHour >= scheduleStartHour && searchHour < scheduleEndHour) {
                    const isAvailable = this._isSlotFree(member, searchTime, durationSlots, schedule);
                    if (isAvailable) {
                        const startTime = `${String(searchTime.getHours()).padStart(2, '0')}:${String(searchTime.getMinutes()).padStart(2, '0')}`;
                        const endTimeDate = new Date(searchTime.getTime() + durationSlots * 30 * 60000);
                        const endTime = `${String(endTimeDate.getHours()).padStart(2, '0')}:${String(endTimeDate.getMinutes()).padStart(2, '0')}`;
                        return { startTime, endTime, date: new Date(searchTime) };
                    }
                }
            }

            // Increment search time by 30 minutes
            searchTime.setTime(searchTime.getTime() + 30 * 60000);

            // If we go past the end hour, move to the next day
            if (searchTime.getHours() >= scheduleEndHour) {
                searchTime.setDate(searchTime.getDate() + 1);
                searchTime.setHours(scheduleStartHour, 0, 0, 0);
            }
        }

        return null; // No slot found
    }

    /**
     * Checks if a given time slot is free for a member.
     */
    _isSlotFree(member, startTime, durationSlots, schedule) {
        const endTime = new Date(startTime.getTime() + durationSlots * 30 * 60000);
        const dayOfWeek = startTime.getDay();

        // 1. Get and merge preferred time blocks
        const memberSchedules = member.user.defaultSchedule
            .filter(s => s.dayOfWeek === dayOfWeek)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));

        if (memberSchedules.length === 0) {
            return false; // No preference for this day
        }

        const mergedBlocks = [];
        if (memberSchedules.length > 0) {
            let currentBlock = { ...memberSchedules[0] };
            for (let i = 1; i < memberSchedules.length; i++) {
                const nextBlock = memberSchedules[i];
                // If next block starts when or before current one ends, merge them
                if (nextBlock.startTime <= currentBlock.endTime) {
                    currentBlock.endTime = nextBlock.endTime > currentBlock.endTime ? nextBlock.endTime : currentBlock.endTime;
                } else {
                    mergedBlocks.push(currentBlock);
                    currentBlock = { ...nextBlock };
                }
            }
            mergedBlocks.push(currentBlock);
        }

        // 2. Check if the appointment is contained within any merged block
        let isInPreferredTime = false;
        for (const pref of mergedBlocks) {
            const [prefStartH, prefStartM] = pref.startTime.split(':').map(Number);
            const [prefEndH, prefEndM] = pref.endTime.split(':').map(Number);
            
            const prefStartTime = new Date(startTime);
            prefStartTime.setHours(prefStartH, prefStartM, 0, 0);
            
            const prefEndTime = new Date(startTime);
            prefEndTime.setHours(prefEndH, prefEndM, 0, 0);

            if (startTime >= prefStartTime && endTime <= prefEndTime) {
                isInPreferredTime = true;
                break;
            }
        }

        if (!isInPreferredTime) {
            return false; // Not within member's preferred time
        }

        // 3. Check against already scheduled appointments (existing logic is fine)
        for (const existingSlot of schedule) {
            const existingStartTime = new Date(existingSlot.date);
            const [startH, startM] = existingSlot.startTime.split(':').map(Number);
            existingStartTime.setHours(startH, startM, 0, 0);

            const existingEndTime = new Date(existingSlot.date);
            const [endH, endM] = existingSlot.endTime.split(':').map(Number);
            existingEndTime.setHours(endH, endM, 0, 0);

            // Check for overlap
            if (startTime < existingEndTime && endTime > existingStartTime) {
                return false; // Overlaps with an existing slot
            }
        }

        return true; // Slot is free
    }
}

module.exports = new TravelScheduler();
