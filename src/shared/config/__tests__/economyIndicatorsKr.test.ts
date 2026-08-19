import {
    KR_ECONOMY_INDICATORS,
    normalizeKrEventName,
} from '../economyIndicatorsKr';
import { ECONOMY_INDICATOR_CATEGORIES } from '../economyIndicators';

describe('normalizeKrEventName', () => {
    it('strips the trailing period parenthesis FMP appends', () => {
        // FMP는 `Inflation Rate YoY (Jul)`처럼 기간을 붙여 보낸다 — 매칭 키로 쓰려면
        // 그 괄호를 떼야 매달 같은 지표로 모인다.
        expect(normalizeKrEventName('Inflation Rate YoY (Jul)')).toBe(
            'Inflation Rate YoY'
        );
        expect(normalizeKrEventName('GDP Growth Rate YoY (Q2)')).toBe(
            'GDP Growth Rate YoY'
        );
        expect(normalizeKrEventName('10-Year KTB Auction')).toBe(
            '10-Year KTB Auction'
        );
    });

    it('keeps a parenthesis that is part of the name', () => {
        // 뒤에 붙은 것만 떼야 한다 — 중간 괄호까지 지우면 다른 지표가 한 키로 뭉친다.
        expect(normalizeKrEventName('M2 (Broad) Money Supply YoY')).toBe(
            'M2 (Broad) Money Supply YoY'
        );
    });

    it('trims surrounding whitespace', () => {
        expect(normalizeKrEventName('Unemployment Rate (Jul)  ')).toBe(
            'Unemployment Rate'
        );
    });
});

describe('KR_ECONOMY_INDICATORS', () => {
    it('uses already-normalized event names as keys', () => {
        // 레지스트리 키에 기간 괄호가 남으면 그 지표는 영영 매칭되지 않는다.
        for (const meta of KR_ECONOMY_INDICATORS) {
            expect(normalizeKrEventName(meta.event)).toBe(meta.event);
        }
    });

    it('never repeats an event key', () => {
        const events = KR_ECONOMY_INDICATORS.map(m => m.event);
        expect(new Set(events).size).toBe(events.length);
    });

    it('assigns every indicator to a declared category', () => {
        const known = new Set(ECONOMY_INDICATOR_CATEGORIES.map(c => c.key));
        for (const meta of KR_ECONOMY_INDICATORS) {
            expect(known).toContain(meta.category);
        }
    });

    it('covers rates, inflation, growth and labor', () => {
        // 한 카테고리라도 비면 그 섹션이 통째로 사라져 페이지가 얇아진다.
        const covered = new Set(KR_ECONOMY_INDICATORS.map(m => m.category));
        expect([...covered].toSorted()).toEqual(
            ECONOMY_INDICATOR_CATEGORIES.map(c => c.key).toSorted()
        );
    });

    it('gives every card a Korean label, unit and tooltip', () => {
        for (const meta of KR_ECONOMY_INDICATORS) {
            expect(meta.label).toMatch(/[가-힣]/);
            expect(meta.unit.length).toBeGreaterThan(0);
            expect(meta.tooltip.length).toBeGreaterThan(10);
            expect(meta.precision).toBeGreaterThanOrEqual(0);
        }
    });
});
