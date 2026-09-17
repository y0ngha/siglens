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
import { SITE_NAME } from '@/shared/lib/seo';

const NAV_LABEL = messages.shared.ui.Breadcrumb['46c31f'];

function renderCrumb(trail: readonly BreadcrumbCrumb[]) {
    return render(
        <NextIntlClientProvider locale="ko" messages={messages}>
            <Breadcrumb trail={trail} />
        </NextIntlClientProvider>
    );
}

describe('Breadcrumb', () => {
    it('라벨 붙은 nav 랜드마크로 노출된다', () => {
        renderCrumb([{ label: '미국 시장 현황' }]);

        expect(
            screen.getByRole('navigation', { name: NAV_LABEL })
        ).toBeInTheDocument();
    });

    it('홈 마디가 자동으로 앞에 붙는다 — 호출부가 넘기지 않는다', () => {
        renderCrumb([{ label: '미국 시장 현황' }]);

        expect(screen.getByRole('link', { name: SITE_NAME })).toHaveAttribute(
            'href',
            '/'
        );
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
        ).toEqual([SITE_NAME, '뉴스', '미국 시장 뉴스']);
    });
});
