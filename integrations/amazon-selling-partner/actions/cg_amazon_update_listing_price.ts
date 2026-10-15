import { z } from 'zod';
import { createAction } from 'nango';
import { authorizeMarketplaces, patchJson, sellerId } from '../shared.js';
const ListingSubmissionSchema = z.object({ sku: z.string(), status: z.string(), submissionId: z.string(), issues: z.array(z.object({ code: z.string().optional(), severity: z.string().optional() })).max(100).optional() });

const InputSchema = z.strictObject({
    sellerSku: z.string().min(1).max(40),
    productType: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
    marketplaceId: z.string().regex(/^[A-Z0-9]{5,32}$/),
    currency: z.string().regex(/^[A-Z]{3}$/),
    amount: z.number().nonnegative().max(1000000),
    businessPrice: z.number().nonnegative().max(1000000).optional()
});
const OutputSchema = ListingSubmissionSchema;

const action = createAction({
    description: 'Update only the Amazon listing purchasable-offer price paths.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: [],
    exec: async (nango, input) => {
        await authorizeMarketplaces(nango, input);
        const purchasableOffer: Record<string, unknown> = {
            marketplace_id: input.marketplaceId,
            currency: input.currency,
            our_price: [{ schedule: [{ value_with_tax: input.amount }] }]
        };
        if (input.businessPrice !== undefined) {
            purchasableOffer['business_price'] = [{ schedule: [{ value_with_tax: input.businessPrice }] }];
        }
        return OutputSchema.parse(await patchJson(nango, `/listings/2021-08-01/items/${encodeURIComponent(await sellerId(nango))}/${encodeURIComponent(input.sellerSku)}`, {
            productType: input.productType,
            patches: [{ op: 'replace', path: '/attributes/purchasable_offer', value: [purchasableOffer] }]
        }, { marketplaceIds: input.marketplaceId }));
    }
});

export default action;
