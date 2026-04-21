import Link from 'next/link';
import { CurrentYear } from '@/components/layout/CurrentYear';
import { ContactDialog } from '@/components/layout/ContactDialog';
import { DotSeparator } from '@/components/ui/DotSeparator';
import {
    INVESTMENT_DISCLAIMER,
    PRIVACY_PATH,
    PRIVACY_TITLE,
    TERMS_PATH,
    TERMS_TITLE,
} from '@/lib/legal';

export function Footer() {
    return (
        <footer className="border-secondary-800 border-t">
            <div className="flex flex-col gap-2 px-6 py-6 lg:px-[15vw]">
                <div
                    role="note"
                    aria-label="투자 면책 고지"
                    className="text-secondary-500 text-xs leading-relaxed sm:text-sm"
                >
                    {INVESTMENT_DISCLAIMER}
                </div>
                <div className="border-secondary-800 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
                    <p className="text-secondary-600 text-sm">
                        © <CurrentYear /> Siglens
                    </p>
                    <nav
                        aria-label="사이트 정보"
                        className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2"
                    >
                        <Link
                            href={PRIVACY_PATH}
                            className="text-secondary-500 hover:text-secondary-300 text-sm transition-colors"
                        >
                            {PRIVACY_TITLE}
                        </Link>
                        <DotSeparator />
                        <Link
                            href={TERMS_PATH}
                            className="text-secondary-500 hover:text-secondary-300 text-sm transition-colors"
                        >
                            {TERMS_TITLE}
                        </Link>
                        <DotSeparator />
                        <ContactDialog
                            triggerLabel="오류 제보하기"
                            triggerClassName="text-secondary-500 hover:text-secondary-300 text-sm transition-colors rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500"
                        />
                        <DotSeparator />
                        <a
                            href="https://github.com/y0ngha/siglens"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="GitHub에서 기여하기 →"
                            className="text-secondary-500 hover:text-secondary-300 text-sm transition-colors"
                        >
                            GitHub에서 기여하기 →
                        </a>
                    </nav>
                </div>
            </div>
        </footer>
    );
}
