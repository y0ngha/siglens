import 'server-only';
import type { DrizzleNewsRepository } from '../api';
import { buildAnalysisNewsItems } from './buildAnalysisNewsItems';
import { NEWS_ANALYSIS_LOOKBACK_MS } from './newsLookback';

/**
 * "이 심볼로 지금 뉴스 분석을 만들 수 있는가" — prewarm `news` 탭의 전제조건.
 *
 * core가 `{status:'error', code:'no_news'}`를 줬을 때 그게 **일시적 장애**인지
 * **최근 뉴스 부재**인지 가르기 위한 판별자다. 그 code는 "이번 호출에 넘긴
 * 배열이 비었다"만 뜻하므로, 적재(ingest)를 이미 끝낸 뒤에도 여전히 0건인지
 * 직접 확인해야 "이번 창에 쓸 재료가 실제로 없다"가 성립한다.
 *
 * seam이 내부에서 평가하는 것과 **같은 조건**을 본다(`listBySymbol(30일)` →
 * `buildAnalysisNewsItems`). 적재된 원문만으로는 부족하고 보강(번역+라벨)까지
 * 끝난 행이어야 한다는 점이 핵심이다 — `isEnrichedRow`가 미보강 행을 전부
 * 걸러내기 때문에, "DB에 기사는 있는데 분석은 no_news"가 실제로 발생한다.
 *
 * `overall` 탭은 대상이 아니다. core 1.14.0부터 `runOverallAnalysis`가 뉴스 축의
 * `no_news`를 abstain으로 처리하므로 뉴스가 없다고 실패하지 않는다.
 *
 * 오류 경로에서만 호출된다. 인덱스가 걸린 조회 1회이고, 정상 야간에는 아예
 * 실행되지 않는다.
 */
export async function hasAnalyzableNews(
    repo: DrizzleNewsRepository,
    symbol: string
): Promise<boolean> {
    const rows = await repo.listBySymbol(symbol, NEWS_ANALYSIS_LOOKBACK_MS);
    return buildAnalysisNewsItems(rows).length > 0;
}
