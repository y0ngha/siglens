'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
// `next/link`가 아니라 로케일 접두사를 붙이는 래퍼다 — 그냥 `next/link`를 쓰면
// `/ja`에서 누른 링크가 ko 라우트로 나간다.
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

import { useRecentSearches } from '../hooks/useRecentSearches';
import { SearchGlyph } from './SearchTriggerButton';
import {
    HERO_RECENT_CHIP_LIMIT,
    SEARCH_PLACEHOLDER_KEY,
} from '../lib/searchLabels';
import { useSearchOverlayTrigger } from '../model/SearchOverlayContext';
import { TickerAutocomplete } from './TickerAutocomplete';
import { cn } from '@/shared/lib/cn';

interface SymbolSearchPanelProps {
    className?: string;
}

export function SymbolSearchPanel({ className }: SymbolSearchPanelProps) {
    const t = useTranslations('features.ticker-search');
    const tRecent = useTranslations('features.ticker-search.recentSearch');
    /**
     * "모두 지우기"는 자기 자신이 든 행을 통째로 언마운트시킨다. 그대로 두면 포커스가
     * `<body>`로 떨어져 다음 Tab이 문서 처음부터 시작한다(WCAG 2.4.3). 지운 뒤
     * 검색 표면으로 돌려보낸다 — 그 행에서 이어질 만한 유일한 행동이다.
     */
    const triggerRef = useRef<HTMLButtonElement>(null);
    /**
     * 데스크톱(`lg`)에서는 위 트리거가 `display:none`이라 `focus()`가 **아무 일도 하지
     * 않는다**. 브레이크포인트마다 보이는 검색 표면이 다르므로 복원 대상도 갈라야 한다.
     */
    const desktopSearchRef = useRef<HTMLDivElement>(null);
    /** 칩 하나를 지웠을 때 포커스가 머물 자리. 남은 칩이 있으면 목록 안이 자연스럽다. */
    const chipRowRef = useRef<HTMLDivElement>(null);

    const { recentSearches, addSearch, removeSearch, clearAll } =
        useRecentSearches();
    const overlay = useSearchOverlayTrigger();

    return (
        <div className={cn('flex w-full flex-col', className)}>
            {/*
                모바일에서는 히어로 검색창이 **트리거**다.
                폭이 아니라 키보드가 문제여서다 — 이 입력은 이미 전폭이지만, 탭하면
                키보드가 화면의 45%를 먹어 앵커드 드롭다운에 남는 세로가 ~140px(항목
                2~3개)뿐이다. 헤더 검색과 같은 전체화면 오버레이로 보내 검색 경험을
                한 벌로 유지한다.

                겉모습은 그대로 둔다 — 홈의 주 행동 유도라 시각적 앵커가 필요하다.
                실제 `<input>` 대신 버튼을 쓰는 이유는, 타이핑을 받지 못하는 입력이
                포커스만 먹고 키보드를 올리면 사용자가 "먹통"으로 읽기 때문이다.
            */}
            {/* provider가 없으면(테스트·스토리북) 트리거 자체를 렌더하지 않는다.
                누르면 아무 일도 없는 컨트롤을 홈의 주 CTA 자리에 두는 것보다 낫다 —
                `HeaderSearch`와 같은 정책. */}
            {overlay && (
                <button
                    ref={triggerRef}
                    type="button"
                    onClick={overlay.open}
                    // aria-label을 두지 않는다. 버튼의 텍스트가 곧 접근 이름이 되고,
                    // 그게 화면에 보이는 문구와 일치해야 한다(WCAG 2.5.3 Label in Name).
                    // `aria-label="종목 검색 열기"`를 붙이면 음성 입력 사용자가 화면에 보이는
                    // "종목명 · 티커 검색"으로는 이 버튼을 부를 수 없게 된다.
                    className="focus-glow flex h-12 w-full touch-manipulation items-center gap-2 rounded-lg border border-border-control bg-secondary-800 px-4 text-left text-base text-secondary-400 transition-colors hover:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none lg:hidden"
                >
                    <SearchGlyph className="h-4 w-4 shrink-0" />
                    {t(SEARCH_PLACEHOLDER_KEY)}
                </button>
            )}
            <div ref={desktopSearchRef} className="hidden lg:block">
                <TickerAutocomplete size="lg" onSelect={addSearch} />
            </div>

            {recentSearches.length > 0 && (
                <div
                    ref={chipRowRef}
                    tabIndex={-1}
                    className="mt-4 flex flex-wrap items-center justify-center gap-2 outline-none lg:justify-start"
                >
                    <span className="text-xs text-secondary-400">
                        {t('SymbolSearchPanel.d7fe41')}
                    </span>
                    {recentSearches.map((entry, index) => (
                        <span
                            key={entry.symbol}
                            className={cn(
                                'touch-manipulation items-center gap-1 rounded-full border border-primary-600/30 bg-primary-600/5 pr-1 pl-3 text-xs text-secondary-200 transition-colors hover:border-primary-500/60 hover:text-primary-300',
                                // 히어로는 첫 화면 세로가 귀하다 — 4개까지만 보여주고
                                // 나머지는 `lg`부터 드러낸다. 잘라내지 않고 CSS로 감추는 이유는
                                // 브레이크포인트마다 **개수가 달라야** 하기 때문이다 — JS는
                                // 렌더 시점에 뷰포트를 모르므로 한 벌만 만들 수 있다.
                                index < HERO_RECENT_CHIP_LIMIT
                                    ? 'inline-flex'
                                    : 'hidden lg:inline-flex'
                            )}
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
                                        ? tRecent('removeRecent', {
                                              v0: entry.symbol,
                                          })
                                        : tRecent('removeRecentNamed', {
                                              v0: entry.label,
                                              v1: entry.symbol,
                                          })
                                }
                                onClick={() => {
                                    removeSearch(entry.symbol);
                                    // 이 버튼은 자기 자신을 언마운트시킨다 —
                                    // 포커스를 목록에 붙들어 둔다(WCAG 2.4.3).
                                    chipRowRef.current?.focus();
                                }}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full leading-none text-secondary-400 hover:text-secondary-100 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                            >
                                ✕
                            </button>
                        </span>
                    ))}
                    <button
                        type="button"
                        onClick={() => {
                            clearAll();
                            // `display:none`인 요소에 `focus()`를 주면 조용히
                            // 실패하고 포커스가 <body>로 떨어진다. `offsetParent`로
                            // 판정하면 레이아웃이 없는 jsdom에서 항상 숨김으로
                            // 잡히므로 계산된 스타일을 본다.
                            const trigger = triggerRef.current;
                            if (
                                trigger &&
                                getComputedStyle(trigger).display !== 'none'
                            ) {
                                trigger.focus();
                                return;
                            }
                            desktopSearchRef.current
                                ?.querySelector('input')
                                ?.focus();
                        }}
                        // 24×24 미만이면 WCAG 2.5.8을 만족하지 못한다 — text-xs의
                        // line-height는 16px뿐이라 세로 패딩으로 채운다.
                        className="ml-1 inline-flex min-h-6 touch-manipulation items-center px-1 text-xs text-secondary-400 underline-offset-2 hover:text-secondary-200 hover:underline"
                    >
                        {t('SymbolSearchPanel.9d0d41')}
                    </button>
                </div>
            )}
        </div>
    );
}
