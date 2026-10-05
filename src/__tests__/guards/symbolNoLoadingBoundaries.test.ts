import { readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **`[symbol]` 아래에는 `loading.tsx`가 없다 — 목록을 고정한다.**
 *
 * `loading.tsx`는 그 세그먼트 전체를 서버 Suspense 경계로 감싼다. 2026-10-05 운영 크롤에서 그
 * 경계가 두 가지를 망쳤다.
 *
 * 1. **숨김 청크**: 직접 접속 HTML에 fallback 골격과 `<template>` 숨김 청크 + 교체 스크립트가
 *    남아, JS를 실행하지 않는 크롤러(Naver Yeti·Daumoa)에게 본문이 문서 끝쪽으로 밀리거나
 *    보이지 않았다.
 * 2. **soft 404**: Next 16.2는 Suspense 경계 안쪽에서 던진 `notFound()`의 상태를 200으로
 *    남긴다. 탭 가용성 판정(크립토 × 옵션, KR × 의회거래 등)은 어느 탭인지 알아야 해서
 *    레이아웃으로 올릴 수 없고 `page.tsx`에서 던지므로, 경계가 있는 한 200이 샌다.
 *
 * 내비게이션 중 골격은 클라 pending slot(`SymbolTabPendingSlot` → `SymbolTabSkeleton`, 본문은
 * `views/symbol/skeletons/`)이 그린다. 이 가드가 실패하면 `loading.tsx`가 다시 생긴 것이다 —
 * 정말 필요하면 이 목록과 위 근거를 함께 검토한다(`e2e/specs/crypto-symbol.spec.ts`의 404 단언도
 * 같이 깨진다).
 */
const SYMBOL_DIR = path.resolve(__dirname, '../../app/[locale]/[symbol]');

/** 허용 목록 — 의도적으로 비어 있다. */
const ALLOWED_LOADING_FILES: readonly string[] = [];

describe('[symbol] 라우트 트리의 loading.tsx', () => {
    it('loading.tsx가 하나도 없다', () => {
        const found = readdirSync(SYMBOL_DIR, {
            recursive: true,
            encoding: 'utf8',
        })
            .filter(file => /(^|[\\/])loading\.(tsx|ts|jsx|js)$/.test(file))
            .map(file => file.split(path.sep).join('/'))
            .sort();
        expect(found).toEqual([...ALLOWED_LOADING_FILES]);
    });
});
