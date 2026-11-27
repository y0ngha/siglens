'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Timeframe } from '@y0ngha/siglens-core';
import type {
    ChatChartBlock,
    ChatChartTimeframe,
} from '@/entities/chat-conversation/types';
import { useThemeVersion } from '@/shared/hooks/useThemeVersion';
import { CHAT_CHART_FRAME_CLASS } from './ChatChartPlaceholder';
import { useChartRightOffset } from './hooks/useChartRightOffset';
import { useChatChartOverlayItems } from './hooks/useChatChartOverlayItems';
import { StockChart } from './StockChart';

/**
 * `StockChart`의 시간축 서식용 주기. 월봉은 core `Timeframe`에 없고(`AgentBarsTimeframe`은 `Timeframe`에 월봉을 더한
 * 집합), 시각이 날짜 단위라 일봉 서식으로 그린다. 주봉도 `Timeframe`이며 날짜 서식을 쓰므로 그대로 넘긴다.
 */
function displayTimeframe(timeframe: ChatChartTimeframe): Timeframe {
    return timeframe === '1Month' ? '1Day' : timeframe;
}

interface ChatChartProps {
    readonly block: ChatChartBlock;
}

/**
 * SIGLENS AI 답변 안의 차트 한 장 — 도구가 만든 차트 블록(`ChatChartBlock`)의 봉과 작도를 종목 페이지와 같은
 * `StockChart`로 그린다. 지표·거래량 패널과 보조지표 메뉴, 시간외 봉은 없고, 크로스헤어·확대·이동과 "차트 작도"
 * 메뉴(작도 켜고 끄기)만 남는다. 작도는 모두 켜진 채로 시작한다. 틀의 높이는 고정이라 차트가 내려오는 동안의 자리
 * (`ChatChartPlaceholder`)와 차트가 같은 크기다 — 차트 자체는 답변 본문 아래에 붙어(`AssistantMessage`) 읽던 글을 밀지 않는다.
 */
export function ChatChart({ block }: ChatChartProps) {
    // 테마가 바뀌면 차트를 다시 만든다 — 시리즈 색은 생성 시점 값이다(`chartThemeRemountGuard`).
    const themeVersion = useThemeVersion();
    const [hiddenKeys, setHiddenKeys] = useState<ReadonlySet<string>>(
        () => new Set()
    );
    const setVisible = useCallback(
        (keys: readonly string[], visible: boolean) =>
            setHiddenKeys(
                prev =>
                    new Set(
                        visible
                            ? [...prev].filter(key => !keys.includes(key))
                            : [...prev, ...keys]
                    )
            ),
        []
    );
    // 레벨선 제목(되돌림·지지/저항)이 마지막 캔들을 덮지 않게 오른쪽 여백을 비운다 — 종목 페이지와 같은 방식이다.
    const rightOffset = useChartRightOffset();
    const overlayItems = useChatChartOverlayItems(block);
    // 분석 카드와 같은 판정을 서버가 블록에 담았다 — 옛 블록은 필드가 없어 흐리게 하지 않는다.
    const referenceOnlyKeys = useMemo(
        () => new Set(block.referenceOnlyOverlayKeys ?? []),
        [block.referenceOnlyOverlayKeys]
    );
    return (
        <div data-testid="chat-chart" className={CHAT_CHART_FRAME_CLASS}>
            <StockChart
                key={themeVersion}
                bars={block.bars}
                timeframe={displayTimeframe(block.timeframe)}
                ticker={block.symbol}
                marketProfile={block.marketProfile}
                chartOverlays={block.overlays}
                overlayColors={block.overlayColors}
                overlayItems={overlayItems}
                referenceOnlyOverlayKeys={referenceOnlyKeys}
                hiddenOverlayKeys={hiddenKeys}
                onSetOverlayVisible={setVisible}
                onChartReady={rightOffset.onChartReady}
                onChartRemove={rightOffset.onChartRemove}
                onRightGutterChange={rightOffset.onRightGutterChange}
                showIndicatorMenu={false}
            />
        </div>
    );
}
