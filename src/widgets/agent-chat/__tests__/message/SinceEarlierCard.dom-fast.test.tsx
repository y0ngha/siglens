const { action } = vi.hoisted(() => ({ action: vi.fn() }));
vi.mock(
    '@/entities/chat-conversation/actions/getConversationChangesAction',
    () => ({ getConversationChangesAction: action })
);

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
    ChatSymbolChanges,
    ChatSymbolChangesResult,
} from '@/entities/chat-conversation/types';
import en from '../../../../../messages/en.json';
import ko from '../../../../../messages/ko.json';

import { SinceEarlierCard } from '@/widgets/agent-chat/message/SinceEarlierCard';

const CONVERSATION_ID = '11111111-1111-1111-1111-111111111111';

const changes = (over: Partial<ChatSymbolChanges> = {}): ChatSymbolChanges => ({
    status: 'changes',
    symbol: 'NVDA',
    marketProfile: 'us-equity',
    analyzedAt: '2026-11-18T14:00:00.000Z',
    analyzedDate: '2026-11-18',
    latestDate: '2026-11-25',
    closeThen: 100,
    closeNow: 94,
    items: [],
    hasLevels: true,
    trendMeasured: true,
    trendEmaPeriod: 20,
    unreadDays: 0,
    ...over,
});

function renderCard(
    results: ChatSymbolChangesResult[],
    props: Partial<React.ComponentProps<typeof SinceEarlierCard>> = {},
    locale: 'ko' | 'en' = 'ko'
) {
    action.mockResolvedValue(results);
    const onAsk = vi.fn();
    const onReveal = vi.fn();
    const view = render(
        <QueryClientProvider client={new QueryClient()}>
            <NextIntlClientProvider
                locale={locale}
                messages={locale === 'en' ? en : ko}
            >
                <SinceEarlierCard
                    conversationId={CONVERSATION_ID}
                    onAsk={onAsk}
                    onReveal={onReveal}
                    labels={{ NVDA: '엔비디아' }}
                    asking={false}
                    {...props}
                />
            </NextIntlClientProvider>
        </QueryClientProvider>
    );
    return { ...view, onAsk, onReveal };
}

describe('SinceEarlierCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('대화 id로 서버 액션을 한 번 부른다', async () => {
        renderCard([changes()]);
        await screen.findByRole('region');
        expect(action).toHaveBeenCalledTimes(1);
        expect(action).toHaveBeenCalledWith(CONVERSATION_ID);
    });

    it('낭독 영역은 결과가 오기 전부터 트리에 있고 비어 있다', () => {
        action.mockReturnValue(new Promise(() => {}));
        renderCard([]);
        const status = screen.getByRole('status');
        expect(status).toBeEmptyDOMElement();
        expect(status).toHaveClass('sr-only');
    });

    it('결과가 오면 같은 낭독 영역의 내용만 바뀐다(display:none이 아니다)', async () => {
        renderCard([changes()]);
        const status = screen.getByRole('status');
        await waitFor(() =>
            expect(status).toHaveTextContent(
                '분석 이후 달라진 점을 아래에 보여 드려요'
            )
        );
        expect(screen.getByRole('status')).toBe(status);
        expect(status.className).not.toMatch(/hidden/);
    });

    it('비교할 결과가 없으면 카드를 그리지 않고 자리도 차지하지 않는다', async () => {
        const { container, onReveal } = renderCard([]);
        await waitFor(() => expect(action).toHaveBeenCalled());
        expect(screen.queryByRole('region')).toBeNull();
        expect(
            container.querySelector('[data-testid="since-earlier"]')
        ).toBeNull();
        expect(screen.getByRole('status')).toBeEmptyDOMElement();
        expect(onReveal).not.toHaveBeenCalled();
    });

    it('제목은 종목 이름과 분석일, 가격 줄은 마지막 종가와 그 날짜·분석일 종가·부호 있는 변화를 말한다', async () => {
        renderCard([changes()]);
        expect(
            await screen.findByText('엔비디아 11월 18일 분석 이후 달라진 점')
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                '11월 25일 종가 $94.00, 분석일 종가 $100.00, 변화 -6.0%'
            )
        ).toBeInTheDocument();
    });

    it('이름을 아직 모르면 심볼로 쓴다', async () => {
        renderCard([changes({ symbol: 'AAPL' })]);
        expect(
            await screen.findByText('AAPL 11월 18일 분석 이후 달라진 점')
        ).toBeInTheDocument();
    });

    it('카드가 나타나면 onReveal을 한 번 부른다', async () => {
        const { onReveal } = renderCard([changes()]);
        await screen.findByRole('region');
        expect(onReveal).toHaveBeenCalledTimes(1);
    });

    describe('줄', () => {
        it('추세 변화는 라벨·날짜와 함께 판정 기준 줄을 보인다', async () => {
            renderCard([
                changes({
                    items: [
                        {
                            kind: 'trend',
                            from: 'neutral',
                            to: 'bullish',
                            date: '2026-11-25',
                        },
                    ],
                }),
            ]);
            expect(
                await screen.findByText(
                    '추세 판정이 보합에서 강세 상태로 바뀌었어요 (11월 25일 종가)'
                )
            ).toBeInTheDocument();
            expect(
                screen.getByText(
                    '판정 기준은 20일 EMA의 기울기와 종가 위치예요'
                )
            ).toBeInTheDocument();
        });

        it.each([
            [
                'support',
                'down',
                '그 분석의 지지선 $95.00 아래에서 마감했어요 (11월 21일, 종가 $94.00)',
            ],
            [
                'support',
                'up',
                '그 분석의 지지선 $95.00 위로 다시 올라와 마감했어요 (11월 21일, 종가 $94.00)',
            ],
            [
                'resistance',
                'up',
                '그 분석의 저항선 $95.00 위에서 마감했어요 (11월 21일, 종가 $94.00)',
            ],
            [
                'resistance',
                'down',
                '그 분석의 저항선 $95.00 아래로 다시 내려와 마감했어요 (11월 21일, 종가 $94.00)',
            ],
        ] as const)(
            '%s 가격대를 %s로 건넌 줄',
            async (side, direction, text) => {
                renderCard([
                    changes({
                        items: [
                            {
                                kind: 'level',
                                side,
                                direction,
                                price: 95,
                                close: 94,
                                date: '2026-11-21',
                            },
                        ],
                    }),
                ]);
                expect(await screen.findByText(text)).toBeInTheDocument();
            }
        );

        it.each([
            [
                'in_zone',
                '그 분석의 진입 구간 $98.00~$102.00 안에서 마감했어요 (11월 25일)',
            ],
            [
                'above_zone',
                '그 분석의 진입 구간 $98.00~$102.00 위에서 마감했어요 (11월 25일)',
            ],
            [
                'below_zone',
                '그 분석의 진입 구간 $98.00~$102.00 아래에서 마감했어요 (11월 25일)',
            ],
        ] as const)('계획 위치 %s', async (position, text) => {
            renderCard([
                changes({
                    items: [
                        {
                            kind: 'plan',
                            position,
                            zoneLow: 98,
                            zoneHigh: 102,
                            date: '2026-11-25',
                        },
                    ],
                }),
            ]);
            expect(await screen.findByText(text)).toBeInTheDocument();
        });

        it('무효화 기준 이하 마감과 계획 불성립을 각각 말한다', async () => {
            renderCard([
                changes({
                    items: [
                        { kind: 'plan_stopped', stop: 90, date: '2026-11-25' },
                        { kind: 'plan_no_setup', date: '2026-11-25' },
                    ],
                }),
            ]);
            expect(
                await screen.findByText(
                    '그 분석의 무효화 기준 $90.00 이하에서 마감했어요 (11월 25일)'
                )
            ).toBeInTheDocument();
            expect(
                screen.getByText(
                    '그 분석의 진입 계획은 11월 25일 종가 기준으로 더는 성립하지 않아요'
                )
            ).toBeInTheDocument();
        });

        it('신호는 이름과 일봉 날짜를 말한다', async () => {
            renderCard([
                changes({
                    items: [
                        {
                            kind: 'signal',
                            type: 'golden_cross',
                            date: '2026-11-24',
                        },
                    ],
                }),
            ]);
            expect(
                await screen.findByText('새 신호 골든크로스 (11월 24일 일봉)')
            ).toBeInTheDocument();
        });

        it('한국 종목은 원화 표기로 쓴다', async () => {
            renderCard([
                changes({
                    marketProfile: 'kr-equity',
                    closeThen: 72_000,
                    closeNow: 70_000,
                    items: [
                        {
                            kind: 'level',
                            side: 'support',
                            direction: 'down',
                            price: 71_000,
                            close: 70_500,
                            date: '2026-11-21',
                        },
                    ],
                }),
            ]);
            expect(
                await screen.findByText(
                    '그 분석의 지지선 ₩71,000 아래에서 마감했어요 (11월 21일, 종가 ₩70,500)'
                )
            ).toBeInTheDocument();
        });
    });

    describe('"달라진 점 없음"은 전부 읽었을 때만 말한다', () => {
        it('전부 읽었고 가격대가 있었으면 가격대 기준을 말한다', async () => {
            renderCard([changes()]);
            expect(
                await screen.findByText(
                    '그 뒤로 추세 판정, 새 신호, 분석 가격대 기준으로 달라진 점은 없어요 (11월 25일 종가)'
                )
            ).toBeInTheDocument();
        });

        it('가격대가 없던 분석은 가격대 기준이라고 말하지 않는다', async () => {
            renderCard([changes({ hasLevels: false })]);
            expect(
                await screen.findByText(
                    '그 뒤로 추세 판정과 새 신호 기준으로 달라진 점은 없어요 (11월 25일 종가)'
                )
            ).toBeInTheDocument();
            expect(screen.queryByText(/분석 가격대/)).toBeNull();
        });

        it('추세를 못 읽었으면 "없어요" 대신 비교하지 못했다고 말한다', async () => {
            renderCard([changes({ trendMeasured: false })]);
            expect(
                await screen.findByText(
                    '추세 판정은 데이터가 부족해 비교하지 못했어요'
                )
            ).toBeInTheDocument();
            expect(screen.queryByText(/달라진 점은 없어요/)).toBeNull();
        });

        it('신호·종가를 못 읽은 날이 있으면 그 수를 말하고 "없어요"를 말하지 않는다', async () => {
            renderCard([changes({ unreadDays: 3 })]);
            expect(
                await screen.findByText(
                    '신호나 종가를 확인하지 못한 거래일이 3일 있어요'
                )
            ).toBeInTheDocument();
            expect(screen.queryByText(/달라진 점은 없어요/)).toBeNull();
        });

        it('달라진 점이 있으면 "없어요"를 말하지 않는다', async () => {
            renderCard([
                changes({
                    items: [{ kind: 'plan_no_setup', date: '2026-11-25' }],
                }),
            ]);
            await screen.findByText(/더는 성립하지 않아요/);
            expect(screen.queryByText(/달라진 점은 없어요/)).toBeNull();
        });
    });

    describe('물어보기 버튼', () => {
        it('이름을 담은 접근성 이름을 갖고, 누르면 미리 채운 질문을 한 번만 보낸다', async () => {
            const { onAsk } = renderCard([changes()]);
            const button = await screen.findByRole('button', {
                name: '엔비디아 달라진 점 물어보기',
            });
            expect(button).toHaveTextContent('달라진 점 물어보기');
            fireEvent.click(button);
            fireEvent.click(button);
            expect(onAsk).toHaveBeenCalledTimes(1);
            expect(onAsk).toHaveBeenCalledWith(
                '엔비디아(NVDA) 11월 18일 분석 이후 달라진 점을 알려 줘'
            );
        });

        it('답변이 흐르는 중에는 보내지 않는다', async () => {
            const { onAsk } = renderCard([changes()], { asking: true });
            fireEvent.click(await screen.findByRole('button'));
            expect(onAsk).not.toHaveBeenCalled();
        });

        it('종목마다 따로 보낸다', async () => {
            const { onAsk } = renderCard([
                changes(),
                changes({ symbol: 'AAPL' }),
            ]);
            const buttons = await screen.findAllByRole('button');
            expect(buttons).toHaveLength(2);
            fireEvent.click(buttons[0]);
            fireEvent.click(buttons[1]);
            expect(onAsk).toHaveBeenCalledTimes(2);
        });
    });

    it('너무 오래된 분석은 비교 불가를 알리고 물어보기 버튼을 두지 않는다', async () => {
        renderCard([
            {
                status: 'too_old',
                symbol: 'NVDA',
                marketProfile: 'us-equity',
                analyzedAt: '2025-01-05T12:00:00.000Z',
                analyzedDate: '2025-01-05',
            },
        ]);
        expect(
            await screen.findByText(
                '분석한 지 오래돼 비교할 수 없어요. 새로 분석해 보세요.'
            )
        ).toBeInTheDocument();
        expect(
            await screen.findByText(
                '엔비디아 2025년 1월 5일 분석 이후 달라진 점'
            )
        ).toBeInTheDocument();
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('비교할 게 없는 종목(same_session)이 섞여 와도 카드를 그리지 않는다', async () => {
        renderCard([
            {
                status: 'same_session',
                symbol: 'AAPL',
                marketProfile: 'us-equity',
                analyzedAt: '2026-11-25T14:00:00.000Z',
                analyzedDate: '2026-11-25',
            },
        ]);
        await waitFor(() => expect(action).toHaveBeenCalled());
        expect(screen.queryByRole('region')).toBeNull();
    });

    it('영어 화면은 영어 문장과 영어 날짜로 그린다', async () => {
        renderCard(
            [
                changes({
                    items: [
                        {
                            kind: 'level',
                            side: 'support',
                            direction: 'down',
                            price: 95,
                            close: 94,
                            date: '2026-11-21',
                        },
                    ],
                }),
            ],
            {},
            'en'
        );
        expect(
            await screen.findByText(
                'Closed below the support at $95.00 from that analysis (November 21, close $94.00)'
            )
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', {
                name: 'Ask what changed for 엔비디아',
            })
        ).toBeInTheDocument();
    });

    it('낭독 영역은 role=status(polite)이고 카드 자체에는 라이브 속성이 없다', async () => {
        const { container } = renderCard([changes()]);
        await screen.findByRole('region');
        expect(screen.getByRole('status')).toHaveAttribute('role', 'status');
        expect(
            container.querySelector('[data-testid="since-earlier"]')
        ).not.toHaveAttribute('aria-live');
    });
});
