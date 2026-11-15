import { useTranslations } from 'next-intl';
import { SignalBadge } from '@/widgets/dashboard/ui/signal/SignalBadge';
import type { TodaySignalRow } from '@/entities/sector-signal/lib/selectTodaySignals';
import { KR_EXCHANGE_SUFFIX_RE } from '@/shared/config/ticker';
import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';
import { cn } from '@/shared/lib/cn';
import { SENTIMENT_LABEL_KEY } from '@/shared/lib/fearGreedLabels';
import { formatKoreanDateTime } from '@/shared/lib/formatKoreanDateTime';
import { formatKoreanDate } from '@/shared/lib/legal';
import { formatSignedPercent, signColorClass } from '@/shared/lib/priceFormat';
import { SURFACE_CARD, SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION, LABEL_KO } from '@/shared/lib/typographyStyles';
import { FearGreedScoreBar } from '@/shared/ui/FearGreedScoreBar';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import type {
    FearGreedMarketLabelKey,
    SignalMarketLabelKey,
    TodayMarketView,
} from '../_lib/todayMarketView';

const HEADING_ID = 'home-today-market-heading';

function rowLabel(row: TodaySignalRow, locale: Locale): string {
    // 한글 이름은 ko에서만 쓴다 — 다른 로케일에 한글을 섞지 않는다(가이드 라이브 종목과 같은 규칙).
    return row.koreanName !== null && locale === DEFAULT_LOCALE
        ? row.koreanName
        : row.symbol.replace(KR_EXCHANGE_SUFFIX_RE, '');
}

interface HomeTodayMarketProps {
    readonly locale: Locale;
    /** `toTodayMarketView`의 결과. 그릴 것이 없으면(`null`) 페이지가 이 컴포넌트를 두지 않는다. */
    readonly view: TodayMarketView;
}

/**
 * 홈 "오늘의 시장" — 시장별 공포탐욕 지수와 오늘 기술적 신호가 잡힌 종목.
 *
 * 다시 들를 이유가 되도록 날마다 바뀌는 내용을 히어로 바로 아래 둔다. 서버 렌더라 JS 없는
 * 크롤러도 오늘 점수와 종목 링크를 읽는다.
 *
 * 동기 컴포넌트다(`async` 아님) — 홈의 다른 섹션처럼 페이지 트리에 그대로 들어가고, 번역은
 * 서버 컴포넌트의 `useTranslations`로 읽는다.
 */
export function HomeTodayMarket({ locale, view }: HomeTodayMarketProps) {
    const t = useTranslations('app.home.todayMarket');
    const tLabel = useTranslations('shared.enumLabel');
    const { tiles, signalGroups } = view;
    // 키를 리터럴로 부른다 — `t(labelKey)`처럼 변수로 부르면 i18n 추출기가 키를 못 보고
    // 카탈로그에서 지운다(`yarn i18n:extract --write`).
    const marketLabel: Record<FearGreedMarketLabelKey, string> = {
        marketUs: t('marketUs'),
        marketKr: t('marketKr'),
        marketCrypto: t('marketCrypto'),
    };
    const signalMarketLabel: Record<SignalMarketLabelKey, string> = {
        signalsUs: t('signalsUs'),
        signalsKr: t('signalsKr'),
    };

    return (
        <section
            aria-labelledby={HEADING_ID}
            className={cn(SURFACE_CARD, 'p-5 sm:p-6')}
        >
            <h2 id={HEADING_ID} className={HEADING_SECTION}>
                {t('heading')}
            </h2>
            <p className="mt-1 text-sm text-secondary-400">{t('intro')}</p>

            {tiles.length > 0 && (
                <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {tiles.map(
                        ({ id, href, labelKey, date, score, sentiment }) => {
                            const label = tLabel(
                                SENTIMENT_LABEL_KEY[sentiment]
                            );
                            return (
                                <li key={id}>
                                    <Link
                                        href={href}
                                        prefetch={false}
                                        className={cn(
                                            SURFACE_NESTED,
                                            'block px-4 py-3 transition-colors hover:bg-secondary-700/70 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none'
                                        )}
                                    >
                                        <span className="flex items-baseline justify-between gap-2">
                                            <span className="text-sm font-medium text-secondary-200">
                                                {marketLabel[labelKey]}
                                            </span>
                                            <span className="text-xs text-secondary-500">
                                                {t('asOf', {
                                                    // `date`는 세션 날짜만 담은 `YYYY-MM-DD`다(core
                                                    // `FearGreedReading.date`). `new Date`가 UTC 자정으로
                                                    // 읽고 KST로 찍어도 날짜가 바뀌지 않는다 — 시각이
                                                    // 붙은 값이 오면 이 가정을 다시 본다.
                                                    date: formatKoreanDate(
                                                        new Date(date),
                                                        locale
                                                    ),
                                                })}
                                            </span>
                                        </span>
                                        <span className="mt-1 flex items-baseline gap-2">
                                            <span className="font-mono text-2xl font-semibold text-secondary-50">
                                                {score}
                                            </span>
                                            <span className="text-sm text-secondary-300">
                                                {label}
                                            </span>
                                        </span>
                                        {/* 막대는 장식이다 — 점수와 단계는 바로 위 글자가 이미 말하고, 링크 이름에
                                            진행 막대의 aria-label까지 섞이면 같은 값을 두 번 읽는다. */}
                                        <span
                                            aria-hidden="true"
                                            className="mt-2 block"
                                        >
                                            <FearGreedScoreBar
                                                value={score}
                                                label={t('scoreBarLabel', {
                                                    market: marketLabel[
                                                        labelKey
                                                    ],
                                                    score,
                                                    label,
                                                })}
                                            />
                                        </span>
                                    </Link>
                                </li>
                            );
                        }
                    )}
                </ul>
            )}

            {signalGroups.length > 0 && (
                <div className="mt-6">
                    <h3 className="text-sm font-semibold text-secondary-100">
                        {t('signalsHeading')}
                    </h3>
                    <div className="mt-3 grid grid-cols-1 gap-6 sm:grid-cols-2">
                        {signalGroups.map(
                            ({ id, href, labelKey, rows, computedAt }) => (
                                <div key={id}>
                                    <div className="flex items-baseline justify-between gap-2">
                                        <h4 className={LABEL_KO}>
                                            {signalMarketLabel[labelKey]}
                                        </h4>
                                        <Link
                                            href={href}
                                            prefetch={false}
                                            className="text-xs font-medium text-primary-400 hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                                        >
                                            {t('viewAll', {
                                                market: signalMarketLabel[
                                                    labelKey
                                                ],
                                            })}
                                        </Link>
                                    </div>
                                    <ul className="mt-2 divide-y divide-secondary-700">
                                        {rows.map(row => (
                                            <li
                                                key={row.symbol}
                                                className="flex items-center justify-between gap-3 py-2"
                                            >
                                                <div className="min-w-0">
                                                    <Link
                                                        href={`/${row.symbol}`}
                                                        prefetch={false}
                                                        className="block truncate text-sm font-medium text-secondary-100 underline-offset-4 hover:text-primary-400 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                                                    >
                                                        {rowLabel(row, locale)}
                                                    </Link>
                                                    <p className="mt-0.5 text-xs text-secondary-300">
                                                        <SignalBadge
                                                            type={
                                                                row.signalType
                                                            }
                                                        />
                                                        {row.expected && (
                                                            <span className="ml-1 text-secondary-500">
                                                                {t(
                                                                    'expectedTag'
                                                                )}
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                                <span
                                                    className={cn(
                                                        'shrink-0 font-mono text-xs',
                                                        signColorClass(
                                                            row.changePercent
                                                        )
                                                    )}
                                                >
                                                    {formatSignedPercent(
                                                        row.changePercent
                                                    )}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                    {computedAt !== null && (
                                        <p className="mt-1 text-xs text-secondary-500">
                                            {t('signalsBasis', {
                                                time: formatKoreanDateTime(
                                                    computedAt,
                                                    locale
                                                ),
                                            })}
                                        </p>
                                    )}
                                </div>
                            )
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}
