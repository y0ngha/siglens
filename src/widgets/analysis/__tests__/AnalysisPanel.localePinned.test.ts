import { readdirSync, readFileSync } from 'node:fs';
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
/**
 * 패널은 오케스트레이터(`AnalysisPanel.tsx`)와 섹션·아이템(`sections/`·`ui/`)으로 나뉘어
 * 있다 — 가격을 그리는 곳은 하위 파일이므로 패널 렌더 트리 전체를 함께 검사한다.
 */
const WIDGET_DIR = path.resolve(__dirname, '..');
const PANEL_FILES = [
    'AnalysisPanel.tsx',
    ...['sections', 'ui'].flatMap(dir =>
        readdirSync(path.join(WIDGET_DIR, dir))
            .filter(name => name.endsWith('.tsx'))
            .map(name => path.join(dir, name))
    ),
];
const SOURCE = PANEL_FILES.map(file =>
    readFileSync(path.join(WIDGET_DIR, file), 'utf8')
)
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');

describe('AnalysisPanel 숫자 포맷 로케일 고정', () => {
    it('toLocaleString/toLocaleDateString을 직접 부르지 않는다', () => {
        expect(SOURCE).not.toMatch(
            /\.toLocale(String|DateString|TimeString)\(/
        );
    });

    it('가격은 페이지 로케일을 받는 shared 포매터로 낸다', () => {
        // 가격 표기는 시장 규칙(한국 종목은 호가 단위 정수)까지 담은
        // `formatAnalysisPrice` 한 곳으로 모였다 — 모든 호출이 페이지 로케일을 넘긴다.
        const calls = [...SOURCE.matchAll(/formatAnalysisPrice\(([^)]*)\)/g)];
        expect(calls.length).toBeGreaterThan(0);
        for (const [, args] of calls)
            expect(args).toMatch(/,\s*symbol,\s*locale\b/);
        // 그 포매터는 페이지 로케일의 캐시 포매터로 숫자를 낸다.
        const shared = readFileSync(
            path.resolve(
                __dirname,
                '../../../shared/lib/analysisPriceFormat.ts'
            ),
            'utf8'
        );
        const body = shared.slice(
            shared.indexOf('export function formatAnalysisPrice(')
        );
        expect(body.slice(0, body.indexOf('\n}\n'))).toMatch(
            /cachedNumberFormat\(INTL_LOCALE\[locale\]/
        );
    });
});
