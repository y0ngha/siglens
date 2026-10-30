import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import type { PainPoint } from '../../lib/aboutSections';
import { AboutSection } from '../AboutSection';

interface Props {
    readonly title: string;
    readonly body: string;
    /** Caption over each complaint. */
    readonly wasLabel: string;
    /** The locale's brand name, captioning each answer. */
    readonly brandName: string;
    readonly points: readonly PainPoint[];
}

/** The complaints section: each card pairs a complaint with SIGLENS AI's answer. */
export function AboutPainSection({
    title,
    body,
    wasLabel,
    brandName,
    points,
}: Props) {
    return (
        <AboutSection id="about-pain" title={title} sub={body}>
            <ul className="mt-7 flex flex-col gap-2.5">
                {points.map(({ was, now }) => (
                    <li
                        key={was}
                        className={cn(
                            SURFACE_CARD,
                            'grid overflow-hidden sm:grid-cols-[2fr_3fr]'
                        )}
                    >
                        <div className="border-b border-secondary-700 bg-secondary-900 px-4 py-3.5 sm:border-r sm:border-b-0">
                            <p className="text-xs text-secondary-400">
                                {wasLabel}
                            </p>
                            <p className="mt-1 text-[15px] leading-6 text-secondary-300">
                                {was}
                            </p>
                        </div>
                        <div className="px-4 py-3.5">
                            <p
                                className="text-xs font-semibold text-secondary-100"
                                translate="no"
                            >
                                {brandName}
                            </p>
                            <p className="mt-1 text-[15px] leading-6 text-secondary-100">
                                {now}
                            </p>
                        </div>
                    </li>
                ))}
            </ul>
        </AboutSection>
    );
}
