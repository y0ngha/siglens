import { LOCAL_STORAGE_VOC_PROMPTED_KEY } from '@/shared/lib/storageKeys';

/**
 * VOC 모달이 아직 한 번도 안 떴는가. 가입 넛지(`features/analysis-nudge`)와 VOC 호스트
 * (`features/voc-prompt`)가 함께 읽는 값이라 두 feature 사이 import를 만들지 않으려고 shared에 둔다.
 *
 * 저장소가 막혀 있으면(사파리 개인 정보 보호 등) "대기 아님"으로 본다. 반대로 보면 "띄웠다"는
 * 기록을 못 남겨 모달이 매 방문 뜨고, 가입 넛지는 영영 양보만 하게 된다.
 */
export function isVocPromptPending(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return localStorage.getItem(LOCAL_STORAGE_VOC_PROMPTED_KEY) !== '1';
    } catch {
        return false;
    }
}

/** 모달을 띄운 순간 부른다. 이후 `isVocPromptPending()`은 false다. */
export function markVocPrompted(): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(LOCAL_STORAGE_VOC_PROMPTED_KEY, '1');
    } catch {
        // storage blocked - 읽는 쪽이 이미 "대기 아님"으로 본다.
    }
}
