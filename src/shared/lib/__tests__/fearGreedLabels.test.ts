import {
    CONFIDENCE_LIMITED_KEY,
    formatFactorRaw,
} from '@/shared/lib/fearGreedLabels';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';

// 문구는 `shared.lib.fearGreed` 카탈로그로 옮겼다 — 예전엔 모듈 상수라
// `/en/AAPL/fear-greed` footer가 한국어 문장을 그대로 렌더했다.
const NS = 'shared.lib.fearGreed';

describe('formatFactorRaw', () => {
    it('volume_z는 소수 둘째 자리 일반 포맷으로 출력한다', () => {
        expect(formatFactorRaw('volume_z', 1.2345, 'ko')).toBe('1.23');
        expect(formatFactorRaw('volume_z', -2.5, 'ko')).toBe('-2.50');
    });

    it.each([
        ['buysell_imbalance' as const, 0.123],
        ['range_position' as const, 0.876],
    ])('%s는 1dp 퍼센트로 출력한다', (key, raw) => {
        const result = formatFactorRaw(key, raw, 'ko');
        expect(result).toMatch(/^-?\d+\.\d%$/);
    });

    it.each([
        ['poc_distance' as const, 0.0512],
        ['ma200_distance' as const, -0.0314],
    ])('%s는 2dp 퍼센트로 출력한다', (key, raw) => {
        const result = formatFactorRaw(key, raw, 'ko');
        expect(result).toMatch(/^-?\d+\.\d{2}%$/);
    });
});

describe('sample-size footer catalog', () => {
    it.each(['ko', 'en', 'ja', 'zh'] as const)(
        '%s: 정상·제한 두 문장과 헤더 칩 라벨이 카탈로그에 다 있다',
        locale => {
            const t = catalogTranslator(NS, locale);
            for (const key of [
                'sampleFooterNormal',
                'sampleFooterLimited',
                CONFIDENCE_LIMITED_KEY,
            ]) {
                expect(t(key), `${locale}.${key}`).toBeTruthy();
            }
        }
    );

    it('ko 문장은 개발자 용어("표본", "산출") 없이 거래일 수만 말한다', () => {
        const tKo = catalogTranslator(NS, 'ko');
        for (const key of ['sampleFooterNormal', 'sampleFooterLimited']) {
            const text = tKo(key, { v0: 45 });
            expect(text).not.toMatch(/표본|산출/);
        }
    });

    it('en 문장에 한글이 남지 않는다', () => {
        const tEn = catalogTranslator(NS, 'en');
        for (const key of ['sampleFooterNormal', 'sampleFooterLimited']) {
            expect(tEn(key, { v0: 45 })).not.toMatch(/[가-힣]/);
        }
    });

    it('옛 confidenceFooter/confidenceNormal 키는 모든 카탈로그에서 사라졌다', () => {
        for (const locale of ['ko', 'en', 'ja', 'zh'] as const) {
            const t = catalogTranslator(NS, locale);
            expect(() => t('confidenceFooter')).toThrow();
            expect(() => t('confidenceNormal')).toThrow();
        }
    });
});
