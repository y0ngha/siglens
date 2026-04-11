import Link from 'next/link';
import { CurrentYear } from '@/components/layout/CurrentYear';
import { ContactDialog } from '@/components/layout/ContactDialog';
import {
    INVESTMENT_DISCLAIMER,
    PRIVACY_PATH,
    PRIVACY_TITLE,
    TERMS_PATH,
    TERMS_TITLE,
} from '@/lib/seo';

function FooterSeparator() {
    return (
        <span className="text-secondary-700" aria-hidden="true">
            ·
        </span>
    );
}

export function Footer() {
    return (
        <footer className="border-secondary-800 border-t">
            <div className="flex flex-col gap-4 px-6 py-6 lg:px-[15vw]">
                <div
                    role="note"
                    className="text-secondary-500 text-xs leading-relaxed sm:text-sm"
                >
                    {INVESTMENT_DISCLAIMER}
                </div>
                <div className="border-secondary-800 flex flex-col items-center gap-3 border-t pt-4 sm:flex-row sm:justify-between">
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
                        <FooterSeparator />
                        <Link
                            href={TERMS_PATH}
                            className="text-secondary-500 hover:text-secondary-300 text-sm transition-colors"
                        >
                            {TERMS_TITLE}
                        </Link>
                        <FooterSeparator />
                        <ContactDialog
                            triggerLabel="오류 제보하기"
                            triggerClassName="text-secondary-500 hover:text-secondary-300 text-sm transition-colors"
                        />
                        <FooterSeparator />
                        <a
                            href="https://github.com/y0ngha/siglens"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="GitHub 저장소에서 프로젝트에 기여하기"
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
