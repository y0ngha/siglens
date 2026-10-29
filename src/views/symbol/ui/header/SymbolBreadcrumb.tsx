'use client';

/**
 * 종목 레이아웃 헤더의 가시 브레드크럼(`시그렌즈 / 종목명 (티커) / 탭`).
 */
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { cn } from '@/shared/lib/cn';
import { brandName } from '@/shared/lib/brandName';
import type { Locale } from '@/shared/i18n/locales';
import type { HeaderDisplayName } from '../../utils/headerDisplayName';

interface SymbolBreadcrumbProps {
    /** `<nav>`의 접근 가능한 이름. */
    label: string;
    /** 대문자 티커. */
    ticker: string;
    /** 종목명 조각(`resolveHeaderDisplayName`). */
    name: HeaderDisplayName;
    /** 차트 탭(`/{T}`)인가 — 종목명이 현재 페이지라 링크가 아니다. */
    isChartRoute: boolean;
    /** 셋째 마디(현재 하위 탭) 라벨. 차트 탭이거나 알 수 없는 세그먼트면 null. */
    subTabLabel: string | null;
    locale: Locale;
}

/**
 * 종목명 줄 클래스. 모바일은 최대 2줄까지 줄바꿈한다(`line-clamp-2`, text-base) — 2줄
 * 높이(40px)가 헤더 컨트롤(size-11 = 44px)보다 작아 헤더 높이, 곧 `--symbol-chrome-h`는
 * 그대로다. sm 이상은 한 줄 말줄임. 링크가 되어도 같은 규약이다(`SymbolHeaderShellFallback`).
 */
const NAME_CLASS =
    'line-clamp-2 text-base leading-tight font-semibold tracking-wide text-secondary-100 sm:line-clamp-none sm:truncate sm:text-lg';

/**
 * 각 탭 페이지의 `BreadcrumbList` JSON-LD와 같은 마디를 같은 문자열로 그린다. 홈 마디 텍스트는
 * JSON-LD와 같은 `brandName(locale)`이고 영문 대문자는 CSS(`uppercase`)가 만든다.
 *
 * 종목명은 h1이 아니다 — 모든 `/[symbol]/*` 페이지에 공통으로 렌더되므로 h1이면 페이지 h1과
 * 겹쳐 페이지당 h1이 둘이 된다. 브레드크럼 `<ol>`의 한 마디로만 둔다. 하위 탭에서는 이 이름이
 * 차트 `/{T}`로 가는 링크이고, 차트 탭에서는 자기 자신이라 텍스트다.
 *
 * 모바일(sm 미만)에서는 홈 마디·영문명·셋째 마디를 감춘다. 375px에서 이것들이 폭을 먹어
 * 한국어 종목명이 잘린다 — 홈은 사이트 헤더 로고가, 현재 탭은 바로 아래 탭 레일이 이미 보여 준다.
 */
export function SymbolBreadcrumb({
    label,
    ticker,
    name,
    isChartRoute,
    subTabLabel,
    locale,
}: SymbolBreadcrumbProps) {
    const nameContent = <SymbolNameContent ticker={ticker} name={name} />;

    return (
        <nav aria-label={label} className="min-w-0">
            <ol className="flex min-w-0 items-center gap-2">
                <li className="hidden sm:inline">
                    <Link
                        href="/"
                        // 모든 심볼 페이지의 브레드크럼에 렌더되는 사실상 전역 링크다 — prefetch는
                        // 진입 심볼마다 다른 `_rsc` 해시로 `/`의 엣지 캐시를 파편화한다.
                        prefetch={false}
                        className="font-mono text-xs tracking-[0.2em] text-secondary-400 uppercase transition-colors hover:text-secondary-300"
                    >
                        {brandName(locale)}
                    </Link>
                </li>
                <li
                    aria-hidden="true"
                    className="hidden text-secondary-500 sm:inline"
                >
                    /
                </li>
                <li
                    className="min-w-0"
                    {...(isChartRoute
                        ? { 'aria-current': 'page' as const }
                        : {})}
                >
                    {isChartRoute ? (
                        <span className={NAME_CLASS}>{nameContent}</span>
                    ) : (
                        <Link
                            href={`/${ticker}`}
                            // 하위 탭마다 렌더되는 헤더 링크 — prefetch는 `_rsc` 해시를 탭×진입
                            // 경로별로 파편화한다.
                            prefetch={false}
                            className={cn(
                                NAME_CLASS,
                                'transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none'
                            )}
                        >
                            {nameContent}
                        </Link>
                    )}
                </li>
                {subTabLabel !== null && (
                    <>
                        <li
                            aria-hidden="true"
                            className="hidden text-secondary-500 sm:inline"
                        >
                            /
                        </li>
                        <li
                            aria-current="page"
                            className="hidden shrink-0 text-sm whitespace-nowrap text-secondary-400 sm:inline"
                        >
                            {subTabLabel}
                        </li>
                    </>
                )}
            </ol>
        </nav>
    );
}

interface SymbolNameContentProps {
    ticker: string;
    name: HeaderDisplayName;
}

/**
 * `애플, Apple Inc. (AAPL)`. 한국어명이 앞서면 영문명(과 앞의 ", ")은 sm 이상에서만 보인다
 * — 모바일은 `애플 (AAPL)`. 한국어명이 없으면 영문명이 곧 종목명이라 항상 보인다. 쉼표는
 * 영문명과 같은 span에 두지 않고 바깥 래퍼에 둬서 영문명 텍스트가 자기 노드로 남게 한다.
 */
function SymbolNameContent({ ticker, name }: SymbolNameContentProps) {
    const { koreanName, companyName } = name;
    return (
        <>
            {koreanName !== null && (
                <span className="text-secondary-300">{koreanName}</span>
            )}
            {companyName !== null && koreanName !== null && (
                <span className="hidden sm:inline">
                    , <span className="text-secondary-200">{companyName}</span>
                </span>
            )}
            {companyName !== null && koreanName === null && (
                <span className="text-secondary-200">{companyName}</span>
            )}{' '}
            ({ticker})
        </>
    );
}
