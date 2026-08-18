import 'server-only';
import { runNewsCardAnalysis, type NewsItem } from '@y0ngha/siglens-core';
import type { DrizzleNewsRepository } from '../api';
import { withConcurrencyLimit } from '@/shared/lib/withConcurrencyLimit';
import { NEWS_CARD_ANALYSIS_PARALLEL_LIMIT } from './newsAnalysisConstants';

/**
 * 기사 한 건을 카드 분석(번역 + 라벨링)해 DB에 반영한다.
 *
 * 호출자가 `item`이 아직 미분석(`analyzedAt === null`)임을 보장한다.
 *
 * 추론 on/off는 여기서 정하지 않는다 — `runNewsCardAnalysis`가 use-case 정책으로
 * `reasoning: false`를 고정한다(번역 + 라벨링은 결정적 변환).
 */
async function analyzeAndPersist(
    item: NewsItem,
    repo: DrizzleNewsRepository
): Promise<void> {
    const analyzed = await runNewsCardAnalysis({ item });

    // titleKo와 summaryKo가 **둘 다** 비면 core normalizer의 crash-safe fallback을
    // 그대로 받은 것이다 — `normalizeNewsCardAnalysis`는 응답이 스키마와 어긋나면
    // `asObject(parsed) ?? {}`로 전 필드를 기본값(문자열 '', sentiment 'neutral',
    // category 'other')으로 떨어뜨린다. 그대로 저장하면 `analyzedAt`이 세팅되어
    // 이 기사는 두 번 다시 분석되지 않고 그 기본값이 영구 고착한다 — DB를 손으로
    // 되돌리기 전까지 복구 불가. 경제 이벤트·지표 번역 경로와 같은 skip 정책이다
    // (`ensureEconomicEventsAnalyzedAction`).
    //
    // DeepSeek 어댑터는 `responseSchema`를 무시하고 `json_object`만 걸어(JSON
    // 유효성만 보장, 필드·enum은 미보장) 이 경로가 실제로 열려 있다.
    //
    // 조건을 "둘 다 빈 경우"로 좁힌 이유는 재시도 비용이다. titleKo가 채워진 응답은
    // 모델이 실제로 만들어낸 결과이지 fallback이 아니므로 저장하는 편이 맞고,
    // 그만큼 재시도 표면이 좁아진다. 남은 표면(완전 fallback)은 응답 자체가
    // 비결정적이라 재시도로 대개 회복된다.
    const { titleKo, summaryKo } = analyzed.result;
    if (titleKo.trim() === '' && summaryKo.trim() === '') {
        console.warn(
            `[analyzeNewsCards] empty card analysis — skipping persist for ${item.id}`
        );
        return;
    }

    await repo.attachAnalysis(item.id, analyzed.result, new Date());
}

export interface AnalyzeNewsCardsOptions {
    /**
     * 이번 호출에서 분석할 최대 건수. 최신순으로 자른다.
     *
     * 두 호출자 모두 값을 넘기지만 근거가 다르다. prewarm cron은 유닛
     * 타임아웃(2분) 안에서 끝나야 해서 12건(`PREWARM_NEWS_CARD_LIMIT`),
     * 방문자 경로는 마감은 없지만 마운트당 LLM 왕복 비용이 있어
     * 25건(`VISITOR_NEWS_CARD_LIMIT`)이다. 생략하면 후보
     * 전체를 분석한다 — 180일 적재분이면 최악 1,000건이라 실질적으로 쓰면 안 된다.
     */
    limit?: number;
    /** 로그 접두. 어느 경로에서 난 실패인지 CloudWatch에서 구분하기 위한 것. */
    logLabel: string;
}

/**
 * 미분석 기사들을 카드 분석해 DB에 채운다.
 *
 * **왜 별도 함수인가**: 이 단계를 건너뛴 뉴스 행은 분석 파이프라인에서 통째로
 * 사라진다. `isEnrichedRow`가 `titleKo`·`summaryKo`·`sentiment`·`category`·
 * `priceImpact`가 모두 채워진 행만 통과시키므로, 원문만 적재된 행은
 * `buildAnalysisNewsItems`에서 전부 걸러지고 core의 `runNewsAnalysis`는
 * `news.length === 0`을 보고 `{status:'error', code:'no_news'}`를 반환한다.
 * 그러면 `news`와 `overall` 두 탭의 SEO 스냅샷이 생성되지 않는다.
 *
 * 원래 이 로직은 `ensureNewsCardsAnalyzedAction`(방문자 경로) 안에만 있었다.
 * 그래서 **사람이 찾지 않는 종목은 영원히 보강되지 않았다** — 보강이 없으니
 * 스냅샷이 없고, 스냅샷이 없으니 페이지가 얇고, 얇으니 유입이 없어 다시 아무도
 * 찾지 않는다. 국내 종목은 신규 유입이 0에서 시작하므로 구조적으로 이 루프에
 * 100% 걸린다(실측: 프로덕션에서 국내 20종목 전부 보강 0건, 미국 저유동성
 * 종목·알트코인도 동일). prewarm cron이 같은 단계를 돌게 해서 끊는다.
 *
 * 실패는 건별로 로깅하고 삼킨다 — 한 기사의 LLM 실패가 나머지 기사와 상위
 * 배치를 죽이지 않는다.
 *
 * **`lib/`에 두는 것은 의도된 예외다**(MISTAKES.md §0.7은 `entities/{slice}/lib/`를
 * 순수 함수로 제한한다). 같은 슬라이스의 `ingestNewsForSymbol.ts`가 이미 같은 형태다 —
 * 파이프라인의 인접 단계(적재 → 보강)이고, 저장소를 주입받아 부수효과를 호출자가
 * 통제하며, 두 호출자(방문자 액션 / prewarm cron)가 공유해야 한다. `api.ts`로 옮기면
 * 두 단계가 서로 다른 파일로 갈라져 순서 계약이 읽히지 않는다. 새 패턴을 만드는
 * 게 아니라 이미 있는 지역 예외에 맞추는 쪽을 택했다.
 */
export async function analyzeNewsCards(
    candidates: readonly NewsItem[],
    repo: DrizzleNewsRepository,
    options: AnalyzeNewsCardsOptions
): Promise<void> {
    // 최신 기사가 분석 가치가 가장 높다. 상한에 걸려 잘려도 잘리는 쪽이 오래된
    // 기사가 되도록 정렬을 상한 적용 **앞에** 둔다.
    const targets =
        options.limit === undefined
            ? candidates
            : candidates
                  .toSorted((a, b) =>
                      b.publishedAt.localeCompare(a.publishedAt)
                  )
                  .slice(0, options.limit);

    if (targets.length === 0) return;

    // `runNewsCardAnalysis`는 블로킹 LLM 왕복이다(worker 제거 이후). 무제한 병렬
    // 실행은 2-vCPU 서버에서 커넥션 풀 고갈 / 메모리 압박을 유발하므로
    // NEWS_CARD_ANALYSIS_PARALLEL_LIMIT개씩 청크 단위로 실행한다.
    const settled = await withConcurrencyLimit(
        targets,
        NEWS_CARD_ANALYSIS_PARALLEL_LIMIT,
        item => analyzeAndPersist(item, repo)
    );
    const failures = settled.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
        console.error(
            `[${options.logLabel}] ${failures.length}/${targets.length} analyzeAndPersist failed`,
            failures.map(f => (f.status === 'rejected' ? f.reason : null))
        );
    }
}
