/**
 * 시장 요약 데이터를 가져오지 못했을 때 패널 상단에 띄우는 닫을 수 있는 경고 안내.
 */
import { useTranslations } from 'next-intl';
import type { DashboardScope } from '@/shared/config/dashboardScope';
import { cn } from '@/shared/lib/cn';
import { CloseIcon } from '@/shared/ui/StrokeIcons';

type NoticeVariant = 'partial' | 'total';

/** 실패 정도별 안내 문구 키. */
const NOTICE_KEY: Record<NoticeVariant, string> = {
    partial: 'MarketDataErrorNotice.partial',
    total: 'MarketDataErrorNotice.total',
};

/**
 * 시장별 이름 키. scope id 전체에 대해 빠짐없이 적어야 하므로 새 scope를 추가하면 여기서
 * 컴파일 오류가 난다 — 모르는 시장을 조용히 미국으로 안내하지 않는다.
 */
const MARKET_LABEL_KEY: Record<DashboardScope['id'], string> = {
    us: 'MarketDataErrorNotice.marketLabelUs',
    kr: 'MarketDataErrorNotice.marketLabelKr',
    crypto: 'MarketDataErrorNotice.marketLabelCrypto',
};

interface MarketDataErrorNoticeProps {
    /**
     * 어느 시장인가.
     *
     * 표시 문자열이 아니라 **id**를 받는다. `scope.marketLabel`은 core 프롬프트로 흘러가는
     * 한국어 상수라, 그대로 쓰면 영어 문장 한가운데 "미국 증시"가 박힌다. 시장 이름은 id로
     * 로케일 카탈로그에서 찾으므로 한국 화면이 미국 이야기를 하지 않는다.
     */
    scopeId: DashboardScope['id'];
    /**
     * 얼마나 실패했나.
     *
     * `'partial'`은 시세 일부만 빈 경우, `'total'`은 요약 자체가 없어 카드도 제목도 못
     * 그리는 경우다. 상태에 맞는 문구를 따로 써야 아무것도 못 불러온 화면이 "일부를 가져오지
     * 못했어요"라고 말하지 않는다.
     */
    variant: NoticeVariant;
    /** 'x' 클릭 시 호출 — 닫기 상태는 소비자(패널)가 소유한다. */
    onClose: () => void;
    className?: string;
}

/**
 * 시장 요약 데이터의 일부(또는 전부)를 가져오지 못했을 때 시장 페이지 상단에
 * 노출하는 안내. transient 장애(레이트리밋 등)라 새로고침으로 회복 가능하므로
 * 위험(`ui-danger`)이 아닌 경고(`ui-warning`) 톤을 쓴다. 닫기 가능하지만 닫음 상태는
 * 일시적이며(소비자의 useState), 새로고침/재조회 후에도 실패가 지속되면 다시 뜬다.
 */
export function MarketDataErrorNotice({
    scopeId,
    variant,
    onClose,
    className,
}: MarketDataErrorNoticeProps) {
    const t = useTranslations('widgets.dashboard');
    return (
        <div
            role="alert"
            className={cn(
                'border-ui-warning/30 bg-ui-warning/5 text-ui-warning-text flex items-start gap-2 rounded-lg border p-3 text-sm',
                className
            )}
        >
            <span aria-hidden>⚠</span>
            <div className="flex-1 space-y-0.5">
                <p>
                    {t(NOTICE_KEY[variant], {
                        v0: t(MARKET_LABEL_KEY[scopeId]),
                    })}
                </p>
                <p className="text-ui-warning-text/90">
                    {t('MarketDataErrorNotice.69afbd')}
                </p>
            </div>
            <button
                type="button"
                onClick={onClose}
                aria-label={t('MarketDataErrorNotice.76bb07')}
                className="-m-1 shrink-0 rounded p-1 leading-none text-ui-warning-text transition-colors hover:text-ui-warning-text focus-visible:ring-2 focus-visible:ring-ui-warning/50 focus-visible:outline-none"
            >
                <CloseIcon />
            </button>
        </div>
    );
}
