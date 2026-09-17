/**
 * `/terms`·`/privacy`의 soft-404 회귀 가드.
 *
 * 예전에는 `findActive` 조회와 `notFound()`가 `<Suspense>` **안**(`TermsContent`)에
 * 있었다. 셸이 이미 스트리밍을 시작한 뒤라 Next가 응답을 200으로 확정해, 화면은
 * 404인데 상태 코드는 200인 soft-404가 나갔다(2026-09 구글 정책 감사 M7).
 * 지금은 페이지 컴포넌트가 Suspense 밖에서 던진다.
 *
 * 두 라우트를 한 파일에서 본다 — 같은 규칙이 형제 라우트 한쪽에만 적용되는
 * 표류가 이 프로젝트의 반복 결함이다(MISTAKES.md §6.7).
 */
const { mockGetActiveTerms, mockNotFound } = vi.hoisted(() => ({
    mockGetActiveTerms: vi.fn(),
    mockNotFound: vi.fn(() => {
        throw new Error('NEXT_NOT_FOUND');
    }),
}));

vi.mock('@/entities/terms/api', () => ({
    getActiveTerms: mockGetActiveTerms,
}));
vi.mock('next/navigation', () => ({ notFound: mockNotFound }));
vi.mock('next-intl/server', () => ({
    setRequestLocale: vi.fn(),
    getTranslations: vi.fn(async () => (key: string) => key),
}));

import type { Metadata } from 'next';
import TermsPage, {
    generateMetadata as termsMetadata,
} from '@/app/[locale]/terms/page';
import PrivacyPage, {
    generateMetadata as privacyMetadata,
} from '@/app/[locale]/privacy/page';

type PageComponent = (props: {
    params: Promise<{ locale: string }>;
}) => Promise<unknown>;

type MetadataFn = (props: {
    params: Promise<{ locale: string }>;
}) => Promise<Metadata>;

/** `Metadata['alternates']`는 `null`도 되므로 canonical 접근에 좁히기가 필요하다. */
function canonicalOf(metadata: Metadata): unknown {
    return metadata.alternates?.canonical;
}

const ROUTES: readonly {
    name: string;
    page: PageComponent;
    metadata: MetadataFn;
}[] = [
    { name: '/terms', page: TermsPage, metadata: termsMetadata },
    { name: '/privacy', page: PrivacyPage, metadata: privacyMetadata },
];

describe('legal 라우트의 활성 버전이 없을 때', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetActiveTerms.mockResolvedValue(null);
    });

    it.each(ROUTES)(
        '$name: 페이지가 Suspense 밖에서 notFound()를 던진다',
        async ({ page }) => {
            await expect(
                page({ params: Promise.resolve({ locale: 'ko' }) })
            ).rejects.toThrow('NEXT_NOT_FOUND');
            expect(mockNotFound).toHaveBeenCalled();
        }
    );

    it.each(ROUTES)(
        '$name: generateMetadata가 noindex + canonical 없음을 낸다',
        async ({ metadata }) => {
            const result = await metadata({
                params: Promise.resolve({ locale: 'ko' }),
            });
            expect(result.robots).toEqual({ index: false, follow: true });
            expect(canonicalOf(result)).toBeNull();
        }
    );
});

describe('legal 라우트의 활성 버전이 있을 때', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetActiveTerms.mockResolvedValue({
            id: 'row-1',
            kind: 'tos',
            version: 2,
            effectiveDate: new Date('2026-09-14T00:00:00.000Z'),
            body: '# 약관\n본문',
            bodyLocale: 'ko',
            isTranslationFallback: false,
        });
    });

    it.each(ROUTES)('$name: notFound()를 던지지 않는다', async ({ page }) => {
        await expect(
            page({ params: Promise.resolve({ locale: 'ko' }) })
        ).resolves.toBeDefined();
        expect(mockNotFound).not.toHaveBeenCalled();
    });

    it.each(ROUTES)(
        '$name: generateMetadata가 canonical을 비우지 않는다',
        async ({ metadata }) => {
            const result = await metadata({
                params: Promise.resolve({ locale: 'ko' }),
            });
            expect(result.robots).not.toEqual({ index: false, follow: true });
            expect(canonicalOf(result)).not.toBeNull();
        }
    );
});
