import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// 한글명 리졸버는 DB/FMP를 타는 server-only 경로다. 이 파일의 관심사는 렌더된
// 링크 그래프이지 이름 조회가 아니므로, 결정적인 스텁으로 고정한다.
vi.mock('@/entities/ticker', () => ({
    getAssetInfoResilient: vi.fn(),
}));

import { RelatedSymbols } from '../RelatedSymbols';
import { relatedSymbolsFor } from '@/shared/config/relatedSymbols';
import { getAssetInfoResilient } from '@/entities/ticker';
import type { MockedFunction } from 'vitest';

const mockGetAssetInfoResilient = getAssetInfoResilient as MockedFunction<
    typeof getAssetInfoResilient
>;

/** async 서버 컴포넌트라 element 트리를 await한 뒤 렌더한다. */
async function renderRelated(symbol: string) {
    return render(await RelatedSymbols({ symbol }));
}

describe('RelatedSymbols', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // 기본은 "DB에 이름 없음" — 큐레이션 폴백 경로를 밟는다.
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: null,
            degraded: false,
        } as never);
    });

    it('연관 종목마다 심볼 루트로 가는 앵커를 낸다', async () => {
        await renderRelated('NVDA');
        const expected = relatedSymbolsFor('NVDA');
        expect(expected.length).toBeGreaterThan(0);

        for (const item of expected) {
            // 접근 가능한 이름은 **표기용** 티커를 담는다(국내 종목은 접미사를
            // 뗀 `005930`). href는 canonical 심볼(`/005930.KS`)이어야 라우트가
            // 종목을 특정한다 — 이 둘이 갈라지는 것이 이 단언의 요점이다.
            const link = screen.getByRole('link', {
                name: new RegExp(`${item.displayTicker}$`),
            });
            expect(link).toHaveAttribute('href', `/${item.symbol}`);
        }
    });

    /**
     * 이 컴포넌트의 존재 이유가 크롤 가능한 내부링크다. `<a href>`가 아니라
     * 버튼/스크립트 내비게이션으로 바뀌면 링크 그래프가 통째로 사라지므로
     * 앵커 개수를 직접 고정한다.
     */
    it('모든 항목이 실제 앵커다 (크롤 가능)', async () => {
        const { container } = await renderRelated('NVDA');
        const anchors = container.querySelectorAll('a[href^="/"]');
        expect(anchors).toHaveLength(relatedSymbolsFor('NVDA').length);
    });

    it('자기 자신은 링크하지 않는다', async () => {
        await renderRelated('NVDA');
        expect(
            screen.queryByRole('link', { name: /^NVDA$/ })
        ).not.toBeInTheDocument();
    });

    it('큐레이션 한글명이 있으면 티커와 함께 노출한다 (DB 미스 폴백)', async () => {
        await renderRelated('MSFT');
        // NVDA는 메가캡 카테고리 형제라 반드시 목록에 있다.
        const link = screen.getByRole('link', { name: /NVDA/ });
        expect(link).toHaveTextContent('엔비디아');
        expect(link).toHaveTextContent('NVDA');
    });

    /**
     * 큐레이션 상수의 한글명 커버리지는 전체 칩의 42%뿐이라, 나머지는 `LENZ`처럼
     * 티커만 노출됐다 — 정작 그 종목 페이지 제목은 "렌즈 테라퓨틱스(LENZ)"였다.
     * DB 이름을 얹어 그 간극을 메운다.
     */
    it('DB에 한글명이 있으면 큐레이션 상수보다 우선한다', async () => {
        mockGetAssetInfoResilient.mockImplementation((async (
            symbol: string
        ) => ({
            assetInfo: {
                symbol,
                name: `${symbol} Inc.`,
                koreanName: `한글-${symbol}`,
            },
            degraded: false,
        })) as never);

        await renderRelated('NVDA');
        const first = relatedSymbolsFor('NVDA')[0];
        const link = screen.getByRole('link', {
            name: new RegExp(`${first.displayTicker}$`),
        });
        expect(link).toHaveTextContent(`한글-${first.symbol}`);
    });

    /**
     * 이름 하나 못 읽었다고 내부링크가 사라지면 이 컴포넌트의 존재 이유가 없어진다.
     * 조회 실패는 삼키고 앵커는 그대로 남아야 한다.
     */
    it('한글명 조회가 실패해도 링크는 전부 남는다', async () => {
        mockGetAssetInfoResilient.mockRejectedValue(new Error('DB down'));

        const { container } = await renderRelated('NVDA');
        expect(container.querySelectorAll('a[href^="/"]')).toHaveLength(
            relatedSymbolsFor('NVDA').length
        );
    });

    /**
     * `DYNAMIC_SERVER_USAGE`는 실패가 아니라 Next의 제어 흐름 신호다 — 정적 생성
     * 중 동적 API가 쓰였으니 이 렌더를 포기하라는 뜻이다. 삼키면 Next가 의도한
     * bail-out을 막아 잘못된 결과가 캐시에 굳는다(#545 인시던트 클래스).
     * 위 "조회 실패는 삼킨다" 테스트와 짝을 이뤄 두 경로를 구분해 고정한다.
     */
    it('DYNAMIC_SERVER_USAGE는 삼키지 않고 되던진다', async () => {
        const dynamicError = Object.assign(
            new Error('Dynamic server usage: cookies'),
            { digest: 'DYNAMIC_SERVER_USAGE' }
        );
        mockGetAssetInfoResilient.mockRejectedValue(dynamicError);

        await expect(RelatedSymbols({ symbol: 'NVDA' })).rejects.toThrow(
            dynamicError
        );
    });

    it('유니버스 밖 심볼이면 섹션 자체를 렌더하지 않는다 (빈 껍데기 금지)', async () => {
        const { container } = await renderRelated('ZZZNOTREAL');
        expect(container).toBeEmptyDOMElement();
    });

    it('접근 가능한 이름을 가진 내비게이션 랜드마크다', async () => {
        await renderRelated('NVDA');
        expect(
            screen.getByRole('navigation', { name: '관련 종목' })
        ).toBeInTheDocument();
    });
});
