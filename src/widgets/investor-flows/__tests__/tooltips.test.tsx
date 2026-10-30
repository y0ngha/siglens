// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import koMessages from '../../../../messages/ko.json';
import { FlowTooltip, type FlowTerm } from '../investorFlowsTooltips';
import { MESSAGE_CATALOGS } from '@/shared/test-utils/messageCatalogs';

/** `Record<FlowTerm, true>`라 용어가 늘면 여기서 컴파일 오류가 나 카탈로그 검사에 빠지지 않는다. */
const TERMS: Record<FlowTerm, true> = {
    thirteenF: true,
    institutionalHolding: true,
    newExited: true,
    increasedDecreased: true,
    netBuySell: true,
    form4: true,
    insiderCluster: true,
    largeHolder13dg: true,
    shortInterest: true,
    pctOfFloat: true,
    daysToCover: true,
    shortSqueeze: true,
    offExchangeShortRatio: true,
    settlementDate: true,
    partialAggregation: true,
    flowScore: true,
    optionsNotional: true,
    form144: true,
    dilution: true,
    failsToDeliver: true,
    thresholdList: true,
    squeezeScore: true,
    krFlowScore: true,
    krMajorHolder: true,
    krInsider: true,
};

describe('수급 용어 툴팁', () => {
    it.each(Object.keys(TERMS) as FlowTerm[])(
        '%s는 네 로케일에 1~3개 문단으로 있다',
        term => {
            for (const [locale, catalog] of Object.entries(MESSAGE_CATALOGS)) {
                const paragraphs = (
                    catalog.widgets['investor-flows'].tooltip as Record<
                        string,
                        string[]
                    >
                )[term];
                expect(Array.isArray(paragraphs), `${locale}.${term}`).toBe(
                    true
                );
                expect(
                    paragraphs.length,
                    `${locale}.${term}`
                ).toBeGreaterThanOrEqual(1);
                expect(
                    paragraphs.length,
                    `${locale}.${term}`
                ).toBeLessThanOrEqual(3);
            }
        }
    );

    it('한국어 문구는 ~이에요/~해요체이고 권유 표현이 없다', () => {
        for (const term of Object.keys(TERMS)) {
            const text = (
                koMessages.widgets['investor-flows'].tooltip as Record<
                    string,
                    string[]
                >
            )[term].join(' ');
            expect(text, term).toMatch(
                /(이에요|예요|해요|어요|아요|돼요|있어요|않아요)\.?/
            );
            expect(text, term).not.toMatch(/매수하세요|사세요|추천|유망/);
        }
    });

    it('(i) 버튼에 올리면 카탈로그 문단이 열린다', async () => {
        const user = userEvent.setup();
        render(<FlowTooltip term="thirteenF" />);
        await user.hover(screen.getByRole('button'));
        expect(
            await screen.findByText(/13F는 운용 규모가 큰 기관이/)
        ).toBeInTheDocument();
    });
});
