/**
 * "관련 종목" 칩 스트립의 순수 판정 — 칩 이름 고르기와 캡션별 묶음. 이름 조회(I/O)는
 * `relatedSymbolNames.ts`가 맡는다.
 */
import type { RelatedSymbol } from '@/shared/config/relatedSymbols';
import { pickAssetName } from '@/entities/ticker/lib/ticker';
import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';

/** 캡션(메시지 키) 하나와 그 아래 칩들. */
export interface RelatedSymbolGroup {
    readonly label: string;
    readonly items: readonly RelatedSymbol[];
}

/**
 * 칩 이름 판정 — DB 이름 우선, 큐레이션 한글명 폴백은 ko에서만.
 *
 * ko는 한글명만 쓴다(없으면 티커만). 그 외 로케일은 `pickAssetName`으로 영문명을 쓰고, 영문명이
 * 없을 때만 한글명으로 떨어진다. 비-ko에서는 DB가 비었을 때의 큐레이션 한글명 폴백도 쓰지
 * 않는다(영문 페이지에 "애플 AAPL"이 나오지 않게). 이름이 티커와 같으면 칩에 티커가 두 번
 * 찍히므로 이름으로 치지 않는다.
 */
export function chipNameFor(
    assetInfo: { name: string; koreanName?: string } | null,
    item: RelatedSymbol,
    locale: Locale
): string | undefined {
    const curated = locale === DEFAULT_LOCALE ? item.koreanName : undefined;
    if (assetInfo === null) return curated;
    if (locale === DEFAULT_LOCALE) return assetInfo.koreanName ?? curated;
    const name = pickAssetName(assetInfo, item.symbol, locale);
    return name === item.symbol ? curated : name;
}

/**
 * 선정 순서(테마 → 링)를 유지한 채 캡션별로 묶는다 — 그룹은 처음 등장한 순서대로라
 * 관련성이 높은 그룹이 먼저 온다.
 */
export function groupRelatedByLabel(
    related: readonly RelatedSymbol[]
): readonly RelatedSymbolGroup[] {
    const labels = [...new Set(related.map(item => item.label))];
    return labels.map(label => ({
        label,
        items: related.filter(item => item.label === label),
    }));
}
