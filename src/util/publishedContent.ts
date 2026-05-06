import {getCollection, type CollectionEntry} from 'astro:content';

export type PostEntry = CollectionEntry<'posts'>;
export type TilEntry = CollectionEntry<'til'>;
export type LinkEntry = CollectionEntry<'links'>;

export type PublishedEntry = PostEntry | TilEntry | LinkEntry;
export type PublishedEntryType = PublishedEntry['data']['type'];

export type FeedItem =
    | {
          kind: 'post';
          href: string;
          entry: PostEntry;
          title: string;
          description: string;
          pubDate: Date;
      }
    | {
          kind: 'til';
          href: string;
          entry: TilEntry;
          title: string;
          description: string;
          pubDate: Date;
      }
    | {
          kind: 'link';
          href: string;
          entry: LinkEntry;
          title: string;
          description: string;
          pubDate: Date;
      };

const buildTime = new Date(Date.now());

export function isProductionContentBuild(): boolean {
    if (import.meta.env.MODE !== 'production') {
        return false;
    }

    const branchName =
        process.env.CI_COMMIT_SOURCE_BRANCH ??
        process.env.CI_COMMIT_BRANCH ??
        process.env.CF_PAGES_BRANCH;

    if (!branchName) {
        return true;
    }

    return branchName === 'main';
}

function isVisible(pubDate: Date): boolean {
    if (!isProductionContentBuild()) {
        return true;
    }

    return pubDate.valueOf() <= buildTime.valueOf();
}

function sortByPubDateDescending<T extends {data: {pubDate: Date}}>(entries: T[]): T[] {
    return [...entries].sort((left, right) => right.data.pubDate.valueOf() - left.data.pubDate.valueOf());
}

function sortPostVersionsAscending(entries: PostEntry[]): PostEntry[] {
    return [...entries].sort((left, right) => left.data.version - right.data.version);
}

export async function getVisiblePostVersions(): Promise<PostEntry[]> {
    const entries = await getCollection('posts');
    return sortPostVersionsAscending(entries.filter((entry) => isVisible(entry.data.pubDate)));
}

export async function getCanonicalPosts(): Promise<PostEntry[]> {
    const groupedPosts = groupPostsBySlug(await getVisiblePostVersions());

    return Array.from(groupedPosts.values())
        .map((versions) => versions.at(-1)!)
        .sort((left, right) => right.data.pubDate.valueOf() - left.data.pubDate.valueOf());
}

export async function getPostVersionsForSlug(slug: string): Promise<PostEntry[]> {
    const groupedPosts = groupPostsBySlug(await getVisiblePostVersions());
    return groupedPosts.get(slug) ?? [];
}

export async function getVisibleTilEntries(): Promise<TilEntry[]> {
    const entries = await getCollection('til');
    return sortByPubDateDescending(entries.filter((entry) => isVisible(entry.data.pubDate)));
}

export async function getVisibleLinkEntries(): Promise<LinkEntry[]> {
    const entries = await getCollection('links');
    return sortByPubDateDescending(entries.filter((entry) => isVisible(entry.data.pubDate)));
}

export async function getUnifiedFeedItems(limit?: number): Promise<FeedItem[]> {
    const [posts, tils, links] = await Promise.all([
        getCanonicalPosts(),
        getVisibleTilEntries(),
        getVisibleLinkEntries(),
    ]);

    const items = [
        ...posts.map((entry) => toFeedItem(entry)),
        ...tils.map((entry) => toFeedItem(entry)),
        ...links.map((entry) => toFeedItem(entry)),
    ].sort((left, right) => right.pubDate.valueOf() - left.pubDate.valueOf());

    return typeof limit === 'number' ? items.slice(0, limit) : items;
}

export function groupPostsBySlug(entries: PostEntry[]): Map<string, PostEntry[]> {
    const grouped = new Map<string, PostEntry[]>();

    for (const entry of entries) {
        const group = grouped.get(entry.data.slug) ?? [];
        group.push(entry);
        grouped.set(entry.data.slug, group);
    }

    for (const [slug, versions] of grouped) {
        grouped.set(slug, sortPostVersionsAscending(versions));
    }

    return grouped;
}

export function buildPostPath(entryOrSlug: PostEntry | string): string {
    const slug = typeof entryOrSlug === 'string' ? entryOrSlug : entryOrSlug.data.slug;
    return `/blog/${slug}/`;
}

export function buildPostHistoryPath(entryOrSlug: PostEntry | string): string {
    const slug = typeof entryOrSlug === 'string' ? entryOrSlug : entryOrSlug.data.slug;
    return `/blog/${slug}/versions/`;
}

export function buildPostVersionPath(entry: PostEntry): string {
    return `/blog/${entry.data.slug}/${entry.data.version}/`;
}

export function buildTilPath(entry: TilEntry): string {
    return `/til/${entry.data.slug}/`;
}

export function buildLinkPath(entry: LinkEntry): string {
    return `/links/${entry.data.slug}/`;
}

export function toFeedItem(entry: PublishedEntry): FeedItem {
    if (entry.collection === 'posts') {
        return {
            kind: 'post',
            href: buildPostPath(entry),
            entry,
            title: entry.data.title,
            description: entry.data.description,
            pubDate: entry.data.pubDate,
        };
    }

    if (entry.collection === 'til') {
        return {
            kind: 'til',
            href: buildTilPath(entry),
            entry,
            title: entry.data.title,
            description: entry.data.description,
            pubDate: entry.data.pubDate,
        };
    }

    return {
        kind: 'link',
        href: buildLinkPath(entry),
        entry,
        title: entry.data.title,
        description: entry.data.description,
        pubDate: entry.data.pubDate,
    };
}
