import { MarkdownText } from '@/components/ui/MarkdownText';

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
                        className="bg-ui-warning/10 text-ui-warning rounded-md px-2 py-0.5 text-xs"
                        title="미국 옵션 정규 거래 시간 외에 수집된 스냅샷으로, Open Interest가 직전 세션 기준일 수 있습니다."
                    >
                        OI 데이터 지연
                    </span>
                )}
            </div>
            {isEmpty ? (
                <p className="text-secondary-400 text-sm">
                    이 종목은 옵션이 상장되어 있지 않거나 분석할 데이터가
                    없어요.
                </p>
            ) : (
                <ul aria-label="옵션 분석 항목" className="space-y-2">
                    {bullets.map((bullet, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                            <span
                                aria-hidden="true"
                                className="text-secondary-400 mt-0.5 shrink-0"
                            >
                                •
                            </span>
                            <MarkdownText className="text-secondary-400 min-w-0">
                                {bullet}
                            </MarkdownText>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
