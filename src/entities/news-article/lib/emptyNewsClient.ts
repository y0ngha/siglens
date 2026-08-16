import type { NewsClientPort } from './newsClientPort';

/**
 * 뉴스 소스가 아직 없거나 자격증명이 미설정일 때 쓰는 무동작 클라이언트.
 *
 * 잘못된 소스로 폴백하는 대신 빈 결과를 돌려준다 — kr-equity를 FMP `stock`으로
 * 폴백시키면 한국 종목 페이지에 무관한 미국 뉴스가 실린다. 호출부는 이미 빈 배열을
 * "새로 수집할 뉴스 없음"으로 처리하므로 별도 분기가 필요 없다.
 *
 * 상태가 없어 싱글턴 인스턴스 하나로 충분하다(FmpNewsClient의 캐시 변수 불필요).
 */
export const EMPTY_NEWS_CLIENT: NewsClientPort = {
    fetchNews: async () => [],
    fetchNewsForPeriod: async () => [],
    fetchEarningsReport: async () => null,
};
