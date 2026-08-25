import Link from 'next/link';
import { relatedSymbolsFor } from '@/shared/config/relatedSymbols';
import { getAssetInfoResilient } from '@/entities/ticker';
import { isDynamicServerError } from '@/shared/lib/isDynamicServerError';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

interface RelatedSymbolsProps {
    /** 현재 심볼(대문자). 자기 자신은 목록에서 제외된다. */
    symbol: string;
}

/**
 * 칩에 쓸 한글명을 확정한다. 큐레이션 상수(무비용)를 기본으로 두고, DB에 이름이
 * 있으면 그쪽을 쓴다.
 *
 * ## 왜 DB를 읽는가
 *
 * `relatedSymbolsFor`는 I/O 0인 순수 함수라 큐레이션 상수에 있는 이름만 붙일 수
 * 있는데, 2026-08-24 실측 기준 그 커버리지가 **전체 칩의 42%**였다. 나머지는
 * `LENZ`·`TSM`처럼 티커만 노출됐다 — 정작 그 종목 페이지 제목은 "렌즈
 * 테라퓨틱스(LENZ)", "TSMC(TSM)"으로 멀쩡히 한글명을 쓰고 있는데도. 같은 종목이
 * 화면마다 다른 이름으로 보이는 데다, 한국어 질의에 걸리는 앵커 텍스트를 절반 넘게
 * 버리는 셈이었다.
 *
 * ## 왜 이 방식인가 — 새 조회 경로를 만들지 않는다
 *
 * `getAssetInfoResilient`는 이 페이지가 현재 심볼에 대해 이미 쓰는 리졸버이고
 * 심볼당 `unstable_cache`로 감싸져 있다. 그래서 (a) 칩 이름이 링크 대상 페이지의
 * 제목과 **같은 소스**라 어긋날 수 없고, (b) 각 피어의 엔트리는 그 종목 자신의
 * 페이지 렌더가 이미 채워 둔 것을 공유하며, (c) 번역이 나중에 채워져도 자동으로
 * 따라온다. `Promise.all`이라 왕복은 한 번이다.
 *
 * 인프라 실패는 삼킨다 — 이름 하나 없다고 내부링크가 사라지면 이 컴포넌트의 존재
 * 이유가 없어진다. 그 경우 큐레이션 이름(있으면)으로, 없으면 티커로 폴백한다.
 * **단 `DYNAMIC_SERVER_USAGE`는 예외로 되던진다** — 실패가 아니라 Next의 제어 흐름
 * 신호이기 때문이다(아래 catch 주석).
 */
async function resolveKoreanNames(
    symbols: readonly string[]
): Promise<ReadonlyMap<string, string>> {
    const resolved = await Promise.all(
        symbols.map(async symbol => {
            try {
                const { assetInfo } = await getAssetInfoResilient(symbol);
                return [symbol, assetInfo?.koreanName] as const;
            } catch (e: unknown) {
                // `DYNAMIC_SERVER_USAGE`는 실패가 아니라 Next의 **제어 흐름
                // 신호**다 — 정적 생성 중 동적 API가 쓰였으니 이 렌더를 포기하라는
                // 뜻이다. 삼키면 Next가 의도한 bail-out을 막아 잘못된 결과를 캐시에
                // 굳힌다(#545 인시던트). 형제 resilient 래퍼들과 동일하게 되던진다.
                if (isDynamicServerError(e)) throw e;
                console.error(
                    `[RelatedSymbols] koreanName lookup failed for ${symbol}:`,
                    e
                );
                return [symbol, undefined] as const;
            }
        })
    );
    return new Map(
        resolved.filter((entry): entry is readonly [string, string] =>
            Boolean(entry[1])
        )
    );
}

/**
 * 심볼 페이지 하단의 "관련 종목" 칩 스트립 — 포털의 연관검색어와 같은 역할이다.
 *
 * ## 왜 있는가
 *
 * 2026-08-24 실측에서 sitemap이 광고하는 심볼 431종 중 **303종(70%)이 내부링크
 * 고아**였다(자세한 측정과 링 설계 근거는 `relatedSymbolsFor` JSDoc). 심볼
 * 페이지끼리 서로를 하나도 링크하지 않았기 때문인데, 이 컴포넌트가 그 간선을
 * 만든다. 링 ±1이 유니버스 전체를 하나의 순환으로 이어 고아가 0이 된다.
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
    const related = relatedSymbolsFor(symbol);
    if (related.length === 0) return null;
    const koreanNames = await resolveKoreanNames(related.map(r => r.symbol));

    return (
        <nav
            aria-labelledby="related-symbols-heading"
            className="mt-6 rounded-lg border border-secondary-800 bg-secondary-800/30 p-5"
        >
            <h2 id="related-symbols-heading" className={HEADING_SECTION}>
                관련 종목
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
                {related.map(item => {
                    // DB 이름이 우선 — 링크 대상 페이지의 제목과 같은 소스다.
                    // 큐레이션 이름은 DB가 비었을 때의 폴백.
                    const koreanName =
                        koreanNames.get(item.symbol) ?? item.koreanName;
                    return (
                        <li key={item.symbol}>
                            <Link
                                href={`/${item.symbol}`}
                                // prefetch={false}: 칩이 8개라 기본 prefetch면 뷰포트
                                // 진입 시 RSC 페이로드 8벌(심볼당 ~35KB gzip)을 한꺼번에
                                // 당긴다. 이 스트립은 탐색 보조라 즉시성이 필요 없다.
                                prefetch={false}
                                className="inline-flex items-baseline gap-1.5 rounded-full border border-border-control bg-secondary-900/60 px-3 py-1.5 text-sm text-secondary-300 transition-colors hover:border-primary-500 hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                            >
                                {koreanName !== undefined && (
                                    <span>{koreanName}</span>
                                )}
                                {/* href는 canonical `symbol`, 표기는 접미사를 뗀
                                    `displayTicker` — 국내 종목의 `.KS`/`.KQ`는
                                    검색량이 0이고 사이트의 title 표기도 이미 떼고
                                    있다(RelatedSymbol JSDoc). */}
                                <span className="font-mono text-xs text-secondary-400">
                                    {item.displayTicker}
                                </span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
