import { z } from 'zod';
import { createAction } from 'nango';

const Url = z.string().url().max(2048);
const SiteProperty = z.string().min(1).max(2048);
const InputSchema = z.object({
    inspectionUrl: Url.describe('Fully qualified URL to inspect'),
    siteUrl: SiteProperty.describe('Search Console property URL, for example https://www.example.com/ or sc-domain:example.com')
}).strict();

const action = createAction({
    description: 'Inspect a URL in Google Search Console (inspect-search-console-url).',
    version: '1.0.0',
    input: InputSchema,
    output: z.any(),
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    exec: async (nango, input) => {
        const response = await nango.post({
            baseUrlOverride: 'https://searchconsole.googleapis.com',
            endpoint: '/v1/urlInspection/index:inspect',
            data: {
                inspectionUrl: input.inspectionUrl,
                siteUrl: input.siteUrl
            },
            retries: 3
        });
        return response.data;
    }
});

export type NangoActionLocal = Parameters<(typeof action)['exec']>[0];
export default action;
