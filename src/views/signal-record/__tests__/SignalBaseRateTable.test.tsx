const core = vi.hoisted(() => ({
    override: null as MeasuredSignalBaseRate | null | 'real',
}));
vi.mock('@y0ngha/siglens-core', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@y0ngha/siglens-core')>();
    return {
        ...actual,
        measuredSignalBaseRateFor: (type: string, timeframe: '1Day') =>
            core.override === 'real'
                ? actual.measuredSignalBaseRateFor(type, timeframe)
                : core.override,
    };
});
vi.mock('next-intl/server', async () => {
    const { createTranslator } = await import('next-intl');
    const { MESSAGE_CATALOGS } =
        await import('@/shared/test-utils/messageCatalogs');
    return {
        getTranslations: async ({
            locale,
            namespace,
        }: {
            locale: Locale;
            namespace: string;
        }) =>
            createTranslator({
                locale,
                messages: MESSAGE_CATALOGS[locale],
                namespace,
            } as never),
    };
});

import { render, screen, within } from '@testing-library/react';
import {
    MEASURED_SIGNAL_BASE_RATES,
    type MeasuredSignalBaseRate,
    type MeasuredSignalHorizon,
} from '@y0ngha/siglens-core';
import { createTranslator } from 'next-intl';
import type { ReactElement } from 'react';
import { SIGNAL_HUBS } from '@/entities/signal-history/lib/signalHubs';
import { LOCALES, type Locale } from '@/shared/i18n/locales';
import { formatKoreanDate } from '@/shared/lib/legal';
import { defined } from '@/shared/test-utils/defined';
import { MESSAGE_CATALOGS } from '@/shared/test-utils/messageCatalogs';
import { resolveAsyncServerTree } from '@/shared/test-utils/resolveAsyncServerTree';
import { SignalBaseRateTable } from '../SignalBaseRateTable';

const GOLDEN = MEASURED_SIGNAL_BASE_RATES.golden_cross;
const SHARE_PERCENT_RE = /\d+(\.\d+)?%/;
/** 수익률로 읽힐 말 — 이 블록에는 어떤 로케일에서도 나오면 안 된다. */
const RETURN_WORDING_RE =
    /수익|\+\s?\d|return|profit|gain|リターン|利益|收益|回报/i;

function symbolsOf(market: 'us' | 'kr'): number {
    return defined(
        GOLDEN.scope.markets.find(entry => entry.market === market),
        market
    ).symbols;
}

function translator(locale: Locale, namespace = 'views.signal-record') {
    return createTranslator({
        locale,
        messages: MESSAGE_CATALOGS[locale],
        namespace,
    } as never);
}

async function renderTable(
    signalType: Parameters<typeof SignalBaseRateTable>[0]['signalType'],
    locale: Locale = 'ko'
) {
    const tree = await SignalBaseRateTable({ signalType, locale });
    if (tree === null) return null;
    return render((await resolveAsyncServerTree(tree)) as ReactElement);
}

function recordWith(
    index: number,
    patch: Partial<MeasuredSignalHorizon>
): MeasuredSignalBaseRate {
    const horizons = GOLDEN.horizons.map((horizon, i) =>
        i === index ? { ...horizon, ...patch } : horizon
    ) as unknown as MeasuredSignalBaseRate['horizons'];
    return { ...GOLDEN, horizons };
}

describe('SignalBaseRateTable', () => {
    beforeEach(() => {
        core.override = 'real';
    });

    it('네 기간을 1·5·10·20 순서로 모두 그리고 숫자는 상수 필드 그대로다', async () => {
        await renderTable('golden_cross');
        const t = translator('ko');

        const items = within(screen.getByRole('list')).getAllByRole('listitem');
        expect(items).toHaveLength(4);
        GOLDEN.horizons.forEach((horizon, i) => {
            expect(items[i]).toHaveTextContent(
                t('eventRow', {
                    days: horizon.h,
                    event: `${(defined(horizon.eventShare) * 100).toFixed(1)}%`,
                    n: horizon.n,
                })
            );
            expect(items[i]).toHaveTextContent(
                t('placeboRow', {
                    placebo: `${(defined(horizon.placeboShare) * 100).toFixed(1)}%`,
                })
            );
        });
    });

    it('비율 크기와 상관없이 기간 순서를 지킨다(정렬·강조 없음)', async () => {
        core.override = {
            ...GOLDEN,
            horizons: GOLDEN.horizons.map((horizon, i) => ({
                ...horizon,
                eventShare: 0.4 + i * 0.05 * (i % 2 === 0 ? 1 : -1),
            })) as unknown as MeasuredSignalBaseRate['horizons'],
        };
        await renderTable('golden_cross');

        const items = within(screen.getByRole('list')).getAllByRole('listitem');
        expect(items.map(item => item.textContent)).toEqual(
            [1, 5, 10, 20].map(days =>
                expect.stringContaining(`${days}일 뒤 신호 방향으로`)
            )
        );
    });

    it('판정 no_edge는 고정 문장을 쓴다', async () => {
        await renderTable('golden_cross');

        expect(
            screen.getAllByText('임의 날짜보다 높다고 확인되지 않았어요.')
        ).toHaveLength(4);
        expect(screen.queryByText('임의 날짜보다 높았어요.')).toBeNull();
    });

    it('no_edge 문장은 임의 날짜보다 뚜렷이 낮은 행에도 거짓이 아니다(실제 52주 신저가 기록)', async () => {
        const record = MEASURED_SIGNAL_BASE_RATES.new_52w_low;
        const below = record.horizons.filter(
            horizon =>
                horizon.verdict === 'no_edge' &&
                defined(horizon.eventShare) <
                    defined(horizon.placeboShare) - 0.1
        );
        expect(below.length).toBeGreaterThan(0);

        await renderTable('new_52w_low');

        const items = within(screen.getByRole('list')).getAllByRole('listitem');
        const row = items[record.horizons.indexOf(below[0])];
        expect(row).toHaveTextContent(
            '임의 날짜보다 높다고 확인되지 않았어요.'
        );
        expect(row.textContent).not.toMatch(/차이가 없|같았|비슷/);
    });

    it('영어는 하루와 여러 날을 복수형으로 가른다', async () => {
        const t = translator('en');

        expect(t('horizonLabel', { days: 1 })).toBe('1 day later');
        expect(t('horizonLabel', { days: 5 })).toBe('5 days later');
        expect(t('eventRow', { days: 1, event: '48.4%', n: 5281 })).toMatch(
            /^1 day later,.* \(5,281 cases\)$/
        );
        expect(t('eventRow', { days: 5, event: '48.4%', n: 1 })).toMatch(
            /^5 days later,.* \(1 case\)$/
        );
    });

    it('표본 수는 기호 없이 사례 건수로 적는다', () => {
        expect(
            translator('ko')('eventRow', { days: 1, event: '48.4%', n: 5281 })
        ).toBe('1일 뒤 신호 방향으로 움직인 비율 48.4% (사례 5,281건)');
    });

    it('placebo 줄은 자기 기준(같은 종목의 임의 날짜에서 같은 방식으로 센 비율)을 적는다', async () => {
        await renderTable('golden_cross');

        expect(
            screen.getAllByText(
                /^같은 종목의 임의 날짜에서 같은 방식으로 센 비율 \d/
            )
        ).toHaveLength(4);
    });

    it('판정 beats_placebo는 고정 문장을 쓴다', async () => {
        core.override = recordWith(1, { verdict: 'beats_placebo' });
        await renderTable('golden_cross');

        expect(screen.getAllByText('임의 날짜보다 높았어요.')).toHaveLength(1);
        expect(
            screen.getAllByText('임의 날짜보다 높다고 확인되지 않았어요.')
        ).toHaveLength(3);
    });

    it('표본이 적은 기간은 비율 없이 고정 문장만 싣는다', async () => {
        core.override = recordWith(2, {
            verdict: 'insufficient_sample',
            eventShare: null,
            placeboShare: null,
            difference: null,
        });
        await renderTable('golden_cross');

        const items = within(screen.getByRole('list')).getAllByRole('listitem');
        expect(items).toHaveLength(4);
        expect(items[2]).toHaveTextContent('10일 뒤');
        expect(items[2]).toHaveTextContent('표본이 적어 비율을 싣지 않아요.');
        expect(items[2].textContent).not.toMatch(/\d\d?%|사례 \d/);
        expect(items[1].textContent).toMatch(SHARE_PERCENT_RE);
    });

    it('기간이 하나라도 빠진 기록이면 블록을 그리지 않는다', async () => {
        core.override = {
            ...GOLDEN,
            horizons: GOLDEN.horizons.slice(0, 3),
        } as unknown as MeasuredSignalBaseRate;

        expect(await renderTable('golden_cross')).toBeNull();
    });

    it('기록이 없는 신호는 블록을 그리지 않는다', async () => {
        core.override = null;

        expect(await renderTable('golden_cross')).toBeNull();
    });

    it('범위 문장은 상수의 종목 수와 기간에서 만든다', async () => {
        await renderTable('golden_cross');
        const t = translator('ko');

        const us = symbolsOf('us');
        const kr = symbolsOf('kr');
        expect(
            screen.getByText(
                t('scope', {
                    us,
                    kr,
                    from: formatKoreanDate(new Date(GOLDEN.scope.from), 'ko'),
                    to: formatKoreanDate(new Date(GOLDEN.scope.to), 'ko'),
                })
            )
        ).toBeInTheDocument();
        expect(screen.getByText(new RegExp(`미국 ${us}종목`))).toBeVisible();
    });

    it('과거 기록 고지를 같은 카드에 싣는다', async () => {
        await renderTable('golden_cross');

        const card = screen.getByRole('region');
        expect(
            within(card).getByText(
                '과거 기록이며 앞으로의 결과를 뜻하지 않아요.'
            )
        ).toBeInTheDocument();
    });

    it('상승 신호는 더 높았던 사례의 비율이라고 적는다', async () => {
        await renderTable('golden_cross');
        expect(
            screen.getByText(/종가가 더 높았던 사례의 비율/)
        ).toBeInTheDocument();
    });

    it('하락 신호는 더 낮았던 사례의 비율이라고 적는다', async () => {
        await renderTable('death_cross');

        expect(
            screen.getByText(/종가가 더 낮았던 사례의 비율/)
        ).toBeInTheDocument();
    });

    it('비율 칸 바깥에는 숫자 퍼센트가 없다', async () => {
        await renderTable('golden_cross');

        const card = screen.getByRole('region');
        const clone = card.cloneNode(true) as HTMLElement;
        clone
            .querySelectorAll('[data-record-share]')
            .forEach(el => el.remove());
        expect(clone.textContent).not.toContain('%');
    });
});

describe('모든 신호 페이지의 기록 블록 문구 가드', () => {
    beforeEach(() => {
        core.override = 'real';
    });

    const cases = SIGNAL_HUBS.flatMap(hub =>
        LOCALES.map(locale => ({ hub, locale }))
    );

    it.each(cases)(
        '$hub.slug / $locale: 퍼센트는 비율 칸에만 있고 수익률 표현이 없다',
        async ({ hub, locale }) => {
            const view = defined(
                await renderTable(hub.signalType, locale),
                'rendered record'
            );

            const card = defined(
                view.container.querySelector('section'),
                'record section'
            );
            expect(card.querySelectorAll('li')).toHaveLength(4);
            const clone = card.cloneNode(true) as HTMLElement;
            clone
                .querySelectorAll('[data-record-share]')
                .forEach(el => el.remove());
            expect(clone.textContent).not.toContain('%');
            expect(card.textContent).not.toMatch(RETURN_WORDING_RE);
        }
    );

    it('모든 신호 페이지에 기록이 있다(없는 허브가 조용히 빠지지 않는다)', () => {
        for (const hub of SIGNAL_HUBS) {
            expect(MEASURED_SIGNAL_BASE_RATES).toHaveProperty(hub.signalType);
        }
    });

    it.each(LOCALES)('%s 카탈로그 문구에 퍼센트 기호가 없다', locale => {
        const group = (
            MESSAGE_CATALOGS[locale] as unknown as {
                views: { 'signal-record': Record<string, string> };
            }
        ).views['signal-record'];

        for (const [key, text] of Object.entries(group)) {
            expect(text, key).not.toContain('%');
            expect(text, key).not.toMatch(RETURN_WORDING_RE);
        }
    });
});
