import { getTranslations } from 'next-intl/server';
import { KR_EXCHANGE_SUFFIX_RE } from '@/shared/config/ticker';
import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';
import { cn } from '@/shared/lib/cn';
import { formatKoreanDateTime } from '@/shared/lib/formatKoreanDateTime';
import { formatKoreanDate } from '@/shared/lib/legal';
import { formatSignedPercent, signColorClass } from '@/shared/lib/priceFormat';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION, LABEL_KO } from '@/shared/lib/typographyStyles';
import { LocaleLink } from '@/shared/ui/LocaleLink';
import type { LiveSymbolGroup, LiveSymbolRow } from '../lib/liveSymbols';

const LIVE_HEADING_ID = 'guide-live-heading';

interface GuideLiveSymbolsProps {
    readonly locale: Locale;
    readonly groups: readonly LiveSymbolGroup[];
}

function latest(
    rows: readonly LiveSymbolRow[],
    basis: LiveSymbolRow['basis']
): string | null {
    const times = rows
        .filter(row => row.basis === basis)
        .map(row => row.detectedOn);
    // ISO 문자열은 오프셋 표기(`Z`/`+09:00`)가 섞이면 사전순이 시간순이 아니다 — 시각으로 비교한다.
    return times.length === 0
        ? null
        : (times.toSorted((a, b) => Date.parse(a) - Date.parse(b)).at(-1) ??
              null);
}

/** 화면 표기용 코드 — 한국 종목의 거래소 접미사(`.KS`/`.KQ`)를 뗀다. 링크 경로에는 쓰지 않는다. */
function displayCode(symbol: string): string {
    return symbol.replace(KR_EXCHANGE_SUFFIX_RE, '');
}

/**
 * 스캐너 행의 `name`은 한국어 이름뿐이라(config에 번역이 없다) ko가 아닌 로케일에서는 쓰지 않고 심볼만 적는다.
 *
 * "지금 이 신호가 나온 종목" — 서버 전용, 클라이언트 JS 0. 데이터는 라우트 로더가 넘긴다.
 * 그룹이 비면 아무것도 그리지 않는다(빈 상태 문구를 170페이지에 반복하지 않는다 — 스펙 §2.4).
 * 기준 시각을 항상 적는다: 스캐너는 1시간, 스냅샷은 전 거래일이라 "지금"이 최대 하루 전이다.
 */
export async function GuideLiveSymbols({
    locale,
    groups,
}: GuideLiveSymbolsProps) {
    if (groups.length === 0) return null;
    const t = await getTranslations({ locale, namespace: 'views.guide' });
    const allRows = groups.flatMap(group => group.rows);
    const scannerAt = latest(allRows, 'scanner');
    const snapshotAt = latest(allRows, 'snapshot');

    return (
        <section
            aria-labelledby={LIVE_HEADING_ID}
            className={cn(SURFACE_CARD, 'mt-10 p-5 sm:p-6')}
        >
            <h2 id={LIVE_HEADING_ID} className={HEADING_SECTION}>
                {t('liveHeading')}
            </h2>
            <p className="mt-1 space-x-2 text-xs text-secondary-500">
                {scannerAt === null ? null : (
                    <span>
                        {t('liveBasisScanner', {
                            time: formatKoreanDateTime(scannerAt, locale),
                        })}
                    </span>
                )}
                {snapshotAt === null ? null : (
                    <span>
                        {t('liveBasisSnapshot', {
                            date: formatKoreanDate(
                                new Date(snapshotAt),
                                locale
                            ),
                        })}
                    </span>
                )}
            </p>
            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
                {groups.map(group => (
                    <div key={group.market}>
                        <h3 className={LABEL_KO}>
                            {group.market === 'us'
                                ? t('liveMarketUs')
                                : t('liveMarketKr')}
                        </h3>
                        <ul className="mt-2 divide-y divide-secondary-700">
                            {group.rows.map(row => (
                                <li
                                    key={row.symbol}
                                    className="flex items-center justify-between gap-3 py-2"
                                >
                                    <LocaleLink
                                        href={`/${row.symbol}`}
                                        prefetch={false}
                                        className="min-w-0 truncate text-sm font-medium text-secondary-100 underline-offset-4 hover:text-primary-400 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                                    >
                                        {row.name === null ||
                                        locale !== DEFAULT_LOCALE
                                            ? t('liveRowLinkSymbolOnly', {
                                                  symbol: displayCode(
                                                      row.symbol
                                                  ),
                                              })
                                            : t('liveRowLink', {
                                                  name: row.name,
                                                  symbol: displayCode(
                                                      row.symbol
                                                  ),
                                              })}
                                    </LocaleLink>
                                    {row.changePercent === null ? (
                                        <span className="shrink-0 text-xs text-secondary-500">
                                            {t('liveDetectedOn', {
                                                date: formatKoreanDate(
                                                    new Date(row.detectedOn),
                                                    locale
                                                ),
                                            })}
                                        </span>
                                    ) : (
                                        <span
                                            className={cn(
                                                'shrink-0 text-xs tabular-nums',
                                                signColorClass(
                                                    row.changePercent
                                                )
                                            )}
                                        >
                                            {formatSignedPercent(
                                                row.changePercent
                                            )}
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </section>
    );
}
