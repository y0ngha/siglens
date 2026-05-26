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
    '*.{json,md,css,scss,yml,yaml}': files =>
        `yarn format:staged ${toRelativeArgs(files)}`,
};

export default config;
