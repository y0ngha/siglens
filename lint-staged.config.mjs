import path from 'node:path';

const quote = value => JSON.stringify(value);

const toRelativeArgs = files =>
    files.map(file => quote(path.relative(process.cwd(), file))).join(' ');

const isSrcCodeFile = file => {
    const relativePath = path.relative(process.cwd(), file);
    return (
        relativePath.startsWith('src/') &&
        /\.(?:c|m)?(?:j|t)sx?$/.test(relativePath)
    );
};

const isMessageCatalogFile = file => {
    const relativePath = path.relative(process.cwd(), file);
    return (
        relativePath.startsWith('messages/') && relativePath.endsWith('.json')
    );
};

const config = {
    '*.{js,jsx,cjs,mjs,ts,tsx}': files => {
        const codeArgs = toRelativeArgs(files);
        const relatedTestArgs = toRelativeArgs(files.filter(isSrcCodeFile));

        return [
            `yarn lint:staged ${codeArgs}`,
            `yarn format:staged ${codeArgs}`,
            ...(relatedTestArgs
                ? [`yarn test:related ${relatedTestArgs}`]
                : []),
        ];
    },
    // 문구 카탈로그(`messages/**/*.json`)가 바뀌면 같은 커밋에서 i18n:verify를 돌린다. 손으로 쓴 키의
    // `messages/_meta/hashes.json` 누락(I18N.md#I18-3)은 pre-push·CI도 잡지만, 커밋 단계에서 잡아야
    // 고친 뒤 다시 커밋하는 왕복이 없다. 포맷 다음에 순서대로 돌려야 포맷 중인 파일을 읽지 않는다.
    '*.{json,md,css,scss,yml,yaml}': files => [
        `yarn format:staged ${toRelativeArgs(files)}`,
        ...(files.some(isMessageCatalogFile) ? ['yarn i18n:verify'] : []),
    ],
};

export default config;
