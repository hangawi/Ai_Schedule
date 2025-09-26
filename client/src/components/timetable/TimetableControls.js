import React from 'react';

const TimetableControls = ({ weekDates, days }) => {
  // 평일만 5개 표시 (월~금)
  const displayItems = weekDates.length > 0 ? weekDates.slice(0, 5) : days.slice(0, 5);

  return (
    <div className="grid grid-cols-6 bg-gray-100 border-b border-gray-200">
      <div className="col-span-1 p-2 text-center font-semibold text-gray-700">시간</div>
      {displayItems.map((item, index) => (
        <div key={index} className="col-span-1 p-2 text-center font-semibold text-gray-700 border-l border-gray-200">
          {weekDates.length > 0 ? item.display : item}
        </div>
      ))}
    </div>
  );
};

export default TimetableControls;