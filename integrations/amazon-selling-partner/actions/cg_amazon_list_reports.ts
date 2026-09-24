import { z } from 'zod';
import { createAction } from 'nango';
import { authorizeMarketplaces, MarketplaceIdsSchema, PageSizeSchema, ReportTypeSchema, csv, getJson } from '../shared.js';
const ReportSchema = z.object({
    reportId: z.string(), reportType: z.string().optional(), processingStatus: z.string().optional(),
    marketplaceIds: z.array(z.string()).max(10).optional(), dataStartTime: z.string().optional(), dataEndTime: z.string().optional(),
    reportScheduleId: z.string().optional(), createdTime: z.string().optional(), processingStartTime: z.string().optional(),
    processingEndTime: z.string().optional(), reportDocumentId: z.string().optional()
});

const InputSchema = z.strictObject({
    reportTypes: z.array(ReportTypeSchema).max(10).optional(),
    processingStatuses: z.array(z.enum(['CANCELLED', 'DONE', 'FATAL', 'IN_PROGRESS', 'IN_QUEUE'])).max(6).optional(),
    marketplaceIds: MarketplaceIdsSchema,
    pageSize: PageSizeSchema,
    createdSince: z.string().datetime({ offset: true }).optional(),
    createdUntil: z.string().datetime({ offset: true }).optional(),
    nextToken: z.string().min(1).max(2048).optional()
});
const OutputSchema = z.object({ reports: z.array(ReportSchema).max(100), nextToken: z.string().optional() });

const action = createAction({
    description: 'List Amazon reports using a curated report-type allowlist.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: [],
    exec: async (nango, input) => {
        await authorizeMarketplaces(nango, input);
        return (OutputSchema.parse(await getJson(nango, '/reports/2021-06-30/reports', {
        reportTypes: input.reportTypes ? csv(input.reportTypes) : undefined,
        processingStatuses: input.processingStatuses ? csv(input.processingStatuses) : undefined,
        marketplaceIds: input.marketplaceIds ? csv(input.marketplaceIds) : undefined,
        pageSize: input.pageSize,
        createdSince: input.createdSince,
        createdUntil: input.createdUntil,
        nextToken: input.nextToken
    })));
    }
});

export default action;
