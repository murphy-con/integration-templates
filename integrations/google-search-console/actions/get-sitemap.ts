import { z } from 'zod';
import { createAction } from 'nango';
import { SitemapSchema } from './schemas.js';

const SiteProperty = z.string().min(1).max(2048);
const FeedPath = z.string().url().max(2048);
const InputSchema = z
    .object({
        siteUrl: SiteProperty.describe('Search Console property URL, for example https://www.example.com/ or sc-domain:example.com'),
        feedpath: FeedPath.describe('Fully qualified sitemap URL')
    })
    .strict();

const action = createAction({
    description: 'Retrieve a submitted sitemap for a Google Search Console property.',
    version: '1.0.0',
    input: InputSchema,
    output: SitemapSchema,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    exec: async (nango, input) => {
        const response = await nango.get({
            endpoint: `/v3/sites/${encodeURIComponent(input.siteUrl)}/sitemaps/${encodeURIComponent(input.feedpath)}`,
            retries: 3
        });
        return SitemapSchema.parse(response.data);
    }
});

export type NangoActionLocal = Parameters<(typeof action)['exec']>[0];
export default action;
