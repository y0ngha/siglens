/**
 * `/methodology` "데이터 출처와 최신성" — 시장별 데이터 공급처와 분석의 갱신 시점.
 */
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import type { MethodologySectionProps } from '../../types';
import { MethodologySection } from '../layout/MethodologySection';
import { BULLET_LIST, CARD } from '../methodologyStyles';

interface DataRow {
    readonly label: string;
    readonly value: string;
}

interface MarketCardProps {
    readonly title: string;
    readonly rows: readonly DataRow[];
}

/** 시장 하나의 데이터 종류 → 공급처 표. */
function MarketCard({ title, rows }: MarketCardProps) {
    return (
        <li className={CARD}>
            <h3 className={HEADING_SUBSECTION}>{title}</h3>
            <dl className="mt-3 flex flex-col gap-2">
                {rows.map(row => (
                    <div
                        key={row.label}
                        className="grid gap-x-4 sm:grid-cols-[7rem_minmax(0,1fr)]"
                    >
                        <dt className="text-xs font-semibold text-secondary-400">
                            {row.label}
                        </dt>
                        <dd className="text-sm leading-6 text-secondary-300">
                            {row.value}
                        </dd>
                    </div>
                ))}
            </dl>
        </li>
    );
}

/**
 * 미국·한국·암호화폐 카드와 최신성 안내. 행은 각 마켓 프로필이 실제로 쓰는 공급처와
 * 맞춘다 — 암호화폐에는 재무 탭이 없어 재무 행이 없다.
 */
export function DataSection({ t, title }: MethodologySectionProps) {
    const markets = [
        {
            title: t('data.marketUs'),
            rows: [
                { label: t('data.rowBars'), value: t('data.fmp') },
                { label: t('data.rowFinancials'), value: t('data.fmp') },
                { label: t('data.rowNews'), value: t('data.fmp') },
                { label: t('data.rowOther'), value: t('data.usOther') },
                { label: t('data.rowDelay'), value: t('data.delayNone') },
            ],
        },
        {
            title: t('data.marketKr'),
            rows: [
                { label: t('data.rowBars'), value: t('data.yahoo') },
                { label: t('data.rowFinancials'), value: t('data.yahoo') },
                { label: t('data.rowNews'), value: t('data.naver') },
                { label: t('data.rowOther'), value: t('data.krOther') },
                { label: t('data.rowDelay'), value: t('data.delayKr') },
            ],
        },
        {
            title: t('data.marketCrypto'),
            rows: [
                { label: t('data.rowBars'), value: t('data.fmp') },
                { label: t('data.rowNews'), value: t('data.fmp') },
                { label: t('data.rowDelay'), value: t('data.delayCrypto') },
            ],
        },
    ];
    return (
        <MethodologySection id="data" title={title} sub={t('data.sub')}>
            <ul className="mt-6 flex flex-col gap-3">
                {markets.map(market => (
                    <MarketCard
                        key={market.title}
                        title={market.title}
                        rows={market.rows}
                    />
                ))}
            </ul>
            <div className={cn(SURFACE_CARD, 'mt-4 px-4 py-4 sm:px-5')}>
                <h3 className={HEADING_SUBSECTION}>{t('data.freshTitle')}</h3>
                <ul className={cn(BULLET_LIST, 'mt-2')}>
                    <li>{t('data.freshCaption')}</li>
                    <li>{t('data.freshRefresh')}</li>
                    <li>{t('data.freshOnDemand')}</li>
                </ul>
            </div>
        </MethodologySection>
    );
}
