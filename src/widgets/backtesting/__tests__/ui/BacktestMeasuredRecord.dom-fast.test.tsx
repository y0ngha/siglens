import { render, screen, within } from '@testing-library/react';
import {
    CANDLE_BASE_RATES,
    CANDLE_OUTCOME_BARS,
    CANDLE_POOLED_BASE_RATE,
    PATTERN_BASE_RATES,
    PATTERN_POOLED_BASE_RATE,
    PRICE_LEVEL_BASE_RATE,
    PRICE_LEVEL_FAMILY_BASE_RATES,
    priceLevelFamilyBaseRateFor,
    type MeasuredBaseRate,
} from '@y0ngha/siglens-core';
import { formatShareAsPercent } from '@/shared/lib/patternBaseRate';
import { BacktestMeasuredRecord } from '../../BacktestMeasuredRecord';

const INSUFFICIENT = '표본이 적어 비율을 싣지 않아요.';

/** 표 칸이 적어야 할 문구. 표본 부족 행은 비율 대신 부족 문장만 적는다. */
const rowText = (
    rate: MeasuredBaseRate,
    versus: '거리' | '종목' = '거리'
): string =>
    rate.verdict === 'insufficient_sample'
        ? INSUFFICIENT
        : `${formatShareAsPercent(rate.eventShare)}% (${rate.n.toLocaleString('en-US')}건), 같은 ${versus === '거리' ? '거리의' : '종목의'} 다른 날 ${formatShareAsPercent(rate.placeboShare)}%`;

const NO_EDGE = '같은 거리의 다른 날 가격과 비교해 측정된 우위는 없어요.';
const BEATS =
    '같은 거리의 다른 날 가격보다 더 자주 닿았지만, 앞으로를 보장하지는 않아요.';
const CANDLE_NO_EDGE = '같은 종목의 다른 날과 비교해 측정된 우위는 없어요.';
const CANDLE_BEATS =
    '같은 종목의 다른 날보다 더 자주 맞았지만, 앞으로를 보장하지는 않아요.';

const POOLED_PATTERN = PATTERN_POOLED_BASE_RATE;
const POOLED_CANDLE = CANDLE_POOLED_BASE_RATE;

const tables = () => screen.getAllByRole('table');

describe('BacktestMeasuredRecord', () => {
    it('is the #record section with an h2 and three h3 blocks', () => {
        const { container } = render(<BacktestMeasuredRecord />);
        expect(container.querySelector('section#record')).not.toBeNull();
        expect(
            screen.getByRole('heading', {
                level: 2,
                name: '분석 기록과 측정 방법',
            })
        ).toBeInTheDocument();
        expect(
            screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
        ).toEqual(['차트 패턴', '캔들 패턴', '가격대']);
    });

    it('prints every number of the pattern table from the constants, in key order', () => {
        render(<BacktestMeasuredRecord />);
        const rows = within(tables()[0]).getAllByRole('row').slice(1);
        const own = Object.entries(PATTERN_BASE_RATES).filter(
            ([, rate]) => rate?.key !== 'pooled'
        );
        // 자기 행 + 합산 행 하나
        expect(rows).toHaveLength(own.length + 1);
        own.forEach(([, rate], index) => {
            expect(rate).toBeDefined();
            expect(rows[index]).toHaveTextContent(
                rowText(rate as MeasuredBaseRate)
            );
        });
        expect(rows[own.length]).toHaveTextContent(rowText(POOLED_PATTERN));
    });

    it('labels the pooled row as the whole pattern set and lists the families it stands in for', () => {
        render(<BacktestMeasuredRecord />);
        const pooledRow = within(tables()[0]).getAllByRole('row').at(-1);
        expect(pooledRow).toHaveTextContent('전체 패턴 합산');
        expect(pooledRow).toHaveTextContent('이 값은 표본이 적은 패턴(');
        expect(pooledRow).toHaveTextContent('상승쐐기');
        expect(pooledRow).toHaveTextContent('삼중천장');
    });

    it('names patterns with the same spelling as the analysis cards', () => {
        render(<BacktestMeasuredRecord />);
        const names = within(tables()[0])
            .getAllByRole('rowheader')
            .map(th => th.textContent ?? '');
        expect(names.some(name => name.startsWith('이중바닥'))).toBe(true);
        expect(names.some(name => name.startsWith('헤드앤숄더'))).toBe(true);
    });

    it('prints the pooled candle row from the constants', () => {
        render(<BacktestMeasuredRecord />);
        const rows = within(tables()[1]).getAllByRole('row').slice(1);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toHaveTextContent('방향이 있는 캔들 패턴 전체');
        expect(rows[0]).toHaveTextContent(rowText(POOLED_CANDLE, '종목'));
    });

    it('prints level families in key order and says so plainly when a family has no own row', () => {
        render(<BacktestMeasuredRecord />);
        const rows = within(tables()[2]).getAllByRole('row').slice(1);
        const families = Object.entries(PRICE_LEVEL_FAMILY_BASE_RATES);
        expect(rows).toHaveLength(families.length + 1);
        families.forEach(([, rate], index) => {
            if (rate.key === 'pooled') {
                expect(rows[index]).toHaveTextContent(
                    '표본이 적어 비율을 싣지 않아요.'
                );
                expect(rows[index]).not.toHaveTextContent(
                    formatShareAsPercent(rate.eventShare)
                );
            } else {
                expect(rows[index]).toHaveTextContent(rowText(rate));
            }
        });
        expect(rows.at(-1)).toHaveTextContent('모든 가격대 합산');
        expect(rows.at(-1)).toHaveTextContent(rowText(PRICE_LEVEL_BASE_RATE));
    });

    it('prints the scope of each table from its rows, not from a literal', () => {
        render(<BacktestMeasuredRecord />);
        const scopeOf = (rate: MeasuredBaseRate) =>
            `${rate.scope.symbols}종목의 일봉으로 ${rate.scope.from}부터 ${rate.scope.to}까지 쟀어요.`;
        const pattern = PATTERN_BASE_RATES.double_bottom as MeasuredBaseRate;
        const candle = POOLED_CANDLE;
        expect(screen.getByText(scopeOf(pattern))).toBeInTheDocument();
        expect(screen.getByText(scopeOf(candle))).toBeInTheDocument();
        expect(
            screen.getByText(scopeOf(PRICE_LEVEL_BASE_RATE))
        ).toBeInTheDocument();
    });

    it('measures every row of a table over the same scope', () => {
        const scopes = (rates: readonly (MeasuredBaseRate | undefined)[]) =>
            new Set(rates.map(rate => JSON.stringify(rate?.scope))).size;
        expect(
            scopes([...Object.values(PATTERN_BASE_RATES), POOLED_PATTERN])
        ).toBe(1);
        expect(
            scopes([...Object.values(CANDLE_BASE_RATES), POOLED_CANDLE])
        ).toBe(1);
        expect(
            scopes([
                ...Object.values(PRICE_LEVEL_FAMILY_BASE_RATES),
                PRICE_LEVEL_BASE_RATE,
            ])
        ).toBe(1);
    });

    it('prints each verdict sentence exactly as often as the constants produce it', () => {
        render(<BacktestMeasuredRecord />);
        const patternRates = [
            ...Object.values(PATTERN_BASE_RATES).filter(
                rate => rate?.key !== 'pooled'
            ),
            POOLED_PATTERN,
        ] as MeasuredBaseRate[];
        const levelRates = [
            ...Object.keys(PRICE_LEVEL_FAMILY_BASE_RATES).flatMap(id => {
                const rate = priceLevelFamilyBaseRateFor(id);
                return rate === null ? [] : [rate];
            }),
            PRICE_LEVEL_BASE_RATE,
        ];
        const distanceRates = [...patternRates, ...levelRates];
        const count = (rates: readonly MeasuredBaseRate[], verdict: string) =>
            rates.filter(rate => rate.verdict === verdict).length;

        expect(screen.queryAllByText(NO_EDGE)).toHaveLength(
            count(distanceRates, 'no_edge')
        );
        expect(screen.queryAllByText(BEATS)).toHaveLength(
            count(distanceRates, 'beats_placebo')
        );
        expect(screen.queryAllByText(CANDLE_NO_EDGE)).toHaveLength(
            count([POOLED_CANDLE], 'no_edge')
        );
        expect(screen.queryAllByText(CANDLE_BEATS)).toHaveLength(
            count([POOLED_CANDLE], 'beats_placebo')
        );
    });

    it('injects the candle horizon from the core constant into the copy', () => {
        render(<BacktestMeasuredRecord />);
        expect(
            screen.getByText(
                `캔들이 나타난 뒤 ${CANDLE_OUTCOME_BARS}거래일 동안 가격이 그 캔들이 가리키는 방향으로 움직인 비율이에요.`
            )
        ).toBeInTheDocument();
    });

    it('has no link, since signal records are not shipped here', () => {
        render(<BacktestMeasuredRecord />);
        expect(screen.queryByRole('link')).toBeNull();
    });

    it('keeps the copy free of returns: no % outside share cells, no profit wording', () => {
        const { container } = render(<BacktestMeasuredRecord />);
        const cells = Array.from(
            container.querySelectorAll('td, th[scope="row"]')
        );
        const outside = container.cloneNode(true) as HTMLElement;
        outside.querySelectorAll('td').forEach(td => td.remove());
        expect(outside.textContent).not.toContain('%');
        expect(container.textContent).not.toMatch(/수익|\+\d|연환산|이겼|줄였/);
        // 비율 칸의 % 는 모두 `{p}% ({n}건), 같은 거리의 다른 날 {q}%` 꼴이다.
        cells
            .filter(cell => cell.textContent?.includes('%'))
            .forEach(cell => {
                expect(cell.textContent).toMatch(
                    /^\d+\.\d% \([\d,]+건\), 같은 (거리의|종목의) 다른 날 \d+\.\d%$/
                );
            });
    });
});
