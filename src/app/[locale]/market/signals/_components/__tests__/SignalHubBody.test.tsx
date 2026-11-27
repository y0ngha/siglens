const intl = vi.hoisted(() => ({ locale: 'ko' }));
vi.mock('next-intl/server', async () => {
    const { catalogTranslator } =
        await import('@/shared/test-utils/catalogTranslator');
    return {
        getLocale: async () => intl.locale,
        getTranslations: async (
            arg: string | { locale?: string; namespace?: string }
        ) =>
            typeof arg === 'string'
                ? catalogTranslator(arg, intl.locale)
                : catalogTranslator(
                      arg.namespace ?? '',
                      arg.locale ?? intl.locale
                  ),
    };
});
const hubData = vi.hoisted(() => ({
    value: {
        rows: [] as unknown[],
        counts: { us: 0, kr: 0 },
        degraded: false,
    },
}));
vi.mock('../../_lib/loadSignalHub', () => ({
    loadSignalHub: vi.fn(async () => hubData.value),
}));
const catalog = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('@/entities/guide/api', () => ({
    loadGuideCatalog: vi.fn(async () => catalog.value),
}));
/** 표 내용은 `views/signal-record` 스위트가 본다. 여기서는 본문이 어느 신호로 부르는지만 본다. */
vi.mock('@/views/signal-record/SignalBaseRateTable', () => ({
    SignalBaseRateTable: ({
        signalType,
        locale,
    }: {
        signalType: string;
        locale: string;
    }) => (
        <section
            data-testid="signal-record"
            data-signal={signalType}
            data-locale={locale}
        />
    ),
}));
vi.mock('@/shared/ui/JsonLd', () => ({
    JsonLd: ({ data }: { data: Record<string, unknown> }) => (
        <script
            data-testid="json-ld"
            data-type={String(data['@type'])}
            data-items={
                Array.isArray(data.itemListElement)
                    ? data.itemListElement.length
                    : undefined
            }
        />
    ),
}));

import { screen, within } from '@testing-library/react';
import {
    CROSS_LOOKBACK_BARS,
    GOLDEN_CROSS_FAST_PERIOD,
    GOLDEN_CROSS_SLOW_PERIOD,
    SHORT_MA_CROSS_FAST_PERIOD,
    SHORT_MA_CROSS_SLOW_PERIOD,
} from '@y0ngha/siglens-core';
import type { ReactElement } from 'react';
import {
    findSignalHub,
    type SignalHub,
} from '@/entities/signal-history/lib/signalHubs';
import type { SignalEpisodeRow } from '@/entities/signal-history/types';
import { SIGNAL_SCAN_UNIVERSE_SIZE } from '@/shared/config/signalScanUniverse/signalScanUniverse';
import type { Locale } from '@/shared/i18n/locales';
import { defined } from '@/shared/test-utils/defined';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { resolveAsyncServerTree } from '@/shared/test-utils/resolveAsyncServerTree';
import ko from '../../../../../../../messages/ko.json';
import { SignalHubBody } from '../SignalHubBody';

const c = ko.app.market.signalHub;
const GOLDEN = findSignalHub('golden-cross')!;
const SIGNAL = ko.shared.enumLabel.signalType.golden_cross;

function row(
    symbol: string,
    market: 'us' | 'kr',
    sessionDate: string,
    extra: Partial<SignalEpisodeRow> = {}
): SignalEpisodeRow {
    return {
        market,
        symbol,
        koreanName: `${symbol}이름`,
        sessionDate,
        lastSeenSession: sessionDate,
        changePercent: 1.5,
        ...extra,
    };
}

const FIVE_ROWS: SignalEpisodeRow[] = [
    row('NVDA', 'us', '2026-11-13', { lastSeenSession: '2026-11-14' }),
    row('AAPL', 'us', '2026-11-13'),
    row('MSFT', 'us', '2026-11-10'),
    row('005930.KS', 'kr', '2026-11-12'),
    row('000660.KS', 'kr', '2026-11-11'),
];

/** 줄 수와 같은 전체 종목 수 — 상한으로 잘리지 않은 보통의 경우. */
function countsOf(list: readonly SignalEpisodeRow[]) {
    return {
        us: list.filter(r => r.market === 'us').length,
        kr: list.filter(r => r.market === 'kr').length,
    };
}

async function renderBody(locale: Locale = 'ko', hub: SignalHub = GOLDEN) {
    intl.locale = locale;
    const tree = await SignalHubBody({ hub, locale });
    return renderWithIntl(
        (await resolveAsyncServerTree(tree)) as ReactElement,
        {
            locale,
        }
    );
}

beforeEach(() => {
    hubData.value = {
        rows: FIVE_ROWS,
        counts: countsOf(FIVE_ROWS),
        degraded: false,
    };
    catalog.value = {
        entries: [
            {
                category: 'indicators',
                slug: 'ma',
                title: '이동평균선',
                summary: '일정 기간 종가의 평균을 이은 선이에요.',
            },
        ],
    };
});

/** 정의 문구 템플릿의 자리표시자를 판정에 쓰는 core 상수로 채운다. */
function fillDefinition(template: string): string {
    return template
        .replace('{bars}', String(CROSS_LOOKBACK_BARS))
        .replace('{fast}', String(GOLDEN_CROSS_FAST_PERIOD))
        .replace('{slow}', String(GOLDEN_CROSS_SLOW_PERIOD))
        .replace('{shortFast}', String(SHORT_MA_CROSS_FAST_PERIOD))
        .replace('{shortSlow}', String(SHORT_MA_CROSS_SLOW_PERIOD));
}

describe('SignalHubBody', () => {
    it('제목·소개에 신호 이름을 넣고, 시장 분석으로 가는 브레드크럼을 둔다', async () => {
        await renderBody();

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: c.title.replace('{signal}', SIGNAL),
            })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: c.breadcrumbMarket })
        ).toHaveAttribute('href', '/market');
    });

    it('소개 문구의 종목 수는 스캔 대상 수에서 온다', async () => {
        await renderBody();

        const intro = c.intro
            .replace('{signal}', SIGNAL)
            .replace('{usCount}', String(SIGNAL_SCAN_UNIVERSE_SIZE.us))
            .replace('{krCount}', String(SIGNAL_SCAN_UNIVERSE_SIZE.kr));
        expect(screen.getByText(intro)).toBeInTheDocument();
        expect(intro).not.toMatch(/약 \d+종목/);
    });

    it('골든크로스 페이지에만 50일선이 200일선을 넘은 종목이라는 정의를 붙인다', async () => {
        await renderBody();

        const definition = fillDefinition(c.definitionGoldenCross);
        expect(screen.getByText(definition)).toBeInTheDocument();
        expect(definition).toContain(
            `최근 ${CROSS_LOOKBACK_BARS}거래일 안에 ${GOLDEN_CROSS_FAST_PERIOD}일 이동평균선이 ${GOLDEN_CROSS_SLOW_PERIOD}일`
        );
        expect(definition).toContain(
            `${SHORT_MA_CROSS_FAST_PERIOD}일선과 ${SHORT_MA_CROSS_SLOW_PERIOD}일선의 교차는 단기 이동평균선`
        );
    });

    it('데드크로스 페이지는 위에서 아래로 내려간 종목이라는 정의를 붙인다', async () => {
        await renderBody('ko', defined(findSignalHub('death-cross')));

        const definition = fillDefinition(c.definitionDeathCross);
        expect(screen.getByText(definition)).toBeInTheDocument();
        expect(definition).toContain('위에서 아래로');
    });

    it('정의 키가 없는 신호 페이지에는 정의 문구가 없다', async () => {
        await renderBody('ko', defined(findSignalHub('rsi-oversold')));

        expect(screen.queryByText(/이동평균선을/)).toBeNull();
    });

    it('미국·한국으로 나눠 처음 포착 세션별로 묶고 종목 페이지로 링크한다', async () => {
        await renderBody();

        const us = screen.getByRole('region', { name: c.marketUs });
        expect(within(us).getAllByRole('heading', { level: 3 })).toHaveLength(
            2
        ); // 11-13, 11-10
        expect(
            within(us).getByRole('link', { name: 'NVDA이름' })
        ).toHaveAttribute('href', '/NVDA');
        const kr = screen.getByRole('region', { name: c.marketKr });
        expect(
            within(kr).getByRole('link', { name: '005930.KS이름' })
        ).toHaveAttribute('href', '/005930.KS');
    });

    it('이어진 에피소드에만 마지막 포착일을 붙인다', async () => {
        await renderBody();

        const nvda = screen
            .getByRole('link', { name: 'NVDA이름' })
            .closest('li')!;
        const aapl = screen
            .getByRole('link', { name: 'AAPL이름' })
            .closest('li')!;
        expect(within(nvda).getByText(/까지 이어짐/)).toBeInTheDocument();
        expect(within(aapl).queryByText(/까지 이어짐/)).toBeNull();
    });

    it('가이드 항목 요약을 싣고 가이드로 링크한다', async () => {
        await renderBody();

        expect(
            screen.getByText('일정 기간 종가의 평균을 이은 선이에요.')
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', {
                name: new RegExp(c.guideLink.replace('{title}', '이동평균선')),
            })
        ).toHaveAttribute('href', '/guide/indicators/ma');
    });

    it('색인 기준(5행) 이상이면 WebPage·Breadcrumb·ItemList 구조화데이터를 낸다', async () => {
        await renderBody();

        expect(
            screen.getAllByTestId('json-ld').map(node => node.dataset.type)
        ).toEqual(['WebPage', 'BreadcrumbList', 'ItemList']);
    });

    it('행이 모자라면 구조화데이터를 내지 않는다(메타데이터 noindex와 같은 판정)', async () => {
        hubData.value = {
            rows: FIVE_ROWS.slice(0, 4),
            counts: countsOf(FIVE_ROWS.slice(0, 4)),
            degraded: false,
        };

        await renderBody();

        expect(screen.queryAllByTestId('json-ld')).toHaveLength(0);
    });

    it('한 시장에 행이 없으면 그 시장은 빈 안내를 보인다', async () => {
        const usOnly = FIVE_ROWS.filter(r => r.market === 'us');
        hubData.value = {
            rows: usOnly,
            counts: countsOf(usOnly),
            degraded: false,
        };

        await renderBody();

        const kr = screen.getByRole('region', { name: c.marketKr });
        expect(within(kr).getByText(c.empty)).toBeInTheDocument();
    });

    it('기록을 못 읽으면(degraded) 목록 대신 안내를 보이고 구조화데이터도 내지 않는다', async () => {
        hubData.value = {
            rows: [],
            counts: { us: 0, kr: 0 },
            degraded: true,
        };

        await renderBody();

        expect(screen.getByText(c.degraded)).toBeInTheDocument();
        expect(screen.queryByRole('region', { name: c.marketUs })).toBeNull();
        expect(screen.queryAllByTestId('json-ld')).toHaveLength(0);
    });

    it('다른 신호 페이지로 가는 링크를 두고 자기 자신은 뺀다', async () => {
        await renderBody();

        const nav = screen.getByRole('navigation', { name: c.otherSignals });
        const hrefs = within(nav)
            .getAllByRole('link')
            .map(link => link.getAttribute('href'));
        expect(hrefs).toContain('/market/signals/death-cross');
        expect(hrefs).not.toContain('/market/signals/golden-cross');
    });

    it('ko가 아닌 로케일은 한글 이름 대신 티커를 쓴다', async () => {
        await renderBody('en');

        expect(screen.getByRole('link', { name: 'NVDA' })).toHaveAttribute(
            'href',
            '/en/NVDA'
        );
        expect(
            screen.getByRole('link', { name: '005930' })
        ).toBeInTheDocument();
    });
    it('상한으로 잘렸으면 전체 수와 보여 주는 수를 알리고, 그 시장에만 붙인다', async () => {
        hubData.value = {
            rows: FIVE_ROWS,
            counts: { us: 250, kr: 2 },
            degraded: false,
        };

        await renderBody();

        const us = screen.getByRole('region', { name: c.marketUs });
        expect(
            within(us).getByText(
                c.truncated.replace('{total}', '250').replace('{shown}', '3')
            )
        ).toBeInTheDocument();
        const kr = screen.getByRole('region', { name: c.marketKr });
        expect(within(kr).queryByText(/가장 최근에 잡힌/)).toBeNull();
    });

    it('잘리지 않았으면 안내 문구를 내지 않는다', async () => {
        await renderBody();

        expect(screen.queryByText(/가장 최근에 잡힌/)).toBeNull();
    });

    it('인기 목록 밖 종목 링크에만 nofollow를 붙인다', async () => {
        const longtail = row('ZZZZ', 'us', '2026-11-13');
        const rowsWithLongtail = [...FIVE_ROWS, longtail];
        hubData.value = {
            rows: rowsWithLongtail,
            counts: countsOf(rowsWithLongtail),
            degraded: false,
        };

        await renderBody();

        expect(screen.getByRole('link', { name: 'ZZZZ이름' })).toHaveAttribute(
            'rel',
            'nofollow'
        );
        expect(
            screen.getByRole('link', { name: 'NVDA이름' })
        ).not.toHaveAttribute('rel');
    });

    it('한국 종목도 따라갈 목록 밖이면 nofollow, 안이면 rel이 없다', async () => {
        const rowsWithKr = [...FIVE_ROWS, row('999999.KQ', 'kr', '2026-11-13')];
        hubData.value = {
            rows: rowsWithKr,
            counts: countsOf(rowsWithKr),
            degraded: false,
        };

        await renderBody();

        expect(
            screen.getByRole('link', { name: '999999.KQ이름' })
        ).toHaveAttribute('rel', 'nofollow');
        expect(
            screen.getByRole('link', { name: '005930.KS이름' })
        ).not.toHaveAttribute('rel');
    });

    it('ItemList 항목 수는 화면에 그린 줄 수와 같다(전체 종목 수가 아니다)', async () => {
        hubData.value = {
            rows: FIVE_ROWS,
            counts: { us: 250, kr: 2 },
            degraded: false,
        };

        await renderBody();

        const itemList = screen
            .getAllByTestId('json-ld')
            .find(node => node.dataset.type === 'ItemList');
        expect(itemList?.dataset.items).toBe(String(FIVE_ROWS.length));
    });

    it('이 허브의 신호로 과거 기록 표를 한 장 부른다', async () => {
        await renderBody('en');

        const record = screen.getByTestId('signal-record');
        expect(record).toHaveAttribute('data-signal', 'golden_cross');
        expect(record).toHaveAttribute('data-locale', 'en');
    });

    it('신호 기록을 못 읽어도(degraded) 합산 기록 표는 그대로 둔다', async () => {
        hubData.value = {
            rows: [],
            counts: { us: 0, kr: 0 },
            degraded: true,
        };

        await renderBody();

        expect(screen.getByTestId('signal-record')).toBeInTheDocument();
    });
});
