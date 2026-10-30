'use client';

import { useTranslations } from 'next-intl';
import {
    POPULAR_PREVIEW_GROUPS,
    popularNameKey,
} from '../../lib/popularPreview';
import { SEARCH_ROW_CLASS } from '../../lib/searchLabels';

interface OverlayPopularPreviewProps {
    onSelect: (symbol: string, label: string) => void;
}

/**
 * 검색 오버레이의 인기 종목(질의가 없을 때). 자산군을 섹션 제목으로 드러낸다 — 인기 종목
 * 데이터(`{symbol}`)에는 거래소 정보가 없어 행마다 시장 배지를 붙일 수 없으므로, 없는 정보를
 * 지어내는 대신 제목으로 묶어 한국·코인 사용자가 자기 영역을 바로 찾게 한다.
 */
export function OverlayPopularPreview({
    onSelect,
}: OverlayPopularPreviewProps) {
    const t = useTranslations('features.ticker-search');
    // 섹션 제목은 `assetClassNav`가 이미 네 로케일로 가진 지역명을 재사용한다 — 새 표를
    // 만들면 `미국`이 두 곳에 생겨 한쪽만 바뀐다.
    const tRegion = useTranslations('shared.config.nav.region');
    /**
     * `useAssetLabel`을 쓰지 않는다. 그 훅의 네임스페이스는 `shared.assetName`(166키)이고
     * 키가 변수라 추출기가 네임스페이스를 통째로 넓힌다. 이 오버레이는 전 라우트 크롬에
     * 들어 있어 그 표가 모든 라우트의 first-load에 실린다(`clientKeyCoverage.test.ts`).
     * 인기 종목은 9개뿐이라 전용 표를 두고, 두 표의 드리프트는
     * `__tests__/popularPreview.test.ts`가 네 로케일에서 막는다.
     */
    const tPopular = useTranslations('features.ticker-search.popularName');

    return POPULAR_PREVIEW_GROUPS.map(group => (
        <section key={group.labelKey}>
            <h2 className="px-4 pt-3 pb-1 text-xs font-medium text-secondary-400">
                {t('search.popularHeading', {
                    v0: tRegion(group.labelKey),
                })}
            </h2>
            {group.items.map(symbol => {
                // 표시 이름은 카탈로그가 정한다. 폴백을 심볼로 두는 것이 의도다 — 누락 시
                // 한국어가 새는 것보다 티커가 보이는 편이 낫고, 누락 자체는 테스트가 막는다.
                const key = popularNameKey(symbol);
                const label = tPopular.has(key) ? tPopular(key) : symbol;
                return (
                    <button
                        key={symbol}
                        type="button"
                        onClick={() => onSelect(symbol, label)}
                        className={SEARCH_ROW_CLASS}
                    >
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-secondary-100">
                            {label}
                        </span>
                        <span className="shrink-0 font-mono text-xs text-secondary-400">
                            {symbol}
                        </span>
                    </button>
                );
            })}
        </section>
    ));
}
