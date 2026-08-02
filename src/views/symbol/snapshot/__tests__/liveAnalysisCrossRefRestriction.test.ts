import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * `LIVE_ANALYSIS_CROSS_REF`(`../lib/liveAnalysisCrossRef.ts`)는 "실시간 AI 분석
 * 결과는 분석 패널에서 따로 제공됩니다" 문장을 export한다. 이 문장은 Technical과
 * Overall 탭에서만 의미가 있다 — 이 두 탭만 화면에 라이브 분석 패널이 함께
 * 떠 있어서 "그건 딴 데 있다"고 가리킬 대상이 실제로 존재한다. Congress/
 * Fundamental/Financials/News/Options 탭은 라이브 분석 패널과 나란히 렌더링되지
 * 않으므로, 이 문장을 그대로 가져다 붙이면 존재하지 않는 패널을 가리키는 문장이
 * 되어 사용자를 오도한다.
 *
 * 지금까지는 두 렌더러(TechnicalSnapshotProse/OverallSnapshotProse) 각각에
 * "문장이 있다"는 존재(presence) 테스트만 있었다 — 세 번째 렌더러(예:
 * NewsSnapshotProse)에 이 상수를 import해 넣어도 기존 스위트는 전부 그린으로
 * 남는다. 부재(absence)를 직접 검증하는 테스트가 없었기 때문이다. 이 테스트는
 * renderers/ 디렉터리 전체를 훑어 정확히 Technical/Overall 이 두 파일만
 * `LIVE_ANALYSIS_CROSS_REF`를 import한다는 것을 구조적으로 못박는다 — 개별
 * 렌더러마다 "이건 없다" 테스트를 다섯 개 추가하는 대신, 소스를 정적으로 읽어
 * 화이트리스트와 비교하는 단일 테스트로 같은 보장을 얻는다.
 */

const RENDERERS_DIR = path.resolve(__dirname, '../renderers');

const ALLOWED_IMPORTERS = new Set([
    'TechnicalSnapshotProse.tsx',
    'OverallSnapshotProse.tsx',
]);

function rendererFiles(): string[] {
    return readdirSync(RENDERERS_DIR).filter(name => name.endsWith('.tsx'));
}

function importsCrossRef(fileName: string): boolean {
    const source = readFileSync(path.join(RENDERERS_DIR, fileName), 'utf-8');
    return source.includes('LIVE_ANALYSIS_CROSS_REF');
}

describe('LIVE_ANALYSIS_CROSS_REF import restriction', () => {
    it('every renderer file in renderers/ is accounted for by this test (guards against a silently-added renderer)', () => {
        // renderers/ 목록 자체가 비어있거나 화이트리스트 밖의 파일만 있어도
        // 아래 테스트들이 공허하게 통과하지 않도록, 실제로 몇 개 파일이
        // 있는지와 화이트리스트 두 파일이 그 안에 있는지 먼저 확인한다.
        const files = rendererFiles();
        expect(files.length).toBeGreaterThan(0);
        for (const allowed of ALLOWED_IMPORTERS) {
            expect(files).toContain(allowed);
        }
    });

    it('imports LIVE_ANALYSIS_CROSS_REF ONLY in TechnicalSnapshotProse.tsx and OverallSnapshotProse.tsx', () => {
        const files = rendererFiles();
        const actualImporters = files.filter(importsCrossRef).sort();
        const expectedImporters = [...ALLOWED_IMPORTERS].sort();

        // 실패 메시지 자체가 WHY를 설명하도록 남긴다 — 이 assertion이 깨졌다는 건
        // Technical/Overall이 아닌 탭(라이브 분석 패널과 나란히 뜨지 않는 탭)이
        // "실시간 분석은 딴 데 있다"는 문장을 갖게 됐다는 뜻이고, 그 탭에는
        // 가리킬 라이브 패널이 없으므로 사용자에게 오해를 준다.
        expect(
            actualImporters,
            `LIVE_ANALYSIS_CROSS_REF must be imported ONLY by ${expectedImporters.join(
                ', '
            )} (the two tabs rendered alongside the live analysis panel). ` +
                `Found importers: [${actualImporters.join(', ')}]. ` +
                'If a new renderer legitimately needs this sentence, add it to ' +
                'ALLOWED_IMPORTERS here AND confirm that tab actually renders ' +
                'next to a live analysis panel — otherwise the sentence points ' +
                'at a panel that does not exist on that tab.'
        ).toEqual(expectedImporters);
    });
});
