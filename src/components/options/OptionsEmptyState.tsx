// TODO(Phase 5): Enhance with polished empty-state illustration and copy.
import Link from 'next/link';

interface OptionsEmptyStateProps {
    symbol: string;
}

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
                    <Link
                        href={`/${symbol}`}
                        className="border-secondary-700 hover:border-primary-500 focus-visible:ring-primary-500 rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                        <p className="font-semibold">차트 분석</p>
                        <p className="text-secondary-400 mt-1 text-sm">
                            기술적 지표 + AI 종합 리포트
                        </p>
                    </Link>
                    <Link
                        href={`/${symbol}/fundamental`}
                        className="border-secondary-700 hover:border-primary-500 focus-visible:ring-primary-500 rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                        <p className="font-semibold">펀더멘털 분석</p>
                        <p className="text-secondary-400 mt-1 text-sm">
                            재무·밸류에이션·미래 방향
                        </p>
                    </Link>
                    <Link
                        href={`/${symbol}/news`}
                        className="border-secondary-700 hover:border-primary-500 focus-visible:ring-primary-500 rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                        <p className="font-semibold">뉴스 분석</p>
                        <p className="text-secondary-400 mt-1 text-sm">
                            실시간 뉴스 + 애널리스트 의견 분석
                        </p>
                    </Link>
                    <Link
                        href={`/${symbol}/fear-greed`}
                        className="border-secondary-700 hover:border-primary-500 focus-visible:ring-primary-500 rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                        <p className="font-semibold">공포 탐욕 지수</p>
                        <p className="text-secondary-400 mt-1 text-sm">
                            단기 매매 심리 0~100 점수
                        </p>
                    </Link>
                </nav>
            </div>
        </main>
    );
}
