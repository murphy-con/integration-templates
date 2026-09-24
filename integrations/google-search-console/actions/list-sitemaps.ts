import { z } from 'zod';
import { createAction } from 'nango';
import { SitemapsSchema } from './schemas.js';

const SiteProperty = z.string().min(1).max(2048);
const InputSchema = z
    .object({
        siteUrl: SiteProperty.describe('Search Console property URL, for example https://www.example.com/ or sc-domain:example.com'),
        sitemapIndex: z.string().url().max(2048).optional().describe('Optional sitemap index URL to list entries within')
    })
    .strict();

const action = createAction({
    description: 'List submitted sitemaps for a Google Search Console property.',
    version: '1.0.0',
    input: InputSchema,
    output: SitemapsSchema,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    exec: async (nango, input) => {
        const response = await nango.get({
            endpoint: `/v3/sites/${encodeURIComponent(input.siteUrl)}/sitemaps`,
            ...(input.sitemapIndex !== undefined && { params: { sitemapIndex: input.sitemapIndex } }),
            retries: 3
        });
        return SitemapsSchema.parse(response.data);
    }
});

export type NangoActionLocal = Parameters<(typeof action)['exec']>[0];
export default action;
