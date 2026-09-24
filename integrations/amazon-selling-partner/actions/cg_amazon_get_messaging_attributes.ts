import { z } from 'zod';
import { createAction } from 'nango';
import { authorizeMarketplaces, getJson, MarketplaceIdsSchema } from '../shared.js';

const InputSchema = z.strictObject({ amazonOrderId: z.string().regex(/^[0-9-]{10,30}$/), marketplaceIds: MarketplaceIdsSchema.max(1) });
// The official response only documents buyer.locale; strip any unexpected buyer PII.
const OutputSchema = z.object({ buyer: z.object({ locale: z.string().regex(/^[a-z]{2}_[A-Z]{2}$/).optional() }).optional() });

const action = createAction({
    description: 'Retrieve Amazon messaging attributes for one order without sending a message.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: [],
    exec: async (nango, input) => {
        await authorizeMarketplaces(nango, input);
        return (OutputSchema.parse(await getJson(nango, `/messaging/v1/orders/${encodeURIComponent(input.amazonOrderId)}/attributes`, { marketplaceIds: input.marketplaceIds.join(',') })));
    }
});

export default action;
