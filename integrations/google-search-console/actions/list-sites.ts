import { z } from 'zod';
import { createAction } from 'nango';
import { SitesSchema } from './schemas.js';

const InputSchema = z.object({}).strict();

const action = createAction({
    description: 'List Google Search Console properties accessible to the connected user.',
    version: '1.0.0',
    input: InputSchema,
    output: SitesSchema,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    exec: async (nango) => {
        const response = await nango.get({
            endpoint: '/v3/sites',
            retries: 3
        });
        return SitesSchema.parse(response.data);
    }
});

export type NangoActionLocal = Parameters<(typeof action)['exec']>[0];
export default action;
