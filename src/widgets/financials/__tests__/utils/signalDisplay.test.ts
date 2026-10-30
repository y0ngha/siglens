import { describe, expect, it } from 'vitest';
import type { FinancialSignalType } from '@y0ngha/siglens-core';
import koMessages from '../../../../../messages/ko.json';
import enMessages from '../../../../../messages/en.json';
import jaMessages from '../../../../../messages/ja.json';
import zhMessages from '../../../../../messages/zh.json';
import {
    SIGNAL_CHIP_CLASS,
    SIGNAL_LABEL_KEY,
} from '@/widgets/financials/utils/signalDisplay';

/** core가 신호 종류별로 내려 주는 `labelKo` — ko 번역은 이 값과 같아야 화면이 달라지지 않는다. */
const CORE_LABEL_KO: Record<FinancialSignalType, string> = {
    revenue_accel: '매출 성장 가속',
    operating_leverage: '영업 레버리지',
    growth_decline: '매출 역성장',
    operating_income_growth: '영업이익 성장',
    earnings_quality_good: '이익의 질 양호',
    accrual_warning: '이익의 질 주의',
    margin_expansion: '마진 개선',
    margin_contraction: '마진 악화',
    net_cash: '순현금 기업',
    debt_rising: '부채 증가',
    fcf_solid: '잉여현금흐름 견조',
    fcf_negative: '잉여현금흐름 적자',
    capex_heavy: '설비투자 과다',
    fcf_growth: '잉여현금흐름 성장',
};

const CATALOGS = {
    ko: koMessages,
    en: enMessages,
    ja: jaMessages,
    zh: zhMessages,
} as const;

const TYPES = Object.keys(CORE_LABEL_KO) as FinancialSignalType[];

describe('SIGNAL_LABEL_KEY', () => {
    it('모든 신호 종류에 서로 다른 키가 있다', () => {
        expect(Object.keys(SIGNAL_LABEL_KEY).sort()).toEqual([...TYPES].sort());
        expect(new Set(Object.values(SIGNAL_LABEL_KEY)).size).toBe(
            TYPES.length
        );
    });

    it.each(TYPES)('%s: ko 번역은 core의 labelKo와 같다', type => {
        const messages = koMessages.widgets.financials.signalType as Record<
            string,
            string
        >;
        expect(messages[SIGNAL_LABEL_KEY[type]]).toBe(CORE_LABEL_KO[type]);
    });

    it.each(Object.keys(CATALOGS) as (keyof typeof CATALOGS)[])(
        '%s 카탈로그에 모든 신호 키가 비어 있지 않게 있다',
        locale => {
            const messages = CATALOGS[locale].widgets.financials
                .signalType as Record<string, string>;
            TYPES.forEach(type => {
                expect(messages[SIGNAL_LABEL_KEY[type]]).toBeTruthy();
            });
        }
    );

    it('en·ja·zh 번역은 ko 원문과 다르다', () => {
        (['en', 'ja', 'zh'] as const).forEach(locale => {
            const messages = CATALOGS[locale].widgets.financials
                .signalType as Record<string, string>;
            TYPES.forEach(type => {
                expect(messages[SIGNAL_LABEL_KEY[type]]).not.toBe(
                    CORE_LABEL_KO[type]
                );
            });
        });
    });
});

describe('SIGNAL_CHIP_CLASS', () => {
    it('세 방향 모두 색이 있다', () => {
        expect(Object.keys(SIGNAL_CHIP_CLASS).sort()).toEqual([
            'negative',
            'neutral',
            'positive',
        ]);
    });
});
