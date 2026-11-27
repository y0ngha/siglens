import { measuredSignalBaseRateFor } from '@y0ngha/siglens-core';
import type { SignalType } from '@y0ngha/siglens-core';
import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';
import type { Locale } from '@/shared/i18n/locales';
import { cn } from '@/shared/lib/cn';
import { formatKoreanDate } from '@/shared/lib/legal';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { buildSignalRecordView } from './lib/signalRecordView';

interface SignalBaseRateTableProps {
    readonly signalType: SignalType;
    readonly locale: Locale;
    readonly className?: string;
}

/**
 * 신호의 과거 기록 — 신호가 처음 확정된 날 이후 1·5·10·20일 뒤에 신호 방향으로 움직인 사례의 비율과,
 * 같은 종목의 임의 날짜에서 같은 방식으로 센 비율. 숫자는 core의 `MEASURED_SIGNAL_BASE_RATES` 필드 그대로다.
 *
 * 서버 전용, 클라이언트 JS 0. 표시 규칙:
 * - 네 기간을 모두 같이 그리거나 블록 자체를 그리지 않는다. 가장 좋은 기간을 띄우거나 비율로 정렬하지 않는다.
 * - 판정 문장은 고정이다(임의 날짜보다 높았어요 / 임의 날짜보다 높다고 확인되지 않았어요 — core `no_edge`는
 *   "높다고 확인되지 않음"이라 임의 날짜보다 뚜렷이 낮은 행도 포함한다). 표본이 적으면 비율을 싣지 않는다.
 * - 합산 범위(미국·한국 종목 수, 기간)와 "과거 기록" 고지를 같은 카드에 적는다. 수익률 수치는 어디에도 없다.
 * - 합산 기록이라 한국 신호 페이지에서도 같은 범위 문장으로 보여 준다.
 */
export async function SignalBaseRateTable({
    signalType,
    locale,
    className,
}: SignalBaseRateTableProps): Promise<ReactElement | null> {
    const view = buildSignalRecordView(
        measuredSignalBaseRateFor(signalType, '1Day')
    );
    if (view === null) return null;

    const [t, tLabel] = await Promise.all([
        getTranslations({ locale, namespace: 'views.signal-record' }),
        getTranslations({ locale, namespace: 'shared.enumLabel' }),
    ]);
    const headingId = `signal-record-${signalType}-heading`;

    return (
        <section
            aria-labelledby={headingId}
            data-signal-record={signalType}
            className={cn(SURFACE_CARD, 'p-5', className)}
        >
            <h2 id={headingId} className={HEADING_SECTION}>
                {t('heading', {
                    signal: tLabel(`signalType.${signalType}`),
                })}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-secondary-300">
                {view.direction === 'bullish'
                    ? t('basisBullish')
                    : t('basisBearish')}
            </p>
            {/* 표 대신 목록: 기간마다 문장 두 줄이라 좁은 화면에서도 가로 스크롤·열 재배치 없이 읽히고 스크린 리더가 한 기간씩 읽는다. */}
            <ol className="mt-3 divide-y divide-secondary-700">
                {view.rows.map(row =>
                    row.kind === 'rates' ? (
                        <li
                            key={row.days}
                            className="flex flex-col gap-x-6 gap-y-0.5 py-3 text-sm text-secondary-300 sm:flex-row sm:flex-wrap"
                        >
                            <p
                                data-record-share
                                className="font-medium text-secondary-100 tabular-nums"
                            >
                                {t('eventRow', {
                                    days: row.days,
                                    event: row.event,
                                    n: row.n,
                                })}
                            </p>
                            <p data-record-share className="tabular-nums">
                                {t('placeboRow', { placebo: row.placebo })}
                            </p>
                            <p className="sm:basis-full">
                                {row.verdict === 'beats_placebo'
                                    ? t('verdictBeats')
                                    : t('verdictNoEdge')}
                            </p>
                        </li>
                    ) : (
                        <li
                            key={row.days}
                            className="flex flex-col gap-y-0.5 py-3 text-sm text-secondary-300"
                        >
                            <p className="font-medium text-secondary-100">
                                {t('horizonLabel', { days: row.days })}
                            </p>
                            <p>{t('insufficient')}</p>
                        </li>
                    )
                )}
            </ol>
            <p className="mt-3 text-xs leading-relaxed text-secondary-400">
                {t('scope', {
                    us: view.usSymbols,
                    kr: view.krSymbols,
                    from: formatKoreanDate(new Date(view.from), locale),
                    to: formatKoreanDate(new Date(view.to), locale),
                })}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-secondary-400">
                {t('disclaimer')}
            </p>
        </section>
    );
}
