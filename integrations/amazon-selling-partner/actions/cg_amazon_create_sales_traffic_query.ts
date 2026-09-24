import { z } from 'zod';
import { createAction } from 'nango';
import { authorizeMarketplaces, MarketplaceIdsSchema, TokenSchema, postJson } from '../shared.js';
import { salesTrafficQuery } from './data-kiosk-queries.js';

const InputSchema = z.strictObject({
    startDate: z.string().date(),
    endDate: z.string().date(),
    marketplaceIds: MarketplaceIdsSchema,
    paginationToken: TokenSchema.optional()
}).refine((value) => value.startDate <= value.endDate, 'startDate must not be after endDate');
const OutputSchema = z.object({ queryId: z.string() });

const action = createAction({
    description: 'Create the fixed Amazon sales-and-traffic-by-date Data Kiosk query.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: [],
    exec: async (nango, input) => {
        await authorizeMarketplaces(nango, input);
        const query = salesTrafficQuery(input);
        return OutputSchema.parse(await postJson(nango, '/dataKiosk/2023-11-15/queries', { query, paginationToken: input.paginationToken }));
    }
});

export default action;
