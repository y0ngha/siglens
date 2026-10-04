import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import enMessages from '../../../../messages/en.json';
import koMessages from '../../../../messages/ko.json';
import {
    KR_DASHBOARD_SCOPE,
    US_DASHBOARD_SCOPE,
} from '@/shared/config/dashboardScope';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { useAssetLabel } from '@/shared/i18n/assetLabel';

const FALLBACK = '__FALLBACK__';

function Probe({ symbol }: { symbol: string }) {
    const label = useAssetLabel();
    return <span data-testid="label">{label(symbol, FALLBACK)}</span>;
}

/**
 * **config ↔ 카탈로그 완전성.**
 *
 * `useAssetLabel`의 폴백은 원시 키가 화면에 찍히는 것을 막지만, 그 대가로
 * 카탈로그 누락을 **조용한 오언어 렌더**로 바꾼다. 실제로 `QNTM`·`SPACE`
 * 두 섹터가 그렇게 빠져 있었다 — 영어 탭 줄 끝에 `양자·우주`가 붙어 있었고
 * 아무 테스트도 실패하지 않았다.
 *
 * **반드시 비-기본 로케일로 렌더한다.** `renderHook`/`render`는
 * `vitest.setup.dom.ts`가 ko 프로바이더로 감싸므로, 그걸로는 "en 카탈로그에서
 * 나온다"를 확인할 수 없다 — 실측: en 값을 한국어로 바꿔 놓아도 30개가 전부
 * 통과했다.
 */
describe('useAssetLabel — config ↔ 카탈로그 완전성', () => {
    const symbols = [
        ...new Set(
            [
                ...US_DASHBOARD_SCOPE.indices,
                ...US_DASHBOARD_SCOPE.sectorEtfs,
                ...US_DASHBOARD_SCOPE.signalSectors,
                ...KR_DASHBOARD_SCOPE.indices,
                ...KR_DASHBOARD_SCOPE.sectorEtfs,
                ...KR_DASHBOARD_SCOPE.signalSectors,
            ].map(entry => entry.symbol)
        ),
    ];

    it('대조 대상을 실제로 모은다', () => {
        expect(symbols.length).toBeGreaterThan(20);
    });

    it.each(symbols)('%s: en 카탈로그 값이 실제로 렌더된다', symbol => {
        const expected = (
            enMessages as unknown as {
                shared: { assetName: Record<string, string> };
            }
        ).shared.assetName[symbol.replace(/\./g, '_')];

        expect(expected).toBeDefined();
        renderWithIntl(<Probe symbol={symbol} />, { locale: 'en' });

        const rendered = screen.getByTestId('label').textContent ?? '';

        // 조회 경로가 동작하는지.
        expect(rendered).toBe(expected);
        // 기대값을 en.json에서 읽으므로 위 단언만으로는 **동어반복**이다 —
        // en 값을 한국어로 바꿔도 통과한다(실측). 카탈로그와 무관한 성질을
        // 하나 더 건다: 영어 표면에 한글이 있으면 안 된다.
        expect(rendered).not.toMatch(/[가-힣]/);
        expect(rendered).not.toBe(FALLBACK);
    });

    it('카탈로그에 없는 심볼만 폴백으로 떨어진다', () => {
        renderWithIntl(<Probe symbol="NOPE" />, { locale: 'en' });

        expect(screen.getByTestId('label')).toHaveTextContent(FALLBACK);
    });

    it('카탈로그 키에 점이 남아 있지 않다', () => {
        // next-intl은 `.`를 중첩 구분자로 쓴다 — 남아 있으면 조회 불가에
        // 더해 요청마다 INVALID_KEY console.error가 난다.
        for (const catalog of [koMessages, enMessages]) {
            const t = (
                catalog as unknown as {
                    shared: { assetName: Record<string, string> };
                }
            ).shared.assetName;

            expect(Object.keys(t).filter(k => k.includes('.'))).toEqual([]);
        }
    });
});
