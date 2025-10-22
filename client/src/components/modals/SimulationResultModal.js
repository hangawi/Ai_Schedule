import React, { useState } from 'react';
import TimetableGrid from '../timetable/TimetableGrid';
import { X, Grid, Calendar, Clock, Merge, Split } from 'lucide-react';
import { getCurrentWeekMonday } from '../../utils/coordinationUtils';

const SimulationResultModal = ({ isOpen, onClose, simulationResult, roomData, currentUser }) => {
  const [viewMode, setViewMode] = useState('week');
  const [showFullDay, setShowFullDay] = useState(false);
  const [showMerged, setShowMerged] = useState(true);
  const [currentWeekStartDate, setCurrentWeekStartDate] = useState(getCurrentWeekMonday());

  if (!isOpen || !simulationResult) return null;

  const { timeSlots, members, name, description, settings } = simulationResult;

  const scheduleStartHour = settings?.scheduleStart || 9;
  const scheduleEndHour = settings?.scheduleEnd || 18;
  const effectiveShowFullDay = showFullDay;

  const handleWeekChange = (date) => {
    setCurrentWeekStartDate(date);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800">시뮬레이션 결과: {name}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            <X size={24} />
          </button>
        </div>

        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center">
                <Calendar size={20} className="mr-2 text-green-600" />
                시간표 ({showFullDay ? '00' : String(scheduleStartHour).padStart(2, '0')}:00 - {showFullDay ? '24' : String(scheduleEndHour).padStart(2, '0')}:00)
            </h3>
            <div className="flex items-center space-x-2">
                <button
                    onClick={() => setShowFullDay(!showFullDay)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        showFullDay
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                    <Clock size={16} className="mr-1 inline" />
                    {showFullDay ? '24시간' : '기본'}
                </button>
                <button
                    onClick={() => setShowMerged(!showMerged)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        showMerged
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                    {showMerged ? (
                    <>
                        <Split size={16} className="mr-1 inline" />
                        분할
                    </>
                    ) : (
                    <>
                        <Merge size={16} className="mr-1 inline" />
                        병합
                    </>
                    )}
                </button>
                <button
                    onClick={() => setViewMode('week')}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        viewMode === 'week'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                    <Grid size={16} className="mr-1 inline" />
                    주간
                </button>
            </div>
        </div>

        <div className="flex-1 overflow-auto">
            <TimetableGrid
                key={`sim-week-${effectiveShowFullDay ? 'full' : 'basic'}-${showMerged ? 'merged' : 'split'}`}
                roomId={roomData._id}
                roomSettings={{
                    ...settings,
                    startHour: effectiveShowFullDay ? 0 : scheduleStartHour,
                    endHour: effectiveShowFullDay ? 24 : scheduleEndHour
                }}
                timeSlots={timeSlots || []}
                members={members || []}
                roomData={{...roomData, ...simulationResult}}
                currentUser={currentUser}
                isRoomOwner={true}
                selectedSlots={[]}
                onSlotSelect={() => {}}
                onWeekChange={handleWeekChange}
                initialStartDate={currentWeekStartDate}
                readOnly={true}
                showMerged={showMerged}
            />
        </div>
      </div>
    </div>
  );
};

export default SimulationResultModal;