import 'server-only';
import { createHash } from 'node:crypto';
import { createCacheProvider } from '@y0ngha/siglens-core';
import { callDeepseekChat, parseJsonResponse } from '@/entities/llm-provider';
import { tryReadTranslatorConfig } from '@/entities/ticker';
import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';
import glossary from '../../../messages/glossary.json';
import { extractProse } from './lib/proseFields';
import { translateAnalysis } from './lib/translateAnalysis';

/**
 * 번역 캐시 TTL. 분석 결과 자체의 TTL보다 길게 잡는다 — 같은 문장이 여러 분석에
 * 재등장하고(면책 문구·정형 표현), 원문이 바뀌면 해시가 달라져 자연히 무효화된다.
 */
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

const LOCALE_NAME: Record<Exclude<Locale, 'ko'>, string> = {
    en: 'English (US)',
    ja: 'Japanese',
    zh: 'Simplified Chinese',
};

/**
 * 캐시 키.
 *
 * **원문 산문 전체의 해시 + 로케일**이다. 심볼·탭·모델을 키에 넣지 않는 이유:
 * 같은 문장이면 어느 분석에서 왔든 번역이 같고, 원문이 조금이라도 바뀌면
 * 해시가 달라져 스스로 무효화된다. TTL 관리보다 내용 주소화가 안전하다.
 */
/**
 * 번역 프롬프트·용어집 버전.
 *
 * 캐시 키가 원문 해시 + 로케일뿐이면, **용어집이나 프롬프트 규칙을 고쳐도**
 * TTL 30일 동안 예전 번역이 그대로 나온다 — 용어집을 두는 이유 자체가 무력화된다.
 * `glossary.json`이나 `buildPrompt`의 규칙을 바꿀 때 이 값을 올린다.
 * (이 레포의 `PROMPT_TEMPLATE_VERSION`과 같은 클래스다.)
 */
const TRANSLATION_PROMPT_VERSION = 'v1';

function cacheKey(texts: readonly string[], locale: Locale): string {
    const digest = createHash('sha256')
        .update(JSON.stringify(texts))
        .digest('hex');
    return `i18n:analysis:${TRANSLATION_PROMPT_VERSION}:${locale}:${digest}`;
}

function buildPrompt(texts: readonly string[], locale: Exclude<Locale, 'ko'>) {
    // filter+map을 한 번의 flatMap으로 — 중간 배열을 만들지 않는다.
    const glossaryLines = Object.entries(
        glossary as Record<string, Record<string, string>>
    )
        .flatMap(([term, translations]) =>
            translations[locale]
                ? [`  "${term}" → "${translations[locale]}"`]
                : []
        )
        .join('\n');

    return `Translate each Korean stock-analysis sentence into ${LOCALE_NAME[locale]}.

Rules:
- Return a JSON array of strings with EXACTLY ${texts.length} items, in the same order.
- Never change numbers, prices, percentages, ticker symbols or dates.
- Keep the register of a professional finance report: factual, no hedging added or removed.
- Do not add explanations, headings, or markdown.
${glossaryLines ? `\nLocked terminology (use exactly):\n${glossaryLines}\n` : ''}
Input (JSON array of Korean strings):
${JSON.stringify(texts)}`;
}

/**
 * AI 분석 결과의 **산문만** 대상 로케일로 옮긴다.
 *
 * ## 왜 재분석이 아니라 후처리 번역인가
 *
 * `@y0ngha/siglens-core`의 public API에는 locale 파라미터가 없고, 프롬프트가
 * `overallConclusionKo` 같은 **필드 이름 수준에서** 한국어 출력을 고정한다.
 * 로케일별로 분석을 다시 돌리면 LLM 비용이 로케일 수만큼 곱해지고, 프롬프트
 * 15개 파일 수정 + 교차 레포 릴리스가 필요하다. 한국어로 한 번 생성한 결과의
 * 산문만 저가 모델로 옮기면 비용은 조회된 로케일당 한 번이고, 숫자 필드와
 * enum은 `*Ko` 후보가 아니라 애초에 번역 대상이 아니다. `priceRangeKo`처럼
 * **문자열 안에 든 숫자·날짜**는 넘어가므로, 그 보존은 아래 프롬프트의
 * "Never change numbers, prices, percentages, ticker symbols or dates" 규칙이
 * 담당한다 — 구조적 보장이 아니다.
 *
 * ## 실패는 전부 원문으로 떨어진다
 *
 * 키 없음·모델 오류·개수 불일치 모두 한국어 원문을 그대로 돌려준다. 부분 적용은
 * 한 화면에 두 언어가 섞이는 최악의 상태다. 번역이 없는 로케일은
 * `SYMBOL_INDEXABLE_LOCALES` 게이트가 색인에서 막으므로 SEO 피해도 없다.
 *
 * ⚠️ **SSE 경로에서는 반드시 `heartbeatStream(work)`의 `work` 안에서 호출한다.**
 * 이 함수는 응답 완료 후 실행되는데, 바깥에서 await하면 첫 바이트까지의 침묵이 프록시 idle 한도에 걸린다
 * (2026-08-02 프로덕션 실측: heartbeat 없으면 61.1초에 끊김, 25초 heartbeat면
 * 286초 완주. 당시 벽은 ALB idle 60초였고, master가 cloudflared로 옮긴 뒤에는
 * 125.9초다 — 어느 쪽이든 heartbeat 없이는 못 넘는다).
 */
export async function translateAnalysisForLocale<T>(
    analysis: T,
    locale: Locale
): Promise<T> {
    if (locale === DEFAULT_LOCALE) return analysis;
    // 기본 로케일을 걸러낸 뒤라 타입을 좁힌다 — 프롬프트·용어집 조회가 대상
    // 로케일만 받도록 강제해, 새 로케일 추가 시 컴파일러가 누락을 짚는다.
    const target: Exclude<Locale, 'ko'> = locale;

    const entries = extractProse(analysis);
    if (entries.length === 0) return analysis;

    const texts = entries.map(entry => entry.text);
    const key = cacheKey(texts, target);

    const config = tryReadTranslatorConfig();
    if (!config) return analysis;

    try {
        // 캐시 미구성(로컬·E2E)에서는 번역만 매번 다시 한다 — 기능은 유지된다.
        // **try 안에 있어야 한다.** 밖에 두면 팩토리가 던졌을 때 이 함수가 reject되고,
        // 호출자(`withLocalizedProse`)가 그걸 `Promise.race`에 넣으므로 거절이
        // 그대로 전파돼 **SSE 분석 전체가 실패한다** — 한국어 원문으로 떨어지는
        // 이 레이어의 계약과 정반대다.
        const cache = createCacheProvider();

        const cached = await cache?.get<string[]>(key).catch(() => null);
        if (Array.isArray(cached) && cached.length === texts.length) {
            return translateAnalysis(analysis, async () => cached);
        }

        const raw = await callDeepseekChat({
            apiKey: config.apiKey,
            // `[Usage]` 텔레메트리에서 분석 번역 지출을 따로 본다.
            jobId: 'analysis-i18n',
            model: config.model,
            contents: buildPrompt(texts, target),
        });
        const parsed = parseJsonResponse(raw, 'analysisTranslation');
        if (
            !Array.isArray(parsed) ||
            parsed.length !== texts.length ||
            parsed.some(item => typeof item !== 'string')
        ) {
            console.error('[analysisTranslation] shape mismatch', {
                locale: target,
                expected: texts.length,
                received: Array.isArray(parsed) ? parsed.length : typeof parsed,
            });
            return analysis;
        }
        const translated = parsed as string[];
        await cache
            ?.set(key, translated, CACHE_TTL_SECONDS)
            .catch(() => undefined);
        return translateAnalysis(analysis, async () => translated);
    } catch (error) {
        // 조용히 삼키지 않는다 — 키 오설정이나 모델 장애가 비-ko 사용자 전원을
        // 한국어로 되돌리는데, 화면에는 아무 에러도 안 뜬다(원문이 나온다).
        console.error('[analysisTranslation] failed', {
            locale: target,
            model: config.model,
            entryCount: texts.length,
            error,
        });
        return analysis;
    }
}
