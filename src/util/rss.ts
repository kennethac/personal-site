import {SITE_DESCRIPTION, SITE_TITLE} from '../consts';
import {
    buildLinkPath,
    buildPostPath,
    buildTilPath,
    type FeedItem,
    type LinkEntry,
    type PostEntry,
    type TilEntry,
} from './publishedContent';

type RssRenderableEntry = FeedItem | PostEntry | TilEntry | LinkEntry;

export function getFeedTitle(suffix?: string): string {
    return suffix ? `${SITE_TITLE} ${suffix}` : SITE_TITLE;
}

export function getFeedDescription(suffix?: string): string {
    return suffix ? `${SITE_DESCRIPTION}. ${suffix}` : SITE_DESCRIPTION;
}

export function toRssItem(entry: RssRenderableEntry) {
    if ('kind' in entry) {
        return {
            title: entry.title,
            description: entry.kind === 'link'
                ? `${entry.description} Source: ${entry.entry.data.author} - ${entry.entry.data.link}`
                : entry.description,
            pubDate: entry.pubDate,
            link: entry.href,
        };
    }

    if (entry.collection === 'posts') {
        return {
            title: entry.data.title,
            description: entry.data.description,
            pubDate: entry.data.pubDate,
            link: buildPostPath(entry),
        };
    }

    if (entry.collection === 'til') {
        return {
            title: entry.data.title,
            description: entry.data.description,
            pubDate: entry.data.pubDate,
            link: buildTilPath(entry),
        };
    }

    return {
        title: entry.data.title,
        description: `${entry.data.description} Source: ${entry.data.author} - ${entry.data.link}`,
        pubDate: entry.data.pubDate,
        link: buildLinkPath(entry),
    };
}
