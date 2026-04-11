import Link from 'next/link';
import { SITE_NAME } from '@/lib/seo';

interface LegalBreadcrumbProps {
    pageTitle: string;
}

export function LegalBreadcrumb({ pageTitle }: LegalBreadcrumbProps) {
    return (
        <nav aria-label="breadcrumb" className="mb-6 text-xs">
            <ol className="text-secondary-500 flex items-center gap-2">
                <li>
                    <Link
                        href="/"
                        className="hover:text-secondary-300 transition-colors"
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
