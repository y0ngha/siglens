import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SearchResultRow } from '@/features/ticker-search/ui/SearchResultRow';
import type { TickerSearchResult } from '@/shared/lib/types';

function result(over: Partial<TickerSearchResult> = {}): TickerSearchResult {
    return {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        exchange: 'NASDAQ',
        exchangeFullName: 'NASDAQ Global Select',
        ...over,
    };
}

describe('SearchResultRow', () => {
    it('한글명을 주 이름으로, 티커를 보조로 보여준다', () => {
        render(
            <SearchResultRow
                result={result({ koreanName: '애플' })}
                onSelect={vi.fn()}
            />
        );

        expect(screen.getByText('애플')).toBeInTheDocument();
        expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    it('국내 종목은 영문 법인명을 붙이지 않는다', () => {
        // `resultDisplayNames`가 데스크톱 자동완성과 공유되는지 확인하는 계약이다.
        // 여기만 어긋나면 오버레이에서만 영문명이 붙어 종목 페이지 타이틀과 표기가 달라진다.
        render(
            <SearchResultRow
                result={result({
                    symbol: '005930.KS',
                    name: 'Samsung Electronics Co., Ltd.',
                    koreanName: '삼성전자',
                    exchange: 'KSC',
                    exchangeFullName: 'Korea Exchange',
                })}
                onSelect={vi.fn()}
            />
        );

        expect(screen.getByText('삼성전자')).toBeInTheDocument();
        expect(
            screen.queryByText('Samsung Electronics Co., Ltd.')
        ).not.toBeInTheDocument();
    });

    it('시장 배지를 붙인다', () => {
        render(<SearchResultRow result={result()} onSelect={vi.fn()} />);
        expect(screen.getByTestId('market-badge')).toBeInTheDocument();
    });

    it('시세를 표시하지 않는다', () => {
        // D4 회귀 가드. 시세를 넣으면 행마다 추가 왕복이 붙는다 — 한국 트래픽이
        // LAX로 라우팅되는 현재(RTT 165ms) 그 비용이 실재한다. 넣으려면 의도적으로
        // 이 테스트를 고쳐야 한다.
        const { container } = render(
            <SearchResultRow result={result()} onSelect={vi.fn()} />
        );
        expect(container.textContent).not.toMatch(/[%$₩]/);
    });

    it('Link가 아니라 button이다', () => {
        // `<Link>`는 router.push라 히스토리가 [NVDA, 검색, AAPL]이 되어 뒤로가기가
        // 유령 항목에 걸린다. 또 기본 prefetch가 켜져 PR #719가 막은 RSC 폭주를 되살린다.
        const { container } = render(
            <SearchResultRow result={result()} onSelect={vi.fn()} />
        );
        expect(container.querySelector('a')).toBeNull();
        // `role="option"`은 방향키 모델이 없어 제거했다(SearchOverlay 주석 참고).
        // 네이티브 button 역할 그대로가 계약이다.
        expect(screen.getByRole('button')).toBeInstanceOf(HTMLButtonElement);
    });

    it('소스에 prefetch 배선이 없다', () => {
        // 데스크톱 `ResultItem`의 `onMouseEnter={onPrefetch}`를 복사해 오지 않았는지
        // **소스 수준에서** 본다. React는 핸들러를 DOM 속성으로 노출하지 않아 렌더
        // 결과로는 검증할 수 없다(`vaulPatchIntegrity.test.ts`와 같은 성격의 가드).
        //
        // `router.prefetch`는 `prefetch={false}`를 우회하고 `/AAPL` RSC는 1.71MB다
        // (docs/architecture/CDN_CACHING.md §1). 10행 목록에 걸면 오버레이를 한 번
        // 열 때마다 ~17MB가 오리진에서 나가 PR #719가 막은 폭주가 되살아난다.
        // 인기·최근 행은 `SearchResultRow`를 거치지 않고 `SearchOverlay`가 직접
        // 그린다. 한쪽만 보면 그쪽에 붙은 prefetch 배선을 놓친다.
        const source = [
            'src/features/ticker-search/ui/SearchResultRow.tsx',
            'src/features/ticker-search/ui/SearchOverlay.tsx',
        ]
            .map(file => readFileSync(join(process.cwd(), file), 'utf-8'))
            .join('\n');
        // 주석에는 'prefetch'가 등장하므로 코드 배선만 골라낸다.
        const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        expect(code).not.toMatch(/onMouseEnter/);
        expect(code).not.toMatch(/prefetch/i);
    });

    it('선택하면 심볼과 표시 이름을 함께 넘긴다', async () => {
        const onSelect = vi.fn();
        render(
            <SearchResultRow
                result={result({ koreanName: '애플' })}
                onSelect={onSelect}
            />
        );

        await userEvent.click(screen.getByRole('button'));
        expect(onSelect).toHaveBeenCalledWith('AAPL', '애플');
    });
});
