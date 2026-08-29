/**
 * /economy page.tsx integration tests.
 *
 * EconomyContent는 async RSC이므로 @testing-library/react로 직접 렌더할 수 없다.
 * page.factlayer.test.tsx 패턴을 따라 비동기 컴포넌트를 직접 호출해 element 트리를
 * 검사하거나, 렌더 가능한 컴포넌트(EconomyDegraded)에 대해 render를 사용한다.
 *
 * Test 1: 빈 스냅샷이면 generateMetadata({ params: Promise.resolve({ locale: 'ko' }) }).robots === { index: false }
 * Test 2: 빈 스냅샷이면 EconomyContent가 EconomyDegraded를 반환
 * Test 3: peekMacroBriefingStatic이 throw해도 EconomyContent가 끝까지 렌더
 * Test 4: DATASET_JSON_LD에 license 필드가 존재한다(GSC Dataset license 경고 해소)
 */

// vi.mock은 호이스팅 — 모든 import 전에 위치해야 한다(vitest 모킹 규칙).
vi.mock('@/entities/economy/api/economySnapshotStaticCache', () => ({
    getEconomySnapshotStatic: vi.fn(),
}));
vi.mock('@/entities/economy/api/macroBriefingStaticCache', () => ({
    peekMacroBriefingStatic: vi.fn(),
}));
vi.mock('@/entities/economy', () => ({
    isEmptyEconomySnapshot: vi.fn(),
}));
// `buildFaqJsonLd`만은 **진짜를 쓴다**. 모의로 같은 매핑을 한 벌 더 적으면,
// 마크업과 화면이 한 소스에서 나오는지 보겠다는 이 테스트가 정작 실물이 아니라
// 자기 복제본을 검증하게 된다 — 이 PR이 없애고 있는 중복 그 자체다.
vi.mock('@/shared/lib/seo', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    clampSeoDescription: (s: string) => s,
    ROOT_KEYWORDS: [],
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
    SITE_BUILD_DATE: new Date('2026-01-01T00:00:00.000Z'),
}));
vi.mock('@/shared/lib/legal', () => ({
    TERMS_PATH: '/terms',
}));
vi.mock('@/shared/lib/og', () => ({
    OG_IMAGE_WIDTH: 1200,
    OG_IMAGE_HEIGHT: 630,
}));
// JsonLd를 스파이 가능한 컴포넌트로 교체해 EconomyPage가 전달하는 data를 캡처한다.
// 최상단 변수 참조는 호이스팅 때문에 불가 — vi.fn()을 factory 내부에서 직접 사용한다.
vi.mock('@/shared/ui/JsonLd', () => ({
    JsonLd: vi.fn().mockReturnValue(null),
}));
// widgets은 server-only 의존이 없으므로 실제 구현 사용.
// 단, MacroBriefing은 'use client' — mock으로 교체해 SSR 환경 충돌 방지.
vi.mock('@/widgets/economy', () => ({
    MacroBriefing: () => <div data-testid="macro-briefing" />,
    EconomicIndicatorGrid: () => <div data-testid="indicator-grid" />,
    EconomicCalendar: () => <div data-testid="calendar" />,
    EconomyMacroFacts: () => <p data-testid="macro-facts" />,
    EconomySkeleton: () => <div data-testid="economy-skeleton" />,
    TREASURY_CARD_META: { year2: {}, year10: {} },
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { EconomySnapshot } from '@y0ngha/siglens-core';
import { generateMetadata } from '@/app/[locale]/economy/page';
import { getEconomySnapshotStatic } from '@/entities/economy/api/economySnapshotStaticCache';
import { peekMacroBriefingStatic } from '@/entities/economy/api/macroBriefingStaticCache';
import { isEmptyEconomySnapshot } from '@/entities/economy';
// JsonLd는 vi.mocked()를 통해 test 내부에서 접근한다(최상단 변수는 호이스팅 충돌 방지).
import { JsonLd } from '@/shared/ui/JsonLd';
import { expectFaqSingleSource } from '@/__tests__/utils/expectFaqSingleSource';

const mockGetSnapshot = vi.mocked(getEconomySnapshotStatic);
const mockPeekStatic = vi.mocked(peekMacroBriefingStatic);
const mockIsEmpty = vi.mocked(isEmptyEconomySnapshot);

const EMPTY_SNAPSHOT: EconomySnapshot = {
    indicators: [],
    treasury: null,
    calendar: [],
};

const FULL_SNAPSHOT: EconomySnapshot = {
    indicators: [
        {
            name: 'federalFunds',
            latest: { date: '2026-05-01', value: 5.33 },
            previous: null,
            trend: [],
        },
    ],
    treasury: { date: '2026-06-15', year2: 4.07, year10: 4.47 },
    calendar: [],
};

describe('/economy page.tsx integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generateMetadata', () => {
        it('빈 스냅샷이면 metadata.robots === { index: false, follow: true } 이고 canonical이 null', async () => {
            mockGetSnapshot.mockResolvedValue(EMPTY_SNAPSHOT);
            mockIsEmpty.mockReturnValue(true);

            const meta = await generateMetadata({
                params: Promise.resolve({ locale: 'ko' }),
            });

            expect(meta.robots).toEqual({ index: false, follow: true });
            expect(meta.alternates?.canonical).toBeNull();
        });

        it('정상 스냅샷이면 metadata.robots가 index:true(명시)이고 canonical이 ECONOMY_URL', async () => {
            mockGetSnapshot.mockResolvedValue(FULL_SNAPSHOT);
            mockIsEmpty.mockReturnValue(false);

            const meta = await generateMetadata({
                params: Promise.resolve({ locale: 'ko' }),
            });

            expect(meta.robots).toEqual({ index: true, follow: true });
            expect(meta.alternates?.canonical).toBe(
                'https://siglens.io/economy'
            );
        });

        it('snapshot fetch가 throw하면 metadata는 noindex + canonical null (degraded 경로)', async () => {
            mockGetSnapshot.mockRejectedValue(new Error('redis timeout'));

            const consoleSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);

            const meta = await generateMetadata({
                params: Promise.resolve({ locale: 'ko' }),
            });

            expect(meta.robots).toEqual({ index: false, follow: true });
            expect(meta.alternates?.canonical).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                    '[economy.generateMetadata] snapshot failed:'
                ),
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });
    });

    describe('EconomyContent — degrade path', () => {
        it('빈 스냅샷이면 EconomyContent가 EconomyDegraded를 반환한다', async () => {
            mockGetSnapshot.mockResolvedValue(EMPTY_SNAPSHOT);
            mockIsEmpty.mockReturnValue(true);

            // EconomyContent는 직접 import해서 호출한다 (async RSC).
            // vitest 환경에서 named async function은 await로 직접 실행 가능.
            const { default: EconomyPage } =
                await import('@/app/[locale]/economy/page');

            // EconomyPage는 sync 컴포넌트, EconomyContent가 async RSC.
            // EconomyContent를 직접 꺼낼 수 없으므로, RTL로 EconomyPage를 렌더하되
            // Suspense children(EconomyContent) 결과를 React.act+await로 flush한다.
            // 단, 테스트 환경에서 async RSC는 완전 지원 안 됨 — EconomyDegraded의
            // 텍스트가 보이는지 assert함으로써 degrade 분기를 검증한다.
            const { act } = await import('@testing-library/react');
            await act(async () => {
                render(
                    await EconomyPage({
                        params: Promise.resolve({ locale: 'ko' }),
                    })
                );
            });

            // EconomyDegraded 안의 특징적 텍스트.
            expect(
                screen.getByText(/잠시 후 다시 시도해 주세요/)
            ).toBeInTheDocument();
        });

        it('getEconomySnapshotStatic이 throw하면 EconomyDegraded를 렌더한다 (빈 캐시 동결 방지)', async () => {
            // P0 incident path: snapshot loader throws (Redis timeout, FMP 5xx 등) →
            // .catch(() => null) → null 처리 → EconomyDegraded. throw가 전파되면
            // ISR 0-byte 빈 캐시가 동결된다.
            mockGetSnapshot.mockRejectedValue(new Error('redis timeout'));
            // isEmptyEconomySnapshot은 null 경로에서 호출되지 않아야 한다.
            mockIsEmpty.mockReturnValue(false);

            const consoleSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);

            const { default: EconomyPage } =
                await import('@/app/[locale]/economy/page');
            const { act } = await import('@testing-library/react');
            await act(async () => {
                render(
                    await EconomyPage({
                        params: Promise.resolve({ locale: 'ko' }),
                    })
                );
            });

            // EconomyDegraded가 렌더돼야 한다(non-empty page, not a throw).
            expect(
                screen.getByText(/잠시 후 다시 시도해 주세요/)
            ).toBeInTheDocument();

            // .catch() 가 console.error를 호출했어야 한다.
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[EconomyContent] snapshot failed:'),
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });
    });

    describe('EconomyContent — peek error resilience', () => {
        it('peekMacroBriefingStatic이 throw해도 grid·calendar가 렌더되고 console.error가 호출된다', async () => {
            mockGetSnapshot.mockResolvedValue(FULL_SNAPSHOT);
            mockIsEmpty.mockReturnValue(false);
            mockPeekStatic.mockRejectedValue(new Error('redis down'));

            const consoleSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);

            const { default: EconomyPage } =
                await import('@/app/[locale]/economy/page');
            const { act } = await import('@testing-library/react');
            await act(async () => {
                render(
                    await EconomyPage({
                        params: Promise.resolve({ locale: 'ko' }),
                    })
                );
            });

            // indicator-grid와 calendar는 peekSeed와 무관하게 렌더돼야 한다.
            expect(screen.getByTestId('indicator-grid')).toBeInTheDocument();
            expect(screen.getByTestId('calendar')).toBeInTheDocument();

            // console.error가 peek 실패를 로깅했어야 한다.
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('peekMacroBriefingStatic failed:'),
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });
    });

    describe('buildEconomyDatasetJsonLd — license field', () => {
        it('Dataset JSON-LD에 license 필드가 있다', async () => {
            const { buildEconomyDatasetJsonLd } =
                await import('@/app/[locale]/economy/page');

            // license는 t와 무관한 고정 필드 — description만 로케일에 따라 바뀐다.
            const datasetJsonLd = buildEconomyDatasetJsonLd(key => key, 'ko');

            // GSC "license 누락" 경고 해소 — backtesting 페이지와 동일한 SITE_URL+TERMS_PATH 형식.
            expect(datasetJsonLd.license).toBe('https://siglens.io/terms');
        });

        /**
         * Dataset/WebPage/Breadcrumb은 데이터가 있을 때만 나간다. 셸이 무조건
         * 내보내면 `generateMetadata`가 noindex를 건 렌더에서도 "이 URL은 1년치
         * 거시 지표 데이터셋"이라고 주장하게 된다. FAQ는 화면에 그대로 있으므로 예외.
         */
        it('셸에서는 FAQ 구조화데이터만 낸다', async () => {
            const mockJsonLdComponent = vi.mocked(JsonLd);
            mockJsonLdComponent.mockClear();

            const { default: EconomyPage } =
                await import('@/app/[locale]/economy/page');
            render(
                await EconomyPage({ params: Promise.resolve({ locale: 'ko' }) })
            );

            const types = mockJsonLdComponent.mock.calls.map(
                ([props]) =>
                    (props as { data: { '@type': string } }).data['@type']
            );
            expect(types).toContain('FAQPage');
            expect(types).not.toContain('Dataset');
        });
    });

    /**
     * 회귀 가드: FAQPage 마크업과 화면 Q&A는 배열 하나에서 나와야 한다. 이 라우트는
     * 오랫동안 마크업만 내보내고 화면에는 대응하는 Q&A가 없었다 — 구글은 대응하는
     * 내용이 페이지에 보일 것을 요구하며, 없으면 리치 결과 자격을 잃는다. JSON-LD가
     * 유효한지만 보는 테스트로는 이 결함이 잡히지 않는다. `/[symbol]/*` 9개 탭과
     * `/economy/kr`이 이미 쓰는 가드(`expectFaqSingleSource`)를 그대로 적용한다.
     */
    it('FAQPage 구조화데이터가 화면 FaqSection과 같은 질문·답변을 쓴다', async () => {
        const { default: EconomyPage } =
            await import('@/app/[locale]/economy/page');

        expectFaqSingleSource(
            await EconomyPage({ params: Promise.resolve({ locale: 'ko' }) })
        );
    });
});
