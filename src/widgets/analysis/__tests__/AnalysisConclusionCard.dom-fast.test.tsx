import { fireEvent, render, screen, within } from '@testing-library/react';
import type {
    ActionRecommendation,
    AnalysisResponse,
    ClusteredKeyLevel,
    ClusteredKeyLevels,
    PlanCheck,
} from '@y0ngha/siglens-core';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { AnalysisConclusionCard } from '@/widgets/analysis/sections/AnalysisConclusionCard';

function level(price: number): ClusteredKeyLevel {
    return { price, reason: 'r', count: 1, sources: [] };
}

const LEVELS: ClusteredKeyLevels = {
    support: [level(95), level(90)],
    resistance: [level(105), level(110)],
};
const NO_LEVELS: ClusteredKeyLevels = { support: [], resistance: [] };

function planCheck(belowStopLoss: boolean): PlanCheck {
    return {
        currentPrice: 100,
        entryZoneTop: null,
        exceedsEntryZone: false,
        belowStopLoss,
        riskRewardAtEntry: null,
        riskRewardAtCurrent: null,
    };
}

function analysisOf(
    trend: string | undefined,
    action?: Partial<ActionRecommendation>
): AnalysisResponse {
    return {
        trend,
        actionRecommendation: action === undefined ? undefined : { ...action },
    } as unknown as AnalysisResponse;
}

const BASE = {
    symbol: 'AAPL',
    status: 'ready' as const,
    keyLevels: LEVELS,
};

function row(label: string): HTMLElement {
    const term = screen.getByText(label).closest('dt');
    const wrapper = term?.parentElement;
    if (wrapper == null) throw new Error(`row not found: ${label}`);
    return wrapper;
}

describe('AnalysisConclusionCard', () => {
    describe('채워진 상태', () => {
        it('추세 헤드라인과 세 가격 행을 보여 준다', () => {
            render(
                <AnalysisConclusionCard
                    {...BASE}
                    analysis={analysisOf('bullish', { stopLoss: 88 })}
                />
            );

            expect(screen.getByText('강세')).toBeInTheDocument();
            expect(
                within(row('저항선')).getByText('105.00')
            ).toBeInTheDocument();
            expect(
                within(row('지지선')).getByText('95.00')
            ).toBeInTheDocument();
            expect(
                within(row('무효화 기준')).getByText('88.00')
            ).toBeInTheDocument();
        });

        it('저항·지지·무효화 가격에 각자의 색을 쓴다', () => {
            render(
                <AnalysisConclusionCard
                    {...BASE}
                    analysis={analysisOf('bullish', { stopLoss: 88 })}
                />
            );

            expect(within(row('저항선')).getByText('105.00')).toHaveClass(
                'text-ui-danger-text'
            );
            expect(within(row('지지선')).getByText('95.00')).toHaveClass(
                'text-ui-success-text'
            );
            expect(within(row('무효화 기준')).getByText('88.00')).toHaveClass(
                'text-secondary-100'
            );
        });

        it.each([
            ['bullish', '강세', 'text-ui-success-text'],
            ['bearish', '약세', 'text-ui-danger-text'],
            ['neutral', '보합', 'text-secondary-200'],
        ] as const)(
            '%s 헤드라인 색은 값에 붙는다',
            (trend, text, colorClass) => {
                render(
                    <AnalysisConclusionCard
                        {...BASE}
                        analysis={analysisOf(trend)}
                    />
                );
                expect(screen.getByText(text)).toHaveClass(colorClass);
                expect(screen.getByText('현재 추세')).toHaveClass(
                    'text-secondary-300'
                );
            }
        );

        it('접두어만 줄어들고 추세 값은 줄지 않는다(좁은 패널)', () => {
            render(
                <AnalysisConclusionCard
                    {...BASE}
                    analysis={analysisOf('bullish')}
                />
            );
            expect(screen.getByText('현재 추세')).toHaveClass(
                'min-w-0',
                'truncate'
            );
            expect(screen.getByText('강세')).toHaveClass('shrink-0');
            expect(
                document.querySelector('[data-conclusion-headline]')
            ).toHaveClass('h-7');
        });

        it.each([
            ['en', 'Current trend:', 'Bullish'],
            ['ja', '現在のトレンド：', '強気'],
            ['zh', '当前趋势：', '看涨'],
        ] as const)(
            '%s 헤드라인도 접두어와 값으로 나뉜다',
            (locale, prefix, value) => {
                renderWithIntl(
                    <AnalysisConclusionCard
                        {...BASE}
                        analysis={analysisOf('bullish')}
                    />,
                    { locale }
                );
                expect(screen.getByText(prefix)).toHaveClass('truncate');
                expect(screen.getByText(value)).toHaveClass('shrink-0');
            }
        );

        it('알 수 없는 추세는 "추세 정보 없음"을 그린다', () => {
            render(
                <AnalysisConclusionCard
                    {...BASE}
                    analysis={analysisOf('sideways')}
                />
            );
            expect(screen.getByText('추세 정보 없음')).toHaveClass(
                'text-secondary-300'
            );
            expect(screen.queryByText(/현재 추세/)).toBeNull();
        });

        it('한국 종목은 호가 단위로 맞춘 가격을 쓴다', () => {
            render(
                <AnalysisConclusionCard
                    {...BASE}
                    symbol="005930.KS"
                    krxTickTable="share"
                    keyLevels={{
                        support: [level(71234)],
                        resistance: [level(80456)],
                    }}
                    analysis={analysisOf('bullish', { stopLoss: 69987 })}
                />
            );

            expect(
                within(row('지지선')).getByText('71,200')
            ).toBeInTheDocument();
            expect(
                within(row('저항선')).getByText('80,500')
            ).toBeInTheDocument();
            expect(
                within(row('무효화 기준')).getByText('70,000')
            ).toBeInTheDocument();
        });

        it('영어 로케일은 영어 라벨을 쓴다', () => {
            renderWithIntl(
                <AnalysisConclusionCard
                    {...BASE}
                    analysis={analysisOf('bullish', { stopLoss: 88 })}
                />,
                { locale: 'en' }
            );
            expect(
                screen.getByRole('heading', { name: 'At a glance' })
            ).toBeInTheDocument();
            expect(screen.getByText('Resistance')).toBeInTheDocument();
            expect(screen.getByText('Invalidation level')).toBeInTheDocument();
        });
    });

    describe('분석 시각', () => {
        it('제목 줄 오른쪽에 패널 머리와 같은 형식으로 보인다', () => {
            render(
                <AnalysisConclusionCard
                    {...BASE}
                    analysis={{
                        ...analysisOf('bullish'),
                        analyzedAt: '2026-11-20T01:30:00.000Z',
                    }}
                />
            );
            const time = screen.getByText('2026-11-20 10:30');
            expect(time.tagName).toBe('TIME');
            // 스크린 리더는 맨 날짜 대신 "분석 시각 …"으로 읽는다. 화면에는 날짜만 보인다.
            expect(time).toHaveTextContent('분석 시각 2026-11-20 10:30');
            expect(within(time).getByText('분석 시각')).toHaveClass('sr-only');
            expect(time).toHaveAttribute(
                'dateTime',
                '2026-11-20T01:30:00.000Z'
            );
            expect(time.parentElement).toContainElement(
                screen.getByRole('heading', { level: 2 })
            );
        });

        it('시각이 없으면 아무것도 그리지 않고 제목 줄 높이는 같다', () => {
            const { container } = render(
                <AnalysisConclusionCard
                    {...BASE}
                    analysis={analysisOf('bullish')}
                />
            );
            expect(container.querySelector('time')).toBeNull();
            expect(container.querySelector('h2')?.parentElement).toHaveClass(
                'h-5'
            );
        });

        it('로딩 중에는 이전 시각이 있어도 그리지 않는다', () => {
            const { container } = render(
                <AnalysisConclusionCard
                    {...BASE}
                    status="pending"
                    analysis={{
                        ...analysisOf('bullish'),
                        analyzedAt: '2026-11-20T01:30:00.000Z',
                    }}
                />
            );
            expect(container.querySelector('time')).toBeNull();
        });
    });

    describe('행 상태', () => {
        it('손절이 없으면 무효화 기준은 없음이다', () => {
            render(
                <AnalysisConclusionCard
                    {...BASE}
                    analysis={analysisOf('bullish')}
                />
            );
            expect(within(row('무효화 기준')).getByText('없음')).toHaveClass(
                'text-secondary-400'
            );
            expect(within(row('저항선')).queryByText('없음')).toBeNull();
        });

        it('저항선만 비면 그 행만 없음이다', () => {
            render(
                <AnalysisConclusionCard
                    {...BASE}
                    keyLevels={{ support: [level(95)], resistance: [] }}
                    analysis={analysisOf('bullish', { stopLoss: 88 })}
                />
            );
            expect(within(row('저항선')).getByText('없음')).toBeInTheDocument();
            expect(
                within(row('지지선')).getByText('95.00')
            ).toBeInTheDocument();
        });

        it('지지선만 비면 그 행만 없음이다', () => {
            render(
                <AnalysisConclusionCard
                    {...BASE}
                    keyLevels={{ support: [], resistance: [level(105)] }}
                    analysis={analysisOf('bullish', { stopLoss: 88 })}
                />
            );
            expect(within(row('지지선')).getByText('없음')).toBeInTheDocument();
            expect(
                within(row('저항선')).getByText('105.00')
            ).toBeInTheDocument();
        });

        it('레벨이 전부 없으면 세 행이 모두 없음이다', () => {
            render(
                <AnalysisConclusionCard
                    {...BASE}
                    keyLevels={NO_LEVELS}
                    analysis={analysisOf('bearish')}
                />
            );
            expect(screen.getAllByText('없음')).toHaveLength(3);
        });

        it('비회원(전부 잠김)은 세 행이 회원 전용이고 가격이 새지 않는다', () => {
            render(
                <AnalysisConclusionCard
                    {...BASE}
                    lockedInfoDepth={['partial_detail', 'stoploss']}
                    analysis={analysisOf('bullish', { stopLoss: 88 })}
                />
            );
            expect(screen.getAllByText('회원 전용')).toHaveLength(3);
            expect(screen.getByText('강세')).toBeInTheDocument();
            expect(screen.queryByText('105.00')).toBeNull();
            expect(screen.queryByText('88.00')).toBeNull();
        });

        it('매매 전략만 잠기면 무효화 기준 행만 회원 전용이다', () => {
            render(
                <AnalysisConclusionCard
                    {...BASE}
                    lockedInfoDepth={['entry']}
                    analysis={analysisOf('bullish', { stopLoss: 88 })}
                />
            );
            expect(
                within(row('무효화 기준')).getByText('회원 전용')
            ).toBeInTheDocument();
            expect(
                within(row('저항선')).getByText('105.00')
            ).toBeInTheDocument();
        });

        it('오늘의 무료 공개로 잠금이 풀리면 같은 행에 가격이 채워진다', () => {
            const analysis = analysisOf('bullish', { stopLoss: 88 });
            const { rerender } = render(
                <AnalysisConclusionCard
                    {...BASE}
                    lockedInfoDepth={['partial_detail', 'stoploss']}
                    analysis={analysis}
                />
            );
            const before = row('저항선');
            expect(within(before).getByText('회원 전용')).toBeInTheDocument();

            rerender(
                <AnalysisConclusionCard
                    {...BASE}
                    lockedInfoDepth={[]}
                    analysis={analysis}
                />
            );

            expect(row('저항선')).toBe(before);
            expect(within(before).getByText('105.00')).toBeInTheDocument();
        });
    });

    describe('이미 내려감 배지', () => {
        it('손절이 보이고 계획이 무효면 같은 행에 배지를 붙인다', () => {
            render(
                <AnalysisConclusionCard
                    {...BASE}
                    analysis={analysisOf('bullish', {
                        stopLoss: 88,
                        planCheck: planCheck(true),
                    })}
                />
            );
            const invalidation = row('무효화 기준');
            expect(within(invalidation).getByText('88.00')).toBeInTheDocument();
            // 화면에는 짧은 배지, 스크린 리더에는 전체 뜻(분석 시점 종가 기준)을 읽는다.
            expect(within(invalidation).getByText('이탈')).toHaveAttribute(
                'aria-hidden',
                'true'
            );
            expect(
                within(invalidation).getByText(
                    '분석 시점의 종가가 이미 이 가격 아래였어요.'
                )
            ).toHaveClass('sr-only');
        });

        it('배지가 있으면 설명 툴팁에도 분석 시점 기준의 뜻이 실린다', () => {
            render(
                <AnalysisConclusionCard
                    {...BASE}
                    analysis={analysisOf('bullish', {
                        stopLoss: 88,
                        planCheck: planCheck(true),
                    })}
                />
            );
            fireEvent.click(
                screen.getByRole('button', { name: '무효화 기준 설명' })
            );
            const tooltip = screen.getByRole('tooltip', { hidden: true });
            expect(tooltip).toHaveTextContent(
                '이 분석이 전제한 흐름이 깨졌다고 보는 가격이에요.'
            );
            expect(tooltip).toHaveTextContent(
                '분석 시점의 종가가 이미 이 가격 아래였어요.'
            );
        });

        it('배지가 없으면 툴팁은 기본 설명만 싣는다', () => {
            render(
                <AnalysisConclusionCard
                    {...BASE}
                    analysis={analysisOf('bullish', { stopLoss: 88 })}
                />
            );
            fireEvent.click(
                screen.getByRole('button', { name: '무효화 기준 설명' })
            );
            expect(
                screen.getByRole('tooltip', { hidden: true })
            ).not.toHaveTextContent('종가가 이미');
        });

        it.each([
            ['ko', '이탈'],
            ['en', 'Broken'],
            ['ja', '割れ'],
            ['zh', '已跌破'],
        ] as const)('%s 배지는 짧은 단어다', (locale, text) => {
            renderWithIntl(
                <AnalysisConclusionCard
                    {...BASE}
                    analysis={analysisOf('bullish', {
                        stopLoss: 88,
                        planCheck: planCheck(true),
                    })}
                />,
                { locale }
            );
            expect(screen.getByText(text)).toBeInTheDocument();
            expect(text.length).toBeLessThanOrEqual(6);
        });

        it('좁은 폭에서 가격·배지는 줄지 않는다(원화 큰 가격)', () => {
            const { container } = render(
                <AnalysisConclusionCard
                    {...BASE}
                    symbol="005930.KS"
                    keyLevels={{ support: [level(1234567)], resistance: [] }}
                    analysis={analysisOf('bullish', {
                        stopLoss: 1234567,
                        planCheck: planCheck(true),
                    })}
                />
            );
            const invalidation = row('무효화 기준');
            expect(
                within(invalidation).getByText('1,235,000')
            ).toBeInTheDocument();
            expect(invalidation.querySelector('dd')).toHaveClass('shrink-0');
            expect(
                within(invalidation).getByText('이탈').parentElement
            ).toHaveClass('shrink-0');
            expect(container.querySelector('dt')).toHaveClass('min-w-0');
        });

        it('ⓘ 버튼은 줄지 않고 라벨만 줄어든다(가격 밑으로 들어가 눌리지 않는 것 방지)', () => {
            render(
                <AnalysisConclusionCard
                    {...BASE}
                    symbol="005930.KS"
                    analysis={analysisOf('bullish', {
                        stopLoss: 1234567,
                        planCheck: planCheck(true),
                    })}
                />
            );
            const invalidation = row('무효화 기준');
            expect(
                within(invalidation).getByRole('button', {
                    name: '무효화 기준 설명',
                })
            ).toHaveClass('shrink-0');
            const label = within(invalidation).getByText('무효화 기준');
            expect(label).toHaveClass('min-w-0', 'truncate');
            expect(label.className).not.toMatch(/min-w-\[/);
            expect(label.parentElement).toHaveClass('min-w-0');
        });

        it('무효가 아니면 배지가 없다', () => {
            render(
                <AnalysisConclusionCard
                    {...BASE}
                    analysis={analysisOf('bullish', {
                        stopLoss: 88,
                        planCheck: planCheck(false),
                    })}
                />
            );
            expect(screen.queryByText('이탈')).toBeNull();
            expect(screen.queryByText(/종가가 이미/)).toBeNull();
        });
    });

    describe('로딩(pending)', () => {
        it('라벨·면책 문장·진행 문구는 글자로, 값 세 칸만 자리표시줄로 그린다', () => {
            const { container } = render(
                <AnalysisConclusionCard
                    {...BASE}
                    status="pending"
                    analysis={analysisOf(undefined)}
                />
            );

            expect(screen.getByText('저항선')).toBeInTheDocument();
            expect(screen.getByText('지지선')).toBeInTheDocument();
            expect(screen.getByText('무효화 기준')).toBeInTheDocument();
            expect(screen.getByText(/예측이 아니에요/)).toBeInTheDocument();
            expect(screen.getByText('AI 분석 진행 중')).toBeInTheDocument();
            expect(screen.queryByText('회원 전용')).toBeNull();
            expect(screen.queryByText('없음')).toBeNull();
            expect(screen.queryByText(/현재 추세/)).toBeNull();
            expect(
                container.querySelectorAll('[aria-hidden="true"]')
            ).toHaveLength(3);
        });

        it('자리표시줄은 모션 감소 설정에서 멈춘다', () => {
            const { container } = render(
                <AnalysisConclusionCard
                    {...BASE}
                    status="pending"
                    analysis={analysisOf(undefined)}
                />
            );
            const bars = container.querySelectorAll('[aria-hidden="true"]');
            expect(bars.length).toBeGreaterThan(0);
            bars.forEach(bar => {
                expect(bar).toHaveClass(
                    'animate-pulse',
                    'motion-reduce:animate-none'
                );
            });
        });
    });

    describe('접근성과 구조', () => {
        it('제목 h2가 id로 영역 이름에 연결된다', () => {
            render(
                <AnalysisConclusionCard
                    {...BASE}
                    analysis={analysisOf('bullish')}
                />
            );
            const heading = screen.getByRole('heading', {
                level: 2,
                name: '한눈에 보기',
            });
            const region = screen.getByRole('region', { name: '한눈에 보기' });
            expect(region).toHaveAttribute('aria-labelledby', heading.id);
            expect(heading.id).not.toBe('');
        });

        it('두 사본이 같은 화면에 있어도 제목 id가 겹치지 않는다', () => {
            render(
                <>
                    <AnalysisConclusionCard
                        {...BASE}
                        analysis={analysisOf('bullish')}
                    />
                    <AnalysisConclusionCard
                        {...BASE}
                        analysis={analysisOf('bullish')}
                    />
                </>
            );
            const [first, second] = screen.getAllByRole('heading', {
                level: 2,
            });
            expect(first.id).not.toBe(second.id);
        });

        it('채워진 상태는 aria-busy가 거짓이다', () => {
            render(
                <AnalysisConclusionCard
                    {...BASE}
                    analysis={analysisOf('bullish')}
                />
            );
            expect(
                screen.getByRole('region', { name: '한눈에 보기' })
            ).toHaveAttribute('aria-busy', 'false');
        });

        it('로딩 중이면 aria-busy가 참이다', () => {
            render(
                <AnalysisConclusionCard
                    {...BASE}
                    status="pending"
                    analysis={analysisOf(undefined)}
                />
            );
            expect(
                screen.getByRole('region', { name: '한눈에 보기' })
            ).toHaveAttribute('aria-busy', 'true');
        });

        it('무효화 기준 설명 버튼 말고는 링크도 버튼도 없다', () => {
            render(
                <AnalysisConclusionCard
                    {...BASE}
                    lockedInfoDepth={['partial_detail', 'stoploss']}
                    analysis={analysisOf('bullish')}
                />
            );
            expect(screen.queryAllByRole('link')).toHaveLength(0);
            const buttons = screen.getAllByRole('button');
            expect(buttons).toHaveLength(1);
            expect(buttons[0]).toHaveAccessibleName('무효화 기준 설명');
        });

        it('행은 정의 목록이고 면책 문장은 어떤 상태에서도 있다', () => {
            const { container } = render(
                <AnalysisConclusionCard
                    {...BASE}
                    analysis={analysisOf('bullish')}
                />
            );
            expect(container.querySelectorAll('dl > div > dt')).toHaveLength(3);
            expect(container.querySelectorAll('dl > div > dd')).toHaveLength(3);
            expect(
                screen.getByText(
                    '분석 시점까지의 흐름을 정리한 내용이며, 예측이 아니에요.'
                )
            ).toBeInTheDocument();
        });

        it('모든 상태에서 행 높이 클래스가 같다', () => {
            const states = [
                { status: 'pending' as const, lockedInfoDepth: [] },
                {
                    status: 'ready' as const,
                    lockedInfoDepth: ['partial_detail', 'stoploss'] as const,
                },
                { status: 'ready' as const, lockedInfoDepth: [] },
            ];
            const classLists = states.map(state => {
                const { container, unmount } = render(
                    <AnalysisConclusionCard
                        {...BASE}
                        {...state}
                        analysis={analysisOf('bullish', { stopLoss: 88 })}
                    />
                );
                const classes = Array.from(
                    container.querySelectorAll('dl > div')
                ).map(el => el.className);
                const headline = container.querySelector(
                    '[data-conclusion-headline]'
                )?.className;
                unmount();
                return { classes, headline };
            });

            expect(classLists[0].classes).toEqual([
                'flex h-6 items-center justify-between gap-2',
                'flex h-6 items-center justify-between gap-2',
                'flex h-6 items-center justify-between gap-2',
            ]);
            expect(classLists[1]).toEqual(classLists[0]);
            expect(classLists[2]).toEqual(classLists[0]);
            expect(classLists[0].headline).toContain('h-7');
        });
    });
});
