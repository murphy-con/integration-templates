import { z } from 'zod';
import { createAction } from 'nango';
import { authorizeMarketplaces, MarketplaceIdsSchema, csv, getJson } from '../shared.js';

const InputSchema = z.strictObject({
    asin: z.string().regex(/^[A-Z0-9]{10}$/),
    marketplaceIds: MarketplaceIdsSchema,
    includedData: z
        .array(
            z.enum([
                'attributes',
                'classifications',
                'dimensions',
                'identifiers',
                'images',
                'productTypes',
                'relationships',
                'salesRanks',
                'summaries',
                'vendorDetails',
            ]),
        )
        .max(10)
        .optional(),
});
// Closed, bounded provider projection: never include free-text, identity, address or tax fields.
const OutputSchema = z.object({
    asin: z.string().max(10).optional(),
    productTypes: z
        .array(z.object({ marketplaceId: z.string().max(32).optional(), productType: z.string().max(100).optional() }))
        .max(10)
        .optional(),
    salesRanks: z
        .array(
            z.object({
                marketplaceId: z.string().max(32).optional(),
                classificationRanks: z
                    .array(
                        z.object({
                            classificationId: z.string().max(100).optional(),
                            rank: z.number().int().optional(),
                        }),
                    )
                    .max(20)
                    .optional(),
                displayGroupRanks: z
                    .array(
                        z.object({
                            websiteDisplayGroup: z.string().max(100).optional(),
                            rank: z.number().int().optional(),
                        }),
                    )
                    .max(20)
                    .optional(),
            }),
        )
        .max(10)
        .optional(),
    summaries: z
        .array(
            z.object({
                marketplaceId: z.string().max(32).optional(),
                itemClassification: z.string().max(40).optional(),
                adultProduct: z.boolean().optional(),
                packageQuantity: z.number().int().optional(),
            }),
        )
        .max(10)
        .optional(),
});

const action = createAction({
    description: 'Retrieve one Amazon catalog item with an explicit data allowlist.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: [],
    exec: async (nango, input) =>
        {
        await authorizeMarketplaces(nango, input);
        return (OutputSchema.parse(
            await getJson(nango, `/catalog/2022-04-01/items/${encodeURIComponent(input.asin)}`, {
                marketplaceIds: csv(input.marketplaceIds),
                includedData: input.includedData ? csv(input.includedData) : undefined,
            }),
        ));
    },
});

export default action;
