import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import type {
    SeoAnalysisSnapshot,
    SeoSnapshotTab,
} from '@/entities/seo-snapshot/model';
import type { AssetClass } from '@/shared/config/marketProfile/types';
import type { Locale } from '@/shared/i18n/locales';
import {
    buildSnapshotMetaDescription,
    symbolTabDescriptionLabel,
    type SeoTranslator,
} from '@/shared/lib/seo';

interface TabSnapshotInput {
    /** 대문자 심볼. */
    readonly symbol: string;
    readonly tab: SeoSnapshotTab;
    /** 이 라우트의 `revalidate` — 본문의 `getSeoSnapshotsStatic` 호출과 같은 값이어야 캐시를 공유한다. */
    readonly revalidate: number;
    readonly locale: Locale;
    readonly displayName: string;
    readonly assetClass: AssetClass;
    readonly tSeo: SeoTranslator;
    /**
     * 프리웜이 구워 둔 평이화 산문을 설명에 먼저 쓸지. 차트·종합 탭만 켠다 —
     * 나머지 탭은 원문 헤드라인이 설명으로 더 낫다고 판단해 둔 상태다.
     */
    readonly preferPlain?: boolean;
}

export interface TabSnapshotMeta {
    /** 이 탭의 SEO 스냅샷 행. */
    readonly snap: SeoAnalysisSnapshot | undefined;
    /** 스냅샷에서 만든 검색용 설명. 스냅샷이 없으면 `null`(템플릿 설명 유지). */
    readonly description: string | null;
}

/**
 * 종목 탭 `generateMetadata`가 쓰는 SEO 스냅샷과 그로부터 만든 meta description.
 *
 * 스냅샷 호출은 본문이 아래에서 부르는 `getSeoSnapshotsStatic(upper, revalidate,
 * locale)`과 같다 — `unstable_cache`가 한 렌더 안에서 중복을 없애므로 DB 왕복이
 * 늘지 않는다. 스냅샷이 없으면 템플릿 설명으로 떨어진다(하위 호환). og/twitter는
 * 템플릿 문구를 유지하고, 검색 결과에 보이는 `<meta name="description">`만 바꾼다.
 */
export async function loadTabSnapshotMeta({
    symbol,
    tab,
    revalidate,
    locale,
    displayName,
    assetClass,
    tSeo,
    preferPlain = false,
}: TabSnapshotInput): Promise<TabSnapshotMeta> {
    // `null`(읽기 실패)은 "스냅샷 없음"과 같게 템플릿 설명으로 떨어진다 — 설명 문구는
    // 색인 여부와 무관하다(색인 판정은 `getBlockedSymbolMetadata`가 `unknown`으로 구분한다).
    const snap = (
        (await getSeoSnapshotsStatic(symbol, revalidate, locale)) ?? []
    ).find(s => s.tab === tab);
    const description = snap
        ? buildSnapshotMetaDescription(
              tab,
              snap.content,
              displayName,
              preferPlain ? snap.plain : null,
              locale,
              symbolTabDescriptionLabel(tab, assetClass, tSeo)
          )
        : null;
    return { snap, description };
}
