import { getSessionBarsStatic } from '@/entities/bars/lib/sessionBarsStaticCache';
import {
    buildTechnicalFacts,
    RECENT_BARS_WINDOW,
} from '@/entities/bars/lib/technicalFacts';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import {
    describeFloor,
    type PositionTranslator,
} from '@/widgets/portfolio-position/utils/positionBuildingNotes';
import {
    BAND_COUNT,
    computePosition,
} from '@/widgets/portfolio-position/utils/positionGeometry';
import { computeVolumeByBand } from '@/widgets/portfolio-position/utils/volumeByBand';

/** "내 위치" 탭이 SSR로 내리는 최근 가격 범위(공개 데이터만 — 평단·수익률은 클라 전용). */
export interface PriceRange {
    low52w: number;
    high52w: number;
    lastClose: number;
    /**
     * 가격대별 최근 거래량 비중(%), index 0 = 최저가 밴드. 집계할 수 없으면(전체 거래량 0 등) `null` —
     * `PositionBuilding`은 그 경우 층 hover를 생략한다.
     */
    volumeByBand: number[] | null;
}

/**
 * 최근 가격 범위를 서버에서 계산한다. 실패·봉 부족은 `null`로 흡수한다 — 클라의 `PositionTabContent`는
 * 값이 없어도 CTA·데이터 부족 안내로 폴백한다.
 *
 * 반드시 `getSessionBarsStatic`을 거친다:
 * 1. `getBarsAction`은 `cookies()`를 읽어 ISR cold-gen이 `DYNAMIC_SERVER_USAGE`로 500을 낸다.
 * 2. 6h 봉 캐시(`getQuantizedBarsStatic`)를 읽으면 Next가 이 라우트(12h 선언)를 6h로 clamp한다 —
 *    렌더 중 읽힌 `unstable_cache` revalidate의 최솟값이 라우트 revalidate가 된다. 세션 키 캐시는
 *    마지막 마감 세션 날짜를 키로 둬 24h로도 세션 롤마다 갱신된다(장중 형성 봉 제외 — ISR 결정성).
 *
 * 지표가 빈 축소판 봉이라 `buildTechnicalFacts`의 rsi·macd는 `null`이고, 이 탭은 그 둘을 읽지 않는다.
 * 거래량 집계는 52주 범위를 도출한 것과 같은 `RECENT_BARS_WINDOW` 창을 쓴다 — 창이 다르면 밴드 범위와
 * 집계 대상 봉의 시간창이 어긋난다.
 */
export async function resolvePriceRange(
    ticker: string,
    fmpSymbol: string | undefined,
    marketProfile: MarketProfileId
): Promise<PriceRange | null> {
    try {
        const sessionBars = await getSessionBarsStatic(
            ticker,
            marketProfile,
            fmpSymbol
        );
        const facts = buildTechnicalFacts(
            sessionBars.bars,
            sessionBars.indicators
        );
        if (facts === null) return null;
        return {
            low52w: facts.low52w,
            high52w: facts.high52w,
            lastClose: facts.lastClose,
            volumeByBand: computeVolumeByBand(
                sessionBars.bars.slice(-RECENT_BARS_WINDOW),
                facts.low52w,
                facts.high52w,
                BAND_COUNT
            ),
        };
    } catch (e) {
        console.error('[PositionPage] resolvePriceRange failed:', e);
        return null;
    }
}

/** 현재가가 52주 범위의 어느 쪽에 있는지 — `app.symbol.position.band.*` 문장 하나에 대응한다. */
export type RangeTone = 'nearHigh' | 'middle' | 'nearLow';

/**
 * 층 라벨과 **같은 밴드 경계**로 톤을 고른다. 퍼센타일 리터럴(70/30)을 쓰면 층 라벨의 20% 폭 밴드와
 * 경계가 어긋나 "4층 · 고층 … 중간 지점이에요"처럼 한 문장이 스스로를 부정한다.
 *
 * `describeFloorTier` 매핑(0 → 저층, 1~2 → 중층, 3 → 고층, 4 → 펜트하우스)을 따라 최하 밴드는 하단부,
 * 상위 두 밴드는 상단부, 나머지는 중간이다. 밴드 인덱스에서 파생하므로 `BAND_COUNT`가 바뀌어도 함께
 * 움직인다.
 *
 * @param currentPos 범위 안 위치(0~1). 반올림한 퍼센타일이 아니라 `describeFloor`와 같은 원본 값이다 —
 *   반올림을 거치면 경계에서 둘이 갈린다.
 */
export function rangeTone(currentPos: number): RangeTone {
    const band = Math.min(BAND_COUNT - 1, Math.floor(currentPos * BAND_COUNT));
    if (band >= BAND_COUNT - 2) return 'nearHigh';
    if (band === 0) return 'nearLow';
    return 'middle';
}

/** 톤별 문장 — 키를 리터럴로 둬 카탈로그 추출이 사용처를 본다. */
const RANGE_TONE_MESSAGE: Readonly<
    Record<RangeTone, (t: PositionTranslator) => string>
> = {
    nearHigh: t => t('nearHigh'),
    middle: t => t('middle'),
    nearLow: t => t('nearLow'),
};

/** 현재가의 범위 내 위치 요약 — 탭 본문의 가이드 문단이 렌더한다. */
export interface CurrentPricePosition {
    /** 0~100 정수 — 현재가가 [저점, 고점] 안에서 차지하는 위치(clamp됨). */
    percentile: number;
    /**
     * "N층 · 티어"(정상 범위) 또는 "옥상 위 …"/"지하 세대 …"(방어적 — 현재가는 52주 범위를 도출한 것과
     * 같은 봉에서 나와 이론상 벗어나지 않는다). `PositionBuilding`과 같은 어휘다.
     */
    floorLabel: string;
    /** 위치를 해석하는 한 문장(상단부·하단부·중간). */
    tone: string;
}

/**
 * 현재가가 52주 범위 안에서 몇 %·몇 층인지 계산한다. 회원 전용 `PositionBuilding`과 같은 어휘를 내도록
 * `computePosition`·`describeFloor`를 그대로 쓴다 — 둘이 갈라지면 같은 위치를 다른 말로 설명한다.
 *
 * `computePosition`은 회원 평단(`avg`)을 필수로 받지만 이 SSR 문단은 익명 방문자용이라 평단이 없다.
 * `avg` 자리에 현재가를 넣는다 — `avg`는 `<= 0`·non-finite 가드에만 쓰이고, 읽는 `currentPos`·
 * `currentClamped`는 `current`만으로 계산되므로 결과에 영향이 없다. 분모 0(`high52w <= low52w`) 같은
 * 퇴화 입력은 `computePosition`이 `null`로 막고, 그러면 호출부가 문단을 생략한다.
 *
 * @param tPos `widgets.portfolio-position.positionNote` 번역자(층 라벨).
 * @param tBand `app.symbol.position.band` 번역자(톤 문장).
 */
export function resolveCurrentPricePosition(
    range: PriceRange,
    tPos: PositionTranslator,
    tBand: PositionTranslator
): CurrentPricePosition | null {
    const model = computePosition({
        low52w: range.low52w,
        high52w: range.high52w,
        current: range.lastClose,
        avg: range.lastClose,
    });
    if (model === null) return null;
    return {
        percentile: Math.round(model.currentPos * 100),
        floorLabel: describeFloor(
            model.currentPos,
            model.currentClamped,
            BAND_COUNT,
            tPos
        ),
        tone: RANGE_TONE_MESSAGE[rangeTone(model.currentPos)](tBand),
    };
}
