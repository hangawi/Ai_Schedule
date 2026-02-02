/**
 * 이동시간 캐시 시스템
 *
 * Google Maps API 호출을 최소화하기 위한 캐싱 메커니즘.
 * 같은 출발지-목적지 조합은 캐시에서 재사용합니다.
 */

class TravelTimeCache {
  constructor() {
    this.cache = new Map();
    this.TTL = 24 * 60 * 60 * 1000; // 24시간 (밀리초)
    this.maxSize = 10000; // 최대 캐시 항목 수
  }

  /**
   * 캐시 키 생성
   * @param {string} origin - 출발지 (lat,lng 또는 주소)
   * @param {string} destination - 목적지 (lat,lng 또는 주소)
   * @param {string} mode - 이동 수단
   * @returns {string} 캐시 키
   */
  _generateKey(origin, destination, mode) {
    // 좌표는 소수점 4자리까지만 사용 (약 11m 정밀도)
    const normalizeCoord = (coord) => {
      if (typeof coord === 'string' && coord.includes(',')) {
        const [lat, lng] = coord.split(',').map(v => parseFloat(v).toFixed(4));
        return `${lat},${lng}`;
      }
      return coord;
    };

    const normalizedOrigin = normalizeCoord(origin);
    const normalizedDest = normalizeCoord(destination);

    return `${normalizedOrigin}|${normalizedDest}|${mode}`;
  }

  /**
   * 캐시에서 이동시간 조회
   * @param {string} origin - 출발지
   * @param {string} destination - 목적지
   * @param {string} mode - 이동 수단
   * @returns {number|null} 이동시간 (분) 또는 null
   */
  get(origin, destination, mode) {
    const key = this._generateKey(origin, destination, mode);
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // TTL 확인
    if (Date.now() - cached.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.travelTime;
  }

  /**
   * 다른 교통수단으로 캐시된 값 찾기 (fallback용)
   * @param {string} origin - 출발지
   * @param {string} destination - 목적지
   * @param {string} excludeMode - 제외할 교통수단 (이미 시도한 모드)
   * @returns {number|null} 이동시간 (분) 또는 null
   */
  getFromAnyMode(origin, destination, excludeMode = null) {
    // 우선순위: transit > driving > walking > bicycling
    const modes = ['transit', 'driving', 'walking', 'bicycling'];
    
    for (const mode of modes) {
      if (mode === excludeMode) continue;
      
      const travelTime = this.get(origin, destination, mode);
      if (travelTime !== null) {
        return travelTime;
      }
    }
    
    return null;
  }

  /**
   * 캐시에 이동시간 저장
   * @param {string} origin - 출발지
   * @param {string} destination - 목적지
   * @param {string} mode - 이동 수단
   * @param {number} travelTime - 이동시간 (분)
   */
  set(origin, destination, mode, travelTime) {
    const key = this._generateKey(origin, destination, mode);

    // 캐시 크기 제한
    if (this.cache.size >= this.maxSize) {
      // 가장 오래된 항목 삭제 (FIFO)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      travelTime,
      timestamp: Date.now()
    });

  }

  /**
   * 캐시 통계
   * @returns {Object} 캐시 통계 정보
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.TTL / (60 * 60 * 1000) + '시간'
    };
  }

  /**
   * 캐시 초기화
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
  }

  /**
   * 만료된 항목 정리
   */
  cleanup() {
    const now = Date.now();
    let deletedCount = 0;

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.TTL) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
    }

    return deletedCount;
  }
}

// 싱글톤 인스턴스
const travelTimeCache = new TravelTimeCache();

// 1시간마다 자동 정리
setInterval(() => {
  travelTimeCache.cleanup();
}, 60 * 60 * 1000);

module.exports = travelTimeCache;
