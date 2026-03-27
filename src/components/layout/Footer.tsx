export function Footer() {
    return (
        <footer className="border-secondary-800 border-t">
            <div className="flex items-center justify-between px-6 py-6 lg:px-[15vw]">
                <p className="text-secondary-600 text-sm">© 2025 Siglens</p>
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
        </footer>
    );
}
