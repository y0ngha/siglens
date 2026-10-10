export interface NotFoundLink {
    readonly id: string;
    readonly href: string;
    readonly label: string;
}

export interface NotFoundLayoutProps {
    readonly wordmark: string;
    readonly homeHref: string;
    /**
     * 문서 제목(`<title>`). React가 `<head>`로 끌어올려 렌더한다 — 제목을 마크업의 일부로 두는
     * 이유는 `NotFoundView`의 JSDoc 참고(`document.title` 직접 대입은 하이드레이션에 덮인다).
     */
    readonly documentTitle: string;
    /** 시장 내비. 비어 있으면(SIGLENS AI·비기본 표면) 내비를 그리지 않는다. */
    readonly navLabel?: string;
    readonly navLinks?: readonly NotFoundLink[];
    readonly title: string;
    readonly description?: string;
    readonly homeLabel: string;
    readonly shortcuts?: readonly NotFoundLink[];
}

const WORDMARK_CLASSES =
    'inline-flex min-h-11 items-center rounded px-1 font-mono text-sm font-semibold tracking-[0.15em] text-secondary-100 uppercase focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';
const NAV_LINK_CLASSES =
    'inline-flex min-h-11 items-center rounded px-2 text-sm font-semibold text-secondary-400 transition-colors hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';
const PRIMARY_LINK_CLASSES =
    'mt-8 inline-flex min-h-11 items-center rounded-lg bg-primary-600 px-6 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';
const SECONDARY_LINK_CLASSES =
    'inline-flex min-h-11 items-center rounded-full border border-border-control px-4 text-xs text-secondary-300 transition-colors hover:border-primary-500 hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

/**
 * 루트 404의 브랜드 바 + 본문 마크업 — **서버·클라이언트가 같은 정의를 쓴다.**
 *
 * 서버(`not-found.tsx`)가 한국어 · 메인 호스트 전체 문구로 그리고, 클라이언트 섬
 * (`NotFoundView`)이 비기본 표면(다른 로케일·ai 호스트)을 최소 문구로 그린다.
 * `'use client'`가 없는 순수 프레젠테이션이라 양쪽에서 import할 수 있다.
 *
 * `<title>`도 이 마크업의 일부다 — 표면이 바뀌면 이전 표면의 제목이 언마운트되고 새 제목이
 * 마운트되므로 React가 `<head>`의 단일 `<title>`을 일관되게 소유한다.
 *
 * 헤더 위젯(`Header`)은 클라이언트 프로바이더·검색·사용자 메뉴가 얽혀 있어 프로바이더가
 * 없는 루트에서 쓸 수 없다 — 같은 높이(`h-14`)와 하단 보더만 맞춘 워드마크 + 내비다.
 */
export function NotFoundLayout({
    wordmark,
    homeHref,
    documentTitle,
    navLabel,
    navLinks = [],
    title,
    description,
    homeLabel,
    shortcuts = [],
}: NotFoundLayoutProps) {
    return (
        <>
            <title>{documentTitle}</title>
            <header className="border-b border-secondary-700 bg-secondary-900">
                <div className="flex h-14 items-center gap-2 px-4 sm:gap-4">
                    <a
                        href={homeHref}
                        translate="no"
                        className={WORDMARK_CLASSES}
                    >
                        {wordmark}
                    </a>
                    {navLinks.length > 0 && (
                        <nav
                            aria-label={navLabel}
                            className="hidden items-center gap-1 sm:flex"
                        >
                            {navLinks.map(link => (
                                <a
                                    key={link.id}
                                    href={link.href}
                                    className={NAV_LINK_CLASSES}
                                >
                                    {link.label}
                                </a>
                            ))}
                        </nav>
                    )}
                </div>
            </header>
            <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
                <p className="font-mono text-sm tracking-widest text-primary-400">
                    404
                </p>
                <h1 className="mt-4 text-2xl font-bold text-secondary-100">
                    {title}
                </h1>
                {description && (
                    <p className="mt-3 max-w-md text-sm leading-relaxed text-secondary-400">
                        {description}
                    </p>
                )}
                <a href={homeHref} className={PRIMARY_LINK_CLASSES}>
                    {homeLabel}
                </a>
                {shortcuts.length > 0 && (
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                        {shortcuts.map(link => (
                            <a
                                key={link.id}
                                href={link.href}
                                className={SECONDARY_LINK_CLASSES}
                            >
                                {link.label}
                            </a>
                        ))}
                    </div>
                )}
            </main>
        </>
    );
}
