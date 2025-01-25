import {glob} from 'astro/loaders';
import {defineCollection, z} from 'astro:content';

const blog = defineCollection({
    // Load Markdown and MDX files in the `src/content/blog/` directory.
    loader: glob({base: './src/content/blog', pattern: '**/*.{md,mdx}'}),
    // Type-check frontmatter using a schema
    schema: z.object({
        title: z.string(),
        description: z.string(),
        // Transform string to Date object
        pubDate: z.coerce.date(),
        updatedDate: z.coerce.date().optional(),
    }),
});

const projects = defineCollection({
    // Load Markdown and MDX files in the `src/content/blog/` directory.
    loader: glob({base: './src/content/projects', pattern: '**/*.{md,mdx}'}),
    // type: 'data',
    // Type-check frontmatter using a schema
    schema: z.object({
        title: z.string(),
        description: z.string(),
        logo: z.string(),
        // Transform string to Date object
        repoLink: z.string().nullable(),
        license: z.string().nullable(),
        startDate: z.coerce.date(),
        endDate: z.coerce.date().nullable(),
        stackKeywords: z.array(z.string()),
        isAbandoned: z.boolean()
    }),
});

export const collections = {blog, projects};
