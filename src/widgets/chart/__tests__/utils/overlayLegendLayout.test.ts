import type { OverlayLegendItem } from '@/widgets/chart/types';
import type { OverlayGroup } from '@/widgets/chart/utils/overlayLegendFormat';
import {
    formatOverlayValue,
    groupOverlayItems,
} from '@/widgets/chart/utils/overlayLegendFormat';
import {
    ITEM_GAP_PX,
    LEGEND_ROW_HEIGHT_PX,
    legendItemWidthPx,
    legendMaxHeightPx,
    legendMaxRows,
    legendMaxWidthPx,
    MORE_CHIP_PX,
    packOverlayLegend,
} from '@/widgets/chart/utils/overlayLegendLayout';

/**
 * 감사가 실측한 실패 케이스를 그대로 재현한다: 500x813 뷰포트, 차트 246px,
 * 가격 pane 오버레이 전부 + 보조 pane 3개. 범례 bounding box는 266x492로
 * 가격 pane(86px)의 3.1배, 차트 전체의 108%였다.
 */
const MOBILE_CHART_WIDTH_PX = 246;

/** `usePricePaneStretch` 적용 후의 가격 pane 높이(전체의 50%). */
const MOBILE_PRICE_PANE_PX = 110;

function item(name: string, value: number | null = 311.54): OverlayLegendItem {
    return { name, color: '#ef4444', value };
}

/** 감사 스크린샷에 찍힌 33개 오버레이 전량. */
function auditItems(): OverlayLegendItem[] {
    return [
        'MA(5)',
        'MA(20)',
        'MA(60)',
        'MA(120)',
        'MA(200)',
        'EMA(20)',
        'EMA(60)',
        'BB Upper',
        'BB Middle',
        'BB Lower',
        'Tenkan',
        'Kijun',
        'Chikou',
        'Senkou A',
        'Senkou B',
        'POC',
        'VAH',
        'VAL',
        'KC Upper',
        'KC Middle',
        'KC Lower',
        'DC Upper',
        'DC Middle',
        'DC Lower',
        'Supertrend',
        'PSAR',
        'Chandelier',
    ].map(name => item(name));
}

function pack(
    groups: OverlayGroup[],
    { width, height }: { width: number; height: number }
) {
    return packOverlayLegend({
        groups,
        decimals: 2,
        maxWidthPx: legendMaxWidthPx(width),
        maxRows: legendMaxRows(height),
    });
}

describe('legendMaxRows', () => {
    it('재지 못한 높이는 제한 없음으로 본다', () => {
        // 0을 "높이 0"으로 읽으면 마운트 첫 프레임에 범례가 통째로 접힌다.
        expect(legendMaxRows(0)).toBe(Number.POSITIVE_INFINITY);
        expect(legendMaxRows(-1)).toBe(Number.POSITIVE_INFINITY);
    });

    it('모바일 가격 pane에서 몇 줄이 들어가는지', () => {
        // 범례는 pane의 65%까지만 쓴다 — 예전에는 pane 전체가 예산이라
        // 지표를 많이 켜면 범례가 자기 pane의 78.9%를 덮었다(감사 실측:
        // pane 175px에 범례 138px, 캔들이 보이는 구간 29px).
        // (110*0.65 - 16 인셋 - 8 패딩) / 17 = 2.68 → 2줄
        expect(legendMaxRows(MOBILE_PRICE_PANE_PX)).toBe(2);
    });

    /**
     * 상한이 실제로 물리는지 — 이 단언이 없으면 지분을 1.0으로 되돌려도
     * 나머지 케이스가 전부 통과한다.
     */
    it('범례는 가격 pane의 65%를 넘지 않는다', () => {
        // 계약은 `LEGEND_MAX_PANE_FRACTION`(0.65)이다. 지분을 1.0으로
        // 되돌리면 pane 175에서 0.78이 나와 이 단언이 깨진다 — 나머지
        // 케이스는 전부 통과하므로 이 검사가 없으면 조용히 회귀한다.
        for (const pane of [110, 175, 240, 354]) {
            const px = legendMaxRows(pane) * LEGEND_ROW_HEIGHT_PX;
            expect(px / pane, `pane=${pane}`).toBeLessThanOrEqual(0.65);
        }
    });

    it('아주 낮은 pane에서도 최소 한 줄은 남긴다', () => {
        // 0줄이면 `+33` 칩만 남아 같은 높이를 쓰면서 정보만 사라진다.
        expect(legendMaxRows(20)).toBe(1);
    });

    it('데스크톱 높이에서는 상한이 사실상 걸리지 않는다', () => {
        // 실제 범례 항목은 최대 14개이고 한 줄에 둘 이상 들어가므로,
        // 21줄이면 데스크톱에서 `+N` 칩이 생길 일이 없다.
        expect(legendMaxRows(600)).toBeGreaterThanOrEqual(20);
    });
});

describe('legendMaxWidthPx', () => {
    it('재지 못한 폭은 제한 없음으로 본다', () => {
        expect(legendMaxWidthPx(0)).toBe(Number.POSITIVE_INFINITY);
    });

    it('톱니바퀴 버튼과 가격 축 자리를 비워 둔다', () => {
        // 톱니바퀴는 right-14(56px)에 44px로 놓여 오른쪽 100px을 차지한다.
        const available = legendMaxWidthPx(MOBILE_CHART_WIDTH_PX);
        expect(available).toBeLessThanOrEqual(MOBILE_CHART_WIDTH_PX - 100 - 8);
    });

    it('폭이 예약분보다 좁아도 음수를 돌려주지 않는다', () => {
        expect(legendMaxWidthPx(50)).toBe(0);
    });
});

describe('legendMaxHeightPx', () => {
    it('재지 못했으면 인라인 스타일을 붙이지 않는다', () => {
        expect(legendMaxHeightPx(0)).toBeUndefined();
    });

    it('가격 pane에서 위아래 인셋을 뺀 값이다', () => {
        expect(legendMaxHeightPx(MOBILE_PRICE_PANE_PX)).toBe(
            MOBILE_PRICE_PANE_PX - 16
        );
    });
});

/**
 * **추정 오차의 방향을 붙든다.**
 *
 * `overlayLegendLayout` 헤더가 선언한 규약은 "크게 틀려라"다 — 크게 잡으면 여백이
 * 남고, 작게 잡으면 넘친 항목이 `overflow-hidden`에 잘리면서 `+N` 칩은 그 사실을
 * 모른 채 거짓말을 한다. 그런데 `CHAR_WIDTH_PX 7→4`, `MORE_CHIP_PX 44→0`,
 * `ITEM_GAP_PX 12→0`이 전부 초록이었다. 값이 아니라 **부등호**를 고정한다.
 *
 * 아래 상수는 렌더 결과의 실제 글리프 폭이지 모듈 상수의 복사본이 아니다.
 */
/** 11px 고정폭 글꼴(SFMono/Menlo)의 글자 전진폭 — 0.6em. */
const TRUE_CHAR_PX = 11 * 0.6;
/** `●`(U+25CF)는 고정폭 글꼴에 없어 대체 글꼴로 떨어지며 대략 1em을 쓴다. */
const TRUE_DOT_PX = 11;
/** `gap-x-3` = 0.75rem. */
const TRUE_ITEM_GAP_PX = 12;

/** `● NAME VALUE` — 점 + 공백 + 이름 + 공백 + 값. */
function trueItemWidthPx(name: string, value: string): number {
    return TRUE_DOT_PX + (2 + name.length + value.length) * TRUE_CHAR_PX;
}

describe('추정 폭은 실제 글리프 폭보다 작아지지 않는다', () => {
    it('항목 폭은 실제 렌더 폭 이상이다', () => {
        const cases: [string, number][] = [
            ['MA(120)', 281.9],
            ['BB Middle', 311.54],
            ['Supertrend', 311.54],
        ];

        for (const [name, value] of cases) {
            expect(
                legendItemWidthPx(item(name, value), 2)
            ).toBeGreaterThanOrEqual(
                trueItemWidthPx(name, formatOverlayValue(value, 2))
            );
        }
    });

    it('`+N` 칩 예약폭은 `+99` 칩과 그 앞 간격을 덮는다', () => {
        // 감사 케이스가 `+33`이었다 — 두 자리는 실제로 나온다.
        expect(MORE_CHIP_PX).toBeGreaterThanOrEqual(
            '+99'.length * TRUE_CHAR_PX + ITEM_GAP_PX
        );
    });

    it('항목 간격은 실제 `gap-x-3`보다 좁지 않다', () => {
        expect(ITEM_GAP_PX).toBeGreaterThanOrEqual(TRUE_ITEM_GAP_PX);
    });
});

describe('legendItemWidthPx', () => {
    it('이름과 값의 글자 수에 비례한다', () => {
        expect(legendItemWidthPx(item('MA(120)'), 2)).toBeGreaterThan(
            legendItemWidthPx(item('POC'), 2)
        );
    });

    it('소수 자릿수가 늘면 폭도 늘어난다 — 크립토가 잘려나가지 않게', () => {
        expect(legendItemWidthPx(item('MA(20)', 0.058158), 5)).toBeGreaterThan(
            legendItemWidthPx(item('MA(20)', 0.058158), 2)
        );
    });
});

describe('packOverlayLegend', () => {
    it('그룹마다 새 줄에서 시작한다', () => {
        const groups = groupOverlayItems([
            item('MA(5)'),
            item('MA(20)'),
            item('POC'),
        ]);

        const { rows } = pack(groups, { width: 0, height: 0 });

        expect(rows).toHaveLength(2);
        expect(rows[0].map(i => i.name)).toEqual(['MA(5)', 'MA(20)']);
        expect(rows[1].map(i => i.name)).toEqual(['POC']);
    });

    it('폭을 넘는 그룹은 여러 줄로 쪼갠다', () => {
        const groups = groupOverlayItems(auditItems().slice(0, 5));

        const wide = pack(groups, { width: 0, height: 0 });
        const narrow = pack(groups, {
            width: MOBILE_CHART_WIDTH_PX,
            height: 0,
        });

        expect(wide.rows).toHaveLength(1);
        expect(narrow.rows.length).toBeGreaterThan(1);
    });

    it('한 줄에 최소 한 항목은 넣는다 — 폭 0에서도 빈 줄이 없다', () => {
        const groups = groupOverlayItems(auditItems());

        const { rows } = pack(groups, { width: 50, height: 0 });

        expect(rows.every(row => row.length > 0)).toBe(true);
    });

    it('잘라낸 항목 수를 hiddenCount로 정확히 돌려준다', () => {
        const items = auditItems();
        const groups = groupOverlayItems(items);

        const { rows, hiddenCount } = pack(groups, {
            width: MOBILE_CHART_WIDTH_PX,
            height: MOBILE_PRICE_PANE_PX,
        });

        const shown = rows.reduce((n, row) => n + row.length, 0);
        // 아무것도 조용히 사라지지 않는다: 보인 것 + 접힌 것 = 전부.
        expect(shown + hiddenCount).toBe(items.length);
        expect(hiddenCount).toBeGreaterThan(0);
    });

    it('감사 케이스에서 범례가 가격 pane을 넘지 않는다', () => {
        const groups = groupOverlayItems(auditItems());

        const { rows } = pack(groups, {
            width: MOBILE_CHART_WIDTH_PX,
            height: MOBILE_PRICE_PANE_PX,
        });

        // 실측 492px → 가격 pane(110px)의 인셋 안쪽으로 들어와야 한다.
        const boxHeight = rows.length * LEGEND_ROW_HEIGHT_PX;
        expect(boxHeight).toBeLessThanOrEqual(MOBILE_PRICE_PANE_PX - 16);
    });

    it('가격 pane이 낮아질수록 줄 수가 단조 감소한다', () => {
        const groups = groupOverlayItems(auditItems());
        const heights = [400, 300, 200, 110, 60];

        const rowCounts = heights.map(
            height =>
                pack(groups, { width: MOBILE_CHART_WIDTH_PX, height }).rows
                    .length
        );

        for (let i = 1; i < rowCounts.length; i += 1) {
            expect(rowCounts[i]).toBeLessThanOrEqual(rowCounts[i - 1]);
        }
    });

    it('데스크톱에서는 전부 보여 준다 — 기존 배치를 줄이지 않는다', () => {
        const items = auditItems();
        const groups = groupOverlayItems(items);

        const { rows, hiddenCount } = pack(groups, {
            width: 1200,
            height: 600,
        });

        expect(hiddenCount).toBe(0);
        expect(rows.reduce((n, row) => n + row.length, 0)).toBe(items.length);
    });

    it('빈 입력은 빈 결과다', () => {
        expect(pack([], { width: 300, height: 100 })).toEqual({
            rows: [],
            hiddenCount: 0,
        });
    });
});
