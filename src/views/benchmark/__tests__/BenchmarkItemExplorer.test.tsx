import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    BENCHMARK_DETAIL_FIXTURE,
    BENCHMARK_FIXTURE,
} from '@/entities/benchmark/__tests__/fixtures/benchmarkFixture';
import { createQueryClientWrapper } from '@/__tests__/utils/createQueryClientWrapper';
import { IntlTestProvider } from '@/shared/test-utils/intlRenderWrapper';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import ko from '../../../../messages/ko.json';
import { BenchmarkItemExplorer } from '../BenchmarkItemExplorer';

const e = ko.views.benchmark.explorer;
const LEVEL_NAMES = {
    L1: 'L1',
    L2: 'L2',
    L3: 'L3',
    L4: ko.views.benchmark.levels.L4,
    L5: ko.views.benchmark.levels.L5,
} as const;

// 구현 없는 fetch 스파이는 원본을 호출한다 — 기본값은 거부형이다.
const fetchStub = vi.fn<typeof fetch>(() =>
    Promise.reject(new Error('unexpected fetch'))
);

function detailResponse(): Response {
    return new Response(JSON.stringify(BENCHMARK_DETAIL_FIXTURE));
}

function renderExplorer() {
    const { wrapper: QueryWrapper } = createQueryClientWrapper();
    return renderWithIntl(
        <QueryWrapper>
            <BenchmarkItemExplorer
                round={BENCHMARK_FIXTURE.round}
                targets={BENCHMARK_FIXTURE.targets}
                items={BENCHMARK_FIXTURE.items}
                levelNames={LEVEL_NAMES}
            />
        </QueryWrapper>
    );
}

function questionButtons(): HTMLElement[] {
    return screen
        .queryAllByRole('button', { expanded: false })
        .concat(screen.queryAllByRole('button', { expanded: true }));
}

describe('BenchmarkItemExplorer', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', fetchStub);
    });

    afterEach(() => {
        fetchStub.mockClear();
        vi.unstubAllGlobals();
        window.history.replaceState(null, '', '/');
    });

    describe('server render', () => {
        it('renders every question and verdict without touching the URL', () => {
            window.history.replaceState(null, '', '/?lv=L2');
            const { wrapper: QueryWrapper } = createQueryClientWrapper();
            const html = renderToString(
                <IntlTestProvider>
                    <QueryWrapper>
                        <BenchmarkItemExplorer
                            round={BENCHMARK_FIXTURE.round}
                            targets={BENCHMARK_FIXTURE.targets}
                            items={BENCHMARK_FIXTURE.items}
                            levelNames={LEVEL_NAMES}
                        />
                    </QueryWrapper>
                </IntlTestProvider>
            );
            for (const item of BENCHMARK_FIXTURE.items) {
                expect(html).toContain(item.question);
            }
            expect(html).toContain('AlphaAI');
            expect(fetchStub).not.toHaveBeenCalled();
        });
    });

    describe('list', () => {
        it('shows all items and the total count first', () => {
            renderExplorer();
            expect(questionButtons()).toHaveLength(4);
            expect(screen.getByRole('status').textContent).toBe(
                '4개 표시 / 전체 4개'
            );
        });

        it('shows the ground-truth summary and a verdict per target', () => {
            renderExplorer();
            const first = screen
                .getByText(BENCHMARK_FIXTURE.items[0]!.question)
                .closest('li')!;
            expect(
                within(first).getByText(
                    BENCHMARK_FIXTURE.items[0]!.truthSummary
                )
            ).toBeTruthy();
            const chips = first.querySelectorAll('[data-verdict]');
            expect([...chips].map(c => c.getAttribute('data-verdict'))).toEqual(
                ['correct', 'incorrect', 'correct', 'not_attempted']
            );
        });

        it('does not request any detail until a row is expanded', () => {
            renderExplorer();
            expect(fetchStub).not.toHaveBeenCalled();
        });
    });

    describe('filters', () => {
        it('names the level options like the score tables do', () => {
            renderExplorer();
            const select = screen.getByLabelText(e.filter.level);
            expect(
                within(select).getByRole('option', {
                    name: ko.views.benchmark.levels.L5,
                })
            ).toBeTruthy();
        });

        it('narrows the list by level and writes it to the URL', async () => {
            const user = userEvent.setup();
            renderExplorer();
            await user.selectOptions(
                screen.getByLabelText(e.filter.level),
                'L2'
            );
            expect(questionButtons()).toHaveLength(1);
            expect(
                screen.getByText(BENCHMARK_FIXTURE.items[1]!.question)
            ).toBeTruthy();
            expect(window.location.search).toBe('?lv=L2');
            expect(screen.getByRole('status').textContent).toBe(
                '1개 표시 / 전체 4개'
            );
        });

        it('filters by target and verdict together', async () => {
            const user = userEvent.setup();
            renderExplorer();
            await user.selectOptions(
                screen.getByLabelText(e.filter.verdict),
                'incorrect'
            );
            await user.selectOptions(
                screen.getByLabelText(e.filter.target),
                'gpt'
            );
            expect(questionButtons()).toHaveLength(2);
            expect(window.location.search).toBe('?who=gpt&res=incorrect');
        });

        it('filters by target alone and shows only that target in each row', async () => {
            const user = userEvent.setup();
            renderExplorer();
            await user.selectOptions(
                screen.getByLabelText(e.filter.target),
                'gemini'
            );
            // q-003은 gemini 기록이 제외라 빠진다.
            expect(questionButtons()).toHaveLength(3);
            expect(window.location.search).toBe('?who=gemini');
            for (const list of screen.getAllByRole('list', {
                name: e.results,
            })) {
                expect(within(list).getAllByRole('listitem')).toHaveLength(1);
            }
        });

        it('keeps the target when the verdict is cleared', async () => {
            const user = userEvent.setup();
            renderExplorer();
            await user.selectOptions(
                screen.getByLabelText(e.filter.target),
                'gpt'
            );
            await user.selectOptions(
                screen.getByLabelText(e.filter.verdict),
                'incorrect'
            );
            await user.selectOptions(
                screen.getByLabelText(e.filter.verdict),
                'all'
            );
            expect(window.location.search).toBe('?who=gpt');
            expect(questionButtons()).toHaveLength(4);
        });

        it('applies a target-only URL and offers a reset for it', () => {
            window.history.replaceState(null, '', '/?who=gemini');
            renderExplorer();
            expect(questionButtons()).toHaveLength(3);
            expect(
                screen.getByRole('button', { name: e.filter.reset })
            ).toBeTruthy();
        });

        it('filters by market, type and pool', async () => {
            const user = userEvent.setup();
            renderExplorer();
            await user.selectOptions(
                screen.getByLabelText(e.filter.market),
                'kr'
            );
            await user.selectOptions(screen.getByLabelText(e.filter.pool), 'A');
            await user.selectOptions(
                screen.getByLabelText(e.filter.template),
                'honesty_probe'
            );
            expect(questionButtons()).toHaveLength(1);
            expect(
                screen.getByText(BENCHMARK_FIXTURE.items[3]!.question)
            ).toBeTruthy();
        });

        it('applies filters that are already in the URL', () => {
            window.history.replaceState(null, '', '/?mk=kr');
            renderExplorer();
            expect(questionButtons()).toHaveLength(2);
        });

        it('ignores URL values that are not in the data', () => {
            window.history.replaceState(null, '', '/?lv=L4&res=maybe');
            renderExplorer();
            expect(questionButtons()).toHaveLength(4);
        });

        it('shows the empty state when nothing matches', async () => {
            const user = userEvent.setup();
            renderExplorer();
            await user.selectOptions(
                screen.getByLabelText(e.filter.level),
                'L1'
            );
            await user.selectOptions(
                screen.getByLabelText(e.filter.market),
                'kr'
            );
            expect(screen.getByText(e.empty)).toBeTruthy();
            expect(questionButtons()).toHaveLength(0);
        });

        it('offers reset only while a filter is active and clears the URL', async () => {
            const user = userEvent.setup();
            renderExplorer();
            expect(
                screen.queryByRole('button', { name: e.filter.reset })
            ).toBeNull();
            await user.selectOptions(screen.getByLabelText(e.filter.pool), 'B');
            await user.click(
                screen.getByRole('button', { name: e.filter.reset })
            );
            expect(questionButtons()).toHaveLength(4);
            expect(window.location.search).toBe('');
        });
    });

    describe('expanding a row', () => {
        it('fetches the item file and shows answers, extracted values and judging', async () => {
            fetchStub.mockResolvedValueOnce(detailResponse());
            const user = userEvent.setup();
            renderExplorer();
            const button = screen.getByRole('button', {
                name: new RegExp(BENCHMARK_FIXTURE.items[0]!.question),
            });
            expect(button.getAttribute('aria-expanded')).toBe('false');
            await user.click(button);
            expect(button.getAttribute('aria-expanded')).toBe('true');
            expect(button.getAttribute('aria-controls')).toBe(
                'benchmark-item-q-001'
            );
            await screen.findByText('가상 종목 ZZZ의 종가는 12.34입니다.');
            expect(fetchStub).toHaveBeenCalledWith(
                '/benchmark/2099-01/items/q-001.json',
                expect.anything()
            );
            expect(screen.getByText('종가는 12.34입니다.')).toBeTruthy();
            expect(screen.getByText('약 13달러로 보입니다.')).toBeTruthy();
            expect(screen.getByText('허용 오차 밖')).toBeTruthy();
            expect(
                screen.getByText('근거를 밝히고 한계를 말했다')
            ).toBeTruthy();
            const judgements = within(
                screen.getByRole('list', { name: '중립 심사' })
            ).getAllByRole('listitem');
            expect(judgements).toHaveLength(2);
            expect(judgements[0]!.textContent).toContain('1회차');
            expect(judgements[1]!.textContent).toContain('2회차');
            expect(window.location.search).toBe('?open=q-001');
        });

        it('shows a loading status while the file is in flight', async () => {
            fetchStub.mockReturnValueOnce(new Promise(() => {}));
            const user = userEvent.setup();
            renderExplorer();
            await user.click(
                screen.getByRole('button', {
                    name: new RegExp(BENCHMARK_FIXTURE.items[0]!.question),
                })
            );
            expect(
                screen
                    .getAllByRole('status')
                    .some(
                        el =>
                            el.textContent ===
                            ko.views.benchmark.explorer.detail.loading
                    )
            ).toBe(true);
        });

        it('shows an error with a retry that recovers', async () => {
            fetchStub
                .mockResolvedValueOnce(new Response('nope', { status: 404 }))
                .mockResolvedValueOnce(detailResponse());
            const user = userEvent.setup();
            renderExplorer();
            await user.click(
                screen.getByRole('button', {
                    name: new RegExp(BENCHMARK_FIXTURE.items[0]!.question),
                })
            );
            const alert = await screen.findByRole('alert');
            expect(alert.textContent).toContain(e.detail.error);
            await user.click(
                within(alert).getByRole('button', { name: e.detail.retry })
            );
            await screen.findByText('종가는 12.34입니다.');
            expect(screen.queryByRole('alert')).toBeNull();
        });

        it('collapses on a second click and drops open from the URL', async () => {
            fetchStub.mockResolvedValueOnce(detailResponse());
            const user = userEvent.setup();
            renderExplorer();
            const button = screen.getByRole('button', {
                name: new RegExp(BENCHMARK_FIXTURE.items[0]!.question),
            });
            await user.click(button);
            await screen.findByText('종가는 12.34입니다.');
            await user.click(button);
            expect(button.getAttribute('aria-expanded')).toBe('false');
            expect(screen.queryByText('종가는 12.34입니다.')).toBeNull();
            expect(window.location.search).toBe('');
        });

        it('opens the row named in the URL on load', async () => {
            window.history.replaceState(null, '', '/?open=q-001');
            fetchStub.mockResolvedValueOnce(detailResponse());
            renderExplorer();
            await waitFor(() =>
                expect(fetchStub).toHaveBeenCalledWith(
                    '/benchmark/2099-01/items/q-001.json',
                    expect.anything()
                )
            );
            await screen.findByText('종가는 12.34입니다.');
        });

        it('keeps the open row when the list is filtered', async () => {
            fetchStub.mockResolvedValueOnce(detailResponse());
            const user = userEvent.setup();
            renderExplorer();
            await user.click(
                screen.getByRole('button', {
                    name: new RegExp(BENCHMARK_FIXTURE.items[0]!.question),
                })
            );
            await user.selectOptions(
                screen.getByLabelText(e.filter.market),
                'us'
            );
            expect(window.location.search).toBe('?mk=us&open=q-001');
        });
    });
});
