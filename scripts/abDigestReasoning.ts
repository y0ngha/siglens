/**
 * 시장 뉴스 다이제스트 **추론 on/off A/B 비교** — 오프라인 실험 스크립트.
 *
 * 운영 다이제스트는 `reasoning: true`로 굽는다(`submitMarketNewsDigestAction` 주석:
 * 카테고리 피드 수십 건을 하나의 서술로 합성하는 작업이라 추론 이득이 나는 유일한 뉴스
 * 경로). 그 판단이 출력 토큰·지연 비용만큼 품질로 돌아오는지 확인하려고 만든다.
 *
 * 운영 화면을 반으로 나누는 온라인 A/B는 하지 않는다 — 트래픽(DAU 수십 명)으로는 차이가
 * 통계적으로 드러나지 않고, 다이제스트 캐시 키가 `reason=on|off`로 갈려 화면 쪽 배선도
 * 바뀌어야 한다. 대신 **같은 기사 입력**으로 두 변형을 각각 새로 생성해 눈가림 평가한다.
 *
 * ## 실행
 *
 * ```
 * yarn ab:digest-reasoning                       # 6개 카테고리 전부
 * yarn ab:digest-reasoning --categories stock,crypto
 * yarn ab:digest-reasoning --price-in 0.27 --price-out 1.10   # 100만 토큰당 USD
 * ```
 *
 * `.env.local`(운영 Neon·Upstash·DeepSeek 키)을 읽는다. 결과는 `--out`(기본
 * `./ab-digest-reasoning/<타임스탬프>/`)에 두 파일로 남는다:
 *   - `blind.md` — 평가용. A/B 라벨만 있고 어느 쪽이 추론 ON인지, 토큰·지연도 없다.
 *   - `answer-key.md` + `results.json` — 판정 뒤에 여는 정답 키와 정량 비교.
 *
 * ## 비용·부작용
 *
 * 카테고리당 LLM 2회(ON 1, OFF 1). `force: true`로 캐시를 건너뛰어 매번 새로 생성한다 —
 * 캐시 HIT이면 비교가 안 되기 때문이다. 그 결과 **ON 변형은 운영 다이제스트 캐시
 * 엔트리를 같은 입력으로 새로 덮어쓴다**(같은 키). 내용 품질은 운영과 같은 조건이라
 * 해롭지 않다. OFF 변형은 `reason=off` 키에 쓰이고 화면은 그 키를 읽지 않는다.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
    runMarketNewsDigest,
    type NewsFeedCategory,
} from '@y0ngha/siglens-core';
import { getMarketNewsList } from '@/entities/market-news/api/marketNewsRepository';
import {
    CATEGORY_CONFIG,
    type NewsFeedCategoryId,
} from '@/entities/market-news/lib/categoryConfig';
import { DEFAULT_DIGEST_MODEL_ID } from '@/entities/market-news/lib/marketNewsConstants';
import { toEnrichedMarketNewsItem } from '@/entities/market-news/lib/toEnrichedMarketNewsItem';
import { selectAggregateNewsItems } from '@/entities/news-article/lib/newsAnalysisSelection';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';
import {
    assignBlind,
    renderAnswerKey,
    renderBlindReport,
    type CategoryComparison,
    type DigestVariantRun,
} from './lib/abDigestReport';

interface Args {
    readonly categories: NewsFeedCategoryId[];
    readonly outDir: string;
    readonly price?: { readonly input: number; readonly output: number };
}

function parseArgs(argv: readonly string[]): Args {
    const valueOf = (flag: string): string | undefined => {
        const i = argv.indexOf(flag);
        return i >= 0 ? argv[i + 1] : undefined;
    };
    const all = Object.keys(CATEGORY_CONFIG) as NewsFeedCategoryId[];
    const requested = valueOf('--categories')
        ?.split(',')
        .map(s => s.trim());
    const categories =
        requested === undefined
            ? all
            : requested.filter((c): c is NewsFeedCategoryId =>
                  (all as string[]).includes(c)
              );
    if (requested !== undefined && categories.length !== requested.length) {
        throw new Error(
            `unknown category in --categories (known: ${all.join(', ')})`
        );
    }
    const priceIn = valueOf('--price-in');
    const priceOut = valueOf('--price-out');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return {
        categories,
        outDir: valueOf('--out') ?? join('ab-digest-reasoning', stamp),
        price:
            priceIn !== undefined && priceOut !== undefined
                ? { input: Number(priceIn), output: Number(priceOut) }
                : undefined,
    };
}

interface UsageTotals {
    promptTokens: number;
    cachedTokens: number;
    outputTokens: number;
}

/**
 * 호출 하나 동안 core가 찍는 `[Usage]` 텔레메트리를 가로채 합산한다. 재시도가 있으면
 * 줄이 여러 개 나오므로 합친다 — 과금도 합쳐 나간다. 호출은 순차라 창이 겹치지 않는다.
 */
async function withUsageCapture<T>(
    fn: () => Promise<T>
): Promise<{ value: T; usage: UsageTotals | null }> {
    const original = console.info;
    let totals: UsageTotals | null = null;
    console.info = (...args: unknown[]) => {
        if (args[0] === '[Usage]' && typeof args[1] === 'string') {
            try {
                const u = JSON.parse(args[1]) as Partial<UsageTotals>;
                totals ??= {
                    promptTokens: 0,
                    cachedTokens: 0,
                    outputTokens: 0,
                };
                totals.promptTokens += u.promptTokens ?? 0;
                totals.cachedTokens += u.cachedTokens ?? 0;
                totals.outputTokens += u.outputTokens ?? 0;
            } catch {
                // 파싱 못 하는 줄은 무시한다 — 토큰은 `n/a`로 남는다.
            }
        }
        original(...args);
    };
    try {
        const value = await fn();
        return { value, usage: totals };
    } finally {
        console.info = original;
    }
}

async function runVariant(
    category: NewsFeedCategoryId,
    news: Parameters<typeof runMarketNewsDigest>[0]['news'],
    reasoning: boolean
): Promise<DigestVariantRun> {
    const started = Date.now();
    const { value, usage } = await withUsageCapture(() =>
        runMarketNewsDigest({
            // 액션과 같은 캐스트 — 근거는 `submitMarketNewsDigestAction` 주석.
            category: category as NewsFeedCategory,
            locale: DEFAULT_LOCALE,
            categoryLabel: CATEGORY_CONFIG[category].koLabel,
            modelId: DEFAULT_DIGEST_MODEL_ID,
            news,
            reasoning,
            force: true,
            skipEnqueueIfMiss: false,
        })
    );
    const latencyMs = Date.now() - started;
    const result =
        value.status === 'done' || value.status === 'cached'
            ? value.result
            : null;
    return {
        reasoning,
        latencyMs,
        usage,
        status: value.status,
        currentDriverKo: result?.currentDriverKo ?? '',
        keyEventsKo: result?.keyEventsKo ?? [],
        upcomingEventsKo: result?.upcomingEventsKo ?? [],
        overallSentiment: result?.overallSentiment ?? 'n/a',
    };
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));
    const comparisons: CategoryComparison[] = [];

    for (const category of args.categories) {
        const { sentinel, koLabel } = CATEGORY_CONFIG[category];
        // 액션·허브 프리웜과 **같은 입력 빌더** — 운영이 실제로 보내는 기사 집합으로 비교한다.
        const rows = await getMarketNewsList(sentinel);
        const news = selectAggregateNewsItems(
            rows.map(toEnrichedMarketNewsItem).filter(item => item !== null)
        );
        if (news.length === 0) {
            console.warn(`[ab] ${category}: 보강된 기사 없음 — 건너뜀`);
            continue;
        }
        console.log(`[ab] ${category}: 기사 ${news.length}건 — ON 생성 중…`);
        const on = await runVariant(category, news, true);
        console.log(`[ab] ${category}: OFF 생성 중…`);
        const off = await runVariant(category, news, false);
        comparisons.push({
            category,
            label: koLabel,
            newsCount: news.length,
            on,
            off,
        });
    }

    if (comparisons.length === 0) {
        console.error(
            '[ab] 비교할 카테고리가 없다 — 기사 적재 상태를 먼저 확인할 것'
        );
        process.exitCode = 1;
        return;
    }

    const assignments = assignBlind(
        comparisons.map(c => c.category),
        Math.random
    );
    await mkdir(args.outDir, { recursive: true });
    await Promise.all([
        writeFile(
            join(args.outDir, 'blind.md'),
            renderBlindReport(comparisons, assignments, new Date())
        ),
        writeFile(
            join(args.outDir, 'answer-key.md'),
            renderAnswerKey(comparisons, assignments, args.price)
        ),
        writeFile(
            join(args.outDir, 'results.json'),
            JSON.stringify({ comparisons, assignments }, null, 2)
        ),
    ]);
    console.log(
        `[ab] 완료 — ${args.outDir}/blind.md 로 판정한 뒤 answer-key.md를 여세요.`
    );
}

main().catch((error: unknown) => {
    console.error('[ab] failed:', error);
    process.exitCode = 1;
});
