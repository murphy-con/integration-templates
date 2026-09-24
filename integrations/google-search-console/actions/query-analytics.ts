import { z } from 'zod';
import { createAction } from 'nango';
import { AnalyticsSchema } from './schemas.js';

const SiteProperty = z.string().min(1).max(2048);
const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Dimension = z.enum(['date', 'hour', 'query', 'page', 'country', 'device', 'searchAppearance']);
const Filter = z
    .object({
        dimension: Dimension,
        operator: z.enum(['contains', 'equals', 'notContains', 'notEquals', 'includingRegex', 'excludingRegex']),
        expression: z.string().min(1).max(2048)
    })
    .strict();
const FilterGroup = z
    .object({
        groupType: z.enum(['and']).optional(),
        filters: z.array(Filter).min(1).max(25)
    })
    .strict();
const InputSchema = z
    .object({
        siteUrl: SiteProperty.describe('Search Console property URL, for example https://www.example.com/ or sc-domain:example.com'),
        startDate: DateString.describe('Inclusive start date in YYYY-MM-DD format'),
        endDate: DateString.describe('Inclusive end date in YYYY-MM-DD format'),
        dimensions: z.array(Dimension).max(7).optional(),
        type: z.enum(['web', 'image', 'video', 'news', 'discover', 'googleNews']).optional(),
        dimensionFilterGroups: z.array(FilterGroup).max(5).optional(),
        aggregationType: z.enum(['auto', 'byPage', 'byProperty']).optional(),
        rowLimit: z.number().int().min(1).max(25000).optional(),
        startRow: z.number().int().min(0).max(250000).optional(),
        dataState: z.enum(['final', 'all', 'hourly_all']).optional()
    })
    .strict()
    .superRefine((input, context) => {
        if (input.startDate > input.endDate) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'endDate must not precede startDate' });
        }
        if (input.dimensions && new Set(input.dimensions).size !== input.dimensions.length) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['dimensions'], message: 'dimensions must not contain duplicates' });
        }
    });

const action = createAction({
    description: 'Query Search Console search analytics for a property and date range.',
    version: '1.0.0',
    input: InputSchema,
    output: AnalyticsSchema,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    exec: async (nango, input) => {
        const data = {
            startDate: input.startDate,
            endDate: input.endDate,
            ...(input.dimensions !== undefined && { dimensions: input.dimensions }),
            ...(input.type !== undefined && { type: input.type }),
            ...(input.dimensionFilterGroups !== undefined && { dimensionFilterGroups: input.dimensionFilterGroups }),
            ...(input.aggregationType !== undefined && { aggregationType: input.aggregationType }),
            ...(input.rowLimit !== undefined && { rowLimit: input.rowLimit }),
            ...(input.startRow !== undefined && { startRow: input.startRow }),
            ...(input.dataState !== undefined && { dataState: input.dataState })
        };
        const response = await nango.post({
            endpoint: `/v3/sites/${encodeURIComponent(input.siteUrl)}/searchAnalytics/query`,
            data,
            retries: 3
        });
        return AnalyticsSchema.parse(response.data);
    }
});

export type NangoActionLocal = Parameters<(typeof action)['exec']>[0];
export default action;
