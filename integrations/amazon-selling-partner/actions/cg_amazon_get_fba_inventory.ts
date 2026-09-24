import { z } from 'zod';
import { createAction } from 'nango';
import { authorizeMarketplaces, MarketplaceIdsSchema, TokenSchema, csv, getJson } from '../shared.js';

const InputSchema = z.strictObject({
    marketplaceIds: MarketplaceIdsSchema.length(1),
    granularityType: z.enum(['Marketplace']).default('Marketplace'),
    details: z.boolean().default(false),
    sellerSkus: z.array(z.string().min(1).max(40)).max(20).optional(),
    sellerSku: z.string().min(1).max(40).optional(),
    startDateTime: z.string().datetime({ offset: true }).optional(),
    nextToken: TokenSchema.optional(),
});
// Closed, bounded provider projection: never include free-text, identity, address or tax fields.
const OutputSchema = z.object({
    payload: z.object({
        granularity: z
            .object({
                granularityType: z.string().max(40).optional(),
                granularityId: z.string().max(50).optional(),
            })
            .optional(),
        inventorySummaries: z
            .array(
                z.object({
                    asin: z.string().max(10).optional(),
                    fnSku: z.string().max(40).optional(),
                    sellerSku: z.string().max(40).optional(),
                    condition: z.string().max(40).optional(),
                    totalQuantity: z.number().int().optional(),
                    lastUpdatedTime: z.string().max(40).optional(),
                    inventoryDetails: z
                        .object({
                            fulfillableQuantity: z.number().int().optional(),
                            inboundWorkingQuantity: z.number().int().optional(),
                            inboundShippedQuantity: z.number().int().optional(),
                            inboundReceivingQuantity: z.number().int().optional(),
                            reservedQuantity: z
                                .object({ totalReservedQuantity: z.number().int().optional() })
                                .optional(),
                            unfulfillableQuantity: z
                                .object({ totalUnfulfillableQuantity: z.number().int().optional() })
                                .optional(),
                        })
                        .optional(),
                }),
            )
            .max(100)
            .optional(),
    }),
    pagination: z.object({ nextToken: z.string().max(2048).optional() }).optional(),
});

const action = createAction({
    description: 'Retrieve one bounded page of FBA inventory summaries.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: [],
    exec: async (nango, input) =>
        {
        await authorizeMarketplaces(nango, input);
        return (OutputSchema.parse(
            await getJson(nango, '/fba/inventory/v1/summaries', {
                granularityType: input.granularityType,
                granularityId: input.marketplaceIds[0],
                details: input.details ? 'true' : 'false',
                sellerSkus: input.sellerSkus ? csv(input.sellerSkus) : undefined,
                sellerSku: input.sellerSku,
                startDateTime: input.startDateTime,
                marketplaceIds: csv(input.marketplaceIds),
                nextToken: input.nextToken,
            }),
        ));
    },
});

export default action;
