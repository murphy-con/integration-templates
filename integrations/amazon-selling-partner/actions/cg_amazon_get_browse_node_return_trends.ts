import { z } from 'zod';
import { createAction } from 'nango';
import { authorizeMarketplaces, getJson, MarketplaceIdSchema } from '../shared.js';
import { BrowseReturnTrendsOutput as OutputSchema } from './feedback-projections.js';

const InputSchema = z.strictObject({ browseNodeId: z.string().regex(/^[0-9]{1,20}$/), marketplaceId: MarketplaceIdSchema });

const action = createAction({
    description: 'Get Amazon return trends for a browse node.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: [],
    exec: async (nango, input) => {
        await authorizeMarketplaces(nango, input);
        return (OutputSchema.parse(await getJson(nango, `/customerFeedback/2024-06-01/browseNodes/${encodeURIComponent(input.browseNodeId)}/returns/trends`, { marketplaceId: input.marketplaceId })));
    }
});

export default action;
