import Link from 'next/link';

interface OptionsEmptyStateProps {
    symbol: string;
}

const FALLBACK_LINK_CLASSES =
    'border-secondary-700 hover:border-primary-500 focus-visible:ring-primary-500 rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none';

const FALLBACK_PAGES = [
    {
        key: 'chart',
        label: '차트 분석',
        desc: '기술적 지표 + AI 종합 리포트',
        href: (s: string) => `/${s}`,
    },
    {
        key: 'fundamental',
        label: '펀더멘털 분석',
        desc: '재무·밸류에이션·미래 방향',
        href: (s: string) => `/${s}/fundamental`,
    },
    {
        key: 'news',
        label: '뉴스 분석',
        desc: '실시간 뉴스 + 애널리스트 의견 분석',
        href: (s: string) => `/${s}/news`,
    },
    {
        key: 'fear-greed',
        label: '공포 탐욕 지수',
        desc: '단기 매매 심리 0~100 점수',
        href: (s: string) => `/${s}/fear-greed`,
    },
] as const;

export function OptionsEmptyState({ symbol }: OptionsEmptyStateProps) {
    return (
        <main className="mx-auto max-w-5xl px-4 py-16">
            <div className="border-secondary-700 bg-secondary-800 rounded-xl border p-8 text-center">
                <h1 className="text-xl font-semibold tracking-tight">
                    {symbol} 옵션 시장 정보 없음
                </h1>
                <p className="text-secondary-400 mt-3 text-sm leading-relaxed">
                    {symbol}는 현재 옵션 시장이 형성되어 있지 않습니다.
                    <br />
                    다른 분석 페이지에서 종목을 살펴보세요.
                </p>
                <nav
                    className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
                    aria-label="다른 분석 페이지"
                >
                    {FALLBACK_PAGES.map(({ key, label, desc, href }) => (
                        <Link
                            key={key}
                            href={href(symbol)}
                            className={FALLBACK_LINK_CLASSES}
                        >
                            <p className="font-semibold">{label}</p>
                            <p className="text-secondary-400 mt-1 text-sm">
                                {desc}
                            </p>
                        </Link>
                    ))}
                </nav>
            </div>
        </main>
    );
}
