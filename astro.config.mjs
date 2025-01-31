// @ts-check
import {defineConfig} from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

import icon from 'astro-icon';

import cloudflare from '@astrojs/cloudflare';

import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: 'https://kennethchristensen.me',
  integrations: [mdx(), sitemap(), icon(), tailwind()],
  // adapter: cloudflare(),
  output: 'static'
});