import { z } from 'zod';
import { createAction } from 'nango';
import { authorizeMarketplaces, MarketplaceIdsSchema, csv, getJson, sellerId } from '../shared.js';

const InputSchema = z.strictObject({
    asin: z.string().regex(/^[A-Z0-9]{10}$/),
    marketplaceIds: MarketplaceIdsSchema,
    conditionType: z
        .enum([
            'new_new',
            'new_open_box',
            'new_oem',
            'refurbished_refurbished',
            'used_like_new',
            'used_very_good',
            'used_good',
            'used_acceptable',
            'collectible_like_new',
            'collectible_very_good',
            'collectible_good',
            'collectible_acceptable',
            'club_club',
        ])
        .optional(),
    reasonLocale: z
        .string()
        .regex(/^[a-z]{2}(_[A-Z]{2})?$/)
        .optional(),
    productType: z.string().min(1).max(100).optional(),
});
// Closed, bounded provider projection: never include free-text, identity, address or tax fields.
const OutputSchema = z.object({
    restrictions: z
        .array(
            z.object({
                marketplaceId: z.string().max(32).optional(),
                conditionType: z.string().max(40).optional(),
                reasons: z
                    .array(z.object({ reasonCode: z.string().max(40).optional() }))
                    .max(20)
                    .optional(),
            }),
        )
        .max(100),
});

const action = createAction({
    description: 'Check listing restrictions for an ASIN before changing or creating a listing.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: [],
    exec: async (nango, input) =>
        {
        await authorizeMarketplaces(nango, input);
        return (OutputSchema.parse(
            await getJson(nango, '/listings/2021-08-01/restrictions', {
                asin: input.asin,
                conditionType: input.conditionType,
                sellerId: await sellerId(nango),
                marketplaceIds: csv(input.marketplaceIds),
                reasonLocale: input.reasonLocale,
                productType: input.productType,
            }),
        ));
    },
});

export default action;
