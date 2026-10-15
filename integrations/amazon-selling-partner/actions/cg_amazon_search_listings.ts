import { z } from 'zod';
import { createAction } from 'nango';
import { authorizeMarketplaces, MarketplaceIdsSchema, TokenSchema, csv, getJson, sellerId } from '../shared.js';

const InputSchema = z
    .object({
        marketplaceIds: MarketplaceIdsSchema,
        identifiers: z.array(z.string().min(1).max(32)).min(1).max(20).optional(),
        identifiersType: z.enum(['ASIN', 'EAN', 'FNSKU', 'GTIN', 'ISBN', 'JAN', 'MINSAN', 'SKU', 'UPC']).optional(),
        pageSize: z.number().int().min(1).max(20).default(20),
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
        pageToken: TokenSchema.optional(),
    })
    .strict()
    .refine(
        (value) => Boolean(value.identifiers) === Boolean(value.identifiersType),
        'identifiers and identifiersType must be supplied together',
    );
// Closed, bounded provider projection: never include free-text, identity, address or tax fields.
const OutputSchema = z.object({
    numberOfResults: z.number().int().optional(),
    pagination: z
        .object({ nextToken: z.string().max(2048).optional(), previousToken: z.string().max(2048).optional() })
        .optional(),
    items: z
        .array(
            z.object({
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
                        z.object({
                            fulfillmentChannelCode: z.string().max(40).optional(),
                            quantity: z.number().int().optional(),
                        }),
                    )
                    .max(20)
                    .optional(),
                issues: z
                    .array(z.object({ code: z.string().max(80).optional(), severity: z.string().max(20).optional() }))
                    .max(30)
                    .optional(),
            }),
        )
        .max(20),
});

const action = createAction({
    description: 'Search the connected seller listings with bounded filters and pagination.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: [],
    exec: async (nango, input) =>
        {
        await authorizeMarketplaces(nango, input);
        return (OutputSchema.parse(
            await getJson(nango, `/listings/2021-08-01/items/${encodeURIComponent(await sellerId(nango))}`, {
                marketplaceIds: csv(input.marketplaceIds),
                identifiers: input.identifiers ? csv(input.identifiers) : undefined,
                identifiersType: input.identifiersType,
                pageSize: input.pageSize,
                includedData: input.includedData ? csv(input.includedData) : undefined,
                issueLocale: input.issueLocale,
                pageToken: input.pageToken,
            }),
        ));
    },
});

export default action;
