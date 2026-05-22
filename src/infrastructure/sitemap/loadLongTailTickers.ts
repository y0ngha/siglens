import { POPULAR_TICKERS } from '@/domain/constants/popular-tickers';
import { tryGetDatabaseClient } from '@/infrastructure/db/client';
import { DrizzleKoreanTickerRepository } from '@/infrastructure/db/tickerRepository';

/**
 * sitemap에 포함할 long-tail ticker 목록을 반환한다.
 *
 * POPULAR_TICKERS는 sitemap route에서 5개 라우트(차트·뉴스·펀더멘털·옵션·종합·
 * 공포탐욕)를 모두 노출하지만, 그 외의 DB 등록 ticker는 비용 보호를 위해 차트
 * 페이지만 sitemap에 추가한다. 옵션 hasOptionsMarket probe는 동시성 5로 묶여
 * 있어도 long-tail 전체로 확장하면 cold start에서 Yahoo Finance rate-limit을
 * 깰 위험이 있다. 뉴스·펀더멘털·공포탐욕은 cross-link로 crawler가 발견하면
 * 인덱싱되므로 sitemap 직접 노출은 불필요.
 *
 * DB 미설정/실패 시 빈 배열을 반환해 sitemap 빌드가 POPULAR_TICKERS만으로
 * 정상 동작하도록 graceful degradation한다.
 */
export async function loadLongTailTickers(): Promise<readonly string[]> {
    const client = tryGetDatabaseClient();
    if (client === null) return [];

    try {
        const repo = new DrizzleKoreanTickerRepository(client.db);
        const all = await repo.findAll();
        // POPULAR_TICKERS는 모두 uppercase. DB는 casing 보장 없음 — soft
        // convention만 있어 일부 row가 mixed/lowercase일 수 있다. 비교를 항상
        // uppercase로 정규화해 case mismatch로 중복 sitemap 엔트리(/AAPL +
        // /aapl)가 생기는 회귀를 막고, 방출 URL도 uppercase로 통일해 페이지
        // canonical과 매칭되게 한다.
        const popularSet = new Set<string>(POPULAR_TICKERS);
        return all
            .map(row => row.symbol.toUpperCase())
            .filter(symbol => !popularSet.has(symbol));
    } catch (e) {
        console.error('[sitemap] loadLongTailTickers failed:', e);
        return [];
    }
}
