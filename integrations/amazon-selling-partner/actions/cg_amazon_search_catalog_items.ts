import { z } from 'zod';
import { createAction } from 'nango';
import { authorizeMarketplaces, MarketplaceIdsSchema, TokenSchema, csv, getJson, sellerId } from '../shared.js';

const IncludedData = z
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
    .optional();
const InputSchema = z
    .object({
        marketplaceIds: MarketplaceIdsSchema,
        keywords: z.array(z.string().min(1).max(100)).min(1).max(20).optional(),
        identifiers: z.array(z.string().min(1).max(32)).max(20).optional(),
        identifiersType: z.enum(['ASIN', 'EAN', 'GTIN', 'ISBN', 'JAN', 'MINSAN', 'SKU', 'UPC']).optional(),
        includedData: IncludedData,
        pageSize: z.number().int().min(1).max(20).default(20),
        pageToken: TokenSchema.optional(),
    })
    .strict()
    .refine(
        (value) => Boolean(value.keywords) !== Boolean(value.identifiers),
        'Provide keywords or identifiers, but not both',
    )
    .refine((value) => !value.identifiers || Boolean(value.identifiersType), 'identifiersType is required');
// Closed, bounded provider projection: never include free-text, identity, address or tax fields.
const OutputSchema = z.object({
    numberOfResults: z.number().int().optional(),
    pagination: z
        .object({ nextToken: z.string().max(2048).optional(), previousToken: z.string().max(2048).optional() })
        .optional(),
    items: z
        .array(
            z.object({
                asin: z.string().max(10).optional(),
                productTypes: z
                    .array(
                        z.object({
                            marketplaceId: z.string().max(32).optional(),
                            productType: z.string().max(100).optional(),
                        }),
                    )
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
            }),
        )
        .max(20),
});

const action = createAction({
    description: 'Search Amazon catalog items by bounded keywords or identifiers.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: [],
    exec: async (nango, input) =>
        {
        await authorizeMarketplaces(nango, input);
        return (OutputSchema.parse(
            await getJson(nango, '/catalog/2022-04-01/items', {
                marketplaceIds: csv(input.marketplaceIds),
                keywords: input.keywords ? csv(input.keywords) : undefined,
                sellerId: input.identifiersType === 'SKU' ? await sellerId(nango) : undefined,
                identifiers: input.identifiers ? csv(input.identifiers) : undefined,
                identifiersType: input.identifiersType,
                includedData: input.includedData ? csv(input.includedData) : undefined,
                pageSize: input.pageSize,
                pageToken: input.pageToken,
            }),
        ));
    },
});

export default action;
