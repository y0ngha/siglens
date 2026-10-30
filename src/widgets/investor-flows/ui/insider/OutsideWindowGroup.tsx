/**
 * 점수 창 밖 내부자 거래 묶음 — 제목(어느 쪽 밖인지)·"요약에 세지 않음" 안내·거래 목록.
 */
import { useTranslations } from 'next-intl';
import type { InsiderTransaction } from '@y0ngha/siglens-core';
import { TradeRecords } from './TradeRecords';

interface OutsideWindowGroupProps {
    readonly rows: readonly InsiderTransaction[];
    /** 묶음 제목 — 창 시작 전인지 끝난 뒤인지 날짜와 함께 밝힌다. 표 캡션으로도 쓴다. */
    readonly title: string;
}

/** 요약 카드의 건수·금액은 창 안 거래만 센 값이라, 창 밖 거래는 따로 보이고 그 사실을 안내한다. */
export function OutsideWindowGroup({ rows, title }: OutsideWindowGroupProps) {
    const t = useTranslations('widgets.investor-flows');
    return (
        <div className="mt-4">
            <h4 className="text-sm font-medium text-secondary-200">{title}</h4>
            <p className="mt-1 mb-2 text-xs text-secondary-400">
                {t('insider.outsideWindowNote')}
            </p>
            <TradeRecords rows={rows} caption={title} />
        </div>
    );
}
