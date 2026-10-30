import { getTranslations } from 'next-intl/server';
import { rewriteToPlainLanguage } from '@/entities/analysis-plain/api';
import {
    resolveCurrentPrice,
    resolvePriceAsOf,
} from '@/entities/analysis-plain/server/currentPrice';
import { currencyForSymbol } from '@/shared/config/marketProfile/registry';
import type { Locale } from '@/shared/i18n/locales';
import type { AnalysisType } from './types';

/**
 * 평이화("쉽게보기")를 적용할 분석 종류.
 *
 * 토글 UI가 있는 종목 탭 7종만. `briefing`·`macroBriefing`·`marketNewsDigest`는 화면에 토글이 없어
 * 호출이 그대로 낭비다. `extractProse`와 평이화 프롬프트에 타입별 분기가 없으므로 종류를 늘리는
 * 비용은 이 집합에 문자열 하나를 넣는 것이다.
 */
const PLAIN_ENABLED_TYPES: ReadonlySet<AnalysisType> = new Set([
    'technical',
    'overall',
    'news',
    'fundamental',
    'financials',
    'options',
    'congress',
]);

/** SSE 응답 봉투에 붙는 평이화 필드. core 타입은 건드리지 않는다. */
type WithPlain<T> = T & { plain?: string | null };

/**
 * core가 만든 게이트 거부 문구를 요청 로케일 카탈로그로 갈아끼운다.
 *
 * `timeframe_not_allowed`의 `message`는 core가 만든 **영어** 문장이라 ko 사용자에게도 영어가 나간다.
 * 코드가 함께 오므로 문구만 대체한다. 카탈로그 조회라 LLM 번역과 달리 비용이 없다.
 */
async function withLocalizedGateError<T>(
    work: Promise<T>,
    locale: Locale
): Promise<T> {
    const result = await work;
    if (
        typeof result !== 'object' ||
        result === null ||
        (result as { status?: unknown }).status !== 'error'
    ) {
        return result;
    }
    const envelope = result as { error?: { code?: string; message?: string } };
    if (envelope.error?.code !== 'timeframe_not_allowed') return result;

    const t = await getTranslations({ locale, namespace: 'app.api.stream' });
    return {
        ...envelope,
        error: { ...envelope.error, message: t('timeframeNotAllowed') },
    } as T;
}

/**
 * 결과 봉투에 평이화 산문을 덧붙인다.
 *
 * ## 입력은 이미 요청 로케일이다
 *
 * 모든 축이 core에 `locale`을 넘기므로 `result`의 산문은 이미 요청 언어다. 평이화는 그것을 쉽게 고쳐
 * 쓰기만 하면 된다. 사후 번역 계층을 두면 core가 대상 언어로 써준 산출물을 다시 번역 프롬프트에
 * 넣게 된다.
 *
 * ## 왜 순서가 중요한가
 *
 * 평이화 산출물의 언어는 지시가 아니라 **입력 산문의 언어**가 지배한다. 프로덕션 프롬프트·프로바이더로
 * 측정한 결과(N=6, 재시도 포함): 한국어 산문 + "일본어로 쓰라" → 일본어 4/6, 한국어 산문 +
 * "중국어로 쓰라" → 중국어 2/6. 지시를 시스템 프롬프트·머리말·말미 세 곳에 넣고도 이 정도였다.
 *
 * ## 에러 봉투에는 붙이지 않는다
 *
 * 액션은 실패를 `{ status: 'error', ... }`로 돌려주는데 그 `message`가 `PROSE_FIELD_NAMES`에 걸려
 * 산문으로 추출된다. 그대로 두면 게이트 거부 문구를 LLM에 보내 "쉽게 쓴 에러 메시지"를 만들고
 * 거부마다 DeepSeek 왕복이 붙는다.
 */
async function withPlainLanguage<T>(
    result: T,
    symbol: string,
    locale: Locale
): Promise<WithPlain<T>> {
    if (
        typeof result !== 'object' ||
        result === null ||
        (result as { status?: unknown }).status === 'error'
    ) {
        return result as WithPlain<T>;
    }
    // **봉투가 아니라 분석 payload를 넘긴다.** 액션은 `{ status, result, ... }`를 돌려주는데, 봉투째
    // 넘기면 `extractProse`가 모든 경로에 `result.` 접두를 붙여 `dropSupersededPaths`(bare 경로로 매칭)가
    // 조용히 no-op이 된다 — 그러면 보정 전/후 매매 가격 두 벌이 함께 프롬프트에 실려, 그 함수가 막으려던
    // 모순 출력("다른 분석에서는 목표가를…")이 재현된다.
    const envelope = result as { result?: unknown };
    const payload =
        typeof envelope.result === 'object' && envelope.result !== null
            ? envelope.result
            : result;
    const plain = await rewriteToPlainLanguage(
        payload,
        symbol,
        locale,
        currencyForSymbol(symbol),
        await resolveCurrentPrice(symbol, payload),
        await resolvePriceAsOf(symbol, locale, payload)
    );
    return { ...(result as object), plain } as WithPlain<T>;
}

/**
 * 게이트 문구 현지화와 평이화를 결과에 적용한다.
 *
 * `symbol`이 없으면(종목과 무관한 분석) 평이화를 건너뛴다 — `facts.symbol`이 프롬프트의 사실 블록에
 * 들어가므로 빈 값을 넘기면 안 된다.
 *
 * ## 봇과 사람은 같은 리더 뷰를 받는다 (UA 분기 없음)
 *
 * - **클로킹.** 기본값이 쉽게보기라(localStorage가 빈 크롤러는 항상 기본값) 봇만 원문을 받으면 봇이
 *   보는 DOM과 기본 사람이 보는 DOM이 서로 다른 본문이 된다. 의도와 무관하게 Google의 클로킹 패턴과
 *   구분되지 않는다.
 * - **비용은 이미 저장소가 잡는다.** 평이화 결과는 원문 해시 키로 만료 없이 `analysis_plain_texts`에
 *   저장된다(`entities/analysis-plain/api.ts`). 비용은 크롤 1회당이 아니라 분석 텍스트 1건당이고,
 *   화이트리스트 심볼은 `seo_analysis_snapshots.plain`이 이미 채워져 있다.
 */
export function withReaderViews<T>(
    work: Promise<T>,
    locale: Locale,
    type: AnalysisType,
    symbol: unknown
): Promise<T> {
    const plainEnabled =
        typeof symbol === 'string' &&
        symbol.length > 0 &&
        PLAIN_ENABLED_TYPES.has(type);
    const gated = withLocalizedGateError(work, locale);
    if (!plainEnabled) return gated;

    return gated.then(async result => {
        // 호출부에도 안전망을 둔다. `rewriteToPlainLanguage`가 "절대 reject하지 않는다"를 계약으로
        // 지키지만 그 계약이 한 번 깨지면 성공한 분석이 통째로 에러 프레임이 된다 — 장식 레이어가
        // 감당할 수 있는 실패가 아니다.
        const withPlain = await withPlainLanguage(result, symbol, locale).catch(
            (error: unknown) => {
                console.error('[withPlainLanguage] unexpected throw', error);
                return result as WithPlain<T>;
            }
        );
        return {
            ...(result as object),
            plain: (withPlain as { plain?: string | null }).plain ?? null,
        } as T;
    });
}
