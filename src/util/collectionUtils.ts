import type {CollectionEntry} from "astro:content";

type collectionType = CollectionEntry<'blog'>[];

const buildTime = new Date(Date.now());

export function filterDrafts(entries: collectionType): collectionType {
    const isProduction = (import.meta.env.MODE === 'production');
    if (!isProduction) return entries;
    return entries.filter(e => e.data.pubDate && e.data.pubDate <= buildTime);
}
