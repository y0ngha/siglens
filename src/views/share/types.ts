/**
 * 공유 스냅샷 패널이 공통으로 받는 props 타입.
 *
 * `ShareKindPanel`(디스패처)과 `SHARE_KIND_PANEL_REGISTRY`(엔트리)가 같은 형태를 봐야
 * 디스패처의 캐스트가 안전하므로 한 곳에 둔다.
 */

import type { ShareableKind } from '@/shared/db/constants';
import type { SnapshotResultOf } from '@/entities/shared-analysis/types';
import type { AssetClass } from '@/shared/config/marketProfile/types';
import type { Bar, KrxTickTable } from '@y0ngha/siglens-core';

/** kind `K`의 공유 패널 하나가 받는 props. 서버 페이지가 스냅샷에서 직렬화해 넘긴다. */
export interface SharePanelProps<K extends ShareableKind> {
    /** 스냅샷에 저장된 그 탭의 분석 결과. */
    result: SnapshotResultOf<K>;
    /**
     * 스냅샷 시점 캔들 — `chart` kind에만 있다. 이 필드 이전 스냅샷에는 없으며,
     * 그때 차트 패널은 캔들 차트 없이 분석 패널만 그린다.
     */
    chartBars?: Bar[];
    /**
     * 스냅샷 컨텍스트의 자산 분류. `overall` 패널이 크립토에서 옵션·펀더멘털·재무
     * 섹션을 숨기는 데 쓴다.
     */
    assetClass?: AssetClass;
    /**
     * 스냅샷의 티커(예: "AAPL"). 차트 패널의 리포트 복사·aria-label과 `overall`
     * 패널의 옵션 탭 판정이 쓴다.
     */
    symbol?: string;
    /** 종목의 KRX 호가표(주식/ETF). 차트 패널의 가격 표기에 쓰인다. 생략하면 'share'. */
    krxTickTable?: KrxTickTable;
    /**
     * 스냅샷에 저장된 쉽게보기 산문. 공유 시점에 공유자 화면에 있던 값이다.
     * 없으면(이 필드 이전 스냅샷·평이화 실패) 토글 없이 원문만 렌더한다.
     */
    plain?: string;
}
