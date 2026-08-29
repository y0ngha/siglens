import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { StockWithConflict } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { SignalStockCard } from './SignalStockCard';

interface SignalSubsectionProps {
    /** 가격 앞에 붙일 통화 기호. 시장마다 다르다(`DashboardScope.currencySymbol`). */
    currencySymbol: string;
    /** 티커를 주 제목으로 쓸지(`DashboardScope.tickerIsReadable`). */
    tickerIsReadable: boolean;
    title: string;
    marker: string; // ▲ ▼ △ ▽ ◈
    variant: 'confirmed' | 'expected' | 'mixed';
    stocks: readonly StockWithConflict[];
    infoMessage?: ReactNode;
}

const VARIANT_BORDER: Record<SignalSubsectionProps['variant'], string> = {
    confirmed: 'border-t-2 border-secondary-600',
    mixed: 'border-t-2 border-secondary-500',
    expected: 'border-t border-dashed border-secondary-700',
};

const VARIANT_LABEL: Record<SignalSubsectionProps['variant'], string> = {
    confirmed: 'opacity-100 font-semibold',
    mixed: 'opacity-100 font-semibold',
    expected: 'opacity-70 font-medium',
};

/**
 * 개수에 걸 불투명도. 제목과 **같은 값**이어야 한다.
 *
 * `expected`(상승 조짐·하락 조짐)는 제목만 `opacity-70`으로 약화돼 있었는데
 * 개수는 그대로라, 다섯 소절 중 둘에서 개수가 크기와 대비 모두 제목을 앞섰다
 * (실측 다크 제목 8.43 대 개수 11.81, 라이트 5.73 대 9.34). 소절 전체를 함께
 * 약화시켜야 "이건 아직 확정 신호가 아니다"라는 뜻이 일관되게 읽힌다.
 *
 * `VARIANT_LABEL`을 그대로 쓰지 않는 이유는 거기 붙은 `font-semibold`·
 * `font-medium`이 숫자 두께까지 바꾸기 때문이다. 불투명도만 가져온다.
 *
 * 개수 색이 `secondary-300`이 아니라 `secondary-200`인 것도 이 때문이다.
 * 300을 0.7로 흐리면 라이트 테마에서 4.10:1로 AA(4.5)를 깬다 — 위계를 고치려다
 * 대비를 깨는 맞바꿈이 된다. 200에서 출발하면 흐린 뒤에도 통과하면서 여전히
 * 제목보다 어둡다.
 */
const VARIANT_COUNT_DIM: Record<SignalSubsectionProps['variant'], string> = {
    confirmed: 'opacity-100',
    mixed: 'opacity-100',
    expected: 'opacity-70',
};

export function SignalSubsection({
    currencySymbol,
    tickerIsReadable,
    title,
    marker,
    variant,
    stocks,
    infoMessage,
}: SignalSubsectionProps) {
    const t = useTranslations('widgets.dashboard');
    const count = stocks.length.toString().padStart(2, '0');

    return (
        <section className={cn(VARIANT_BORDER[variant], 'pt-3 pb-4')}>
            <div className="mb-3 flex items-baseline justify-between">
                <div className="flex items-center gap-2">
                    <h3
                        className={cn(
                            'text-secondary-100 text-base tracking-tight text-pretty',
                            VARIANT_LABEL[variant]
                        )}
                    >
                        <span aria-hidden="true" className="mr-2">
                            {marker}
                        </span>
                        {title}
                    </h3>
                    {infoMessage !== undefined && infoMessage !== null && (
                        <InfoTooltip>
                            <div className="text-secondary-300">
                                {infoMessage}
                            </div>
                        </InfoTooltip>
                    )}
                </div>
                {/* 개수가 24px에 muted라 14px 제목보다 크고 어두웠다 — 소제목보다
                    장식이 더 크게 읽히는 역전. 개수를 20px로 낮추고 톤을 한 단계
                    밝혀 제목을 압도하지 않게 한다. 크기는 여전히 제목(16px)보다
                    4px 크지만, 제목이 굵기에서 앞서고 모노 숫자가 같은 크기의
                    한글보다 작게 읽혀 위계는 제목이 가져간다. 대비 우위가 변형마다
                    뒤집히지 않도록 불투명도는 제목과 같은 값을 쓴다
                    (`VARIANT_COUNT_DIM` 참조). */}
                <span
                    className={cn(
                        'font-mono text-xl text-secondary-200 tabular-nums',
                        VARIANT_COUNT_DIM[variant]
                    )}
                    aria-label={t('stockCount', { v0: stocks.length })}
                >
                    {count}
                </span>
            </div>
            {stocks.length === 0 ? (
                <p
                    className="py-4 text-center text-xs text-secondary-500 italic"
                    role="status"
                >
                    {t('SignalSubsection.fe9464')}
                </p>
            ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {stocks.map(stock => (
                        <SignalStockCard
                            key={stock.symbol}
                            data={stock}
                            currencySymbol={currencySymbol}
                            tickerIsReadable={tickerIsReadable}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
