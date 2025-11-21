/**
 * 배열 관련 유틸리티 함수
 */

/**
 * 배열에서 중복 제거
 * @param {Array} arr - 원본 배열
 * @returns {Array} 중복 제거된 배열
 */
const uniqueArray = (arr) => {
  return [...new Set(arr)];
};

/**
 * 객체 배열을 키로 그룹핑
 * @param {Array} arr - 객체 배열
 * @param {string|Function} keyOrFn - 그룹핑 키 또는 키 추출 함수
 * @returns {Object} 그룹핑된 객체
 */
const groupBy = (arr, keyOrFn) => {
  return arr.reduce((acc, item) => {
    const key = typeof keyOrFn === 'function' ? keyOrFn(item) : item[keyOrFn];
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {});
};

/**
 * 배열을 정렬하여 문자열로 변환 (비교용)
 * @param {Array} arr - 배열
 * @returns {string} 정렬된 문자열
 */
const sortedJoin = (arr, separator = ',') => {
  return [...arr].sort().join(separator);
};

/**
 * 두 배열의 교집합
 * @param {Array} arr1 - 첫 번째 배열
 * @param {Array} arr2 - 두 번째 배열
 * @returns {Array} 교집합 배열
 */
const intersection = (arr1, arr2) => {
  const set2 = new Set(arr2);
  return arr1.filter(item => set2.has(item));
};

/**
 * 두 배열의 차집합 (arr1 - arr2)
 * @param {Array} arr1 - 첫 번째 배열
 * @param {Array} arr2 - 두 번째 배열
 * @returns {Array} 차집합 배열
 */
const difference = (arr1, arr2) => {
  const set2 = new Set(arr2);
  return arr1.filter(item => !set2.has(item));
};

/**
 * 배열의 합집합
 * @param {Array} arr1 - 첫 번째 배열
 * @param {Array} arr2 - 두 번째 배열
 * @returns {Array} 합집합 배열
 */
const union = (arr1, arr2) => {
  return uniqueArray([...arr1, ...arr2]);
};

/**
 * 배열의 합계
 * @param {Array} arr - 숫자 배열
 * @returns {number} 합계
 */
const sum = (arr) => {
  return arr.reduce((acc, val) => acc + val, 0);
};

/**
 * 배열의 평균
 * @param {Array} arr - 숫자 배열
 * @returns {number} 평균
 */
const average = (arr) => {
  if (arr.length === 0) return 0;
  return sum(arr) / arr.length;
};

/**
 * 배열의 최댓값
 * @param {Array} arr - 숫자 배열
 * @returns {number} 최댓값
 */
const max = (arr) => {
  if (arr.length === 0) return -Infinity;
  return Math.max(...arr);
};

/**
 * 배열의 최솟값
 * @param {Array} arr - 숫자 배열
 * @returns {number} 최솟값
 */
const min = (arr) => {
  if (arr.length === 0) return Infinity;
  return Math.min(...arr);
};

/**
 * 객체 배열에서 특정 키의 최댓값 찾기
 * @param {Array} arr - 객체 배열
 * @param {string|Function} keyOrFn - 키 또는 값 추출 함수
 * @returns {*} 최댓값을 가진 객체
 */
const maxBy = (arr, keyOrFn) => {
  if (arr.length === 0) return undefined;
  return arr.reduce((maxItem, item) => {
    const maxVal = typeof keyOrFn === 'function' ? keyOrFn(maxItem) : maxItem[keyOrFn];
    const curVal = typeof keyOrFn === 'function' ? keyOrFn(item) : item[keyOrFn];
    return curVal > maxVal ? item : maxItem;
  });
};

/**
 * 객체 배열에서 특정 키의 최솟값 찾기
 * @param {Array} arr - 객체 배열
 * @param {string|Function} keyOrFn - 키 또는 값 추출 함수
 * @returns {*} 최솟값을 가진 객체
 */
const minBy = (arr, keyOrFn) => {
  if (arr.length === 0) return undefined;
  return arr.reduce((minItem, item) => {
    const minVal = typeof keyOrFn === 'function' ? keyOrFn(minItem) : minItem[keyOrFn];
    const curVal = typeof keyOrFn === 'function' ? keyOrFn(item) : item[keyOrFn];
    return curVal < minVal ? item : minItem;
  });
};

/**
 * 배열에서 조건을 만족하는 항목 개수
 * @param {Array} arr - 배열
 * @param {Function} predicate - 조건 함수
 * @returns {number} 조건을 만족하는 항목 수
 */
const countBy = (arr, predicate) => {
  return arr.filter(predicate).length;
};

module.exports = {
  uniqueArray,
  groupBy,
  sortedJoin,
  intersection,
  difference,
  union,
  sum,
  average,
  max,
  min,
  maxBy,
  minBy,
  countBy
};
