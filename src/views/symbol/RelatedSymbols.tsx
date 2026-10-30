import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { getLocale, getTranslations } from 'next-intl/server';
import { RelatedSymbolLink } from '@/views/symbol/RelatedSymbolLink';
import { relatedSymbolsFor } from '@/shared/config/relatedSymbols';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { resolveLocale } from '@/shared/i18n/locales';
import { resolveChipNames } from './relatedSymbolNames';
import { groupRelatedByLabel } from './utils/relatedSymbolChips';

interface RelatedSymbolsProps {
    /** 현재 심볼(대문자). 자기 자신은 목록에서 제외된다. */
    symbol: string;
}

/**
 * 심볼 페이지 하단의 "관련 종목" 칩 스트립 — 포털의 연관검색어와 같은 역할이다.
 *
 * ## 왜 있는가
 *
 * 심볼 페이지끼리 서로를 링크하는 간선을 만든다 — 없으면 sitemap의 심볼 대부분이 내부링크
 * 고아가 된다(측정과 링 설계 근거는 `relatedSymbolsFor` JSDoc). 링 ±1이 유니버스 전체를
 * 하나의 순환으로 잇는다.
 *
 * ## 왜 서버 컴포넌트이고, 왜 Suspense fallback이 아닌가
 *
 * **Suspense fallback에 두면 안 된다** — boundary가 resolve되는 순간 React가 그
 * 서브트리를 클라이언트에서 파괴해, JS를 실행하는 크롤러(Googlebot 렌더러 포함)
 * 에게는 링크가 사라진다(`TechnicalSnapshotProse`가 같은 이유로 persistent
 * server sibling이다 — `[symbol]/page.tsx` 주석 참고). 내부링크가 목적인
 * 컴포넌트가 렌더 후 사라지면 존재 이유가 통째로 없어진다.
 *
 * ## 왜 `<Suspense>`로 감싸지도 않는가
 *
 * 이 컴포넌트가 자체 I/O(피어 8종의 한글명 조회)를 하므로 `<Suspense fallback={null}>`
 * 의 **자식**으로 감싸면 콜드젠에서 셸을 먼저 흘려보낼 수 있다(fallback에 넣는 것과
 * 달리 자식은 하이드레이션 후에도 살아남는다). 그럼에도 감싸지 않는다:
 *
 * 1. **얻는 게 없다.** 워엄 렌더 실측 0.20~0.26초로 조회 비용이 관측되지 않는다.
 *    각 피어의 `assetInfo`는 그 종목 자기 페이지가 이미 채워 둔 `unstable_cache`
 *    엔트리를 공유하기 때문이다. 비용을 치르는 쪽은 6시간에 한 번 도는 콜드젠뿐이다.
 * 2. **잃는 게 있다.** Suspense 경계 뒤 콘텐츠는 raw HTML에서 문서 **끝쪽**에
 *    스트리밍된 뒤 스크립트로 제자리에 옮겨진다(같은 날 `/market` 실측: `<footer>`가
 *    26,177바이트, 본문이 40,391바이트 위치). JS를 실행하는 Googlebot은 문제없지만,
 *    **JS를 실행하지 않는 Naver Yeti·Daumoa에게는 내부링크가 푸터 뒤로 밀린다** —
 *    한국어 검색이 이 사이트의 주 유입이고 내부링크가 이 컴포넌트의 존재 이유다.
 *
 * 관측되지 않는 콜드젠 이득과 주 타깃 크롤러의 링크 위치를 맞바꾸지 않는다.
 *
 * 목록이 비면(유니버스 밖 심볼) 섹션 자체를 생략한다 — 제목만 남은 빈 껍데기를
 * 만들지 않는다.
 */
export async function RelatedSymbols({ symbol }: RelatedSymbolsProps) {
    const t = await getTranslations('views.symbol');
    // 그룹 캡션 키는 네임스페이스가 갈린다 — 큐레이션 카테고리는 홈 카탈로그를
    // 재사용한다(`RelatedSymbol.label` JSDoc). 그래서 루트 번역자로 전체 경로를 부른다.
    const tRoot = await getTranslations();
    const related = relatedSymbolsFor(symbol);
    if (related.length === 0) return null;
    const locale = resolveLocale(await getLocale());
    const names = await resolveChipNames(related, locale);
    const groups = groupRelatedByLabel(related);

    return (
        <nav
            aria-labelledby="related-symbols-heading"
            className={cn(SURFACE_CARD, 'mx-4 my-8 p-5')}
        >
            <h2 id="related-symbols-heading" className={HEADING_SECTION}>
                {t('RelatedSymbols.c35191')}
            </h2>
            {groups.map(({ label, items }) => (
                <div key={label} className="mt-3">
                    {/* 칩만 나열하면 왜 관련 종목인지 알 수 없다 — 그룹의 근거를
                        한 줄로 밝힌다(테마명 · 섹터명 · "다른 종목 둘러보기"). */}
                    <p className="text-xs text-secondary-500">{tRoot(label)}</p>
                    <ul className="mt-1.5 flex flex-wrap gap-2">
                        {items.map(item => {
                            // DB 이름이 우선 — 링크 대상 페이지의 제목과 같은 소스다.
                            // 폴백 규칙은 `resolveChipNames`가 모두 처리한다.
                            const chipName = names.get(item.symbol);
                            return (
                                <li key={item.symbol}>
                                    {/* href는 현재 탭에 맞춘다(뉴스·공포탐욕 탭이면
                                        그 탭 유지) — 이유는 `RelatedSymbolLink` JSDoc. */}
                                    <RelatedSymbolLink
                                        symbol={item.symbol}
                                        className="inline-flex items-baseline gap-1.5 rounded-full border border-border-control bg-secondary-900/60 px-3 py-1.5 text-sm text-secondary-300 transition-colors hover:border-primary-500 hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                                    >
                                        {/* 이름과 티커 사이 공백은 실제 텍스트다 — `gap-1.5`만 두면
                                            링크의 접근 가능한 이름·앵커 텍스트가 `엔비디아NVDA`로
                                            붙는다(inline-flex라 공백 노드는 화면 간격을 바꾸지 않는다). */}
                                        {chipName !== undefined && (
                                            <>
                                                <span>{chipName}</span>{' '}
                                            </>
                                        )}
                                        {/* 표기는 접미사를 뗀 `displayTicker` — 국내 종목의
                                            `.KS`/`.KQ`는 검색량이 0이고 사이트의 title
                                            표기도 이미 떼고 있다(RelatedSymbol JSDoc). */}
                                        <span className="font-mono text-xs text-secondary-400">
                                            {item.displayTicker}
                                        </span>
                                    </RelatedSymbolLink>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </nav>
    );
}
