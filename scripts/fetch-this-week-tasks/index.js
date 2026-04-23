import { Client } from '@notionhq/client';
import { execSync } from 'child_process';
import 'dotenv/config';

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

/**
 * utils
 */
function getPlainText(richTextArray) {
    if (!richTextArray) return '';
    return richTextArray
        .map(t => t.plain_text)
        .join('')
        .trim();
}

function getPageTitle(page) {
    const titleProp =
        page.properties?.Name ||
        Object.values(page.properties).find(p => p.type === 'title');

    return getPlainText(titleProp?.title);
}

/**
 * relation titles (캐싱 적용)
 */
const relationCache = new Map();

async function getRelationTitles(relationArray) {
    if (!relationArray || relationArray.length === 0) return [];

    const titles = await Promise.all(
        relationArray.map(async rel => {
            if (relationCache.has(rel.id)) {
                return relationCache.get(rel.id);
            }

            try {
                const page = await notion.pages.retrieve({ page_id: rel.id });

                const titleProp =
                    page.properties?.Name ||
                    Object.values(page.properties).find(
                        p => p.type === 'title'
                    );

                const title = getPlainText(titleProp?.title);

                relationCache.set(rel.id, title);
                return title;
            } catch {
                return '';
            }
        })
    );

    return titles.filter(Boolean);
}

/**
 * blocks
 */
async function getBlocks(blockId) {
    let results = [];
    let cursor = undefined;

    do {
        const res = await notion.blocks.children.list({
            block_id: blockId,
            start_cursor: cursor,
        });

        results = results.concat(res.results);
        cursor = res.has_more ? res.next_cursor : undefined;
    } while (cursor);

    return results;
}

function blockToText(block) {
    let text = '';

    switch (block.type) {
        case 'paragraph':
            text = getPlainText(block.paragraph.rich_text);
            break;

        case 'bulleted_list_item':
            text = getPlainText(block.bulleted_list_item.rich_text);
            break;

        case 'numbered_list_item':
            text = getPlainText(block.numbered_list_item.rich_text);
            break;

        case 'to_do':
            text = `[${block.to_do.checked ? 'x' : ' '}] ${getPlainText(block.to_do.rich_text)}`;
            break;

        case 'heading_1':
        case 'heading_2':
        case 'heading_3':
            text = getPlainText(block[block.type].rich_text);
            break;

        case 'code': {
            const code = getPlainText(block.code.rich_text);
            const lang = block.code.language || '';
            return `\`\`\`${lang}\n${code}\n\`\`\``;
        }

        case 'quote':
            text = `> ${getPlainText(block.quote.rich_text)}`;
            break;

        case 'callout':
            text = `💡 ${getPlainText(block.callout.rich_text)}`;
            break;

        default:
            return '';
    }

    return text.trim();
}

/**
 * page → structured data
 */
async function convertPage(page) {
    const fullPage = await notion.pages.retrieve({
        page_id: page.id,
    });

    const title = getPageTitle(fullPage);
    if (!title) return null;

    const tags = await getRelationTitles(
        fullPage.properties?.['🔖 Tags']?.relation
    );

    const projects = await getRelationTitles(
        fullPage.properties?.['🔥 Project']?.relation
    );

    const project = projects[0] || 'ETC';
    const tag = tags[0] || '기타';

    const blocks = await getBlocks(page.id);

    const contents = blocks
        .map(blockToText)
        .filter(t => t && t.trim() !== '')
        .flatMap(t => {
            if (t.startsWith('```')) {
                return t.split('\n').map((line, i, codeLines) => {
                    const needIndent =
                        i === 0 || i === 1 || i === codeLines.length - 1;
                    return `${needIndent ? '  ' : ''}${line}`;
                });
            }
            return [`  - ${t}`];
        });

    if (contents.length === 0) return null;

    return {
        project,
        tag,
        title,
        contents,
    };
}

/**
 * group by project → tag
 */
function groupData(pages) {
    const map = new Map();

    for (const page of pages) {
        if (!page) continue;

        if (!map.has(page.project)) {
            map.set(page.project, new Map());
        }

        const tagMap = map.get(page.project);

        if (!tagMap.has(page.tag)) {
            tagMap.set(page.tag, []);
        }

        tagMap.get(page.tag).push(page);
    }

    return map;
}

/**
 * markdown builder
 */
function buildMarkdown(grouped) {
    const sections = [];

    for (const [project, tagMap] of grouped.entries()) {
        const lines = [];

        lines.push(`# ${project}`);

        for (const [tag, items] of tagMap.entries()) {
            lines.push(`\n## ${tag}`);

            for (const item of items) {
                lines.push(`- ${item.title}`);
                lines.push(...item.contents);
            }
        }

        sections.push(lines.join('\n'));
    }

    return sections.join('\n\n---\n\n');
}

/**
 * clipboard (mac)
 */
function copyToClipboard(text) {
    execSync('pbcopy', { input: text });
}

/**
 * main
 */
async function main() {
    if (!DATABASE_ID) {
        throw new Error('❌ NOTION_DATABASE_ID 없음');
    }

    const response = await notion.dataSources.query({
        data_source_id: DATABASE_ID,
    });

    const pages = response.results;

    const parsed = await Promise.all(pages.map(convertPage));

    const grouped = groupData(parsed);
    const output = buildMarkdown(grouped);

    console.log(output);

    copyToClipboard(output);
    console.log('\n✅ 클립보드 복사 완료');
}

main();
