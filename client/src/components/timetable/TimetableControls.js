import React from 'react';

const TimetableControls = ({ weekDates, days }) => {
  return (
    <div className="grid grid-cols-6 bg-gray-100 border-b border-gray-200">
      <div className="col-span-1 p-2 text-center font-semibold text-gray-700">시간</div>
      {(weekDates.length > 0 ? weekDates : days).map((day, index) => (
        <div key={index} className="col-span-1 p-2 text-center font-semibold text-gray-700 border-l border-gray-200">
          {day}
        </div>
      ))}
    </div>
  );
};

export default TimetableControls;