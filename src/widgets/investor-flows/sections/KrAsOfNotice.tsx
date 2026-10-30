/**
 * 한국 수급 탭의 기준 시점·출처 섹션.
 */
import { useTranslations } from 'next-intl';
import type { InvestorFlowsFreshness } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { formatSnapshotDate } from '../utils/snapshotDate';
import { AsOfRow } from '../ui/as-of/AsOfRow';
import { WindowRangeText } from '../ui/as-of/WindowRangeText';

const HEADING_ID = 'flows-kr-asof-heading';

interface KrAsOfNoticeProps {
    readonly freshness: InvestorFlowsFreshness;
    /** 스냅샷 기준일(UTC ISO 또는 날짜). 한국 현지(Asia/Seoul) 날짜로 바꿔 보인다. */
    readonly snapshotAsOf: string;
    /** DART 초기 수집이 끝나지 않았고 이 종목 공시가 비어 있다 — 최근 접수일 자리에 "수집 중"을 쓴다. */
    readonly collecting: boolean;
    /** 우선주라 보통주 회사의 공시를 보여 준다 — 회사명(안내 문구에 넣는다). 보통주면 `null`. */
    readonly commonShareCorpName: string | null;
}

/**
 * 한국 수급 탭의 기준 시점·출처 — 가장 최근 DART 접수일, 점수 반영 기간(core 창), 조회 기준일, 보고 지연 안내, 출처 표기
 * ("출처: 금융감독원 전자공시시스템(DART)"), 기관·외국인 순매수 미제공 안내(KRX 재배포 라이선스로 제외).
 * 우선주는 지분공시가 회사 단위라 보통주와 같은 내용임을 밝힌다.
 */
export function KrAsOfNotice({
    freshness,
    snapshotAsOf,
    collecting,
    commonShareCorpName,
}: KrAsOfNoticeProps) {
    const t = useTranslations('widgets.investor-flows');
    const latest = freshness.krDisclosureLatestDate;
    const latestEmpty = collecting
        ? t('asOf.collecting')
        : t('kr.asOf.latestNone');
    return (
        <section
            aria-labelledby={HEADING_ID}
            data-testid="flows-kr-asof"
            className={cn(SURFACE_CARD, 'space-y-3 p-6')}
        >
            <h2 id={HEADING_ID} className={HEADING_SECTION}>
                {t('asOf.title')}
            </h2>
            <dl className="space-y-2">
                <AsOfRow term={t('kr.asOf.termLatest')}>
                    {latest ?? latestEmpty}
                </AsOfRow>
                <AsOfRow term={t('kr.asOf.termWindow')}>
                    <WindowRangeText
                        window={freshness.largeHolderWindow}
                        noneText={t('kr.asOf.latestNone')}
                    />
                </AsOfRow>
                <AsOfRow term={t('asOf.termSnapshot')}>
                    {formatSnapshotDate(snapshotAsOf, 'kr-equity')}
                </AsOfRow>
            </dl>
            {commonShareCorpName !== null && (
                <p
                    role="note"
                    data-testid="flows-kr-preferred-note"
                    className="rounded-lg bg-secondary-700/40 p-3 text-xs leading-relaxed text-secondary-200"
                >
                    {t('kr.preferredShare', { corpName: commonShareCorpName })}
                </p>
            )}
            <p className="text-xs leading-relaxed text-secondary-300">
                {t('kr.asOf.delay')}
            </p>
            <p className="text-xs leading-relaxed text-secondary-300">
                {t('kr.notProvided')}
            </p>
            <p className="text-xs leading-relaxed text-secondary-400">
                {t('kr.source')}
            </p>
        </section>
    );
}
