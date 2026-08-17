import Link from 'next/link';
import { SITE_NAME } from '@/shared/lib/seo';

interface LegalBreadcrumbProps {
    pageTitle: string;
}

export function LegalBreadcrumb({ pageTitle }: LegalBreadcrumbProps) {
    return (
        <nav aria-label="breadcrumb" className="mb-6 text-xs">
            <ol className="flex items-center gap-2 text-secondary-500">
                <li>
                    <Link
                        href="/"
                        // /privacy·/terms 양쪽에 공통 렌더 — CDN_CACHING.md §1
                        prefetch={false}
                        className="transition-colors hover:text-secondary-300"
                    >
                        {SITE_NAME}
                    </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="text-secondary-400">
                    {pageTitle}
                </li>
            </ol>
        </nav>
    );
}
