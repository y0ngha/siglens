import type { SharedAnalysisSnapshot } from '../types';
import {
    SHARE_KIND_OG_BUILDERS,
    type OgText,
    type OgTranslator,
} from './kindServerRegistry';

export type { OgText, OgTranslator };

/**
 * 스냅샷의 kind에 맞는 OG description·트윗 문안을 만든다. 공유 페이지 메타데이터와
 * OG 이미지가 같은 문안을 쓰도록 하는 단일 진입점이다.
 *
 * kind별 로직은 `SHARE_KIND_OG_BUILDERS`에 있고 컴파일 시점 빠짐없음이 거기서 강제된다.
 */
export function buildOgText(
    snapshot: SharedAnalysisSnapshot,
    t: OgTranslator
): OgText {
    // kind 분기 안에서 `SnapshotResultOf<K>`가 좁혀지지 않으므로 각 빌더가 받는 느슨한
    // 레코드로 얕게 복사한다. 필드 해석은 빌더가 런타임에 좁혀서 한다.
    const r: Record<string, unknown> = { ...snapshot.result };
    const builder = SHARE_KIND_OG_BUILDERS[snapshot.kind];
    return builder(r, snapshot.symbol, t);
}
