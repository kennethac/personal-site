import {glob} from 'astro/loaders';
import {defineCollection, z} from 'astro:content';
import {publishedContentLoader} from './content/loaders/publishedContentLoader';

const publishedBaseSchema = z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date().optional(),
    updatedDate: z.coerce.date().optional(),
    slug: z.string(),
    source: z.enum(['astro', 'obsidian']),
});

const posts = defineCollection({
    loader: publishedContentLoader('posts'),
    schema: publishedBaseSchema.extend({
        type: z.literal('post'),
        version: z.number().int().positive(),
    }),
});

const til = defineCollection({
    loader: publishedContentLoader('til'),
    schema: publishedBaseSchema.extend({
        type: z.literal('til'),
    }),
});

const links = defineCollection({
    loader: publishedContentLoader('links'),
    schema: publishedBaseSchema.extend({
        type: z.literal('link'),
        link: z.string().url(),
        author: z.string(),
    }),
});

const pages = defineCollection({
    loader: glob({base: './src/content/pages', pattern: '**/*.{md,mdx}'}),
    schema: z.object({
        title: z.string(),
        description: z.string(),
    }),
});

const projects = defineCollection({
    loader: glob({base: './src/content/projects', pattern: '**/*.{md,mdx}'}),
    schema: z.object({
        title: z.string(),
        description: z.string(),
        logo: z.string(),
        repoLink: z.string().nullable(),
        license: z.string().nullable(),
        startDate: z.coerce.date(),
        endDate: z.coerce.date().nullable(),
        stackKeywords: z.array(z.string()),
        isAbandoned: z.boolean(),
    }),
});

export const collections = {posts, til, links, projects, pages};
