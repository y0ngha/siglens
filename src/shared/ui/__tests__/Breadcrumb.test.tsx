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
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import messages from '../../../../messages/ko.json';
import { Breadcrumb, type BreadcrumbCrumb } from '@/shared/ui/Breadcrumb';
import enMessages from '../../../../messages/en.json';
import { SITE_NAME, SITE_NAME_KO } from '@/shared/lib/seo';

const NAV_LABEL = messages.shared.ui.Breadcrumb['46c31f'];

function renderCrumb(trail: readonly BreadcrumbCrumb[]) {
    return render(
        <NextIntlClientProvider locale="ko" messages={messages}>
            <Breadcrumb trail={trail} />
        </NextIntlClientProvider>
    );
}

describe('Breadcrumb', () => {
    it('ko 홈 마디는 한글 브랜드(시그렌즈)다', () => {
        renderCrumb([{ label: '미국 시장 현황' }]);

        expect(
            screen.getByRole('link', { name: '시그렌즈' })
        ).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: SITE_NAME })).toBeNull();
    });

    it('ko 외 로케일의 홈 마디는 영문 브랜드(SIGLENS)다', () => {
        render(
            <NextIntlClientProvider locale="en" messages={enMessages}>
                <Breadcrumb trail={[{ label: 'US market' }]} />
            </NextIntlClientProvider>
        );

        expect(screen.getByRole('link', { name: SITE_NAME })).toHaveAttribute(
            'href',
            '/'
        );
    });

    it('라벨 붙은 nav 랜드마크로 노출된다', () => {
        renderCrumb([{ label: '미국 시장 현황' }]);

        expect(
            screen.getByRole('navigation', { name: NAV_LABEL })
        ).toBeInTheDocument();
    });

    it('홈 마디가 자동으로 앞에 붙는다 — 호출부가 넘기지 않는다', () => {
        renderCrumb([{ label: '미국 시장 현황' }]);

        expect(
            screen.getByRole('link', { name: SITE_NAME_KO })
        ).toHaveAttribute('href', '/');
    });

    it('중간 마디는 링크, 마지막 마디는 현재 페이지다', () => {
        renderCrumb([
            { label: '뉴스', href: '/news' },
            { label: '미국 시장 뉴스' },
        ]);

        const nav = screen.getByRole('navigation', { name: NAV_LABEL });
        expect(within(nav).getByRole('link', { name: '뉴스' })).toHaveAttribute(
            'href',
            '/news'
        );
        expect(
            within(nav).queryByRole('link', { name: '미국 시장 뉴스' })
        ).toBeNull();
        expect(
            within(nav).getByText('미국 시장 뉴스').closest('li')
        ).toHaveAttribute('aria-current', 'page');
    });

    /**
     * `aria-current="page"`는 마지막 마디에만 붙어야 한다 — 여러 개가 붙으면
     * 보조기술이 현재 위치를 특정하지 못한다.
     */
    it('aria-current는 한 마디에만 붙는다', () => {
        const { container } = renderCrumb([
            { label: '뉴스', href: '/news' },
            { label: '미국 시장 뉴스', href: '/news/us' },
            { label: '주식' },
        ]);

        expect(
            container.querySelectorAll('[aria-current="page"]')
        ).toHaveLength(1);
    });

    /**
     * 구조화데이터가 페이지에 없는 텍스트를 주장하지 않게 하는 계약의 절반이다 —
     * 화면에 보이는 문자열이 `BreadcrumbList`의 `name`과 같아야 한다.
     */
    it('마디 텍스트를 그대로 그린다 — 숨김 텍스트가 없다', () => {
        const { container } = renderCrumb([
            { label: '뉴스', href: '/news' },
            { label: '미국 시장 뉴스' },
        ]);

        expect(container.querySelectorAll('.sr-only')).toHaveLength(0);
        expect(
            Array.from(container.querySelectorAll('li'))
                .map(li => li.textContent?.trim())
                .filter(text => text !== '/')
        ).toEqual([SITE_NAME_KO, '뉴스', '미국 시장 뉴스']);
    });

    /**
     * 작은 텍스트 링크(12px)의 터치 영역 — 레이아웃은 그대로 두고 `::after`가 24×24 이상으로
     * 히트 영역을 넓힌다(`globals.css`의 `.tap-target`, WCAG 2.2 SC 2.5.8).
     */
    it('홈 마디와 링크 마디는 터치 영역 확장 클래스를 쓴다', () => {
        renderCrumb([
            { label: '미국 시장', href: '/market' },
            { label: '현황' },
        ]);

        expect(screen.getByRole('link', { name: SITE_NAME_KO })).toHaveClass(
            'tap-target'
        );
        expect(screen.getByRole('link', { name: '미국 시장' })).toHaveClass(
            'tap-target'
        );
    });
});
