import {
    CONFIDENCE_LIMITED_KEY,
    CONFIDENCE_NORMAL_KEY,
    confidenceLabelKey,
    formatFactorRaw,
} from '@/shared/lib/fearGreedLabels';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';

// 문구는 `shared.lib.fearGreed` 카탈로그로 옮겼다 — 예전엔 모듈 상수라
// `/en/AAPL/fear-greed` footer가 `표본 200 — 정상 산출`을 그대로 렌더했다.
const NS = 'shared.lib.fearGreed';
const tEn = catalogTranslator(NS, 'en');

describe('formatFactorRaw', () => {
    it('volume_z는 소수 둘째 자리 일반 포맷으로 출력한다', () => {
        expect(formatFactorRaw('volume_z', 1.2345)).toBe('1.23');
        expect(formatFactorRaw('volume_z', -2.5)).toBe('-2.50');
    });

    it.each([
        ['buysell_imbalance' as const, 0.123],
        ['range_position' as const, 0.876],
    ])('%s는 1dp 퍼센트로 출력한다', (key, raw) => {
        const result = formatFactorRaw(key, raw);
        expect(result).toMatch(/^-?\d+\.\d%$/);
    });

    it.each([
        ['poc_distance' as const, 0.0512],
        ['ma200_distance' as const, -0.0314],
    ])('%s는 2dp 퍼센트로 출력한다', (key, raw) => {
        const result = formatFactorRaw(key, raw);
        expect(result).toMatch(/^-?\d+\.\d{2}%$/);
    });
});

describe('confidenceLabelKey', () => {
    it('confidence가 normal이면 정상 라벨 키를 고른다', () => {
        expect(confidenceLabelKey('normal')).toBe(CONFIDENCE_NORMAL_KEY);
    });

    it('confidence가 limited이면 제한 라벨 키를 고른다', () => {
        expect(confidenceLabelKey('limited')).toBe(CONFIDENCE_LIMITED_KEY);
    });

    it.each(['ko', 'en', 'ja', 'zh'] as const)(
        '%s: footer 템플릿과 두 라벨이 카탈로그에 다 있다',
        locale => {
            const t = catalogTranslator(NS, locale);
            for (const key of [
                'confidenceFooter',
                CONFIDENCE_NORMAL_KEY,
                CONFIDENCE_LIMITED_KEY,
            ]) {
                expect(t(key), `${locale}.${key}`).toBeTruthy();
            }
        }
    );

    it('en 카탈로그로 조립하면 한글이 남지 않는다', () => {
        const footer = tEn('confidenceFooter', {
            v0: 45,
            v1: tEn(confidenceLabelKey('limited')),
        });
        expect(footer).not.toMatch(/[가-힣]/);
    });
});
