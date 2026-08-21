'use client';

import { useTranslations } from 'next-intl';
import { isKoreanInput, krExchangeOf } from '@/entities/ticker';
import { isKrEquitySymbol } from '@/shared/config/marketProfile';
import { useAutocomplete } from '../hooks/useAutocomplete';
import { cn } from '@/shared/lib/cn';
import type { TickerSearchResult } from '@/shared/lib/types';

const LISTBOX_ID = 'ticker-autocomplete-listbox';
const OPTION_ID_PREFIX = `${LISTBOX_ID}-option`;

type TickerAutocompleteSize = 'sm' | 'lg';

const INPUT_BASE =
    'bg-secondary-800 border-secondary-700 text-secondary-100 placeholder-secondary-500 focus:border-primary-600 focus:ring-primary-500 rounded-lg border transition-colors outline-none focus:ring-1';
const INPUT_SIZE: Record<TickerAutocompleteSize, string> = {
    sm: 'h-11 px-3 text-sm',
    lg: 'focus-glow h-12 px-4 text-base',
};

const BUTTON_BASE =
    'bg-primary-600 hover:bg-primary-700 shrink-0 rounded-lg font-semibold whitespace-nowrap text-white transition-colors focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none';
const BUTTON_SIZE: Record<TickerAutocompleteSize, string> = {
    sm: 'h-11 px-3 text-sm sm:px-4',
    lg: 'h-12 w-full px-6 text-base sm:w-auto',
};

interface TickerAutocompleteProps {
    className?: string;
    size?: TickerAutocompleteSize;
    onSelect?: (entry: { symbol: string; label: string }) => void;
    /** See useAutocomplete's navigateOnSelect — pass false to use this as a plain value-picker inside a form. */
    navigateOnSelect?: boolean;
    /**
     * Overrides the input's own visual styling (bg/height/border/focus ring)
     * to match a specific host form — e.g. HoldingForm's sibling quantity/price
     * inputs — without changing the default appearance for other consumers
     * (Header, SymbolSearchPanel). Merged on top of the size-based defaults via
     * `cn`/`twMerge`, so later utility classes win over earlier ones.
     */
    inputClassName?: string;
    /** Forwarded to the underlying input so a host form can associate its own field-level error message. */
    ariaInvalid?: boolean;
    /** Forwarded to the underlying input so a host form can associate its own field-level error message. */
    ariaDescribedby?: string;
    /**
     * Associates the input with a host form's own visible field label (e.g.
     * HoldingForm's "종목" label) so the accessible name matches what's on
     * screen, instead of the generic default "종목 티커 검색" aria-label.
     * When provided, this takes over as the input's accessible name (the
     * default `aria-label` is omitted) — other consumers that don't pass it
     * keep the unchanged default behavior.
     */
    ariaLabelledby?: string;
}

export function TickerAutocomplete({
    className,
    size = 'sm',
    onSelect,
    navigateOnSelect,
    inputClassName,
    ariaInvalid,
    ariaDescribedby,
    ariaLabelledby,
}: TickerAutocompleteProps) {
    const t = useTranslations('features.ticker-search');
    const {
        query,
        results,
        isSearching,
        selectedIndex,
        isOpen,
        inputRef,
        dropdownRef,
        handleChange,
        handleKeyDown,
        handleFocus,
        handleSearchClick,
        navigate,
        prefetch,
    } = useAutocomplete({ onSelect, navigateOnSelect });

    const isKorean = isKoreanInput(query);

    return (
        <div
            className={cn(
                'relative flex min-w-0',
                size === 'sm'
                    ? 'items-center gap-2'
                    : 'w-full max-w-xl flex-col gap-3 sm:flex-row sm:items-center',
                className
            )}
        >
            <div className="relative min-w-0 flex-1">
                <input
                    ref={inputRef}
                    name="symbol"
                    autoComplete="off"
                    role="combobox"
                    aria-label={
                        ariaLabelledby
                            ? undefined
                            : t('TickerAutocomplete.30cf1e')
                    }
                    aria-labelledby={ariaLabelledby}
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                    aria-controls={LISTBOX_ID}
                    aria-autocomplete="list"
                    aria-activedescendant={
                        selectedIndex >= 0
                            ? `${OPTION_ID_PREFIX}-${selectedIndex}`
                            : undefined
                    }
                    aria-invalid={ariaInvalid}
                    aria-describedby={ariaDescribedby}
                    type="text"
                    value={query}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onFocus={handleFocus}
                    placeholder={t('TickerAutocomplete.124e37')}
                    className={cn(
                        INPUT_BASE,
                        INPUT_SIZE[size],
                        'w-full min-w-0',
                        inputClassName
                    )}
                />
                {isOpen && (
                    <div
                        ref={dropdownRef}
                        id={LISTBOX_ID}
                        role="listbox"
                        className="absolute top-full left-0 z-50 mt-1 w-full overflow-hidden rounded-lg border border-secondary-700 bg-secondary-800 shadow-lg"
                    >
                        {isSearching && (
                            <div className="px-4 py-3 text-sm text-secondary-400">
                                {t('TickerAutocomplete.e39068')}
                            </div>
                        )}
                        {!isSearching && results.length === 0 && (
                            <div className="px-4 py-3 text-sm text-secondary-400">
                                {isKorean
                                    ? t('TickerAutocomplete.e62852')
                                    : t('TickerAutocomplete.5dd6d9')}
                            </div>
                        )}
                        {results.map((result, index) => (
                            <ResultItem
                                key={result.symbol}
                                id={`${OPTION_ID_PREFIX}-${index}`}
                                result={result}
                                isSelected={index === selectedIndex}
                                onSelect={navigate}
                                onPrefetch={prefetch}
                            />
                        ))}
                    </div>
                )}
            </div>
            {navigateOnSelect !== false && (
                <button
                    type="button"
                    onClick={handleSearchClick}
                    className={cn(BUTTON_BASE, BUTTON_SIZE[size])}
                >
                    {t('TickerAutocomplete.4f5a3f')}
                </button>
            )}
        </div>
    );
}

/** 배지 색조. 자산군을 색으로도 구분해 스캔이 빨라진다. */
type BadgeTone = 'crypto' | 'kr' | 'us';

export interface MarketBadgeSpec {
    /**
     * 거래소 코드처럼 **번역하지 않는** 표시 문자열(`KOSPI`·`NYSE`). 고유명사라
     * 네 로케일 모두 같다.
     */
    label: string;
    /**
     * 번역이 필요한 배지의 `features.ticker-search.assetBadge` 키.
     * 있으면 `label`보다 우선한다 — `코인`·`미국 OTC`가 여기 해당한다.
     */
    labelKey?: string;
    tone: BadgeTone;
}

/**
 * 검색 결과의 시장 배지 — **모든 결과에 붙는다**.
 *
 * `삼성전자`를 검색하면 `005930.KS`(KOSPI 주 상장)와 `SSNLF`(미국 장외 비후원)가
 * 함께 나온다. 이름이 같아 사용자가 둘을 구분할 방법이 없었다 — 하나는 원화로
 * 거래되는 주 상장이고 다른 하나는 거래가 희박한 OTC다.
 *
 * 처음엔 국내·OTC에만 붙였는데, 그러면 배지의 **부재**가 정보를 나르게 된다 —
 * "배지 없음 = 미국 정규 상장"을 사용자가 학습해야 하고, 배지 로직이 조용히 깨져도
 * 화면상 구분이 안 간다. 세 자산군 전부 명시한다.
 *
 * 이 배지가 행에 유일한 거래소 표시다. 원래는 아래에 정식명 한 줄
 * (`Korea Exchange (KOSPI)`, `New York Stock Exchange Arca`)을 더 깔았는데, 배지를
 * 전 자산군으로 넓히면서 같은 정보가 두 번 나오게 됐고 **서로 어긋나기까지 했다** —
 * FMP는 Arca 상장을 `exchange: 'AMEX'`로 주는데 `exchangeFullName`은 `... Arca`다.
 * 좁은 화면에서 종목명을 밀어내던 것도 그 긴 줄이라 배지만 남긴다.
 */
function marketBadgeSpec(result: TickerSearchResult): MarketBadgeSpec | null {
    if (result.marketProfile === 'crypto') {
        return { label: 'Crypto', labelKey: 'coin', tone: 'crypto' };
    }
    if (isKrEquitySymbol(result.symbol)) {
        // 접미사→거래소 매핑은 `krExchangeOf` 한 곳에만 둔다. 여기서 `.KQ`를 다시
        // 판정하면 canonical 정규식(`KR_SYMBOL_RE`)보다 느슨한 두 번째 표가 생긴다.
        return { label: krExchangeOf(result.symbol).code, tone: 'kr' };
    }
    const full = (result.exchangeFullName ?? '').toLowerCase();
    if (full.includes('otc'))
        return { label: 'US OTC', labelKey: 'usOtc', tone: 'us' };

    const code = (result.exchange ?? '').trim().toUpperCase();
    if (!code) return null;
    return { ...(US_EXCHANGE_LABELS[code] ?? { label: code }), tone: 'us' };
}

/**
 * FMP `exchange` 코드 중 **그대로 노출하면 읽기 어려운 것만** 담는다. 표에 없는 코드는
 * 아래 `?? code` 폴백이 원문을 쓴다 — 새 거래소가 생겼다고 배지가 사라지는 것보다 낫다.
 * 그래서 `NASDAQ: 'NASDAQ'` 같은 항등 매핑은 넣지 않는다(폴백과 완전히 같은 동작이다).
 */
const US_EXCHANGE_LABELS: Record<string, { label: string; labelKey: string }> =
    {
        PNK: { label: 'US OTC', labelKey: 'usOtc' },
        OTC: { label: 'US OTC', labelKey: 'usOtc' },
    };

const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
    crypto: 'bg-primary-900/40 text-primary-300',
    kr: 'bg-primary-800/40 text-primary-200',
    us: 'bg-secondary-700/60 text-secondary-300',
};

/**
 * `self-center`가 핵심이다. 이 배지가 놓이는 행은 `items-baseline`이라 — 종목명과
 * 티커의 글자 밑선을 맞추기 위한 것이다 — 정렬을 상속받으면 배지의 **글자** 밑선이
 * 행 밑선에 맞춰지고, 위아래 패딩만큼 배지 상자가 아래로 내려가 미세하게 어긋난다.
 * 배지는 상자로 읽히는 요소라 상자의 세로 중앙이 맞아야 한다.
 */
export function MarketBadge({ label, labelKey, tone }: MarketBadgeSpec) {
    const tBadge = useTranslations('features.ticker-search.assetBadge');
    return (
        <span
            data-testid="market-badge"
            className={cn(
                'shrink-0 self-center rounded px-1.5 py-0.5 text-[0.625rem] leading-none font-semibold',
                BADGE_TONE_CLASS[tone]
            )}
        >
            {labelKey ? tBadge(labelKey) : label}
        </span>
    );
}

interface ResultItemProps {
    id: string;
    result: TickerSearchResult;
    isSelected: boolean;
    onSelect: (symbol: string, label: string) => void;
    onPrefetch: (symbol: string) => void;
}

function ResultItem({
    id,
    result,
    isSelected,
    onSelect,
    onPrefetch,
}: ResultItemProps) {
    // 한국어 사용자가 읽는 화면이므로 한글명이 있으면 그쪽이 주 이름이다.
    // 영문명은 한글명과 다를 때만 덧붙인다 — 종목 마스터 시드는 영문명을 주지 않아
    // `name`에 한글명을 넣어 두므로, 그대로 두면 `삼성전자 (삼성전자)`가 된다.
    //
    // 국내 상장 종목은 한 걸음 더 나아가 영문 법인명을 아예 붙이지 않는다.
    // `buildDisplayName`·`SymbolLayoutHeader`와 **같은 조건**이어야 한다 —
    // 여기만 빠지면 yahoo가 이름을 채운 종목(`Samsung Electronics Co., Ltd.`)이
    // 자동완성에서만 영문명을 달고 나와, 클릭해 들어간 페이지의 타이틀·헤더와
    // 표기가 어긋난다(MISTAKES.md "서버/클라이언트 도메인 조건 불일치").
    const primaryName = result.koreanName ?? result.name;
    const badge = marketBadgeSpec(result);
    const secondaryName =
        result.koreanName &&
        result.name !== result.koreanName &&
        !isKrEquitySymbol(result.symbol)
            ? result.name
            : null;

    return (
        <button
            id={id}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelect(result.symbol, primaryName)}
            onMouseEnter={() => onPrefetch(result.symbol)}
            className={cn(
                'hover:bg-secondary-700 focus-visible:ring-primary-500 w-full px-4 py-2 text-left transition-colors focus-visible:ring-1 focus-visible:outline-none',
                isSelected && 'bg-secondary-700'
            )}
        >
            {/* 회사명이 먼저, 티커가 뒤 — 사용자는 티커가 아니라 이름으로 종목을
                떠올린다(`삼성전자`, `애플`). 티커는 같은 이름의 종목을 구분하는
                보조 정보라 뒤에 둔다. */}
            <div className="flex items-baseline gap-2">
                <span className="truncate font-medium text-secondary-100">
                    {primaryName}
                </span>
                {badge && <MarketBadge {...badge} />}
                <span className="shrink-0 text-sm text-secondary-400">
                    {result.symbol}
                </span>
                {secondaryName && (
                    <span className="truncate text-sm text-secondary-500">
                        {secondaryName}
                    </span>
                )}
            </div>
        </button>
    );
}
