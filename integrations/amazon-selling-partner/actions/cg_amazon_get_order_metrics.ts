import { z } from 'zod';
import { createAction } from 'nango';
import { authorizeMarketplaces, MarketplaceIdsSchema, csv, getJson } from '../shared.js';

const InputSchema = z.strictObject({
    marketplaceIds: MarketplaceIdsSchema,
    interval: z.object({ start: z.string().datetime({ offset: true }), end: z.string().datetime({ offset: true }) }),
    granularity: z.enum(['Hour', 'Day', 'Week', 'Month', 'Year', 'Total']),
    granularityTimeZone: z.string().min(1).max(64).optional(),
    buyerType: z.enum(['B2B', 'B2C', 'All']).optional(),
    fulfillmentNetwork: z.enum(['AFN', 'MFN']).optional(),
    firstDayOfWeek: z.enum(['Monday', 'Sunday']).optional(),
    asin: z
        .string()
        .regex(/^[A-Z0-9]{10}$/)
        .optional(),
    sku: z.string().min(1).max(40).optional(),
    amazonProgram: z.enum(['AmazonHaul']).optional(),
});
// Closed, bounded provider projection: never include free-text, identity, address or tax fields.
const OutputSchema = z.object({
    payload: z
        .array(
            z.object({
                interval: z.string().max(100).optional(),
                unitCount: z.number().int().optional(),
                orderItemCount: z.number().int().optional(),
                orderCount: z.number().int().optional(),
                averageUnitPrice: z
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
                totalSales: z
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
        .max(100),
});

const action = createAction({
    description: 'Retrieve bounded Amazon order metrics for an interval and marketplace set.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: [],
    exec: async (nango, input) =>
        {
        await authorizeMarketplaces(nango, input);
        return (OutputSchema.parse(
            await getJson(nango, '/sales/v1/orderMetrics', {
                marketplaceIds: csv(input.marketplaceIds),
                interval: `${input.interval.start}--${input.interval.end}`,
                granularity: input.granularity,
                granularityTimeZone: input.granularityTimeZone,
                buyerType: input.buyerType,
                fulfillmentNetwork: input.fulfillmentNetwork,
                firstDayOfWeek: input.firstDayOfWeek,
                asin: input.asin,
                sku: input.sku,
                amazonProgram: input.amazonProgram,
            }),
        ));
    },
});

export default action;
