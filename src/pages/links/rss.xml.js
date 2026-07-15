import rss from '@astrojs/rss';
import {getVisibleLinkEntries} from '../../util/publishedContent';
import {getFeedDescription, getFeedTitle, toRssItem} from '../../util/rss';

export async function GET(context) {
    const entries = await getVisibleLinkEntries();

    return rss({
        title: getFeedTitle('Links Feed'),
        description: getFeedDescription('Links worth sharing, with commentary.'),
        site: context.site,
        items: entries.map((entry) => toRssItem(entry)),
    });
}
