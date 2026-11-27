import { AI_COPY, MAIN_COPY } from '@/app/api/llms/_lib/llmsCopy';
import type {
    LlmsDocument,
    LlmsHost,
    LlmsInputs,
    LlmsLink,
    LlmsLinkTarget,
    LlmsSection,
} from '@/app/api/llms/_lib/model';
import { GUIDE_CATEGORIES } from '@/entities/guide/types';
import {
    REPO_RAW_MASTER_BASE,
    backtestResultsRepoPath,
    type BacktestResultsFile,
} from '@/entities/backtest-case/lib/resultsFileUrl';
import { BACKTEST_DATA_PUBLIC_PATH } from '@/entities/backtest-case/lib/fetchBacktestRunData';
import { BENCHMARK_PATH } from '@/shared/config/benchmark';
import {
    FEAR_GREED_DATA_FORMATS,
    FEAR_GREED_DATA_MARKETS,
    FEAR_GREED_HUB_PATH,
    fearGreedDataPath,
} from '@/shared/config/fearGreedData';
import { DEVELOPERS_PATH } from '@/shared/config/publicApi';
import { LLMS_TXT_PATH } from '@/shared/config/llmsTxt';
import { RSS_FEED_PATH } from '@/shared/config/rssFeed';
import { GUIDE_PATH, guideCategoryPath } from '@/shared/lib/guidePaths';
import {
    ABOUT_PATH,
    METHODOLOGY_PATH,
    PRIVACY_PATH,
    TERMS_PATH,
} from '@/shared/lib/legal';
import { BACKTESTING_PATH, SYMBOLS_PATH } from '@/shared/lib/seo';

/**
 * 안내 파일 링크의 절대 URL. `LlmsLinkTarget`의 모든 종류를 여기서만 URL로 바꾼다 — 링크 가드
 * (`llmsLinks.test.ts`)가 종류마다 실제 라우트에 대조하므로 새 종류는 여기와 가드에 함께 들어간다.
 * `repoFile`은 `REPO_RAW_MASTER_BASE` 하나로 만든다(두 번째 철자를 두지 않는다).
 */
export function llmsTargetUrl(
    target: LlmsLinkTarget,
    inputs: LlmsInputs
): string {
    switch (target.kind) {
        case 'mainPage':
            return `${inputs.siteUrl}${target.path}`;
        case 'mainPageFragment':
            return `${inputs.siteUrl}${target.path}#${target.fragment}`;
        case 'symbolPage':
            return `${inputs.siteUrl}/${target.symbol}`;
        case 'rewrite':
        case 'publicFile':
            return `${target.host === 'ai' ? inputs.aiSiteUrl : inputs.siteUrl}${target.path}`;
        case 'aiPage':
            return `${inputs.aiSiteUrl}${target.path}`;
        case 'repoFile':
            return `${REPO_RAW_MASTER_BASE}/${target.repoPath}`;
        case 'external':
            return target.url;
        default: {
            const unreachable: never = target;
            return unreachable;
        }
    }
}

function link(
    inputs: LlmsInputs,
    copy: { readonly title: string; readonly note?: string },
    target: LlmsLinkTarget
): LlmsLink {
    return {
        title: copy.title,
        url: llmsTargetUrl(target, inputs),
        ...(copy.note !== undefined && { note: copy.note }),
        target,
    };
}

function mainPage(path: string): LlmsLinkTarget {
    return { kind: 'mainPage', path };
}

function backtestFile(
    inputs: LlmsInputs,
    copy: { readonly title: string; readonly note: string },
    file: BacktestResultsFile
): LlmsLink {
    return link(inputs, copy, {
        kind: 'repoFile',
        repoPath: backtestResultsRepoPath(inputs.backtestRunId, file),
    });
}

function section(
    heading: string,
    links: readonly LlmsLink[]
): readonly LlmsSection[] {
    return links.length === 0 ? [] : [{ heading, links }];
}

function buildMainDocument(inputs: LlmsInputs): LlmsDocument {
    const copy = MAIN_COPY;
    const { benchmark } = inputs;

    const service = [
        link(inputs, copy.service.about, mainPage(ABOUT_PATH)),
        link(inputs, copy.service.methodology, mainPage(METHODOLOGY_PATH)),
        link(inputs, copy.service.fearGreed, {
            kind: 'mainPageFragment',
            path: METHODOLOGY_PATH,
            fragment: 'fear-greed',
        }),
        link(inputs, copy.service.limits, {
            kind: 'mainPageFragment',
            path: METHODOLOGY_PATH,
            fragment: 'limits',
        }),
        link(inputs, copy.service.corrections, {
            kind: 'mainPageFragment',
            path: METHODOLOGY_PATH,
            fragment: 'corrections',
        }),
        link(inputs, copy.service.backtesting, mainPage(BACKTESTING_PATH)),
    ];

    const fearGreedHubs = FEAR_GREED_DATA_MARKETS.map(market =>
        link(
            inputs,
            {
                title: copy.fearGreedMarkets[market].hubTitle,
                note: copy.fearGreedMarkets[market].hubNote,
            },
            mainPage(FEAR_GREED_HUB_PATH[market])
        )
    );

    const fearGreedFiles = FEAR_GREED_DATA_MARKETS.flatMap(market =>
        FEAR_GREED_DATA_FORMATS.map(format =>
            link(
                inputs,
                {
                    title: `${copy.fearGreedMarkets[market].dataName} (${format.toUpperCase()})`,
                    note: copy.fearGreedFormatNote[format],
                },
                {
                    kind: 'rewrite',
                    host: 'main',
                    path: fearGreedDataPath(market, format),
                }
            )
        )
    );

    const dataFiles = [
        ...fearGreedFiles,
        link(inputs, copy.dataFiles.backtestJson, {
            kind: 'publicFile',
            host: 'main',
            path: BACKTEST_DATA_PUBLIC_PATH,
        }),
        backtestFile(inputs, copy.dataFiles.trades, 'trades.csv'),
        backtestFile(inputs, copy.dataFiles.decisions, 'decisions.csv'),
        backtestFile(inputs, copy.dataFiles.readme, 'README.ko.md'),
        ...(benchmark === null
            ? []
            : [
                  link(inputs, copy.dataFiles.benchmarkZip, {
                      kind: 'publicFile',
                      host: 'ai',
                      path: benchmark.downloads.zipPath,
                  }),
              ]),
    ];

    const market = [
        link(inputs, copy.market.us, mainPage('/market')),
        link(inputs, copy.market.kr, mainPage('/market/kr')),
        link(inputs, copy.market.economyUs, mainPage('/economy')),
        link(inputs, copy.market.economyKr, mainPage('/economy/kr')),
        link(inputs, copy.market.news, mainPage('/news')),
        link(inputs, copy.market.symbols, mainPage(SYMBOLS_PATH)),
        link(inputs, copy.market.nvda, { kind: 'symbolPage', symbol: 'NVDA' }),
        link(inputs, copy.market.samsung, {
            kind: 'symbolPage',
            symbol: '005930.KS',
        }),
    ];

    const guide = [
        link(inputs, copy.guideHub, mainPage(GUIDE_PATH)),
        ...GUIDE_CATEGORIES.map(category =>
            link(
                inputs,
                copy.guideCategories[category],
                mainPage(guideCategoryPath(category))
            )
        ),
    ];

    const subscribe = [
        link(inputs, copy.rss, {
            kind: 'rewrite',
            host: 'main',
            path: RSS_FEED_PATH,
        }),
    ];

    const ai = [
        link(inputs, copy.ai.home, { kind: 'aiPage', path: '/' }),
        link(inputs, copy.ai.about, { kind: 'aiPage', path: '/about' }),
        ...(benchmark === null
            ? []
            : [
                  link(inputs, copy.ai.benchmark, {
                      kind: 'aiPage',
                      path: BENCHMARK_PATH,
                  }),
              ]),
        link(
            inputs,
            benchmark === null ? copy.ai.llmsNoBenchmark : copy.ai.llms,
            {
                kind: 'rewrite',
                host: 'ai',
                path: LLMS_TXT_PATH,
            }
        ),
    ];

    const optional = [
        link(inputs, copy.optional.terms, mainPage(TERMS_PATH)),
        link(inputs, copy.optional.privacy, mainPage(PRIVACY_PATH)),
        ...(inputs.publicApiEnabled
            ? [
                  link(
                      inputs,
                      copy.optional.developers,
                      mainPage(DEVELOPERS_PATH)
                  ),
              ]
            : []),
    ];

    return {
        title: copy.title,
        summary: copy.summary,
        paragraphs: copy.paragraphs,
        sections: [
            ...section(copy.sections.service, service),
            ...section(copy.sections.fearGreed, fearGreedHubs),
            ...section(copy.sections.data, dataFiles),
            ...section(copy.sections.market, market),
            ...section(copy.sections.guide, guide),
            ...section(copy.sections.subscribe, subscribe),
            ...section(copy.sections.ai, ai),
            ...section(copy.sections.optional, optional),
        ],
    };
}

function buildAiDocument(inputs: LlmsInputs): LlmsDocument {
    const copy = AI_COPY;
    const { benchmark } = inputs;

    const ai = [
        link(inputs, copy.home, { kind: 'aiPage', path: '/' }),
        link(inputs, copy.about, { kind: 'aiPage', path: '/about' }),
    ];

    const benchmarkLinks =
        benchmark === null
            ? []
            : [
                  link(inputs, copy.benchmark.page, {
                      kind: 'aiPage',
                      path: BENCHMARK_PATH,
                  }),
                  link(inputs, copy.benchmark.zip, {
                      kind: 'publicFile',
                      host: 'ai',
                      path: benchmark.downloads.zipPath,
                  }),
                  link(inputs, copy.benchmark.prereg, {
                      kind: 'external',
                      url: benchmark.prereg.gistUrl,
                  }),
              ];

    const main = [
        link(inputs, copy.main.home, mainPage('/')),
        link(inputs, copy.main.methodology, mainPage(METHODOLOGY_PATH)),
        link(inputs, copy.main.llms, {
            kind: 'rewrite',
            host: 'main',
            path: LLMS_TXT_PATH,
        }),
    ];

    return {
        title: copy.title,
        summary: copy.summary,
        paragraphs: copy.paragraphs,
        sections: [
            ...section(copy.sections.ai, ai),
            ...section(copy.sections.benchmark, benchmarkLinks),
            ...section(copy.sections.main, main),
        ],
    };
}

/** 호스트별 안내 파일 모델. I/O 없이 입력과 번들 상수만 본다. */
export function buildLlmsDocument(
    host: LlmsHost,
    inputs: LlmsInputs
): LlmsDocument {
    return host === 'ai' ? buildAiDocument(inputs) : buildMainDocument(inputs);
}
