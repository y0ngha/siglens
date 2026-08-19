'use client';

import { useTranslations } from 'next-intl';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

import { useRecentSearches } from '../hooks/useRecentSearches';
import { TickerAutocomplete } from './TickerAutocomplete';
import { cn } from '@/shared/lib/cn';

interface SymbolSearchPanelProps {
    className?: string;
}

export function SymbolSearchPanel({ className }: SymbolSearchPanelProps) {
    const t = useTranslations('features.ticker-search');
    const { recentSearches, addSearch, removeSearch, clearAll } =
        useRecentSearches();

    return (
        <div className={cn('flex w-full flex-col', className)}>
            <TickerAutocomplete size="lg" onSelect={addSearch} />

            {recentSearches.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                    <span className="text-xs text-secondary-500">
                        {t('SymbolSearchPanel.d7fe41')}
                    </span>
                    {recentSearches.map(entry => (
                        <span
                            key={entry.symbol}
                            className="inline-flex touch-manipulation items-center gap-1 rounded-full border border-primary-600/30 bg-primary-600/5 pr-1 pl-3 text-xs text-secondary-200 transition-colors hover:border-primary-500/60 hover:text-primary-300"
                        >
                            {/*
                                a11y target-size: WCAG 2.5.8 requires interactive
                                targets ≥ 24×24 CSS px. The ✕ button's visible
                                glyph stays small because it inherits text-xs
                                sizing inside the 24×24 flex box.
                            */}
                            <Link
                                href={`/${entry.symbol}`}
                                onClick={() => addSearch(entry)}
                                // 티커를 화면에서 뺐으므로 hover/스크린리더용으로
                                // 남긴다 — `삼성전자`는 KRX 상장과 미국 OTC 둘 다로
                                // 최근 검색에 남을 수 있어 라벨만으로는 구분이 안 된다.
                                title={entry.symbol}
                                // 최근 검색 목록으로 다수 렌더 —
                                // docs/architecture/CDN_CACHING.md §1
                                prefetch={false}
                                className="inline-flex min-h-6 max-w-[12rem] items-center rounded py-1.5 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                            >
                                {/* 티커가 아니라 회사명을 보여준다 — `005930.KS`보다
                                    `삼성전자`가 사용자에게 유의미하다. 라벨을 모르는
                                    옛 저장값은 파서가 심볼로 승격시켜 그대로 뜬다. */}
                                {/* `truncate`는 이 Link가 아니라 안쪽 span에 건다 —
                                    `text-overflow`는 블록 컨테이너에만 적용돼,
                                    `inline-flex`인 Link에 걸면 말줄임표 없이
                                    글자만 잘린다. */}
                                <span className="truncate">{entry.label}</span>
                            </Link>
                            <button
                                type="button"
                                // 라벨만 쓰면 같은 회사의 KRX/OTC 두 칩이 완전히
                                // 동일한 접근 이름을 갖는다. 다만 라벨이 곧 심볼인
                                // 항목(회사명을 모르는 옛 저장값·직접 입력)까지
                                // 괄호를 붙이면 `AAPL (AAPL)`이 되어 스크린리더가
                                // 같은 말을 두 번 읽는다.
                                aria-label={
                                    entry.label === entry.symbol
                                        ? `${entry.symbol} 최근 검색에서 제거`
                                        : `${entry.label} (${entry.symbol}) 최근 검색에서 제거`
                                }
                                onClick={() => removeSearch(entry.symbol)}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full leading-none text-secondary-500 hover:text-secondary-100 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                            >
                                ✕
                            </button>
                        </span>
                    ))}
                    <button
                        type="button"
                        onClick={clearAll}
                        className="ml-1 text-xs text-secondary-500 underline-offset-2 hover:text-secondary-300 hover:underline"
                    >
                        {t('SymbolSearchPanel.9d0d41')}
                    </button>
                </div>
            )}
        </div>
    );
}
