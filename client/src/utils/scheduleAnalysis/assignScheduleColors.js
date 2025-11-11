/**
 * 이미지별 시간표 색상 할당
 *
 * 각 이미지마다 다른 색상을 자동으로 할당하여
 * 최적 시간표 모달에서 시각적으로 구분
 */

const COLOR_PALETTE = [
  {
    name: 'blue',
    bg: 'rgba(59, 130, 246, 0.1)', // blue-500 10%
    border: 'rgb(59, 130, 246)', // blue-500
    text: 'rgb(29, 78, 216)', // blue-700
    label: '파란색'
  },
  {
    name: 'green',
    bg: 'rgba(34, 197, 94, 0.1)', // green-500 10%
    border: 'rgb(34, 197, 94)', // green-500
    text: 'rgb(21, 128, 61)', // green-700
    label: '초록색'
  },
  {
    name: 'orange',
    bg: 'rgba(249, 115, 22, 0.1)', // orange-500 10%
    border: 'rgb(249, 115, 22)', // orange-500
    text: 'rgb(194, 65, 12)', // orange-700
    label: '주황색'
  },
  {
    name: 'purple',
    bg: 'rgba(168, 85, 247, 0.1)', // purple-500 10%
    border: 'rgb(168, 85, 247)', // purple-500
    text: 'rgb(109, 40, 217)', // purple-700
    label: '보라색'
  },
  {
    name: 'pink',
    bg: 'rgba(236, 72, 153, 0.1)', // pink-500 10%
    border: 'rgb(236, 72, 153)', // pink-500
    text: 'rgb(190, 24, 93)', // pink-700
    label: '분홍색'
  },
  {
    name: 'indigo',
    bg: 'rgba(99, 102, 241, 0.1)', // indigo-500 10%
    border: 'rgb(99, 102, 241)', // indigo-500
    text: 'rgb(67, 56, 202)', // indigo-700
    label: '남색'
  },
  {
    name: 'red',
    bg: 'rgba(239, 68, 68, 0.1)', // red-500 10%
    border: 'rgb(239, 68, 68)', // red-500
    text: 'rgb(185, 28, 28)', // red-700
    label: '빨간색'
  },
  {
    name: 'teal',
    bg: 'rgba(20, 184, 166, 0.1)', // teal-500 10%
    border: 'rgb(20, 184, 166)', // teal-500
    text: 'rgb(15, 118, 110)', // teal-700
    label: '청록색'
  },
  {
    name: 'yellow',
    bg: 'rgba(234, 179, 8, 0.15)', // yellow-500 15% (더 진하게)
    border: 'rgb(202, 138, 4)', // yellow-600 (더 진하게)
    text: 'rgb(133, 77, 14)', // yellow-800
    label: '노란색'
  },
  {
    name: 'cyan',
    bg: 'rgba(6, 182, 212, 0.1)', // cyan-500 10%
    border: 'rgb(6, 182, 212)', // cyan-500
    text: 'rgb(14, 116, 144)', // cyan-700
    label: '하늘색'
  },
  {
    name: 'rose',
    bg: 'rgba(244, 63, 94, 0.1)', // rose-500 10%
    border: 'rgb(244, 63, 94)', // rose-500
    text: 'rgb(190, 18, 60)', // rose-700
    label: '장미색'
  },
  {
    name: 'lime',
    bg: 'rgba(132, 204, 22, 0.1)', // lime-500 10%
    border: 'rgb(132, 204, 22)', // lime-500
    text: 'rgb(77, 124, 15)', // lime-700
    label: '연두색'
  },
  {
    name: 'amber',
    bg: 'rgba(245, 158, 11, 0.1)', // amber-500 10%
    border: 'rgb(245, 158, 11)', // amber-500
    text: 'rgb(180, 83, 9)', // amber-700
    label: '황갈색'
  },
  {
    name: 'emerald',
    bg: 'rgba(16, 185, 129, 0.1)', // emerald-500 10%
    border: 'rgb(16, 185, 129)', // emerald-500
    text: 'rgb(4, 120, 87)', // emerald-700
    label: '에메랄드'
  },
  {
    name: 'violet',
    bg: 'rgba(139, 92, 246, 0.1)', // violet-500 10%
    border: 'rgb(139, 92, 246)', // violet-500
    text: 'rgb(91, 33, 182)', // violet-700
    label: '제비꽃색'
  },
  {
    name: 'fuchsia',
    bg: 'rgba(217, 70, 239, 0.1)', // fuchsia-500 10%
    border: 'rgb(217, 70, 239)', // fuchsia-500
    text: 'rgb(162, 28, 175)', // fuchsia-700
    label: '자주색'
  }
];

/**
 * 이미지별로 색상 할당
 */
function assignColorsToImages(schedulesByImage) {
  return schedulesByImage.map((imageData, index) => {
    const color = COLOR_PALETTE[index % COLOR_PALETTE.length];

    console.log(`🎨 이미지 ${index + 1}: ${color.label} 할당`);

    return {
      ...imageData,
      color: color,
      colorIndex: index
    };
  });
}

/**
 * 스케줄에 색상 정보 추가
 */
function addColorToSchedules(schedules, colorInfo) {
  return schedules.map(schedule => ({
    ...schedule,
    color: colorInfo
  }));
}

/**
 * 전체 스케줄에 이미지별 색상 적용
 */
function applyColorsToAllSchedules(schedulesByImage) {
  const coloredImages = assignColorsToImages(schedulesByImage);

  // 각 이미지의 스케줄에 색상 추가
  const coloredSchedules = coloredImages.map(imageData => ({
    ...imageData,
    schedules: addColorToSchedules(imageData.schedules, imageData.color)
  }));

  // 전체 스케줄 리스트 (색상 포함)
  const allColoredSchedules = coloredSchedules.flatMap(img => img.schedules);

  return {
    schedulesByImage: coloredSchedules,
    allSchedules: allColoredSchedules
  };
}

/**
 * 이미지 인덱스로 색상 가져오기
 */
function getColorForImageIndex(imageIndex) {
  return COLOR_PALETTE[imageIndex % COLOR_PALETTE.length];
}

export {
  COLOR_PALETTE,
  assignColorsToImages,
  addColorToSchedules,
  applyColorsToAllSchedules,
  getColorForImageIndex
};
