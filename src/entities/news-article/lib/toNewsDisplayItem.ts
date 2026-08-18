import type { NewsDisplayItem } from '@/shared/lib/types';
import type { NewsRow } from '../api';

/**
 * `NewsRow`를 클라이언트로 넘겨도 되는 `NewsDisplayItem` 형상으로 투영한다.
 *
 * `NewsRow`는 `NewsDisplayItem`의 상위 집합이라 그대로 넘겨도 **타입 검사를 통과한다**
 * — 변수로 넘기면 excess-property 검사가 안 걸리기 때문이다. 그래서 클라이언트
 * 컴포넌트에 무심코 넘기면 `bodyEn`(기사 영어 원문)·`symbol`·`analyzedAt`이 RSC
 * 페이로드에 그대로 실려 나가고, 그 페이로드는 12시간 ISR 캐시(S3)에 굳어 조회마다
 * Cloudflare를 통해 전송된다. 180일 창에 상한이 없어 인기 종목은 수백 행이다
 * (감사: 비용 라운드 14).
 *
 * 명시적 allowlist다 — `NewsDisplayItem`에 선언된 필드만 복사한다. 시장 뉴스
 * 슬라이스가 같은 이유로 이미 두고 있는 `toMarketNewsCardItem`의 대칭물이다.
 */
export function toNewsDisplayItem(row: NewsRow): NewsDisplayItem {
    return {
        id: row.id,
        publishedAt: row.publishedAt,
        titleEn: row.titleEn,
        titleKo: row.titleKo,
        sentiment: row.sentiment,
        category: row.category,
        bodyKo: row.bodyKo,
        summaryKo: row.summaryKo,
        priceImpact: row.priceImpact,
        url: row.url,
        source: row.source,
    };
}
