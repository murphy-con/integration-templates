import { z } from 'zod';
import { createAction } from 'nango';
import { authorizeMarketplaces, getJson, MarketplaceIdSchema } from '../shared.js';
import { BrowseReviewTopicsOutput as OutputSchema } from './feedback-projections.js';

const InputSchema = z.strictObject({ browseNodeId: z.string().regex(/^[0-9]{1,20}$/), marketplaceId: MarketplaceIdSchema, sortBy: z.enum(['MENTIONS', 'STAR_RATING_IMPACT']) });

const action = createAction({
    description: 'Get Amazon review topics for a browse node.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: [],
    exec: async (nango, input) => {
        await authorizeMarketplaces(nango, input);
        return (OutputSchema.parse(await getJson(nango, `/customerFeedback/2024-06-01/browseNodes/${encodeURIComponent(input.browseNodeId)}/reviews/topics`, { marketplaceId: input.marketplaceId, sortBy: input.sortBy })));
    }
});

export default action;
