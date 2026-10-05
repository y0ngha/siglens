/**
 * DB 없이 도는 배포 빌드에서 `/terms`·`/privacy`의 동작.
 *
 * 운영 DB가 사설 RDS로 옮겨 가면서 GitHub Actions 러너의 `next build`에는 DB가 없다.
 * 이 상태에서 404(`notFound`)나 빈 화면이 구워져 24h 서빙되면 안 된다 — 비어 있지 않은
 * 안내문 + noindex + 60초 revalidate여야 한다. 반대로 런타임과 DB가 있는 빌드는 기존
 * 경로(`getActiveTerms` 호출, revalidate 그대로)를 그대로 타야 한다.
 *
 * 두 라우트를 한 파일에서 본다 — 형제 라우트 한쪽에만 규칙이 적용되는 표류가 이
 * 프로젝트의 반복 결함이다(MISTAKES.md §6.7).
 */
const { mockGetActiveTerms, mockNotFound, mockShortenRevalidate } = vi.hoisted(
    () => ({
        mockGetActiveTerms: vi.fn(),
        mockNotFound: vi.fn(() => {
            throw new Error('NEXT_NOT_FOUND');
        }),
        mockShortenRevalidate: vi.fn(async () => undefined),
    })
);

vi.mock('@/entities/terms/api', () => ({
    getActiveTerms: mockGetActiveTerms,
}));
vi.mock('next/navigation', () => ({ notFound: mockNotFound }));
vi.mock('next-intl/server', () => ({
    setRequestLocale: vi.fn(),
    getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock('@/shared/cache/buildDegradedRevalidate', () => ({
    shortenRevalidateForDegrade: mockShortenRevalidate,
}));
vi.mock('@/shared/ui/LocaleLink', () => ({
    LocaleLink: ({
        href,
        children,
    }: {
        href: string;
        children: React.ReactNode;
    }) => <a href={href}>{children}</a>,
}));
vi.mock('@/widgets/legal/LegalBreadcrumb', () => ({
    LegalBreadcrumb: () => <nav />,
}));

import React from 'react';
import { render, screen } from '@testing-library/react';
import type { Metadata } from 'next';
import TermsPage, {
    generateMetadata as termsMetadata,
} from '@/app/[locale]/terms/page';
import PrivacyPage, {
    generateMetadata as privacyMetadata,
} from '@/app/[locale]/privacy/page';

type PageComponent = (props: {
    params: Promise<{ locale: string }>;
}) => Promise<React.ReactNode>;

type MetadataFn = (props: {
    params: Promise<{ locale: string }>;
}) => Promise<Metadata>;

const ROUTES: readonly {
    name: string;
    page: PageComponent;
    metadata: MetadataFn;
}[] = [
    { name: '/terms', page: TermsPage, metadata: termsMetadata },
    { name: '/privacy', page: PrivacyPage, metadata: privacyMetadata },
];

const ACTIVE_TERMS = {
    id: 'row-1',
    kind: 'tos',
    version: 2,
    effectiveDate: new Date('2026-09-14T00:00:00.000Z'),
    body: '# 약관\n본문',
    bodyLocale: 'ko',
    isTranslationFallback: false,
};

const params = () => Promise.resolve({ locale: 'ko' });

beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveTerms.mockResolvedValue(ACTIVE_TERMS);
    vi.stubEnv('SIGLENS_OFFLINE_BUILD', '');
});

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('DB 없는 빌드(NEXT_PHASE=build, DATABASE_URL 없음)', () => {
    beforeEach(() => {
        vi.stubEnv('NEXT_PHASE', 'phase-production-build');
        vi.stubEnv('DATABASE_URL', '');
    });

    it.each(ROUTES)(
        '$name: DB를 건드리지 않고 비어 있지 않은 안내문을 낸다',
        async ({ page }) => {
            const element = await page({ params: params() });
            render(<>{element}</>);

            expect(mockGetActiveTerms).not.toHaveBeenCalled();
            expect(mockNotFound).not.toHaveBeenCalled();
            expect(
                screen.getByRole('heading', { level: 1 })
            ).toBeInTheDocument();
            expect(
                screen.getByRole('status', { name: '약관 불러오기 안내' })
            ).toHaveTextContent('약관 전문을 불러오는 중이에요');
        }
    );

    it.each(ROUTES)(
        '$name: 약관·방침 두 문서로 가는 링크를 남긴다',
        async ({ page }) => {
            const element = await page({ params: params() });
            render(<>{element}</>);

            const hrefs = screen
                .getAllByRole('link')
                .map(link => link.getAttribute('href'));
            expect(hrefs).toEqual(['/terms', '/privacy']);
        }
    );

    it.each(ROUTES)(
        '$name: 이 렌더의 revalidate를 낮춘다(안내문이 24h 굳지 않게)',
        async ({ page }) => {
            await page({ params: params() });
            expect(mockShortenRevalidate).toHaveBeenCalledOnce();
        }
    );

    it.each(ROUTES)(
        '$name: generateMetadata가 noindex + canonical 없음을 낸다',
        async ({ metadata }) => {
            const result = await metadata({ params: params() });

            expect(mockGetActiveTerms).not.toHaveBeenCalled();
            expect(result.robots).toEqual({ index: false, follow: true });
            expect(result.alternates?.canonical).toBeNull();
        }
    );

    it('오프라인 빌드(URL이 있어도 Neon 차단)도 같은 안내문 경로다', async () => {
        vi.stubEnv('DATABASE_URL', 'postgres://localhost:5432/testdb');
        vi.stubEnv('SIGLENS_OFFLINE_BUILD', '1');

        const element = await TermsPage({ params: params() });
        render(<>{element}</>);

        expect(mockGetActiveTerms).not.toHaveBeenCalled();
        expect(mockShortenRevalidate).toHaveBeenCalledOnce();
        expect(screen.getByRole('status')).toBeInTheDocument();
    });
});

describe.each([
    {
        label: 'DB가 있는 빌드',
        phase: 'phase-production-build',
        databaseUrl: 'postgres://localhost:5432/testdb',
    },
    { label: '런타임', phase: '', databaseUrl: '' },
])('$label (정상 경로)', ({ phase, databaseUrl }) => {
    beforeEach(() => {
        vi.stubEnv('NEXT_PHASE', phase);
        vi.stubEnv('DATABASE_URL', databaseUrl);
    });

    it.each(ROUTES)(
        '$name: 활성 약관을 조회하고 revalidate를 건드리지 않는다',
        async ({ page }) => {
            const element = await page({ params: params() });

            expect(mockGetActiveTerms).toHaveBeenCalled();
            expect(mockShortenRevalidate).not.toHaveBeenCalled();
            expect(mockNotFound).not.toHaveBeenCalled();
            // 안내문 페이지가 아니라 JSON-LD + 본문 fragment를 낸다.
            const { container } = render(<>{element}</>);
            expect(
                container.querySelector('[role="status"]')
            ).not.toBeInTheDocument();
        }
    );

    it.each(ROUTES)(
        '$name: 활성 버전이 없으면 여전히 notFound()다',
        async ({ page }) => {
            mockGetActiveTerms.mockResolvedValue(null);

            await expect(page({ params: params() })).rejects.toThrow(
                'NEXT_NOT_FOUND'
            );
            expect(mockShortenRevalidate).not.toHaveBeenCalled();
        }
    );

    it.each(ROUTES)(
        '$name: generateMetadata가 색인 가능하다',
        async ({ metadata }) => {
            const result = await metadata({ params: params() });

            expect(result.robots).not.toEqual({ index: false, follow: true });
            expect(result.alternates?.canonical).not.toBeNull();
        }
    );
});
