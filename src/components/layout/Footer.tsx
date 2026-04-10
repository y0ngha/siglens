import { CurrentYear } from '@/components/layout/CurrentYear';
import { ContactDialog } from '@/components/layout/ContactDialog';

export function Footer() {
    return (
        <footer className="border-secondary-800 border-t">
            <div className="flex flex-col items-center gap-2 px-6 py-6 sm:flex-row sm:justify-between lg:px-[15vw]">
                <p className="text-secondary-600 text-sm">
                    © <CurrentYear /> Siglens
                </p>
                <div className="flex items-center gap-3">
                    <ContactDialog
                        triggerLabel="오류 제보하기"
                        triggerClassName="text-secondary-500 hover:text-secondary-300 text-sm transition-colors"
                    />
                    <span className="text-secondary-700" aria-hidden="true">
                        ·
                    </span>
                    <a
                        href="https://github.com/y0ngha/siglens"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="GitHub 저장소에서 프로젝트에 기여하기"
                        className="text-secondary-500 hover:text-secondary-300 text-sm transition-colors"
                    >
                        GitHub에서 기여하기 →
                    </a>
                </div>
            </div>
        </footer>
    );
}
