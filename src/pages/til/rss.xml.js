import rss from '@astrojs/rss';
import {getVisibleTilEntries} from '../../util/publishedContent';
import {getFeedDescription, getFeedTitle, toRssItem} from '../../util/rss';

export async function GET(context) {
    const entries = await getVisibleTilEntries();

    return rss({
        title: getFeedTitle('TIL Feed'),
        description: getFeedDescription('Things learned recently.'),
        site: context.site,
        items: entries.map((entry) => toRssItem(entry)),
    });
}
