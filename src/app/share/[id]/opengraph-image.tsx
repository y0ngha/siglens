import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { buildSymbolOgImage } from '@/entities/og-image';
import { getCachedSharedAnalysis } from '@/entities/shared-analysis/actions/getCachedSharedAnalysis';
import { kindLabel } from '@/widgets/share/lib/kindLabel';

// 공유 스냅샷은 id마다 달라 정적 생성 불가 → force-dynamic
export const dynamic = 'force-dynamic';

export const size = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
export const contentType = 'image/png';
export const alt = 'Siglens AI 분석 공유';

interface Props {
    params: Promise<{ id: string }>;
}

export default async function Image({ params }: Props) {
    const { id } = await params;
    const lookup = await getCachedSharedAnalysis(id);

    if (lookup.status === 'found') {
        const { snapshot } = lookup;
        return buildSymbolOgImage({
            ticker: snapshot.symbol.toUpperCase(),
            label: kindLabel(snapshot.kind),
        });
    }

    return buildSymbolOgImage({
        ticker: 'SIGLENS',
        label: '만료된 공유',
    });
}
