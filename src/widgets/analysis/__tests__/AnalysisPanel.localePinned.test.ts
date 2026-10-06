import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 차트 탭은 이제 서버에서 렌더된다 — `AnalysisPanel`의 가격 표기가 실행 환경 기본 로케일
 * (`toLocaleString(undefined, …)`)을 타면 서버(Node ICU)와 브라우저(사용자 OS)의 구분자가
 * 갈려 하이드레이션 불일치(React #418)가 난다. 렌더 경로의 숫자 포맷은 페이지 로케일
 * (`formatFixed`/`cachedNumberFormat` + `INTL_LOCALE`)로만 한다.
 *
 * 우리 네 로케일(ko·en·ja·zh)은 모두 `1,234.50`이라 렌더 결과로는 차이를 잡을 수 없다 —
 * 그래서 소스에서 막는다.
 */
const SOURCE = readFileSync(
    path.resolve(__dirname, '../AnalysisPanel.tsx'),
    'utf8'
).replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');

describe('AnalysisPanel 숫자 포맷 로케일 고정', () => {
    it('toLocaleString/toLocaleDateString을 직접 부르지 않는다', () => {
        expect(SOURCE).not.toMatch(
            /\.toLocale(String|DateString|TimeString)\(/
        );
    });

    it('가격은 페이지 로케일 포매터로 낸다', () => {
        expect(SOURCE).toMatch(
            /formatFixed\(price, PRICE_FRACTION_DIGITS, locale\)/
        );
        expect(SOURCE).toMatch(/cachedNumberFormat\(INTL_LOCALE\[locale\]/);
    });
});
