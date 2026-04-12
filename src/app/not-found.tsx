import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_NAME } from '@/lib/seo';
import { Footer } from '@/components/layout/Footer';
import { ContactDialog } from '@/components/layout/ContactDialog';
import { TickerCategories } from '@/components/home/TickerCategories';

export const metadata: Metadata = {
    title: '페이지를 찾을 수 없습니다',
    robots: { index: false, follow: true },
};

export default function NotFound() {
    return (
        <>
            <main className="flex flex-1 flex-col">
                <div className="flex flex-col items-center px-6 py-20 text-center">
                    <p className="text-primary-400 font-mono text-sm tracking-widest">
                        404
                    </p>
                    <h1 className="text-secondary-100 mt-4 text-2xl font-bold sm:text-3xl">
                        페이지를 찾을 수 없습니다
                    </h1>
                    <p className="text-secondary-400 mt-3 max-w-md text-sm leading-relaxed">
                        요청하신 페이지가 존재하지 않거나 이동되었을 수
                        있습니다. 아래에서 종목을 검색하거나, 인기 종목을 확인해
                        보세요.
                    </p>

                    <Link
                        href="/"
                        className="bg-primary-600 hover:bg-primary-700 mt-8 rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-colors"
                    >
                        {SITE_NAME} 홈으로 돌아가기
                    </Link>

                    <div className="border-secondary-800 mt-10 border-t pt-8">
                        <p className="text-secondary-400 text-sm">
                            실제로 있는 종목인데 찾을 수 없나요?
                        </p>
                        <p className="text-secondary-600 mt-1 text-xs">
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
            <Footer />
        </>
    );
}
