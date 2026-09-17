import React from 'react';
import { render, screen } from '@testing-library/react';
import { EconomyKrMacroFacts } from '../EconomyKrMacroFacts';
import type { KrIndicatorCard } from '@/entities/economy/api/getKrIndicatorCards';
import {
    KR_ECONOMY_INDICATORS,
    KR_INDICATOR_EVENT,
} from '@/shared/config/economyIndicatorsKr';

/**
 * 픽스처는 실제 레지스트리에서 `meta`를 집어 온다 — 손으로 만든 meta를 쓰면
 * 이벤트명이 바뀌었을 때 컴포넌트가 카드를 못 찾는 회귀를 테스트가 놓친다.
 */
function card(
    event: string,
    overrides: Partial<KrIndicatorCard> = {}
): KrIndicatorCard {
    const meta = KR_ECONOMY_INDICATORS.find(m => m.event === event);
    if (!meta) throw new Error(`unknown test indicator: ${event}`);
    return {
        meta,
        latest: 2.5,
        latestDate: '2026-08-03',
        changeFromPrevious: null,
        ...overrides,
    };
}

describe('EconomyKrMacroFacts', () => {
    it('값이 하나도 없으면 아무것도 렌더하지 않는다', () => {
        const { container } = render(<EconomyKrMacroFacts cards={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('기준금리·국고채·물가·실업률을 결정론적 문장으로 렌더한다', () => {
        render(
            <EconomyKrMacroFacts
                cards={[
                    card(KR_INDICATOR_EVENT.baseRate, { latest: 2.5 }),
                    card(KR_INDICATOR_EVENT.ktb10y, { latest: 3.125 }),
                    card(KR_INDICATOR_EVENT.cpi, { latest: 2.1 }),
                    card(KR_INDICATOR_EVENT.unemployment, { latest: 2.7 }),
                ]}
            />
        );

        const paragraph = screen.getByRole('heading', {
            level: 2,
        }).nextElementSibling;
        // 소수 자리수는 레지스트리의 `precision`을 따른다(기준금리 2자리, 국고채 3자리).
        expect(paragraph).toHaveTextContent('2.50%');
        expect(paragraph).toHaveTextContent('3.125%');
        expect(paragraph).toHaveTextContent('2.1%');
        expect(paragraph).toHaveTextContent('2.7%');
    });

    it('기준금리만 있으면 국고채 문장을 지어내지 않는다', () => {
        render(
            <EconomyKrMacroFacts
                cards={[card(KR_INDICATOR_EVENT.baseRate, { latest: 2.5 })]}
            />
        );
        const paragraph = screen.getByRole('heading', {
            level: 2,
        }).nextElementSibling;
        expect(paragraph).toHaveTextContent('2.50%');
        expect(paragraph?.textContent).not.toContain('국고채');
    });

    it('전월 대비 변화가 있으면 부호를 붙여 한 문장 더 쓴다', () => {
        render(
            <EconomyKrMacroFacts
                cards={[
                    card(KR_INDICATOR_EVENT.cpi, {
                        latest: 2.1,
                        changeFromPrevious: 0.3,
                    }),
                ]}
            />
        );
        const paragraph = screen.getByRole('heading', {
            level: 2,
        }).nextElementSibling;
        expect(paragraph).toHaveTextContent('+0.3%p');
    });

    it('변화가 없으면(null) 변화 문장을 쓰지 않는다', () => {
        render(
            <EconomyKrMacroFacts
                cards={[
                    card(KR_INDICATOR_EVENT.cpi, {
                        latest: 2.1,
                        changeFromPrevious: null,
                    }),
                ]}
            />
        );
        const paragraph = screen.getByRole('heading', {
            level: 2,
        }).nextElementSibling;
        expect(paragraph?.textContent).not.toContain('%p');
    });
});
