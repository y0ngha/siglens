'use client';

/**
 * 종목 페이지 차트 헤더의 프리·애프터마켓 한 줄 시세 캡션(위젯 진입점).
 */
import { useExtendedHoursLine } from '../hooks/useExtendedHoursLine';
import { ExtendedHoursDetailTip } from './quote-line/ExtendedHoursDetailTip';
import { ExtendedMoveText } from './quote-line/ExtendedMoveText';

interface ExtendedHoursQuoteLineProps {
    symbol: string;
}

/**
 * 미국 주식 프리마켓/애프터마켓 한 줄 시세 캡션. 확장 세션이 아니거나 값이 없으면 **아무것도
 * 그리지 않는다**(`null`) — E2E·키 없음·장애·휴장일이 모두 이 경로다.
 *
 * 테두리·배경 없는 **텍스트 캡션**이다 — 옆의 차트 헤더 글자(작도 메뉴 트리거)와 같은 `text-xs` 줄에
 * 놓이고(한글과 숫자가 섞인 줄이라 모노 대신 `tabular-nums`, DESIGN.md 문구 규약), 칩처럼 눈에 띄는 덩어리로 만들지 않는다. 보이는 줄은 세션 라벨 + 가격 + 등락(금액·%)뿐이다.
 * 등락 기준과 체결 시각은 줄에서 뺀 대신 ⓘ(`ExtendedHoursDetailTip`)에 담는다.
 *
 * 자리는 호출부(`ChartContent`의 `chartHeaderStartSlot` → `StockChart` 헤더 띠의 `flex-1 min-w-0` 칸)가 정한다. 띠가
 * 고정 높이(`h-8`)라 나타나도 제목 `h1`·차트 행이 움직이지 않고, 폭은 메뉴 셋의 실제 폭이 남긴 만큼이다.
 * 폭이 모자라면 글줄만 말줄임(`truncate`)하고 ⓘ는 `shrink-0`으로 남겨 잘리지 않게 하며, 래퍼(컨테이너 쿼리 기준)가 9rem보다 좁으면 통째로 숨긴다.
 *
 * 스크린리더에는 캡션 맨 앞 `sr-only` 기준 문구가 먼저 읽힌다.
 */
export function ExtendedHoursQuoteLine({
    symbol,
}: ExtendedHoursQuoteLineProps) {
    const line = useExtendedHoursLine(symbol);
    if (line === null) return null;

    return (
        <span
            data-testid="extended-hours-quote"
            className="hidden max-w-full items-center text-xs text-secondary-300 tabular-nums @min-[9rem]:flex"
        >
            {/* 글줄만 말줄임한다 — ⓘ는 `shrink-0` 형제라 좁은 폭(320px)에서도 잘리지 않는다. */}
            <span
                data-testid="extended-hours-text"
                className="min-w-0 truncate"
            >
                <span className="sr-only">{line.basisLabel}</span>
                <span className="text-secondary-400">
                    {line.sessionLabel}
                </span>{' '}
                <span className="text-secondary-100">{line.priceText}</span>{' '}
                <ExtendedMoveText move={line.move} moveLabel={line.moveLabel} />
            </span>
            <ExtendedHoursDetailTip
                basisLabel={line.basisLabel}
                tradedAtText={line.tradedAtText}
            />
        </span>
    );
}
