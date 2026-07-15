import rss from '@astrojs/rss';
import {getCanonicalPosts} from '../../util/publishedContent';
import {getFeedDescription, getFeedTitle, toRssItem} from '../../util/rss';

export async function GET(context) {
    const posts = await getCanonicalPosts();

    return rss({
        title: getFeedTitle('Blog Feed'),
        description: getFeedDescription('Canonical blog posts only.'),
        site: context.site,
        items: posts.map((post) => toRssItem(post)),
    });
}
