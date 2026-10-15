import { z } from 'zod';
import { createAction } from 'nango';
import { authorizeMarketplaces, getJson, MarketplaceIdSchema, TokenSchema } from '../shared.js';

const InputSchema = z.strictObject({ marketplaceId: MarketplaceIdSchema, asin: z.string().regex(/^[A-Z0-9]{10}$/), pageToken: TokenSchema.optional() });
const OutputSchema = z.object({
    publishRecordList: z.array(z.object({
        marketplaceId: z.string().max(32), locale: z.string().max(35), asin: z.string().max(10),
        contentType: z.string().max(30), contentSubType: z.string().max(50).optional(),
        contentReferenceKey: z.string().max(200)
    })).max(100),
    nextPageToken: z.string().max(2048).optional()
});

const action = createAction({
    description: 'Search bounded Amazon A+ publish records.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: [],
    exec: async (nango, input) => {
        await authorizeMarketplaces(nango, input);
        return (OutputSchema.parse(await getJson(nango, '/aplus/2020-11-01/contentPublishRecords', { marketplaceId: input.marketplaceId, asin: input.asin, pageToken: input.pageToken })));
    }
});

export default action;
