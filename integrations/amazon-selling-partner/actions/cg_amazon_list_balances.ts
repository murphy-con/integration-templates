import { z } from 'zod';
import { createAction } from 'nango';
import { authorizeMarketplaces, MarketplaceIdsSchema, csv, getJson } from '../shared.js';

const InputSchema = z.strictObject({
    marketplaceIds: MarketplaceIdsSchema,
    balanceType: z.enum(['AVAILABLE', 'RESERVED', 'TOTAL', 'ACCOUNT_LEVEL_RESERVE', 'DEFERRED']).optional(),
    accountType: z.enum(['SELLER', 'AMAZON_PAY']).optional(),
    asOfDate: z.string().datetime({ offset: true }).optional(),
    nextToken: z.string().min(1).max(2048).optional(),
});
// Closed, bounded provider projection: never include free-text, identity, address or tax fields.
const OutputSchema = z.object({
    balances: z
        .array(
            z.object({
                balanceType: z.string().max(40).optional(),
                amount: z
                    .object({ currencyCode: z.string().max(3).optional(), currencyAmount: z.number().optional() })
                    .optional(),
                asOfDate: z.string().max(40).optional(),
                lastUpdatedTime: z.string().max(40).optional(),
                partnerMetadata: z
                    .object({
                        marketplaceId: z.string().max(32).optional(),
                        accountType: z.string().max(40).optional(),
                    })
                    .optional(),
            }),
        )
        .max(100),
    nextToken: z.string().max(2048).optional(),
});

const action = createAction({
    description: 'List Amazon seller balances for a bounded marketplace set.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: [],
    exec: async (nango, input) =>
        {
        await authorizeMarketplaces(nango, input);
        return (OutputSchema.parse(
            await getJson(nango, '/finances/2024-06-19/balances', {
                marketplaceIds: input.marketplaceIds ? csv(input.marketplaceIds) : undefined,
                balanceType: input.balanceType,
                accountType: input.accountType,
                asOfDate: input.asOfDate,
                nextToken: input.nextToken,
            }),
        ));
    },
});

export default action;
