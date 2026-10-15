import { z } from 'zod';
import { createAction } from 'nango';

const SiteProperty = z.string().min(1).max(2048);
const InputSchema = z.object({
    siteUrl: SiteProperty.describe('Search Console property URL, for example https://www.example.com/ or sc-domain:example.com')
}).strict();

const action = createAction({
    description: 'List submitted Google Search Console sitemaps (list-search-console-sitemaps).',
    version: '1.0.0',
    input: InputSchema,
    output: z.any(),
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    exec: async (nango, input) => {
        const response = await nango.get({
            endpoint: `/v3/sites/${encodeURIComponent(input.siteUrl)}/sitemaps`,
            retries: 3
        });
        return response.data;
    }
});

export type NangoActionLocal = Parameters<(typeof action)['exec']>[0];
export default action;
