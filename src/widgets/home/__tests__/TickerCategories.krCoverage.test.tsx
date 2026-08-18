vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...rest
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

import React from 'react';
import { render, screen } from '@testing-library/react';

import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { TickerCategories } from '../TickerCategories';

/**
 * 이 그리드는 저장소 전체에서 한국 종목 페이지로 가는 **유일한 크롤 가능한 `<a>`**다
 * (검색 자동완성은 `<button>` + `router.push`). 여기서 빠진 종목은 sitemap에만 있는
 * 고아가 되고 인바운드 링크가 0이 된다.
 *
 * `TickerCategories.test.tsx`가 `TICKER_CATEGORIES`를 목으로 대체하는 것과 달리,
 * 이 파일은 **실제 설정**을 렌더한다 — 목을 쓰면 정작 검사하려는 대상이 사라진다.
 * 업종 분할(2026-08)로 KR 카테고리가 하나에서 여섯으로 늘었으므로 링크 커버리지는
 * 카테고리별이 아니라 합집합으로 검사한다.
 */
describe('TickerCategories — KR 종목 크롤 커버리지', () => {
    it('모든 KR 인기 종목이 크롤 가능한 링크로 렌더된다', () => {
        render(<TickerCategories />);

        const krPopular = POPULAR_TICKERS.filter(t => /\.K[SQ]$/.test(t));
        expect(krPopular.length).toBeGreaterThan(0);

        const hrefs = new Set(
            screen
                .getAllByRole('link')
                .map(a => a.getAttribute('href'))
                .filter((h): h is string => h !== null)
        );

        for (const symbol of krPopular) {
            expect(hrefs).toContain(`/${symbol}`);
        }
    });

    it('미국·한국 섹션을 나눠 시장을 제목에서 밝힌다', () => {
        // 업종 라벨만으로는 시장을 알 수 없다 — `반도체·IT`(한국)와
        // `AI·반도체`(미국)가 한 그리드에 섞이면 구분할 방법이 없다.
        render(<TickerCategories />);

        expect(
            screen.getByRole('heading', { name: '미국 섹터별 인기 종목' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: '한국 섹터별 인기 종목' })
        ).toBeInTheDocument();
    });

    it('KR 종목 링크는 모두 한국 섹션 안에 있다', () => {
        render(<TickerCategories />);

        const krSection = screen.getByRole('navigation', {
            name: '한국 섹터별 인기 종목 탐색',
        });
        const krPopular = POPULAR_TICKERS.filter(t => /\.K[SQ]$/.test(t));
        const krHrefs = new Set(
            Array.from(krSection.querySelectorAll('a')).map(a =>
                a.getAttribute('href')
            )
        );

        expect(krHrefs.size).toBe(krPopular.length);
        for (const symbol of krPopular) {
            expect(krHrefs).toContain(`/${symbol}`);
        }

        // 미국 섹션에 KR 종목이 남아 있으면 제목이 거짓말이 되고 같은 링크가
        // 두 번 렌더된다.
        const usSection = screen.getByRole('navigation', {
            name: '미국 섹터별 인기 종목 탐색',
        });
        const usHrefs = Array.from(usSection.querySelectorAll('a')).map(a =>
            a.getAttribute('href')
        );
        expect(usHrefs.filter(h => /\.K[SQ]$/.test(h ?? ''))).toEqual([]);
    });
});
