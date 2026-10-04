import { SectionSkeleton } from '@/views/symbol/SectionSkeleton';
import { SYMBOL_TAB_SECTION_COUNT } from '@/views/symbol/tabSkeletonSections';

const SKELETON_SECTION_COUNT = SYMBOL_TAB_SECTION_COUNT.news;

export default function NewsLoading() {
    return (
        <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
            {Array.from({ length: SKELETON_SECTION_COUNT }, (_, i) => (
                <SectionSkeleton key={i} />
            ))}
        </main>
    );
}
