'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
// `next/link`가 아니라 로케일 접두사를 붙이는 래퍼다 — 그냥 `next/link`를 쓰면
// `/ja`에서 누른 링크가 ko 라우트로 나간다.
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { CloseIcon } from '@/shared/ui/StrokeIcons';
import type { UseRecentSearchesResult } from '../hooks/useRecentSearches';
import { HERO_RECENT_CHIP_LIMIT } from '../lib/searchLabels';

interface HeroRecentSearchesProps {
    entries: UseRecentSearchesResult['recentSearches'];
    /** 칩을 눌러 그 종목으로 갈 때. 최근 검색 맨 앞으로 다시 올린다. */
    onSelect: UseRecentSearchesResult['addSearch'];
    onRemove: UseRecentSearchesResult['removeSearch'];
    onClearAll: UseRecentSearchesResult['clearAll'];
    /**
     * 이 행이 통째로 사라진 뒤(모두 지우기·마지막 칩 제거) 포커스를 받을 자리로 보낸다.
     * 그대로 두면 포커스가 `<body>`로 떨어져 다음 Tab이 문서 처음부터 시작한다(WCAG 2.4.3).
     */
    onEmptied: () => void;
}

/**
 * 홈 히어로의 최근 검색 칩 행. 항목이 없으면 그리지 않는다.
 *
 * 티커가 아니라 회사명을 보여 준다 — `005930.KS`보다 `삼성전자`가 사용자에게 유의미하다.
 * 라벨을 모르는 옛 저장값은 파서가 심볼로 승격시켜 그대로 뜬다.
 */
export function HeroRecentSearches({
    entries,
    onSelect,
    onRemove,
    onClearAll,
    onEmptied,
}: HeroRecentSearchesProps) {
    const t = useTranslations('features.ticker-search');
    const tRecent = useTranslations('features.ticker-search.recentSearch');
    /** 칩 하나를 지웠을 때 포커스가 머물 자리. 남은 칩이 있으면 목록 안이 자연스럽다. */
    const chipRowRef = useRef<HTMLDivElement>(null);

    function handleRemove(symbol: string) {
        onRemove(symbol);
        // 이 버튼은 자기 자신을 언마운트시킨다. 마지막 칩이었으면 행까지 사라지므로
        // 행이 아니라 검색 표면으로 보낸다.
        if (entries.length === 1) {
            onEmptied();
            return;
        }
        chipRowRef.current?.focus();
    }

    function handleClearAll() {
        onClearAll();
        onEmptied();
    }

    if (entries.length === 0) return null;

    return (
        <div
            ref={chipRowRef}
            tabIndex={-1}
            className="mt-4 flex flex-wrap items-center justify-center gap-2 outline-none lg:justify-start"
        >
            <span className="text-xs text-secondary-400">
                {t('SymbolSearchPanel.d7fe41')}
            </span>
            {entries.map((entry, index) => (
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
                    <Link
                        href={`/${entry.symbol}`}
                        onClick={() => onSelect(entry)}
                        // 티커를 화면에서 뺐으므로 hover/스크린리더용으로
                        // 남긴다 — `삼성전자`는 KRX 상장과 미국 OTC 둘 다로
                        // 최근 검색에 남을 수 있어 라벨만으로는 구분이 안 된다.
                        title={entry.symbol}
                        // 최근 검색 칩은 여러 개가 한꺼번에 렌더된다 — 종목 페이지
                        // RSC 페이로드가 커서 칩마다 미리 받으면 오리진 전송량이 폭증한다.
                        prefetch={false}
                        className="inline-flex min-h-6 max-w-[12rem] items-center rounded py-1.5 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        {/* `truncate`는 이 Link가 아니라 안쪽 span에 건다 —
                            `text-overflow`는 블록 컨테이너에만 적용돼,
                            `inline-flex`인 Link에 걸면 말줄임표 없이
                            글자만 잘린다. */}
                        <span className="truncate">{entry.label}</span>
                    </Link>
                    {/* WCAG 2.5.8: 대상은 24×24 CSS px 이상이어야 한다. ✕ 글리프(size-3)는
                        작게 두고 24×24 상자 안에 넣는다. */}
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
                        onClick={() => handleRemove(entry.symbol)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full leading-none text-secondary-400 hover:text-secondary-100 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        <CloseIcon className="size-3" />
                    </button>
                </span>
            ))}
            <button
                type="button"
                onClick={handleClearAll}
                // 24×24 미만이면 WCAG 2.5.8을 만족하지 못한다 — text-xs의
                // line-height는 16px뿐이라 세로 패딩으로 채운다.
                className="ml-1 inline-flex min-h-6 touch-manipulation items-center rounded px-1 text-xs text-secondary-400 underline-offset-2 hover:text-secondary-200 hover:underline focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                {t('SymbolSearchPanel.9d0d41')}
            </button>
        </div>
    );
}
