import path from 'node:path';
import { findCoreInClientGraph, SRC } from './support/coreClientGraph';

/**
 * 루트 레이아웃이 모든 페이지에 싣는 클라이언트 JS에 `@y0ngha/siglens-core`가 들어가지 않는다.
 *
 * core는 CommonJS 한 덩어리라 값 하나만 import해도 번들러가 통째로 싣는다(원본 185KB,
 * 전송 ~51KB). 2026-10-05 JS 커버리지 실측에서 이 청크가 홈·소개·시장 페이지에도 실려
 * 있었고 홈에서 99%가 쓰이지 않았다. 원인은 루트 레이아웃의 종목 진입 골격이 같은 파일의
 * 모델 선택 프로바이더를 거쳐 core를 끌어온 것이었다(`SymbolLayoutJail` 분리로 해결).
 *
 * 이 가드는 루트 레이아웃에서 시작해 **정적 import만** 따라가며(`next/dynamic`의 지연
 * import는 별도 청크라 제외) 클라이언트 경계(`'use client'`) 안쪽 파일이 core에서 값을
 * import하는지 본다. 판정 워커는 ai 채팅 가드와 공유한다(`support/coreClientGraph.ts`).
 */

const ROOT_LAYOUT = path.join(SRC, 'app/[locale]/layout.tsx');

describe('루트 레이아웃 클라이언트 번들', () => {
    it('@y0ngha/siglens-core를 정적으로 끌어오지 않는다', () => {
        const offenders = findCoreInClientGraph(ROOT_LAYOUT);
        expect(
            offenders.map(o => o.chain.join(' → ')),
            '이 경로의 core 값 import를 지연 로드(next/dynamic)하거나 파일을 나눠 루트 레이아웃 그래프 밖으로 빼야 한다'
        ).toEqual([]);
    });

    it('검출기가 실제로 잡는다 — 분리 전 경로라면 걸린다', () => {
        // jail과 프로바이더가 한 파일이던 때의 경로를 그대로 재현한다.
        const providers = path.join(
            SRC,
            'app/[locale]/[symbol]/SymbolLayoutClient.tsx'
        );
        expect(findCoreInClientGraph(providers).length).toBeGreaterThan(0);
    });
});
