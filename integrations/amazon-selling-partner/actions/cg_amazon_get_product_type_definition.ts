import { z } from 'zod';
import { createAction } from 'nango';
import { authorizeMarketplaces, MarketplaceIdsSchema, csv, getJson, sellerId } from '../shared.js';

const InputSchema = z.strictObject({
    productType: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
    marketplaceIds: MarketplaceIdsSchema.max(1),
    locale: z
        .string()
        .regex(/^(DEFAULT|[a-z]{2}(_[A-Z]{2})?)$/)
        .optional(),
    requirements: z.enum(['LISTING', 'LISTING_PRODUCT_ONLY', 'LISTING_OFFER_ONLY']).optional(),
    requirementsEnforced: z.enum(['ENFORCED', 'NOT_ENFORCED']).optional(),
});
// Closed, bounded provider projection: never include free-text, identity, address or tax fields.
const OutputSchema = z.object({
    productType: z.string().max(100).optional(),
    marketplaceIds: z.array(z.string().max(32)).max(10).optional(),
    requirements: z.string().max(40).optional(),
    requirementsEnforced: z.string().max(40).optional(),
    locale: z.string().max(16).optional(),
    productTypeVersion: z
        .object({
            version: z.string().max(40).optional(),
            latest: z.boolean().optional(),
            releaseCandidate: z.boolean().optional(),
        })
        .optional(),
});

const action = createAction({
    description: 'Retrieve an Amazon product-type definition used to validate listing inputs.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: [],
    exec: async (nango, input) =>
        {
        await authorizeMarketplaces(nango, input);
        return (OutputSchema.parse(
            await getJson(nango, `/definitions/2020-09-01/productTypes/${encodeURIComponent(input.productType)}`, {
                sellerId: await sellerId(nango),
                marketplaceIds: csv(input.marketplaceIds),
                locale: input.locale,
                requirements: input.requirements,
                requirementsEnforced: input.requirementsEnforced,
            }),
        ));
    },
});

export default action;
