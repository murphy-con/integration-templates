import { z } from 'zod';
import { createAction } from 'nango';
import { InspectionSchema } from './schemas.js';

const Url = z.string().url().max(2048);
const SiteProperty = z.string().min(1).max(2048);
const InputSchema = z
    .object({
        inspectionUrl: Url.describe('Fully qualified URL to inspect'),
        siteUrl: SiteProperty.describe('Search Console property URL, for example https://www.example.com/ or sc-domain:example.com'),
        languageCode: z.string().min(2).max(35).optional().describe('Optional BCP-47 language code for issue messages')
    })
    .strict();

const action = createAction({
    description: 'Inspect the indexed status of a URL in a Search Console property.',
    version: '1.0.0',
    input: InputSchema,
    output: InspectionSchema,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    exec: async (nango, input) => {
        const response = await nango.post({
            baseUrlOverride: 'https://searchconsole.googleapis.com',
            endpoint: '/v1/urlInspection/index:inspect',
            data: {
                inspectionUrl: input.inspectionUrl,
                siteUrl: input.siteUrl,
                ...(input.languageCode !== undefined && { languageCode: input.languageCode })
            },
            retries: 3
        });
        return InspectionSchema.parse(response.data);
    }
});

export type NangoActionLocal = Parameters<(typeof action)['exec']>[0];
export default action;
