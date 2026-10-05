import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { resolveAsyncServerTree } from '@/shared/test-utils/resolveAsyncServerTree';

async function AsyncLeaf({ text }: { text: string }) {
    await Promise.resolve();
    return <span>{text}</span>;
}

async function AsyncWrapper() {
    await Promise.resolve();
    // async 컴포넌트가 또 async 컴포넌트를 돌려줘도 끝까지 풀린다.
    return (
        <section>
            <AsyncLeaf text="중첩" />
        </section>
    );
}

function SyncBox({ children }: { children?: React.ReactNode }) {
    return <div data-testid="sync-box">{children}</div>;
}

describe('resolveAsyncServerTree', () => {
    it('트리 안의 async 컴포넌트를 풀어 RTL이 렌더할 수 있게 한다', async () => {
        const tree = (
            <main>
                <h1>제목</h1>
                <AsyncLeaf text="본문" />
            </main>
        );
        render(await resolveAsyncServerTree(tree));
        expect(screen.getByText('제목')).toBeInTheDocument();
        expect(screen.getByText('본문')).toBeInTheDocument();
    });

    it('중첩된 async 컴포넌트와 배열 자식도 푼다', async () => {
        const tree = (
            <SyncBox>
                {[<AsyncLeaf key="a" text="A" />, <AsyncWrapper key="b" />]}
            </SyncBox>
        );
        render(await resolveAsyncServerTree(tree));
        expect(screen.getByText('A')).toBeInTheDocument();
        expect(screen.getByText('중첩')).toBeInTheDocument();
        expect(screen.getByTestId('sync-box')).toBeInTheDocument();
    });

    it('동기 컴포넌트는 실행하지 않고 그대로 둔다', async () => {
        const tree = <SyncBox>내용</SyncBox>;
        const resolved = await resolveAsyncServerTree(tree);
        expect(resolved).toMatchObject({ type: SyncBox });
    });

    it('엘리먼트가 아닌 값(문자열·null)은 그대로 돌려준다', async () => {
        expect(await resolveAsyncServerTree('텍스트')).toBe('텍스트');
        expect(await resolveAsyncServerTree(null)).toBeNull();
    });
});
