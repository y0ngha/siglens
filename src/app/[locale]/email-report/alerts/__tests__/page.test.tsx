const loadView = vi.hoisted(() => vi.fn());
vi.mock('@/entities/mail-alert/server/loadMailAlertManageView', () => ({
    loadMailAlertManageView: loadView,
}));
const manageProps = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('@/features/mail-alert/ui/MailAlertManage', () => ({
    MailAlertManage: (props: unknown) => {
        manageProps.value = props;
        return <div data-testid="manage" />;
    },
}));
vi.mock('@/shared/lib/seo', () => ({ SITE_URL: 'https://siglens.io' }));
vi.mock('next-intl/server', async () => {
    const { catalogTranslator } =
        await import('@/shared/test-utils/catalogTranslator');
    return {
        setRequestLocale: vi.fn(),
        getTranslations: async (
            arg: string | { locale?: string; namespace?: string }
        ) =>
            typeof arg === 'string'
                ? catalogTranslator(arg, 'ko')
                : catalogTranslator(arg.namespace ?? '', arg.locale ?? 'ko'),
    };
});

import { screen } from '@testing-library/react';
import MailAlertsPage, {
    dynamic,
    generateMetadata,
} from '@/app/[locale]/email-report/alerts/page';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { resolveAsyncServerTree } from '@/shared/test-utils/resolveAsyncServerTree';
import type { ReactElement } from 'react';

const params = (locale: string) => Promise.resolve({ locale });
const search = (value: { s?: string; sig?: string } = {}) =>
    Promise.resolve(value);

async function renderPage(
    query: { s?: string; sig?: string } = {},
    locale = 'ko'
) {
    const tree = await MailAlertsPage({
        params: params(locale),
        searchParams: search(query),
    });
    return renderWithIntl((await resolveAsyncServerTree(tree)) as ReactElement);
}

beforeEach(() => {
    vi.clearAllMocks();
    manageProps.value = null;
});

describe('알림 메일 설정 페이지', () => {
    it('요청마다 렌더한다(개인 화면이라 ISR 대상이 아니다)', () => {
        expect(dynamic).toBe('force-dynamic');
    });

    it('메타데이터는 색인하지 않고 로케일별 canonical과 설명을 명시한다(AP-3)', async () => {
        const ko = await generateMetadata({ params: params('ko') });
        const en = await generateMetadata({ params: params('en') });

        expect(ko.title).toBe('알림 메일 설정');
        expect(ko.description).toEqual(expect.any(String));
        expect(ko.robots).toEqual({ index: false, follow: false });
        expect(ko.alternates?.canonical).toBe(
            'https://siglens.io/email-report/alerts'
        );
        expect(en.alternates?.canonical).toBe(
            'https://siglens.io/en/email-report/alerts'
        );
        expect(en.title).toBe('Alert email settings');
    });

    it('설정 링크의 s·sig를 읽어 서버 로더에 넘긴다', async () => {
        loadView.mockResolvedValue({ status: 'empty' });

        await renderPage({ s: 'sub-1', sig: 'abc' });

        expect(loadView).toHaveBeenCalledWith({ s: 'sub-1', sig: 'abc' });
    });

    it('링크가 없으면 undefined를 넘긴다', async () => {
        loadView.mockResolvedValue({ status: 'empty' });

        await renderPage();

        expect(loadView).toHaveBeenCalledWith(undefined);
    });

    it('목록 상태: 항목 이름을 서버에서 번역해 클라이언트 목록에 넘긴다', async () => {
        loadView.mockResolvedValue({
            status: 'ready',
            view: {
                maskedEmail: 'g***@example.com',
                topics: [
                    { kind: 'symbol', symbol: 'AAPL' },
                    { kind: 'signal', signalType: 'golden_cross' },
                    { kind: 'fear_greed', market: 'kr' },
                ],
                includePortfolio: true,
                priceAlerts: [],
                firedPriceAlerts: [],
            },
        });

        await renderPage({ s: 'sub-1', sig: 'abc' });

        expect(screen.getByTestId('manage')).toBeInTheDocument();
        expect(manageProps.value).toMatchObject({
            maskedEmail: 'g***@example.com',
            includePortfolio: true,
            link: { s: 'sub-1', sig: 'abc' },
            topics: [
                { label: 'AAPL 추세 변화와 주요 신호' },
                { label: '새로 잡힌 골든크로스 종목' },
                { label: '한국 공포 탐욕 지수 극단 구간 진입' },
            ],
        });
    });

    describe('가격대 알림', () => {
        const base = {
            id: 'alert-1',
            symbol: 'AAPL',
            market: 'us',
            condition: { kind: 'close_below', level: 180 },
            basis: 'price_level',
            analysisAt: null,
            referenceClose: 190.5,
            createdAt: new Date('2026-11-20T03:00:00Z'),
            expiresOn: '2026-12-20',
            status: 'active',
            firedSession: null,
            firedClose: null,
            firedAt: null,
        } as const;

        function show(
            priceAlerts: readonly unknown[],
            firedPriceAlerts: readonly unknown[] = []
        ) {
            loadView.mockResolvedValue({
                status: 'ready',
                view: {
                    maskedEmail: 'g***@example.com',
                    topics: [],
                    includePortfolio: null,
                    priceAlerts,
                    firedPriceAlerts,
                },
            });
        }

        it('조건 문장과 설명 줄(기준, 만든 날·그때 가격, 유지 기간)을 서버에서 번역해 넘긴다', async () => {
            show([
                base,
                {
                    ...base,
                    id: 'alert-2',
                    condition: { kind: 'close_above', level: 200 },
                    basis: 'analysis_invalidation',
                    analysisAt: new Date('2026-11-19T16:30:00Z'),
                },
                {
                    ...base,
                    id: 'alert-3',
                    symbol: '005930.KS',
                    market: 'kr',
                    condition: {
                        kind: 'enter_zone',
                        low: 70000,
                        high: 71500,
                        approach: 'from_above',
                    },
                    basis: 'analysis_entry_zone',
                    analysisAt: new Date('2026-11-19T16:30:00Z'),
                    referenceClose: 72500,
                },
            ]);

            await renderPage();

            expect(manageProps.value).toMatchObject({
                priceAlerts: [
                    {
                        id: 'alert-1',
                        label: 'AAPL 종가가 US$180.00 이하로 내려가면 메일로 알려 드려요.',
                        lines: [
                            '대화에서 정한 가격이에요.',
                            '만든 날 11월 20일, 그때 가격 US$190.50',
                            '12월 20일 종가까지 확인하고, 한 번 알리면 끝나요.',
                        ],
                    },
                    {
                        id: 'alert-2',
                        label: 'AAPL 종가가 US$200.00 이상으로 올라가면 메일로 알려 드려요.',
                        lines: [
                            '11월 20일 AI 분석의 무효화 기준이에요.',
                            expect.stringContaining('만든 날 11월 20일'),
                            expect.stringContaining('12월 20일 종가까지'),
                        ],
                    },
                    {
                        id: 'alert-3',
                        label: '005930 종가가 ₩70,000~₩71,500 구간에 들어오거나 지나치면 메일로 알려 드려요.',
                        lines: [
                            '11월 20일 AI 분석의 진입 구간이에요.',
                            '만든 날 11월 20일, 그때 가격 ₩72,500',
                            expect.stringContaining('12월 20일 종가까지'),
                        ],
                    },
                ],
            });
        });

        it('분석 기준인데 분석 시각이 없으면 날짜를 지어내지 않고 기준 줄을 뺀다', async () => {
            show([{ ...base, basis: 'analysis_entry_zone', analysisAt: null }]);

            await renderPage();

            const props = manageProps.value as {
                priceAlerts: { lines: string[] }[];
            };
            expect(props.priceAlerts[0]?.lines).toHaveLength(2);
            expect(props.priceAlerts[0]?.lines[0]).toContain('만든 날');
        });

        it('알린 알림은 조건을 충족한 종가 세션과 종가만 말한다(메일이 나갔다고 쓰지 않는다)', async () => {
            show(
                [],
                [
                    {
                        ...base,
                        id: 'fired-1',
                        symbol: 'NVDA',
                        status: 'fired',
                        firedSession: '2026-11-20',
                        firedClose: 120,
                        firedAt: new Date('2026-11-20T22:05:00Z'),
                    },
                ]
            );

            await renderPage();

            expect(manageProps.value).toMatchObject({
                priceAlerts: [],
                firedPriceAlerts: [
                    {
                        id: 'fired-1',
                        text: 'NVDA 종가가 11월 20일에 조건을 충족해 알림이 끝났어요. (종가 US$120.00)',
                    },
                ],
            });
        });

        it('알린 알림 문장과 항목 이름도 한국 종목의 거래소 접미사를 떼어 쓴다', async () => {
            loadView.mockResolvedValue({
                status: 'ready',
                view: {
                    maskedEmail: 'g***@example.com',
                    topics: [{ kind: 'symbol', symbol: '005930.KS' }],
                    includePortfolio: null,
                    priceAlerts: [],
                    firedPriceAlerts: [
                        {
                            ...base,
                            symbol: '005930.KS',
                            market: 'kr',
                            status: 'fired',
                            firedSession: '2026-11-20',
                            firedClose: 70000,
                            firedAt: new Date('2026-11-20T22:05:00Z'),
                        },
                    ],
                },
            });

            await renderPage();

            const props = manageProps.value as {
                topics: { label: string }[];
                firedPriceAlerts: { text: string }[];
            };
            expect(props.topics[0]?.label).toBe('005930 추세 변화와 주요 신호');
            expect(props.firedPriceAlerts[0]?.text).toContain('005930 종가가');
            expect(props.firedPriceAlerts[0]?.text).not.toContain('보냈');
            expect(props.firedPriceAlerts[0]?.text).not.toContain('.KS');
        });

        it('알린 시각이나 종가가 없는 알린 알림은 문장을 만들지 않는다', async () => {
            show(
                [],
                [{ ...base, status: 'fired', firedSession: '2026-11-20' }]
            );

            await renderPage();

            expect(manageProps.value).toMatchObject({ firedPriceAlerts: [] });
        });

        it('가격과 날짜 서식은 경로의 로케일을 따른다', async () => {
            show([base]);

            await renderPage({}, 'en');

            const props = manageProps.value as {
                priceAlerts: { label: string; lines: string[] }[];
            };
            expect(props.priceAlerts[0]?.label).toContain('$180.00');
            expect(props.priceAlerts[0]?.lines[1]).toContain('$190.50');
            expect(props.priceAlerts[0]?.lines[1]).toContain('November 20');
        });
    });

    it('알아보지 못하면 메일 속 링크로 열어 달라는 안내와 로그인 링크를 보인다', async () => {
        loadView.mockResolvedValue({ status: 'unidentified' });

        await renderPage();

        expect(
            screen.getByText('메일 속 링크로 열어 주세요')
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: '로그인하기' })
        ).toHaveAttribute('href', '/login');
        expect(screen.queryByTestId('manage')).not.toBeInTheDocument();
    });

    it('받는 항목이 없으면 빈 상태 문구다', async () => {
        loadView.mockResolvedValue({ status: 'empty' });

        await renderPage();

        expect(
            screen.getByText('받고 있는 알림 메일이 없어요.')
        ).toBeInTheDocument();
    });

    it('불러올 수 없으면(공개 전·테이블 없음) 안내 문구다', async () => {
        loadView.mockResolvedValue({ status: 'unavailable' });

        await renderPage();

        expect(
            screen.getByText(/지금은 설정을 불러올 수 없어요/)
        ).toBeInTheDocument();
    });

    it('제목과 섹션 이름이 같다(AX-1)', async () => {
        loadView.mockResolvedValue({ status: 'empty' });

        await renderPage();

        expect(
            screen.getByRole('heading', { level: 1, name: '알림 메일 설정' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('region', { name: '알림 메일 설정' })
        ).toBeInTheDocument();
    });
});
