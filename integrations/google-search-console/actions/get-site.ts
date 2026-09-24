import { z } from 'zod';
import { createAction } from 'nango';
import { SiteSchema } from './schemas.js';

const SiteProperty = z.string().min(1).max(2048);
const InputSchema = z
    .object({
        siteUrl: SiteProperty.describe('Search Console property URL, for example https://www.example.com/ or sc-domain:example.com')
    })
    .strict();

const action = createAction({
    description: 'Retrieve a Google Search Console property and its permission level.',
    version: '1.0.0',
    input: InputSchema,
    output: SiteSchema,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    exec: async (nango, input) => {
        const response = await nango.get({
            endpoint: `/v3/sites/${encodeURIComponent(input.siteUrl)}`,
            retries: 3
        });
        return SiteSchema.parse(response.data);
    }
});

export type NangoActionLocal = Parameters<(typeof action)['exec']>[0];
export default action;
