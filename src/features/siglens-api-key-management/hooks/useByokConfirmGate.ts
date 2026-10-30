'use client';

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type RefObject,
    type SyntheticEvent,
} from 'react';

interface UseByokConfirmGateOptions {
    /** 등록한 BYOK LLM 키가 하나라도 있는가. 있으면 확인 없이 그대로 제출한다. */
    hasByokKey: boolean;
    /** "AI 모델 키 등록하러 가기"가 스크롤·포커스할 BYOK 섹션의 DOM id(`#` 없이). */
    byokSectionId: string;
}

/**
 * 발급 폼과 안내 모달을 잇는 ref·상태·핸들러. `closeModal`·`createAnyway`·`goToByok`은 참조가 유지되고,
 * `handleSubmit`은 `hasByokKey`가 바뀌면 새로 만들어진다.
 */
export interface ByokConfirmGate {
    /** 발급 `<form>`에 단다. 모달을 통과한 제출이 이 폼을 다시 제출한다. */
    formRef: RefObject<HTMLFormElement | null>;
    /** 발급 버튼에 단다. 다시 제출할 때 submitter로 넘긴다. */
    submitRef: RefObject<HTMLButtonElement | null>;
    modalOpen: boolean;
    /** 폼의 `onSubmit`. BYOK 키가 없으면 제출을 멈추고 모달을 연다. */
    handleSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
    /** 모달 닫기(Escape·배경·닫기 버튼) — 아무것도 하지 않고 취소한다. */
    closeModal: () => void;
    /** "데이터 도구만 쓸게요" — 모달을 닫은 뒤 그대로 발급한다. */
    createAnyway: () => void;
    /** "AI 모델 키 등록하러 가기" — 모달을 닫은 뒤 BYOK 섹션으로 보낸다. */
    goToByok: () => void;
}

type AfterClose = 'submit' | 'jump';

/**
 * 확인 모달을 통과한 제출. 제출 버튼을 submitter로 넘겨 실제 클릭 제출과 같은 경로(폼 액션)를 탄다.
 * 제출 이벤트는 동기로 돌아 `handleSubmit`이 우회 플래그를 소비한다 — 제출이 일어나지 못해도
 * 우회가 무장된 채 남지 않도록 항상 해제한다. React Compiler가 훅 본문의 `try/finally`를
 * 다루지 못해(REACT.md#EF-3) 모듈 함수로 둔다.
 */
function submitConfirmed(
    form: HTMLFormElement,
    submitter: HTMLButtonElement,
    confirmedRef: { current: boolean }
): void {
    confirmedRef.current = true;
    try {
        form.requestSubmit(submitter);
    } finally {
        confirmedRef.current = false;
    }
}

/** BYOK 섹션을 화면 맨 위로 올리고 포커스를 준다. 섹션이 없으면 아무것도 하지 않는다. */
function jumpToSection(sectionId: string): void {
    const section = document.getElementById(sectionId);
    if (section === null) return;
    section.scrollIntoView({ block: 'start' });
    section.focus({ preventScroll: true });
}

/**
 * BYOK 키 없이 시그렌즈 API 키를 발급하려 하면 제출을 멈추고 안내 모달을 먼저 띄운다.
 * 모달에서 고른 다음 동작(그대로 발급·BYOK 섹션으로 이동)은 모달이 닫힌 뒤에 실행한다.
 */
export function useByokConfirmGate({
    hasByokKey,
    byokSectionId,
}: UseByokConfirmGateOptions): ByokConfirmGate {
    const [modalOpen, setModalOpen] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);
    const submitRef = useRef<HTMLButtonElement>(null);
    // 모달에서 "데이터 도구만 쓸게요, 키 만들기"를 고른 제출은 확인을 다시 묻지 않고 통과시킨다.
    const confirmedRef = useRef(false);
    const afterCloseRef = useRef<AfterClose | null>(null);

    const handleSubmit = useCallback(
        (event: SyntheticEvent<HTMLFormElement>) => {
            if (hasByokKey) return;
            if (confirmedRef.current) {
                confirmedRef.current = false;
                return;
            }
            event.preventDefault();
            setModalOpen(true);
        },
        [hasByokKey]
    );

    const closeModal = useCallback(() => setModalOpen(false), []);

    const createAnyway = useCallback(() => {
        afterCloseRef.current = 'submit';
        setModalOpen(false);
    }, []);

    const goToByok = useCallback(() => {
        afterCloseRef.current = 'jump';
        setModalOpen(false);
    }, []);

    // 모달이 닫힌 다음에 실행한다 — 포커스 트랩이 닫히면서 트리거(발급 버튼)로 포커스를 되돌리는데,
    // 클릭 핸들러 안에서 먼저 옮기면 그 복원이 덮어쓴다. effect는 그 정리 뒤에 돈다. 제출도 같은
    // 시점에 해서 클릭 핸들러 안에 중첩 제출 이벤트를 만들지 않는다. 취소(Escape·닫기)는 `null`.
    useEffect(() => {
        if (modalOpen) return;
        const next = afterCloseRef.current;
        afterCloseRef.current = null;
        if (next === 'jump') {
            jumpToSection(byokSectionId);
            return;
        }
        if (next !== 'submit') return;
        const form = formRef.current;
        const submitter = submitRef.current;
        if (form === null || submitter === null) return;
        submitConfirmed(form, submitter, confirmedRef);
    }, [modalOpen, byokSectionId]);

    return {
        formRef,
        submitRef,
        modalOpen,
        handleSubmit,
        closeModal,
        createAnyway,
        goToByok,
    };
}
