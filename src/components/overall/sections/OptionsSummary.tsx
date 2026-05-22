interface OptionsSummaryProps {
    bullets: string[];
    oiStale: boolean;
}

/**
 * 4번째 axis인 옵션 시장 요약 section. NoChains 종목 또는 옵션 데이터가
 * 없을 때는 빈 상태(분석 대상 옵션 없음)로 표시한다. 정규장 외에 수집된
 * 스냅샷이라 OI가 직전 세션 기준일 때만 stale 배지를 표시한다 — 빈 상태에서는
 * 배지를 노출하지 않는다 (분석 자체가 없으므로 stale 의미가 없음).
 */
export function OptionsSummary({ bullets, oiStale }: OptionsSummaryProps) {
    const isEmpty = bullets.length === 0;
    return (
        <section
            aria-labelledby="overall-options-heading"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <div className="mb-3 flex items-center gap-2">
                <h2
                    id="overall-options-heading"
                    className="text-lg font-semibold text-balance"
                >
                    옵션 시장
                </h2>
                {!isEmpty && oiStale && (
                    <span
                        className="rounded-md bg-amber-900/30 px-2 py-0.5 text-xs text-amber-300"
                        title="미국 옵션 정규 거래 시간 외에 수집된 스냅샷으로, Open Interest가 직전 세션 기준일 수 있습니다."
                    >
                        OI 데이터 stale
                    </span>
                )}
            </div>
            {isEmpty ? (
                <p className="text-secondary-400 text-sm">
                    분석 대상 옵션 없음 (옵션 미상장 또는 데이터 없음)
                </p>
            ) : (
                <ul className="text-secondary-200 list-disc space-y-2 pl-5 leading-relaxed">
                    {bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                    ))}
                </ul>
            )}
        </section>
    );
}
