import type { NewsItem } from '@y0ngha/siglens-core';

/**
 * 호출부가 의존하는 뉴스 클라이언트 표면. `FmpNewsClient`는 core 포트가 아니라 siglens
 * 클래스라, 실제 클라이언트와 `FakeNewsClient`가 함께 만족해야 할 계약을 이 인터페이스로
 * 명시한다. 시그니처는 `FmpNewsClient`와 정확히 같다.
 *
 * `getNewsClient.ts`가 아니라 별도 파일인 이유는 `FakeNewsClient`가 타입만 import해도
 * getNewsClient ↔ FakeNewsClient 순환이 생기지 않게 하기 위해서다.
 */
export interface NewsClientPort {
    fetchNewsForPeriod(symbol: string, lookbackMs: number): Promise<NewsItem[]>;
}
