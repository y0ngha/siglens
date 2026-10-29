import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { requireResolvableAsset } from '@/app/[locale]/[symbol]/requireResolvableAsset';
import { resolveLocale, type Locale } from '@/shared/i18n/locales';
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import { enterLocale } from '@/shared/lib/enterLocale';
import type { SeoTranslator } from '@/shared/lib/seo';
import type { AssetInfo } from '@/shared/lib/types';

/** `[symbol]` 탭 라우트 파일(`page.tsx`·`generateMetadata`)이 받는 세그먼트 파라미터. */
export type SymbolTabParams = Promise<{ locale: string; symbol: string }>;

/** 탭 `generateMetadata`가 공통 진입 판정을 마친 뒤 이어 쓰는 값. */
export interface SymbolTabMetadataEntry {
    readonly locale: Locale;
    /** 대문자 티커 — 레이아웃·본문과 같은 값이라 `React.cache` 조회가 접힌다. */
    readonly ticker: string;
    readonly tSeo: SeoTranslator;
    readonly assetInfo: AssetInfo;
    /** `getAssetInfoResilient`가 장애 폴백으로 푼 값인가 — 색인 판정에 넘긴다. */
    readonly degraded: boolean;
}

/**
 * 탭 `generateMetadata`의 공통 진입 — 형상이 틀린 세그먼트와 존재하지 않는 심볼은 메타데이터
 * 단계에서도 `notFound()`다.
 *
 * 레이아웃이 `notFound()`를 던져도 페이지의 `generateMetadata` 결과가 응답 메타로 쓰이므로,
 * 여기서 메타를 돌려주면 404 응답에 홈 상속 title·og나 티커를 단 정상 제목이 얹힌다(e2e
 * `not-found.spec.ts`). 존재 판정은 레이아웃과 같은 `requireResolvableAsset`이다.
 *
 * `getTranslations`에 로케일을 직접 넘긴다 — 메타데이터는 `enterLocale` 없이 돌 수 있어
 * 요청 로케일 등록에 기대지 않는다.
 */
export async function enterSymbolTabMetadata(
    params: SymbolTabParams
): Promise<SymbolTabMetadataEntry> {
    const { locale: rawLocale, symbol } = await params;
    const locale = resolveLocale(rawLocale);
    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });
    const ticker = symbol.toUpperCase();
    if (!isAdmissibleSymbolShape(ticker)) notFound();
    const { assetInfo, degraded } = await requireResolvableAsset(ticker);
    return { locale, ticker, tSeo, assetInfo, degraded };
}

/** 탭 본문이 공통 진입 판정을 마친 뒤 이어 쓰는 값. */
export interface SymbolTabPageEntry {
    readonly locale: Locale;
    /** 대문자 티커. */
    readonly ticker: string;
    /**
     * URL 세그먼트 원문. React Query 시드 키는 클라 훅이 같은 세그먼트 값으로 읽으므로 원문을
     * 그대로 쓴다(대소문자 정규화는 프록시가 리다이렉트로 맡는다).
     */
    readonly segment: string;
}

/**
 * 탭 본문(`page.tsx` default export)의 공통 진입 — 요청 로케일을 등록하고(`enterLocale`,
 * 정적 렌더의 전제), 형상이 틀린 세그먼트는 외부 호출 없이 `notFound()`로 끊는다.
 *
 * 레이아웃이 같은 판정을 먼저 하지만, 페이지를 레이아웃 없이 직접 렌더하는 경로(단위 테스트)와
 * `generateMetadata` 가드의 짝을 지키려고 본문에도 둔다.
 */
export async function enterSymbolTabPage(
    params: SymbolTabParams
): Promise<SymbolTabPageEntry> {
    const { locale: rawLocale, symbol } = await params;
    const locale = enterLocale(rawLocale);
    const ticker = symbol.toUpperCase();
    if (!isAdmissibleSymbolShape(ticker)) notFound();
    return { locale, ticker, segment: symbol };
}
