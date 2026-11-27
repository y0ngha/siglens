import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { AbstractIntlMessages } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { AI_CLIENT_PATHS } from '@/app/ai/[locale]/_lib/aiClientPaths';
import type { ChatVisualBlock as ChatVisualBlockData } from '@/entities/chat-conversation/types';
import { pickMessages } from '@/shared/i18n/loadMessages';
import {
    COMPARE,
    DIVIDENDS,
    FINANCIALS,
    FLOWS_KR,
    FLOWS_US,
    HEATMAP_SECTORS,
    OPTIONS,
    PORTFOLIO,
} from '@/widgets/chart/__tests__/visual/fixtures';
import ko from '../../../../../../messages/ko.json';
import { ChatVisualBlock } from '../ChatVisualBlock';

// 비교 선 차트는 lightweight-charts(캔버스)를 쓴다 — 차트 자체는 CompareLineChart 테스트가 본다.
vi.mock('@/widgets/chart/visual/CompareLineChart', () => ({
    CompareLineChart: () => <div data-testid="compare-line-chart" />,
}));

/**
 * ai 호스트가 실제로 클라이언트로 보내는 메시지(`AI_CLIENT_PATHS`)만으로 렌더한다 — 재사용한 위젯이 읽는 키가 이
 * 목록에 빠지면 누락 오류가 쌓여 아래 테스트가 잡는다. (툴팁 문단은 배열이라 `AbstractIntlMessages`로 좁힌다.)
 */
const AI_MESSAGES = pickMessages(
    ko as unknown as AbstractIntlMessages,
    AI_CLIENT_PATHS
);

/** 렌더 중 next-intl이 보고하는 오류(누락 키 등)를 받는다. */
const onIntlError = vi.fn();

beforeEach(() => {
    onIntlError.mockClear();
});

function renderBlock(block: ChatVisualBlockData) {
    return render(
        <NextIntlClientProvider
            locale="ko"
            messages={AI_MESSAGES}
            onError={onIntlError}
        >
            <ChatVisualBlock block={block} />
        </NextIntlClientProvider>
    );
}

/** 이 블록의 틀(`<figure>`)들. */
const figures = () => screen.getAllByTestId('chat-visual-block');

/** 고정 높이 틀(`CHAT_CHART_FRAME_CLASS`)인지. */
const isFixedFrame = (figure: HTMLElement) =>
    figure.firstElementChild?.className.match(/\bh-72\b/) !== null;

describe('ChatVisualBlock — 시그렌즈 위젯 재사용', () => {
    it.each([
        ['실적', FINANCIALS],
        ['배당', DIVIDENDS],
        ['옵션', OPTIONS],
        ['수급(미국)', FLOWS_US],
        ['수급(한국)', FLOWS_KR],
        ['비교', COMPARE],
        ['히트맵', HEATMAP_SECTORS],
        ['보유종목', PORTFOLIO],
    ])(
        '%s: ai 호스트가 보내는 메시지만으로 키 누락 없이 그린다',
        (_name, block) => {
            renderBlock(block);
            expect(onIntlError).not.toHaveBeenCalled();
        }
    );

    it('실적: 펀더멘털 탭의 추세 차트·재무제표 표를 쓰고 EPS 예상·실제 행을 단다', () => {
        renderBlock(FINANCIALS);
        const [figure] = figures();
        expect(
            within(figure).getByRole('img', {
                name: /AAPL 최근 2분기 매출과 순이익 막대 차트/,
            })
        ).toBeInTheDocument();
        // 재무제표 표(StatementTable)의 스크롤 영역과 캡션.
        expect(
            within(figure).getByRole('region', {
                name: /AAPL 최근 2분기 실적.*좌우 스크롤 가능/,
            })
        ).toBeInTheDocument();
        const rowHeaders = within(figure)
            .getAllByRole('rowheader')
            .map(th => th.textContent);
        expect(rowHeaders).toEqual([
            '매출',
            '순이익',
            'EPS',
            'EPS 예상',
            'EPS 실제',
        ]);
        expect(
            within(figure)
                .getAllByRole('columnheader')
                .map(th => th.textContent)
        ).toEqual(expect.arrayContaining(['2026 Q1', '2026 Q2']));
        // 통화는 블록의 통화 — 주당 금액은 축약하지 않는다.
        expect(within(figure).getByText('US$1.30')).toBeInTheDocument();
        // 높이가 내용만큼이다(고정 높이 틀이 아니다).
        expect(figure.className).not.toMatch(/\bh-72\b/);
    });

    it('실적: 예상·실제 EPS가 모두 없으면 그 행을 달지 않는다', () => {
        renderBlock({
            ...FINANCIALS,
            quarters: FINANCIALS.quarters.map(q => ({
                ...q,
                epsActual: null,
                epsEstimated: null,
            })),
        });
        expect(
            screen.getAllByRole('rowheader').map(th => th.textContent)
        ).toEqual(['매출', '순이익', 'EPS']);
    });

    it('배당: 같은 추세 차트·표에 주당 배당 한 줄, 진행 중인 해는 열 이름에 "(진행 중)"', () => {
        renderBlock({ ...DIVIDENDS, name: '코카콜라' });
        const [figure] = figures();
        expect(
            within(figure).getByRole('img', {
                name: /코카콜라 연도별 주당 배당.*2026년 US\$1\.50\(진행 중\)/,
            })
        ).toBeInTheDocument();
        expect(
            within(figure)
                .getAllByRole('columnheader')
                .map(th => th.textContent)
        ).toEqual(expect.arrayContaining(['2025', '2026년 (진행 중)']));
        expect(
            within(figure)
                .getAllByRole('rowheader')
                .map(th => th.textContent)
        ).toEqual(['주당 배당']);
        expect(within(figure).getByText('US$2.00')).toBeInTheDocument();
    });

    it('옵션: 옵션 탭의 미결제약정 차트를 쓰고 맥스페인·풋콜 비율 줄을 단다', () => {
        renderBlock(OPTIONS);
        const [figure] = figures();
        expect(
            within(figure).getByRole('img', {
                name: 'Strike별 Open Interest 분포',
            })
        ).toBeInTheDocument();
        expect(
            within(figure).getByText('맥스페인 100, 풋콜 비율 0.85')
        ).toBeInTheDocument();
        // 차트가 이미 카드라 틀은 표면을 한 번 더 두르지 않는다(카드 안의 카드 금지).
        expect(figure.className).not.toMatch(/surface-raised/);
        expect(isFixedFrame(figure)).toBe(false);
    });

    it('옵션: 맥스페인을 모르면 줄표', () => {
        renderBlock({ ...OPTIONS, maxPain: null, putCallRatio: null });
        expect(screen.getByText('맥스페인 -, 풋콜 비율 -')).toBeInTheDocument();
    });

    it('수급(미국): 기관 분기는 수급 탭의 QuarterFlowChart, 진행 중 분기는 부분 집계로 표시', () => {
        renderBlock(FLOWS_US);
        const list = screen.getByRole('list', {
            name: '분기별 기관 순매수(IN)와 순매도(OUT)',
        });
        expect(within(list).getAllByRole('listitem')).toHaveLength(2);
        // fixture의 2026-06-30 분기만 complete: false다.
        expect(within(list).getAllByText('부분 집계')).toHaveLength(1);
        expect(within(list).getByText('IN')).toBeInTheDocument();
        expect(within(list).getByText('OUT')).toBeInTheDocument();
    });

    it('수급(미국): complete가 없는 옛 블록은 완결 분기로 그린다', () => {
        const legacy = {
            ...FLOWS_US,
            institutional: FLOWS_US.institutional.map(
                ({ period, holders, netShareChange }) =>
                    ({ period, holders, netShareChange }) as never
            ),
        };
        renderBlock(legacy);
        expect(screen.queryByText('부분 집계')).toBeNull();
        expect(screen.getAllByText('IN').length).toBeGreaterThan(0);
    });

    it('수급(미국): 내부자 월별은 새로 그린 고정 높이 틀에 따로 둔다', () => {
        renderBlock(FLOWS_US);
        const [, insider] = figures();
        expect(
            within(insider).getByRole('img', {
                name: /NVDA 내부자 월별 순매수 금액 막대 차트\. 최근 2개월 합계/,
            })
        ).toBeInTheDocument();
        expect(isFixedFrame(insider)).toBe(true);
    });

    it('수급(미국): 내부자 거래가 없으면 기관 카드만 그린다', () => {
        renderBlock({ ...FLOWS_US, insiderNetValue: [] });
        expect(figures()).toHaveLength(1);
    });

    it('수급(한국): 새로 그린 고정 높이 틀', () => {
        renderBlock(FLOWS_KR);
        const [figure] = figures();
        expect(
            within(figure).getByRole('img').getAttribute('aria-label')
        ).toMatch(/005930\.KS 외국인, 기관, 개인의 일별 순매수량/);
        expect(isFixedFrame(figure)).toBe(true);
    });

    it('비교: 새로 그린 선 차트가 고정 높이 틀 안에 든다', () => {
        renderBlock(COMPARE);
        expect(screen.getByTestId('compare-line-chart')).toBeInTheDocument();
        expect(isFixedFrame(figures()[0])).toBe(true);
    });

    it('히트맵·보유종목은 표 블록이라 고정 높이 틀이 아니다', () => {
        const { unmount } = renderBlock(HEATMAP_SECTORS);
        expect(isFixedFrame(figures()[0])).toBe(false);
        expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(0);
        unmount();
        renderBlock(PORTFOLIO);
        expect(isFixedFrame(figures()[0])).toBe(false);
    });
});
