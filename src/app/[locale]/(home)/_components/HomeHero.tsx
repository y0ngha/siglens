import { HeroIllustration } from '@/widgets/home/HeroIllustration';
import { SymbolSearchPanel } from '@/features/ticker-search/ui/SymbolSearchPanel';
import { aiAskUrl } from '@/shared/config/aiHost';
import { localePath, type Locale } from '@/shared/i18n/locales';
import { brandAiName } from '@/shared/lib/brandName';
import { brandIntroName } from '@/shared/lib/seo';
import { BetaBadge } from '@/shared/ui/BetaBadge';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

/** 히어로 아래 빠른 이동 링크 하나. 라벨은 페이지가 번역해 넘긴다. */
export interface HomeHeroQuickLink {
    readonly href: string;
    readonly label: string;
}

/** 히어로 문구. i18n 추출기가 `page.tsx`의 `t()` 호출로 키를 수집하므로 번역은 페이지가 맡는다. */
export interface HomeHeroCopy {
    /** SIGLENS AI 안내 줄의 설명. */
    readonly aiTeaser: string;
    /** 제목 위 한 줄. 타이밍이 아니라 지켜볼 가격을 본다는 포지셔닝을 말한다(조언 어조 금지). */
    readonly eyebrow: string;
    /** H1 첫 구절(가격대 지도 포지셔닝, 주식과 코인 포함). 둘째 구절은 로케일 브랜드명이다. */
    readonly headline: string;
    /** 제목 아래 소개 문단의 첫 문장(보조지표 개수가 들어간 문장, 개수 0이면 숫자 없는 변형). */
    readonly intro: string;
    /** 소개 문단의 둘째 문장. `sm` 이상에서만 줄을 바꾼다. */
    readonly introTail: string;
}

/**
 * 소개 문단 두 문장 사이의 구분자(NBSP). 둘째 문장 앞 `<br>`은 `sm` 이상에서만 보이므로 모바일에서는
 * 이 구분자가 두 문장을 가른다. 공백만 있는 JSX 텍스트 줄에 두면 컴파일러마다 처리가 달라(SWC는
 * 남기고 esbuild는 버린다) 구분자를 명시적 문자열로 둔다 — 컴파일러의 JSX 공백 규칙과 무관하게
 * 같은 DOM이 나온다.
 */
const INTRO_SENTENCE_JOINER = '\u00a0';

interface HomeHeroProps {
    readonly locale: Locale;
    readonly copy: HomeHeroCopy;
    readonly quickLinks: readonly HomeHeroQuickLink[];
}

/**
 * 홈 히어로 — SIGLENS AI 안내 줄, H1, 소개 문단, 종목 검색, 빠른 이동 링크, 일러스트(이 순서).
 *
 * 서버 컴포넌트다. 문구는 이미 번역된 문자열로 받아 이 컴포넌트는 배치만 맡는다.
 */
export function HomeHero({ locale, copy, quickLinks }: HomeHeroProps) {
    return (
        <div className="relative grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-10">
            <div className="text-center lg:text-left">
                {/* 메인 홈에서 SIGLENS AI로 가는 유일한 입구 — 배너가 아니라 제목 위의 조용한 안내 줄이다.
                    제품명은 로케일을 따른다(ko `시그렌즈 AI`). */}
                <a
                    href={aiAskUrl(localePath(locale, '/'))}
                    className="mb-4 inline-flex min-h-9 max-w-full items-center gap-2 rounded-full border border-border-control px-3 text-xs text-secondary-300 hover:border-primary-400 hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    <span className="inline-flex items-center gap-1.5 font-mono font-semibold tracking-[0.12em] text-primary-400 uppercase">
                        <span translate="no">{brandAiName(locale)}</span>
                        <BetaBadge />
                    </span>
                    <span className="truncate">{copy.aiTeaser}</span>
                    <span aria-hidden="true">→</span>
                </a>
                <p className="mb-5 text-xs font-semibold tracking-[0.01em] text-secondary-400">
                    {copy.eyebrow}
                </p>
                {/*
                    제목 크기는 뷰포트가 아니라 자기 글상자 폭을 따른다. `lg`에서 히어로가 2단으로 갈리며
                    텍스트 컬럼이 좁아지는데 `vw` 기준 clamp은 그걸 볼 수 없다. 래퍼를 컨테이너로 삼아
                    `cqw`를 쓰면 한 규칙으로 전 구간이 맞는다. 제목 글자(Pretendard 700, `tracking-tight`)를
                    실측한 폭은 ko 헤드라인 "주식과 코인의 가격대 지도"가 11.39em이라 한 줄에 드는 한계치가
                    8.78cqw이고(브랜드 줄은 8.67em, 11.53cqw), 7.4cqw는 글상자 폭 288~672px 어디서나 여유를 두고
                    헤드라인 한 줄 + 브랜드 한 줄, 곧 2줄에 든다. en 헤드라인 "A price-level map for stocks and
                    crypto"는 15.78em(한계치 6.34cqw)이라 `lg`에서도 `text-balance`로 두 줄에 나뉘어 브랜드 줄까지
                    3줄이 된다 — 규칙을 로케일별로 나누지 않고 이 줄 수를 받아들인다.

                    하한 2.1rem은 모바일(글상자 288px)에서 글자가 21px까지 떨어지는 걸 막는다 — 이 폭에서는
                    4줄로 흐르는 게 정상이다. 상한 3.25rem은 글상자 최대치(`max-w-2xl` 672px)에서 도달하지
                    않는 안전장치다.

                    두 구절은 모든 폭에서 줄을 나눈다 — 모바일에서 붙으면 "분석 서비스 시그렌즈"가 한
                    덩어리로 읽힌다. 둘째 구절은 브랜드명(`brandIntroName`)이다 — H1에 한글 표기가 들어가야
                    "시그렌즈" 검색이 홈으로 온다.
                */}
                <div className="@container mx-auto max-w-sm sm:max-w-2xl lg:mx-0">
                    <h1 className="text-[clamp(2.1rem,7.4cqw,3.25rem)] leading-[1.12] font-bold tracking-tight text-balance text-secondary-50">
                        {copy.headline}{' '}
                        <span className="block text-primary-300">
                            {brandIntroName(locale)}
                        </span>
                    </h1>
                </div>
                <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-secondary-400 sm:max-w-2xl sm:text-lg lg:mx-0">
                    {copy.intro}
                    {INTRO_SENTENCE_JOINER}
                    <br className="hidden sm:block" />
                    {copy.introTail}
                </p>
                {/* 홈 건너뛰기 링크(`page.tsx`의 `#search`)의 대상이다. `tabIndex={-1}`이 없으면 링크가 해시만 바꾸고 DOM 포커스는
                    body에 남는다. SC 2.4.1 자체는 랜드마크(main 1개 + 라벨된 nav)로 충족된다. */}
                <div
                    id="search"
                    tabIndex={-1}
                    className="mt-8 flex w-full justify-center focus:outline-none lg:justify-start"
                >
                    <SymbolSearchPanel className="max-w-2xl lg:max-w-none" />
                </div>
                <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 lg:justify-start">
                    {quickLinks.map(({ href, label }) => (
                        <Link
                            key={href}
                            href={href}
                            // 헤더 내비와 같은 목적지를 한 번 더 노출한다. prefetch를 켜면 같은 목적지에
                            // 진입 경로별로 다른 `_rsc` 키가 쌓여 CDN 캐시가 파편화된다.
                            prefetch={false}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-primary-400 transition-colors hover:text-primary-300"
                        >
                            {label} <span aria-hidden="true">→</span>
                        </Link>
                    ))}
                </div>
            </div>
            {/*
                일러스트는 텍스트 컬럼(H1, 소개, 검색, 빠른 이동) 뒤에 온다. 모바일에서 장식 그림이
                H1과 검색 상자보다 먼저 와 첫 화면을 차지하던 문제를 바로잡았다 — 읽는 순서도
                H1, 검색, 일러스트다. `lg` 이상은 그리드가 텍스트를 왼쪽, 일러스트를 오른쪽에 두므로
                배치가 같다. `lg` 미만은 그리드가 한 열이라 그림이 빠른 이동 링크 아래 ~265px을 차지할
                뿐 정보가 없다 — 클래스로 첫 페인트부터 숨겨 모바일 높이를 줄인다(모바일 LCP는 이미
                텍스트다). `HeroIllustration`이 `width`/`height`를 내려 자리를 미리 잡아 CLS는 없다.
            */}
            <div className="hidden lg:block">
                <HeroIllustration className="mx-auto h-auto w-full max-w-md lg:max-w-none" />
            </div>
        </div>
    );
}
