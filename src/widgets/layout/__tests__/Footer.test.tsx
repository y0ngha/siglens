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
vi.mock('../ContactDialog', () => ({
    ContactDialog: ({ triggerLabel }: { triggerLabel: string }) => (
        <button type="button">{triggerLabel}</button>
    ),
}));
vi.mock('../CurrentYear', () => ({
    CurrentYear: () => <>2026</>,
}));
vi.mock('@/shared/lib/legal', () => ({
    INVESTMENT_DISCLAIMER_KEY: 'investmentDisclaimer',
    PRIVACY_PATH: '/privacy',
    privacyTitle: () => '개인정보처리방침',
    TERMS_PATH: '/terms',
    termsTitle: () => '이용약관',
}));

import React from 'react';
import { render, screen, within } from '@testing-library/react';

import { Footer, splitFooterLabel } from '../Footer';
import {
    ALL_NAV_REGION_LINKS,
    NAV_VERTICALS,
} from '@/shared/config/assetClassNav';
import { GITHUB_URL } from '@/shared/lib/seo';
import { koMessage } from '@/shared/test-utils/koMessage';

describe('Footer', () => {
    it('renders the investment disclaimer', () => {
        render(<Footer />);

        // 문구는 `shared.lib.legal` 카탈로그에서 온다 — 예전엔 모듈 상수라
        // 비-ko 푸터도 한국어 고지를 렌더했다.
        expect(
            screen.getByText(koMessage('shared.lib.legal.investmentDisclaimer'))
        ).toBeInTheDocument();
    });

    it('renders the copyright with year', () => {
        render(<Footer />);

        expect(screen.getByText(/© 2026 Siglens/)).toBeInTheDocument();
    });

    it('renders the privacy policy link', () => {
        render(<Footer />);

        const link = screen.getByRole('link', { name: /개인정보처리방침/ });
        expect(link).toHaveAttribute('href', '/privacy');
    });

    it('renders the terms link', () => {
        render(<Footer />);

        const link = screen.getByRole('link', { name: /이용약관/ });
        expect(link).toHaveAttribute('href', '/terms');
    });

    it('renders the contact dialog trigger', () => {
        render(<Footer />);

        expect(
            screen.getByRole('button', { name: /문의하기/ })
        ).toBeInTheDocument();
    });

    it('has a navigation landmark for site info', () => {
        render(<Footer />);

        expect(
            screen.getByRole('navigation', { name: /사이트 정보/ })
        ).toBeInTheDocument();
    });

    it('renders the /economy link with 미국 경제 label', () => {
        render(<Footer />);

        const link = screen.getByRole('link', { name: /미국 경제/ });
        expect(link).toHaveAttribute('href', '/economy');
    });

    it('renders the US news link with its full label', () => {
        render(<Footer />);

        // `/news`는 3지역 상위 허브이고 미국 카테고리 목록은 `/news/us`가 잇는다.
        const link = screen.getByRole('link', { name: '미국 시장 뉴스' });
        expect(link).toHaveAttribute('href', '/news/us');
    });

    /**
     * 카테고리 열로 묶이면서 **보이는 글자**는 짧은 라벨(`미국`)로 줄었다. 그래도
     * 접근성 이름과 크롤러가 읽는 앵커 텍스트는 `fullLabel` 그대로여야 한다 —
     * 푸터는 전 페이지에 렌더되는 전역 링크라 앵커 텍스트 변경의 사정거리가
     * 사이트 전체다. 숨은 조각(`sr-only`)이 그 차이를 메운다.
     */
    it('링크의 접근성 이름은 여전히 fullLabel이다 (앵커 텍스트 보존)', () => {
        render(<Footer />);

        for (const region of ALL_NAV_REGION_LINKS) {
            const link = screen.getByRole('link', {
                name: koMessage(region.fullLabelKey),
            });
            expect(link).toHaveAttribute('href', region.href);
        }
    });

    /**
     * 저작권 표기가 `© 2026` / `Siglens` 두 줄로 쪼개졌다(2026-08-25 사용자 제보
     * 스크린샷). 당시 원인은 옆에 있던 `flex-wrap` nav가 `justify-between` 아래에서
     * 폭을 뺏은 것이라 `shrink-0`이 함께 필요했다. 카테고리 열로 바뀌며 그 형제
     * nav가 사라져 `shrink-0`은 근거를 잃었지만, 좁은 화면에서 저작권 한 줄이
     * 쪼개질 이유는 여전히 없으므로 `whitespace-nowrap`은 남긴다.
     */
    it('저작권 표기는 줄바꿈되지 않는다', () => {
        const { container } = render(<Footer />);

        const copyright = Array.from(container.querySelectorAll('p')).find(el =>
            el.textContent?.includes('Siglens')
        );
        expect(copyright).toBeDefined();
        expect(copyright!.className).toContain('whitespace-nowrap');
    });

    it('버티컬마다 카테고리 열을 세우고 이름 붙인 목록을 담는다', () => {
        render(<Footer />);

        for (const vertical of NAV_VERTICALS) {
            const list = screen.getByRole('list', {
                name: koMessage(vertical.labelKey),
            });
            expect(list).toBeInTheDocument();
        }
    });

    /**
     * 푸터는 축이 둘이다 — 왼쪽은 "누가 만들었는가"(저작권·저장소·약관·문의),
     * 오른쪽은 "어디로 갈 수 있는가"(사이트맵). 랜드마크도 그렇게 갈라 둔다.
     */
    it('두 랜드마크로 갈라진다 — 사이트 정보 · 사이트맵', () => {
        render(<Footer />);

        const info = screen.getByRole('navigation', { name: '사이트 정보' });
        const sitemap = screen.getByRole('navigation', { name: '사이트맵' });

        expect(
            within(info).getByRole('link', { name: '개인정보처리방침' })
        ).toBeInTheDocument();
        expect(within(info).queryByRole('list')).toBeNull();
        expect(within(sitemap).getAllByRole('list')).toHaveLength(
            NAV_VERTICALS.length
        );
    });

    it('GitHub 저장소 링크는 새 탭으로 열고 opener를 끊는다', () => {
        render(<Footer />);

        const link = screen.getByRole('link', { name: /GitHub 저장소/ });
        // 배선은 상수로 검증한다 — 기대값을 하드코딩하면 상수가 정상적으로
        // 바뀌었을 때도 실패해, 진짜 회귀인지 낡은 기대값인지 구분이 안 된다
        // (MISTAKES.md #13.5).
        expect(link).toHaveAttribute('href', GITHUB_URL);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link.getAttribute('rel')).toContain('noopener');
    });

    /**
     * 위 테스트는 상수를 import하므로 **배선만** 본다 — 상수 자체가 엉뚱한 값으로
     * 바뀌면 그대로 통과한다. 값의 정확한 저장소 경로는 단위 테스트가 판단할 수
     * 없지만 **형태**는 판단할 수 있으므로, 그 층만 따로 붙든다.
     */
    it('GITHUB_URL은 https GitHub 주소다', () => {
        expect(GITHUB_URL).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+$/);
    });

    it('열 제목은 헤딩이 아니다 (전 페이지 문서 개요 오염 방지)', () => {
        const { container } = render(<Footer />);

        // 푸터는 모든 라우트에 렌더된다. 열 제목을 h2로 두면 종목 페이지의 실제
        // h2들과 같은 층에 사이트맵 제목 다섯 개가 섞인다.
        expect(container.querySelectorAll('h1,h2,h3,h4,h5,h6')).toHaveLength(0);
    });

    it('지역에 속하지 않는 상위 허브는 자기 버티컬 열의 첫 항목이다', () => {
        render(<Footer />);

        // `/news`만 해당한다 — 세 지역이 각자 다른 URL이라 허브가 어느 지역에도
        // 속하지 않는다.
        const newsList = screen.getByRole('list', { name: '뉴스' });
        const first = within(newsList).getAllByRole('link')[0];
        expect(first).toHaveAttribute('href', '/news');
        expect(first).toHaveAccessibleName('뉴스 전체');
    });

    it('보이는 글자는 짧은 라벨이다', () => {
        render(<Footer />);

        const marketList = screen.getByRole('list', { name: '시장 분석' });
        expect(
            within(marketList)
                .getAllByRole('link')
                .map(a => a.textContent)
        ).toEqual(['미국 시장 분석', '한국 시장 분석']);
    });

    it('exposes both market regions', () => {
        render(<Footer />);

        expect(
            screen.getByRole('link', { name: '미국 시장 분석' })
        ).toHaveAttribute('href', '/market');
        expect(
            screen.getByRole('link', { name: '한국 시장 분석' })
        ).toHaveAttribute('href', '/market/kr');
    });
});

describe('splitFooterLabel', () => {
    /**
     * 조합이 규칙적이지 않아 문자열 연결로는 못 만든다 — 그래서 만들지 않고
     * 자른다. 이 표가 그 불규칙을 그대로 담는다.
     */
    it('토큰 앞뒤로 갈라 낸다', () => {
        // 접미 — 가장 흔한 형태.
        expect(splitFooterLabel('미국 시장 분석', '미국')).toEqual({
            srPrefix: '',
            visible: '미국',
            srSuffix: ' 시장 분석',
        });
        // 접미인데 버티컬 라벨(`뉴스`)과 fullLabel(`미국 시장 뉴스`)이 어긋난다.
        expect(splitFooterLabel('미국 시장 뉴스', '미국')).toEqual({
            srPrefix: '',
            visible: '미국',
            srSuffix: ' 시장 뉴스',
        });
        // 상위 허브는 토큰이 **앞**이 아니라 뒤에 온다.
        expect(splitFooterLabel('뉴스 전체', '전체')).toEqual({
            srPrefix: '뉴스 ',
            visible: '전체',
            srSuffix: '',
        });
        // fullLabel이 토큰 하나뿐인 경우.
        expect(splitFooterLabel('암호화폐 뉴스', '암호화폐')).toEqual({
            srPrefix: '',
            visible: '암호화폐',
            srSuffix: ' 뉴스',
        });
    });

    it('토큰이 없으면 전체를 보여준다 (라벨을 잃지 않는다)', () => {
        expect(splitFooterLabel('미국 시장 분석', '없는토큰')).toEqual({
            srPrefix: '',
            visible: '미국 시장 분석',
            srSuffix: '',
        });
    });
});
