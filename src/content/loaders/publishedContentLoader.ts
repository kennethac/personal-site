import {existsSync, promises as fs} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import type {Loader, LoaderContext} from 'astro/loaders';

const CONTENT_EXTENSIONS = new Set(['.md', '.mdx']);
export const OBSIDIAN_CONTENT_ROOT_ENV = 'OBSIDIAN_CONTENT_ROOT';

type PublishedCollection = 'posts' | 'til' | 'links';
type SourceKind = 'astro' | 'obsidian';

type EntryType = {
    getEntryInfo: (args: {contents: string; fileUrl: URL}) => Promise<{
        body: string;
        data: Record<string, unknown>;
    }>;
    getRenderFunction?: (config: LoaderContext['config']) => Promise<(args: {
        id: string;
        data: Record<string, unknown>;
        body: string;
        filePath: string;
        digest: string;
    }) => Promise<{
        html: string;
        metadata?: {
            imagePaths?: string[];
        };
    }>>;
    contentModuleTypes?: unknown;
};

type ExtendedLoaderContext = LoaderContext & {
    entryTypes: Map<string, EntryType>;
};

type BaseLoadedEntry = {
    id: string;
    slug: string;
    body: string;
    rawData: Record<string, unknown>;
    source: SourceKind;
    absolutePath: string;
    relativeFilePath: string;
    version?: number;
};

type SourceDefinition = {
    kind: SourceKind;
    basePath: string;
};

function toPosixPath(value: string): string {
    return value.split(path.sep).join('/');
}

function slugifySegment(segment: string): string {
    return segment
        .trim()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function slugifyPathSegments(segments: string[]): string {
    const slugSegments = segments.map((segment) => {
        const slug = slugifySegment(segment);
        if (!slug) {
            throw new Error(`Path segment "${segment}" does not produce a valid slug.`);
        }
        return slug;
    });

    return slugSegments.join('/');
}

function stripContentExtension(relativePath: string): string {
    return relativePath.replace(/\.(md|mdx)$/i, '');
}

async function listContentFiles(basePath: string): Promise<string[]> {
    if (!existsSync(basePath)) {
        return [];
    }

    const files: string[] = [];

    async function walk(currentPath: string) {
        const dirents = await fs.readdir(currentPath, {withFileTypes: true});

        for (const dirent of dirents) {
            if (dirent.name.startsWith('.') || dirent.name.startsWith('_')) {
                continue;
            }

            const absolutePath = path.join(currentPath, dirent.name);

            if (dirent.isDirectory()) {
                await walk(absolutePath);
                continue;
            }

            if (!dirent.isFile()) {
                continue;
            }

            const extension = path.extname(dirent.name).toLowerCase();
            if (!CONTENT_EXTENSIONS.has(extension)) {
                continue;
            }

            files.push(toPosixPath(path.relative(basePath, absolutePath)));
        }
    }

    await walk(basePath);
    return files.sort();
}

function getCollectionDirectory(collection: PublishedCollection): string {
    switch (collection) {
        case 'posts':
            return 'posts';
        case 'til':
            return 'til';
        case 'links':
            return 'links';
    }
}

function getAstroBasePath(config: LoaderContext['config'], collection: PublishedCollection): string {
    return fileURLToPath(new URL(`src/content/${getCollectionDirectory(collection)}/`, config.root));
}

function requireObsidianRoot(): string {
    const root = process.env[OBSIDIAN_CONTENT_ROOT_ENV]?.trim();

    if (!root) {
        throw new Error(
            `Missing required ${OBSIDIAN_CONTENT_ROOT_ENV} environment variable. Set it to the mounted Obsidian content subset path.`,
        );
    }

    const resolvedRoot = path.resolve(root);
    if (!existsSync(resolvedRoot)) {
        throw new Error(
            `${OBSIDIAN_CONTENT_ROOT_ENV} points to "${resolvedRoot}", but that path does not exist.`,
        );
    }

    return resolvedRoot;
}

function getSourceDefinitions(config: LoaderContext['config'], collection: PublishedCollection): SourceDefinition[] {
    const obsidianRoot = requireObsidianRoot();

    return [
        {
            kind: 'astro',
            basePath: getAstroBasePath(config, collection),
        },
        {
            kind: 'obsidian',
            basePath: path.join(obsidianRoot, getCollectionDirectory(collection)),
        },
    ];
}

function getEntryType(context: ExtendedLoaderContext, absolutePath: string): EntryType {
    const extension = path.extname(absolutePath).toLowerCase();
    const entryType = context.entryTypes.get(extension);

    if (!entryType) {
        throw new Error(`No Astro content entry type found for "${absolutePath}".`);
    }

    return entryType;
}

async function parseMarkdownEntry(
    context: ExtendedLoaderContext,
    absolutePath: string,
): Promise<{body: string; data: Record<string, unknown>}> {
    const contents = await fs.readFile(absolutePath, 'utf-8');
    const entryType = getEntryType(context, absolutePath);

    return entryType.getEntryInfo({
        contents,
        fileUrl: pathToFileURL(absolutePath),
    });
}

async function collectPostEntries(
    context: ExtendedLoaderContext,
    sources: SourceDefinition[],
): Promise<BaseLoadedEntry[]> {
    const collected: BaseLoadedEntry[] = [];
    const slugSources = new Map<string, SourceKind>();
    const versionIds = new Map<string, string>();

    for (const source of sources) {
        const relativePaths = await listContentFiles(source.basePath);

        for (const relativePath of relativePaths) {
            const versionMatch = path.basename(relativePath).match(/^v(\d+)\.(md|mdx)$/i);
            if (!versionMatch) {
                throw new Error(
                    `Post file "${path.join(source.basePath, relativePath)}" must be named like "v1.md" or "v2.mdx".`,
                );
            }

            const version = Number(versionMatch[1]);
            if (path.dirname(stripContentExtension(relativePath)) === '.') {
                throw new Error(
                    `Post file "${path.join(source.basePath, relativePath)}" must live inside a post folder, e.g. "posts/my-post/v1.md".`,
                );
            }

            const postPathWithoutFilename = path.dirname(relativePath);
            const slug = slugifyPathSegments(postPathWithoutFilename.split('/'));
            const existingSource = slugSources.get(slug);

            if (existingSource && existingSource !== source.kind) {
                throw new Error(
                    `Post slug "${slug}" exists in both Astro content and Obsidian content. Duplicate posts across sources are not allowed.`,
                );
            }

            if (slug.split('/').at(-1) === 'versions' || /^\d+$/.test(slug.split('/').at(-1) ?? '')) {
                throw new Error(
                    `Post slug "${slug}" is reserved. Post slugs cannot end with "versions" or a numeric segment.`,
                );
            }

            slugSources.set(slug, source.kind);

            const id = `${slug}/v${version}`;
            const duplicateVersionPath = versionIds.get(id);
            const absolutePath = path.join(source.basePath, relativePath);

            if (duplicateVersionPath) {
                throw new Error(
                    `Duplicate post version "${id}" found in both "${duplicateVersionPath}" and "${absolutePath}".`,
                );
            }

            versionIds.set(id, absolutePath);

            const {body, data} = await parseMarkdownEntry(context, absolutePath);
            collected.push({
                id,
                slug,
                body,
                rawData: data,
                source: source.kind,
                version,
                absolutePath,
                relativeFilePath: toPosixPath(path.relative(fileURLToPath(context.config.root), absolutePath)),
            });
        }
    }

    const groupedBySlug = new Map<string, BaseLoadedEntry[]>();

    for (const entry of collected) {
        const group = groupedBySlug.get(entry.slug) ?? [];
        group.push(entry);
        groupedBySlug.set(entry.slug, group);
    }

    for (const [slug, versions] of groupedBySlug) {
        const sortedVersions = versions.sort((left, right) => {
            if ((left.version ?? 0) !== (right.version ?? 0)) {
                return (left.version ?? 0) - (right.version ?? 0);
            }

            return left.absolutePath.localeCompare(right.absolutePath);
        });

        let previousPubDate: Date | undefined;

        for (const entry of sortedVersions) {
            const rawPubDate = entry.rawData.pubDate;
            const parsedPubDate = new Date(rawPubDate as string | number | Date);

            if (Number.isNaN(parsedPubDate.valueOf())) {
                throw new Error(`Post "${entry.absolutePath}" has an invalid pubDate.`);
            }

            if (previousPubDate && parsedPubDate.valueOf() < previousPubDate.valueOf()) {
                throw new Error(
                    `Post versions for "${slug}" are out of publish-date order. "${entry.absolutePath}" publishes before an earlier version.`,
                );
            }

            previousPubDate = parsedPubDate;
        }
    }

    return collected;
}

async function collectFlatEntries(
    context: ExtendedLoaderContext,
    sources: SourceDefinition[],
): Promise<BaseLoadedEntry[]> {
    const collected: BaseLoadedEntry[] = [];
    const pathsBySlug = new Map<string, string>();

    for (const source of sources) {
        const relativePaths = await listContentFiles(source.basePath);

        for (const relativePath of relativePaths) {
            const slug = slugifyPathSegments(stripContentExtension(relativePath).split('/'));
            const absolutePath = path.join(source.basePath, relativePath);
            const duplicatePath = pathsBySlug.get(slug);

            if (duplicatePath) {
                throw new Error(
                    `Duplicate entry slug "${slug}" found in both "${duplicatePath}" and "${absolutePath}".`,
                );
            }

            pathsBySlug.set(slug, absolutePath);

            const {body, data} = await parseMarkdownEntry(context, absolutePath);
            collected.push({
                id: slug,
                slug,
                body,
                rawData: data,
                source: source.kind,
                absolutePath,
                relativeFilePath: toPosixPath(path.relative(fileURLToPath(context.config.root), absolutePath)),
            });
        }
    }

    return collected;
}

async function storeRenderedEntry(
    context: ExtendedLoaderContext,
    entry: BaseLoadedEntry,
    collection: PublishedCollection,
    renderFunctionByEntryType: WeakMap<EntryType, Awaited<ReturnType<NonNullable<EntryType['getRenderFunction']>>>>,
) {
    const entryType = getEntryType(context, entry.absolutePath);
    const digest = context.generateDigest({
        body: entry.body,
        data: entry.rawData,
    });

    const parsedData = await context.parseData({
        id: entry.id,
        data: {
            ...entry.rawData,
            slug: entry.slug,
            source: entry.source,
            type: collection === 'posts' ? 'post' : collection === 'til' ? 'til' : 'link',
            ...(entry.version ? {version: entry.version} : {}),
        },
        filePath: entry.relativeFilePath,
    });

    if (entryType.getRenderFunction) {
        let render = renderFunctionByEntryType.get(entryType);

        if (!render) {
            render = await entryType.getRenderFunction(context.config);
            renderFunctionByEntryType.set(entryType, render);
        }

        const rendered = await render({
            id: entry.id,
            data: entry.rawData,
            body: entry.body,
            filePath: entry.relativeFilePath,
            digest,
        });

        context.store.set({
            id: entry.id,
            data: parsedData,
            body: entry.body,
            filePath: entry.relativeFilePath,
            digest,
            rendered,
            assetImports: rendered?.metadata?.imagePaths,
        });

        return;
    }

    if ('contentModuleTypes' in entryType) {
        context.store.set({
            id: entry.id,
            data: parsedData,
            body: entry.body,
            filePath: entry.relativeFilePath,
            digest,
            deferredRender: true,
        });

        return;
    }

    context.store.set({
        id: entry.id,
        data: parsedData,
        body: entry.body,
        filePath: entry.relativeFilePath,
        digest,
    });
}

export function publishedContentLoader(collection: PublishedCollection): Loader {
    return {
        name: `published-content-${collection}`,
        load: async (loaderContext) => {
            const context = loaderContext as ExtendedLoaderContext;
            const sources = getSourceDefinitions(context.config, collection);
            const entries =
                collection === 'posts'
                    ? await collectPostEntries(context, sources)
                    : await collectFlatEntries(context, sources);

            context.store.clear();

            const renderFunctionByEntryType = new WeakMap<
                EntryType,
                Awaited<ReturnType<NonNullable<EntryType['getRenderFunction']>>>
            >();

            for (const entry of entries) {
                await storeRenderedEntry(context, entry, collection, renderFunctionByEntryType);
            }
        },
    };
}
