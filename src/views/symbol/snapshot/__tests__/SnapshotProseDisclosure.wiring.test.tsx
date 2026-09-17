/**
 * 라이브 `PlainAnalysisSwitch`와 `SnapshotProseDisclosure`를 실제로 함께 마운트해
 * `data-analysis-view` 채널이 진짜로 연결돼 있는지 확인하는 배선(wiring) 테스트다.
 *
 * `SnapshotSummarySection.test.tsx`의 "지난 AI 분석 접기" 스위트는 표식을
 * `document.documentElement.dataset.analysisView = 'plain'`으로 **수동 주입**해
 * `SnapshotProseDisclosure` 자체의 접힘 로직만 검증한다. 그 테스트는 `PlainAnalysisSwitch`의
 * `useEffect`가 실제로 그 표식을 세우는지는 증명하지 않는다 — `MutationObserver` 배선이
 * 통째로 삭제돼도 수동 주입 테스트는 계속 통과한다.
 *
 * 여기서는 두 컴포넌트를 같은 DOM에 실제로 마운트해 신호가 끝까지 전달되는지 본다.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PlainAnalysisSwitch } from '@/shared/ui/PlainAnalysisSwitch';
import { SnapshotProseDisclosure } from '../SnapshotProseDisclosure';

function renderWiring() {
    return render(
        <>
            {/* 라이브 위젯: hideToggle=false라 표식을 세우는 쪽이다. */}
            <PlainAnalysisSwitch plain="라이브 평이화 문단입니다.">
                <div>라이브 원본</div>
            </PlainAnalysisSwitch>
            <SnapshotProseDisclosure summaryLabel="지난 AI 분석 보기">
                <p>스냅샷 산문</p>
            </SnapshotProseDisclosure>
        </>
    );
}

describe('PlainAnalysisSwitch ↔ SnapshotProseDisclosure 배선', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    afterEach(() => {
        delete document.documentElement.dataset.analysisView;
    });

    it('기본값(쉽게보기)으로 마운트되면 라이브 스위치가 표식을 세우고 스냅샷 아코디언이 접힌다', async () => {
        renderWiring();

        // 기본 모드가 이미 'plain'이므로 라이브 스위치의 effect가 마운트 직후 표식을 세운다.
        await waitFor(() =>
            expect(document.documentElement.dataset.analysisView).toBe('plain')
        );

        const details = document.querySelector('details');
        expect(details).not.toBeNull();
        await waitFor(() => expect(details?.open).toBe(false));
        // 접혀도 텍스트는 DOM에 남는다(SEO 자산 — display:none이 아니다).
        expect(screen.getByText('스냅샷 산문')).toBeInTheDocument();
    });

    it('라이브 스위치가 언마운트되면 표식이 지워지고 아코디언이 다시 펼쳐진다', async () => {
        const { rerender } = renderWiring();

        await waitFor(() =>
            expect(
                (document.querySelector('details') as HTMLDetailsElement).open
            ).toBe(false)
        );

        // 라이브 스위치만 제거한다(트리 구조는 유지) — 표식을 세우던 쪽만 사라진다.
        rerender(
            <>
                {null}
                <SnapshotProseDisclosure summaryLabel="지난 AI 분석 보기">
                    <p>스냅샷 산문</p>
                </SnapshotProseDisclosure>
            </>
        );

        await waitFor(() =>
            expect(
                document.documentElement.dataset.analysisView
            ).toBeUndefined()
        );
        await waitFor(() =>
            expect(
                (document.querySelector('details') as HTMLDetailsElement).open
            ).toBe(true)
        );
    });
});
