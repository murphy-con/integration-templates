import { z } from 'zod';
import { createAction } from 'nango';
import { authorizeMarketplaces, MarketplaceIdsSchema, csv, getJson, sellerId } from '../shared.js';

const InputSchema = z.strictObject({
    sellerSku: z.string().min(1).max(40),
    marketplaceIds: MarketplaceIdsSchema,
    includedData: z
        .array(
            z.enum([
                'attributes',
                'issues',
                'offers',
                'fulfillmentAvailability',
                'procurement',
                'relationships',
                'summaries',
                'productTypes',
            ]),
        )
        .max(8)
        .optional(),
    issueLocale: z
        .string()
        .regex(/^[a-z]{2}(_[A-Z]{2})?$/)
        .optional(),
});
// Closed, bounded provider projection: never include free-text, identity, address or tax fields.
const OutputSchema = z.object({
    sku: z.string().max(40).optional(),
    summaries: z
        .array(
            z.object({
                marketplaceId: z.string().max(32).optional(),
                asin: z.string().max(10).optional(),
                productType: z.string().max(100).optional(),
                conditionType: z.string().max(32).optional(),
                status: z.array(z.string().max(32)).max(5).optional(),
                createdDate: z.string().max(40).optional(),
                lastUpdatedDate: z.string().max(40).optional(),
            }),
        )
        .max(10)
        .optional(),
    offers: z
        .array(
            z.object({
                marketplaceId: z.string().max(32).optional(),
                offerType: z.string().max(10).optional(),
                price: z
                    .object({
                        currencyCode: z.string().max(3).optional(),
                        amount: z
                            .union([
                                z.number(),
                                z
                                    .string()
                                    .regex(/^-?[0-9]+(?:\.[0-9]+)?$/)
                                    .max(32),
                            ])
                            .optional(),
                    })
                    .optional(),
            }),
        )
        .max(20)
        .optional(),
    fulfillmentAvailability: z
        .array(
            z.object({ fulfillmentChannelCode: z.string().max(40).optional(), quantity: z.number().int().optional() }),
        )
        .max(20)
        .optional(),
    issues: z
        .array(z.object({ code: z.string().max(80).optional(), severity: z.string().max(20).optional() }))
        .max(30)
        .optional(),
});

const action = createAction({
    description: 'Retrieve one listing from the connected Amazon seller.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: [],
    exec: async (nango, input) =>
        {
        await authorizeMarketplaces(nango, input);
        return (OutputSchema.parse(
            await getJson(
                nango,
                `/listings/2021-08-01/items/${encodeURIComponent(await sellerId(nango))}/${encodeURIComponent(input.sellerSku)}`,
                {
                    marketplaceIds: csv(input.marketplaceIds),
                    includedData: input.includedData ? csv(input.includedData) : undefined,
                    issueLocale: input.issueLocale,
                },
            ),
        ));
    },
});

export default action;
