// @vitest-environment jsdom
vi.mock('next-intl/server', () => ({
    getTranslations: vi.fn(async () => {
        const t = (key: string) => `t:${key}`;
        t.rich = (key: string) => `rich:${key}`;
        return t;
    }),
}));
vi.mock('@/widgets/legal/LegalPageShell', () => ({
    LegalPageShell: ({
        eyebrow,
        topNotice,
        bottomNotice,
        children,
    }: {
        eyebrow: string;
        topNotice?: React.ReactNode;
        bottomNotice?: React.ReactNode;
        children: React.ReactNode;
    }) => (
        <div>
            <p data-testid="eyebrow">{eyebrow}</p>
            <section data-testid="top">{topNotice}</section>
            {children}
            <section data-testid="bottom">{bottomNotice}</section>
        </div>
    ),
}));
vi.mock('@/widgets/legal/PolicyMarkdownBody', () => ({
    PolicyMarkdownBody: ({ markdown }: { markdown: string }) => (
        <article>{markdown}</article>
    ),
}));
vi.mock('@/widgets/legal/UntranslatedNotice', () => ({
    UntranslatedNotice: ({
        requested,
        served,
    }: {
        requested: string;
        served: string;
    }) => (
        <p>
            untranslated:{requested}:{served}
        </p>
    ),
}));
vi.mock('@/shared/ui/LocaleLink', () => ({
    LocaleLink: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
}));

import { render, screen } from '@testing-library/react';
import type { TermsRecord } from '@/entities/terms/api';
import {
    PRIVACY_EYEBROW,
    PrivacyContent,
} from '@/app/[locale]/privacy/_components/PrivacyContent';

const record = (overrides: Partial<TermsRecord> = {}): TermsRecord => ({
    id: 'id-1',
    kind: 'privacy',
    version: 1,
    effectiveDate: new Date('2026-09-14T00:00:00Z'),
    body: '본문 마크다운',
    bodyLocale: 'ko',
    isTranslationFallback: false,
    ...overrides,
});

const renderContent = async (terms: TermsRecord, locale: 'ko' | 'en' = 'ko') =>
    render(await PrivacyContent({ locale, terms }));

describe('PrivacyContent', () => {
    it('eyebrow 상수는 화면에 노출되는 영문 라벨 그대로다', () => {
        expect(PRIVACY_EYEBROW).toBe('PRIVACY POLICY');
    });

    it('셸 eyebrow로 같은 상수를 넘긴다', async () => {
        await renderContent(record());
        expect(screen.getByTestId('eyebrow')).toHaveTextContent(
            PRIVACY_EYEBROW
        );
    });

    it('본문은 레코드 body를 마크다운 본문으로 렌더한다', async () => {
        await renderContent(record());
        expect(screen.getByText('본문 마크다운')).toBeInTheDocument();
    });

    it('번역 fallback이 아니면 번역 안내를 내지 않는다', async () => {
        await renderContent(record());
        expect(screen.queryByText(/untranslated:/)).not.toBeInTheDocument();
    });

    it('번역 fallback이면 요청 로케일과 제공 로케일을 안내에 넘긴다', async () => {
        await renderContent(
            record({ isTranslationFallback: true, bodyLocale: 'ko' }),
            'en'
        );
        expect(screen.getByText('untranslated:en:ko')).toBeInTheDocument();
    });

    it('번역 안내는 상단 영역에만 나온다', async () => {
        await renderContent(record({ isTranslationFallback: true }), 'en');
        expect(screen.getByTestId('top')).toHaveTextContent('untranslated:');
        expect(screen.getByTestId('bottom')).not.toHaveTextContent(
            'untranslated:'
        );
    });

    it('하단 영역에 투자 고지와 약관 링크 문장이 나온다', async () => {
        await renderContent(record());
        expect(screen.getByTestId('bottom')).toHaveTextContent(
            'rich:privacyBottomNotice'
        );
    });
});
