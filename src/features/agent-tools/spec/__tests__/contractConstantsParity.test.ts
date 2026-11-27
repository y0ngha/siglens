import * as core from '@y0ngha/siglens-core';
import { describe, expect, it } from 'vitest';
import * as chartTool from '@/entities/chat-conversation/lib/chartToolConstants';
import * as companyFilings from '@/entities/company-filings/lib/companyFilingsConstants';
import * as xPosts from '@/entities/x-posts/lib/xPostsConstants';
import * as macro from '@/features/agent-tools/lib/macroInstruments';

/**
 * 도구 출력 계약 숫자 15개의 siglens 사본이 core의 deprecated 수출값과 같은지 본다. 값이 같아야 도구를 siglens 것으로
 * 바꾼 뒤에도 실행기·엔티티가 같은 상한으로 돈다.
 *
 * core 다음 메이저(core-3)가 deprecated 수출을 지우면 이 테스트를 지운다 — 그때부터는 siglens 사본이 유일한 출처다.
 */
const PAIRS = [
    ['AGENT_X_POSTS_MAX', xPosts.AGENT_X_POSTS_MAX, core.AGENT_X_POSTS_MAX],
    [
        'AGENT_X_POSTS_PAGE_SIZE',
        xPosts.AGENT_X_POSTS_PAGE_SIZE,
        core.AGENT_X_POSTS_PAGE_SIZE,
    ],
    [
        'AGENT_X_POSTS_WINDOW_DAYS',
        xPosts.AGENT_X_POSTS_WINDOW_DAYS,
        core.AGENT_X_POSTS_WINDOW_DAYS,
    ],
    [
        'AGENT_X_POST_TEXT_MAX_CHARS',
        xPosts.AGENT_X_POST_TEXT_MAX_CHARS,
        core.AGENT_X_POST_TEXT_MAX_CHARS,
    ],
    [
        'AGENT_FILINGS_LIST_MAX',
        companyFilings.AGENT_FILINGS_LIST_MAX,
        core.AGENT_FILINGS_LIST_MAX,
    ],
    [
        'AGENT_FILINGS_WINDOW_DAYS',
        companyFilings.AGENT_FILINGS_WINDOW_DAYS,
        core.AGENT_FILINGS_WINDOW_DAYS,
    ],
    [
        'AGENT_FILING_TEXT_MAX_CHARS',
        companyFilings.AGENT_FILING_TEXT_MAX_CHARS,
        core.AGENT_FILING_TEXT_MAX_CHARS,
    ],
    ['AGENT_CHART_KINDS', chartTool.AGENT_CHART_KINDS, core.AGENT_CHART_KINDS],
    [
        'AGENT_CHART_PERIODS',
        chartTool.AGENT_CHART_PERIODS,
        core.AGENT_CHART_PERIODS,
    ],
    [
        'AGENT_COMPARE_SYMBOLS_MIN',
        chartTool.AGENT_COMPARE_SYMBOLS_MIN,
        core.AGENT_COMPARE_SYMBOLS_MIN,
    ],
    [
        'AGENT_COMPARE_SYMBOLS_MAX',
        chartTool.AGENT_COMPARE_SYMBOLS_MAX,
        core.AGENT_COMPARE_SYMBOLS_MAX,
    ],
    [
        'AGENT_MACRO_INSTRUMENTS',
        macro.AGENT_MACRO_INSTRUMENTS,
        core.AGENT_MACRO_INSTRUMENTS,
    ],
    [
        'AGENT_MACRO_QUOTES_MAX',
        macro.AGENT_MACRO_QUOTES_MAX,
        core.AGENT_MACRO_QUOTES_MAX,
    ],
] as const;

describe('도구 출력 계약 숫자: siglens 사본 = core deprecated 수출', () => {
    it.each(PAIRS)('%s', (_name, siglens, deprecated) => {
        expect(deprecated).toBeDefined();
        expect(siglens).toStrictEqual(deprecated);
    });

    it('siglens 사본 모듈은 위 상수만 값으로 내보낸다(빠진 상수가 없다)', () => {
        const exported = [chartTool, companyFilings, xPosts, macro]
            .flatMap(module => Object.keys(module))
            .toSorted();
        expect(exported).toEqual(PAIRS.map(([name]) => name).toSorted());
    });
});
