import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_NAME } from '@/shared/lib/seo';
import { ContactDialog } from '@/widgets/layout/ContactDialog';
import { TickerCategories } from '@/widgets/home';

export const metadata: Metadata = {
    title: '페이지를 찾을 수 없습니다',
    robots: { index: false, follow: true },
};

export default function NotFound() {
    return (
        <>
            <main className="flex flex-1 flex-col">
                <div className="page-container flex flex-col items-center py-20 text-center">
                    <p className="font-mono text-sm tracking-widest text-primary-400">
                        404
                    </p>
                    <h1 className="mt-4 text-2xl font-bold text-secondary-50 sm:text-3xl">
                        페이지를 찾을 수 없습니다
                    </h1>
                    <p className="mt-3 max-w-md text-sm leading-relaxed text-secondary-400">
                        요청하신 페이지가 존재하지 않거나 이동되었을 수
                        있습니다. 아래에서 종목을 검색하거나, 인기 종목을 확인해
                        보세요.
                    </p>

                    <Link
                        href="/"
                        className="mt-8 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                    >
                        {SITE_NAME} 홈으로 돌아가기
                    </Link>

                    <div className="mt-10 border-t border-secondary-700 pt-8">
                        <p className="text-sm text-secondary-400">
                            실제로 있는 종목인데 찾을 수 없나요?
                        </p>
                        <p className="mt-1 text-xs text-secondary-500">
                            시스템 오류일 수 있습니다. 알려주시면
                            확인하겠습니다.
                        </p>
                        <ContactDialog
                            triggerLabel="오류 제보하기 →"
                            triggerClassName="text-primary-400 hover:text-primary-300 mt-3 inline-block text-xs transition-colors"
                        />
                    </div>
                </div>
                <TickerCategories />
            </main>
        </>
    );
}
