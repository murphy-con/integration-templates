import { z } from 'zod';
import { createAction } from 'nango';
import { authorizeMarketplaces, MarketplaceIdsSchema, csv, getJson } from '../shared.js';

const InputSchema = z
    .strictObject({
        marketplaceIds: MarketplaceIdsSchema,
        accountType: z.enum(['SELLER', 'AMAZON_PAY']).optional(),
        relatedIdentifierName: z.enum(['SETTLEMENT_ID']).optional(),
        relatedIdentifierValue: z.string().min(1).max(100).optional(),
        periodStart: z.string().datetime({ offset: true }).optional(),
        periodEnd: z.string().datetime({ offset: true }).optional(),
        nextToken: z.string().min(1).max(2048).optional(),
    })
    .refine(
        (value) => !value.relatedIdentifierName || Boolean(value.relatedIdentifierValue),
        'relatedIdentifierValue is required with relatedIdentifierName',
    );
// Closed, bounded provider projection: never include free-text, identity, address or tax fields.
const OutputSchema = z.object({
    summaries: z
        .array(
            z.object({
                netProceeds: z
                    .object({ currencyCode: z.string().max(3).optional(), currencyAmount: z.number().optional() })
                    .optional(),
                periodStart: z.string().max(40).optional(),
                periodEnd: z.string().max(40).optional(),
                partnerMetadata: z
                    .object({
                        marketplaceId: z.string().max(32).optional(),
                        accountType: z.string().max(40).optional(),
                    })
                    .optional(),
                breakdowns: z
                    .array(
                        z.object({
                            breakdownType: z.string().max(80).optional(),
                            breakdownAmount: z
                                .object({
                                    currencyCode: z.string().max(3).optional(),
                                    currencyAmount: z.number().optional(),
                                })
                                .optional(),
                        }),
                    )
                    .max(40)
                    .optional(),
            }),
        )
        .max(100),
    nextToken: z.string().max(2048).optional(),
});

const action = createAction({
    description: 'List Amazon financial summaries for a bounded period or identifier.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: [],
    exec: async (nango, input) =>
        {
        await authorizeMarketplaces(nango, input);
        return (OutputSchema.parse(
            await getJson(nango, '/finances/2024-06-19/summary', {
                marketplaceIds: input.marketplaceIds ? csv(input.marketplaceIds) : undefined,
                accountType: input.accountType,
                relatedIdentifierName: input.relatedIdentifierName,
                relatedIdentifierValue: input.relatedIdentifierValue,
                periodStart: input.periodStart,
                periodEnd: input.periodEnd,
                nextToken: input.nextToken,
            }),
        ));
    },
});

export default action;
