import rss from '@astrojs/rss';
import {getFeedDescription, getFeedTitle, toRssItem} from '../util/rss';
import {getUnifiedFeedItems} from '../util/publishedContent';

export async function GET(context) {
    const items = await getUnifiedFeedItems();

    return rss({
        title: getFeedTitle(),
        description: getFeedDescription(),
        site: context.site,
        items: items.map((item) => toRssItem(item)),
    });
}
