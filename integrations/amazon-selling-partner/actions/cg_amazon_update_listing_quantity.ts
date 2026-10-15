import { z } from 'zod';
import { createAction } from 'nango';
import { authorizeMarketplaces, patchJson, sellerId } from '../shared.js';
const ListingSubmissionSchema = z.object({ sku: z.string(), status: z.string(), submissionId: z.string(), issues: z.array(z.object({ code: z.string().optional(), severity: z.string().optional() })).max(100).optional() });

const InputSchema = z.strictObject({
    sellerSku: z.string().min(1).max(40),
    productType: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
    marketplaceId: z.string().regex(/^[A-Z0-9]{5,32}$/),
    fulfillmentChannelCode: z.string().regex(/^[A-Za-z0-9_-]{1,50}$/),
    quantity: z.number().int().min(0).max(100000)
});
const OutputSchema = ListingSubmissionSchema;

const action = createAction({
    description: 'Update only the Amazon listing fulfillment-availability quantity path.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: [],
    exec: async (nango, input) => {
        await authorizeMarketplaces(nango, input);
        return (OutputSchema.parse(await patchJson(nango, `/listings/2021-08-01/items/${encodeURIComponent(await sellerId(nango))}/${encodeURIComponent(input.sellerSku)}`, {
        productType: input.productType,
        patches: [{
            op: 'replace',
            path: '/attributes/fulfillment_availability',
            value: [{ fulfillment_channel_code: input.fulfillmentChannelCode, quantity: input.quantity, marketplace_id: input.marketplaceId }]
        }]
    }, { marketplaceIds: input.marketplaceId })));
    }
});

export default action;
