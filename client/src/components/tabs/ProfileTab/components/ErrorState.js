// 에러 상태 컴포넌트

import React from 'react';

export const ErrorState = ({ error }) => {
  return <div className="text-red-500">오류: {error}</div>;
};
