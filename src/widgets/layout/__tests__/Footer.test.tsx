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
    ABOUT_PATH: '/about',
    aboutTitle: () => 'SIGLENS 소개',
    INVESTMENT_DISCLAIMER_KEY: 'investmentDisclaimer',
    METHODOLOGY_PATH: '/methodology',
    methodologyTitle: () => '분석 방법',
    PRIVACY_PATH: '/privacy',
    privacyTitle: () => '개인정보처리방침',
    TERMS_PATH: '/terms',
    termsTitle: () => '이용약관',
}));

import React from 'react';
import { render, screen, within } from '@testing-library/react';

import { Footer } from '../Footer';
import {
    ALL_NAV_REGION_LINKS,
    NAV_VERTICALS,
} from '@/shared/config/assetClassNav';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { localePath } from '@/shared/i18n/locales';
import { GITHUB_URL, SITE_NAME, SITE_NAME_KO, X_URL } from '@/shared/lib/seo';
import { koMessage } from '@/shared/test-utils/koMessage';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import en from '../../../../messages/en.json';
import ja from '../../../../messages/ja.json';
import ko from '../../../../messages/ko.json';
import zh from '../../../../messages/zh.json';

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

        expect(screen.getByText(/© 2026 SIGLENS/)).toBeInTheDocument();
    });

    /**
     * 한글 표기는 전 페이지 푸터에서 워드마크 옆에 보인다 — 화면에서 "시그렌즈"가
     * 사이트 전역으로 나오는 유일한 자리다. 한글 독음이라 ko에서만 낸다.
     */
    it('ko 푸터는 워드마크 옆에 한글 표기를 보인다', () => {
        renderWithIntl(<Footer />, { locale: 'ko' });

        expect(
            screen.getByText(new RegExp(`© 2026 SIGLENS · ${SITE_NAME_KO}`))
        ).toBeInTheDocument();
    });

    it.each(['en', 'ja', 'zh'] as const)(
        '%s 푸터에는 한글 표기가 없다',
        locale => {
            const { container } = renderWithIntl(<Footer />, { locale });

            expect(screen.getByText(/© 2026 SIGLENS/)).toBeInTheDocument();
            expect(container.textContent).not.toContain(SITE_NAME_KO);
        }
    );

    it('renders the about link with the catalog title', () => {
        render(<Footer />);

        const link = screen.getByRole('link', { name: /SIGLENS 소개/ });
        expect(link).toHaveTextContent('SIGLENS 소개');
        expect(link).toHaveAttribute('href', '/about');
    });

    /**
     * 분석 방법 링크는 산문 하단의 출처 고지와 `/about`이 향하는 페이지로 가는
     * **전역 입구**다. 소개 바로 뒤에 있고(`내비 순서`), 지워지면 `/methodology`는
     * sitemap 말고는 크롤 경로가 없는 고아가 된다.
     */
    it('renders the methodology link right after the about link', () => {
        render(<Footer />);

        const info = screen.getByRole('navigation', { name: '사이트 정보' });
        const links = within(info).getAllByRole('link');
        const about = links.findIndex(a => a.getAttribute('href') === '/about');
        expect(about).toBeGreaterThanOrEqual(0);
        const link = links[about + 1]!;
        expect(link).toHaveAttribute('href', '/methodology');
        expect(link).toHaveAccessibleName('분석 방법');
    });

    /**
     * 종목 디렉터리 링크는 **크롤 구조물**이다. 2026-09-18 실측에서 sitemap 심볼
     * 416개 중 147개가 홈에서 3클릭 안에 닿지 않았고, 푸터는 전 라우트에 렌더되므로
     * 이 한 줄이 디렉터리를 1클릭·모든 종목을 2클릭으로 만든다. 지워지면 그 구조가
     * 조용히 사라지므로 존재와 목적지를 함께 고정한다.
     */
    it('renders the symbol directory link on every page', () => {
        render(<Footer />);

        const link = screen.getByRole('link', {
            name: koMessage('widgets.layout.Footer.symbolsLink'),
        });
        expect(link).toHaveAttribute('href', '/symbols');
    });

    it('renders a link to ai.siglens.io named "시그렌즈 AI" in ko', () => {
        render(<Footer />);

        const link = screen.getByRole('link', { name: '시그렌즈 AI' });
        expect(link).toHaveAttribute(
            'href',
            `${AI_SITE_URL}${localePath('ko', '/')}`
        );
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
     * 푸터는 전 페이지에 렌더되는 전역 링크라 앵커 텍스트의 사정거리가 사이트 전체다.
     * 보이는 글자가 곧 `fullLabel`이라 접근성 이름·크롤러 앵커 텍스트가 같다.
     */
    it('링크의 접근성 이름은 fullLabel이다 (보이는 글자 = 이름)', () => {
        render(<Footer />);

        for (const region of ALL_NAV_REGION_LINKS) {
            const link = screen.getByRole('link', {
                name: koMessage(region.fullLabelKey),
            });
            expect(link).toHaveAttribute('href', region.href);
        }
    });

    /**
     * 저작권 표기가 `© 2026` / `SIGLENS` 두 줄로 쪼개졌다(2026-08-25 사용자 제보
     * 스크린샷). 당시 원인은 옆에 있던 `flex-wrap` nav가 `justify-between` 아래에서
     * 폭을 뺏은 것이라 `shrink-0`이 함께 필요했다. 카테고리 열로 바뀌며 그 형제
     * nav가 사라져 `shrink-0`은 근거를 잃었지만, 좁은 화면에서 저작권 한 줄이
     * 쪼개질 이유는 여전히 없으므로 `whitespace-nowrap`은 남긴다.
     */
    it('저작권 표기는 줄바꿈되지 않는다', () => {
        const { container } = render(<Footer />);

        const copyright = Array.from(container.querySelectorAll('p')).find(el =>
            el.textContent?.includes('SIGLENS')
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
        // (TESTING.md#TE-10).
        expect(link).toHaveAttribute('href', GITHUB_URL);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link.getAttribute('rel')).toContain('noopener');
    });

    /**
     * X 계정 링크. GitHub 링크 바로 뒤의 아이콘 전용 링크라 접근 가능한 이름이
     * `aria-label` 하나뿐이다 — 이름이 빠지면 스크린리더는 "링크"만 읽는다.
     * 터치 영역은 아이콘(20px)이 아니라 링크 상자(`size-11` = 44px)가 진다.
     */
    it('X 계정 링크는 새 탭으로 열고 opener를 끊으며 이름이 있다', () => {
        render(<Footer />);

        const link = screen.getByRole('link', { name: /X\(트위터\) 계정/ });
        expect(link).toHaveAttribute('href', X_URL);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link.getAttribute('rel')?.split(' ').toSorted()).toEqual([
            'noopener',
            'noreferrer',
        ]);
        expect(link).toHaveAccessibleName(
            koMessage('widgets.layout.xAccountAria').replace('{v0}', SITE_NAME)
        );
    });

    it('X 아이콘은 장식이고 링크 상자가 44px 터치 영역이다', () => {
        render(<Footer />);

        const link = screen.getByRole('link', { name: /X\(트위터\) 계정/ });
        expect(link.querySelector('svg')).toHaveAttribute(
            'aria-hidden',
            'true'
        );
        expect(link.className.split(/\s+/)).toEqual(
            expect.arrayContaining(['size-11', '-m-3'])
        );
    });

    it('GitHub 아이콘도 X와 같은 44px 터치 영역이다 — 음수 마진으로 레이아웃 몫은 20px 그대로', () => {
        render(<Footer />);

        const link = screen.getByRole('link', { name: /GitHub 저장소/ });
        expect(link.className.split(/\s+/)).toEqual(
            expect.arrayContaining(['size-11', '-m-3'])
        );
    });

    it('GitHub·X 터치 상자가 겹치지 않는다 — 행 간격이 두 상자의 바깥 여백 합(12+12=24px)이다', () => {
        render(<Footer />);

        const row = screen.getByRole('link', {
            name: /GitHub 저장소/,
        }).parentElement!;
        const classes = row.className.split(/\s+/);
        expect(classes).toContain('gap-x-6');
        expect(classes).not.toContain('gap-x-4');
        expect(
            screen.getByRole('link', { name: /X\(트위터\) 계정/ }).parentElement
        ).toBe(row);
    });

    it('사이트맵 링크는 터치 영역 확장 클래스를 쓴다', () => {
        render(<Footer />);

        const sitemap = screen.getAllByRole('list')[0]!;
        for (const link of within(sitemap).getAllByRole('link')) {
            expect(link).toHaveClass('tap-target');
        }
    });

    it('X_URL은 https x.com 프로필 주소다', () => {
        expect(X_URL).toBe('https://x.com/siglens_io');
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

    /**
     * 2026-10-05 크롤 감사: 푸터 앵커가 `미국`/`한국`만 말해 목적지 주제를 알려 주지 못했다.
     * 보이는 글자가 곧 전체 이름이다 — 열 제목과 겹치는 비용을 내고 앵커가 주제를 말한다.
     */
    it('보이는 글자는 전체 이름이다', () => {
        render(<Footer />);

        const marketList = screen.getByRole('list', { name: '시장 분석' });
        expect(
            within(marketList)
                .getAllByRole('link')
                .map(a => a.textContent)
        ).toEqual(['미국 시장 분석', '한국 시장 분석']);
    });

    /**
     * 보이는 글자가 이름이라 `aria-label`도, 숨김 텍스트(`sr-only`)도 필요 없다. 전 페이지에
     * 렌더되는 전역 링크 집합의 숨김 텍스트는 구글 정책에 걸린다.
     */
    it('링크에 aria-label도 숨김 텍스트도 없다 — 보이는 글자가 이름이다', () => {
        const { container } = render(<Footer />);

        const sitemap = screen.getByRole('navigation', { name: '사이트맵' });
        expect(sitemap.querySelectorAll('.sr-only')).toHaveLength(0);
        expect(container.querySelectorAll('a .sr-only')).toHaveLength(0);
        for (const link of within(sitemap).getAllByRole('link')) {
            expect(link).not.toHaveAttribute('aria-label');
        }
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

/**
 * Footer는 `aboutTitle(tSeo)`를 그대로 그린다 — ko는 한글 표기(`시그렌즈 소개`),
 * 나머지는 영문 표기(`SIGLENS`)를 카탈로그가 직접 담아야 한다. `Footer.test.tsx`는
 * `aboutTitle`을 모킹하므로 실제 카탈로그 값은 이 테스트가 아니면 아무도
 * 검증하지 않는다.
 */
describe('shared.seo.about.title 카탈로그', () => {
    it.each([
        ['ko', ko],
        ['en', en],
        ['ja', ja],
        ['zh', zh],
    ])('%s 카탈로그는 브랜드 표기를 담고 있다', (locale, messages) => {
        expect(messages.shared.seo.about.title).toContain(
            locale === 'ko' ? SITE_NAME_KO : SITE_NAME
        );
    });
});

/**
 * 푸터가 쓰는 두 새 문구는 `Footer.test.tsx`의 다른 테스트가 ko로만 읽는다 —
 * 네 로케일 모두에 있고 인자 자리가 남아 있어야 비-ko 푸터가 키 문자열이나
 * 한국어를 내지 않는다.
 */
describe('푸터의 분석 방법·X 계정 카탈로그', () => {
    it.each([
        ['ko', ko],
        ['en', en],
        ['ja', ja],
        ['zh', zh],
    ])('%s: 분석 방법 제목과 X 계정 이름이 있다', (locale, messages) => {
        const title = messages.shared.seo.methodology.title;
        const aria = messages.widgets.layout.xAccountAria;
        expect(title.length).toBeGreaterThan(0);
        expect(aria).toContain('{v0}');
        if (locale !== 'ko') {
            expect(title).not.toMatch(/[가-힣]/);
            expect(aria).not.toMatch(/[가-힣]/);
        }
    });
});
