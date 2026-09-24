import { z } from 'zod';
import { createAction } from 'nango';
import { authorizeMarketplaces, getJson } from '../shared.js';

const InputSchema = z
    .strictObject({
        postedAfter: z.string().datetime({ offset: true }),
        postedBefore: z.string().datetime({ offset: true }).optional(),
        marketplaceId: z
            .string()
            .regex(/^[A-Z0-9]{5,32}$/),
        transactionStatus: z.enum(['DEFERRED', 'RELEASED', 'DEFERRED_RELEASED']).optional(),
        nextToken: z.string().min(1).max(2048).optional(),
    });
// Closed, bounded provider projection: never include free-text, identity, address or tax fields.
const OutputSchema = z.object({
    payload: z.object({
        nextToken: z.string().max(2048).optional(),
        transactions: z
            .array(
                z.object({
                    transactionType: z
                        .string()
                        .regex(/^[A-Za-z][A-Za-z0-9_-]{0,79}$/)
                        .optional(),
                    transactionStatus: z.string().max(40).optional(),
                    postedDate: z.string().max(40).optional(),
                    totalAmount: z
                        .object({
                            currencyCode: z.string().max(3).optional(),
                            currencyAmount: z.number().optional(),
                        })
                        .optional(),
                    sellingPartnerMetadata: z
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
    }),
});

const action = createAction({
    description: 'List one bounded page of Amazon financial transactions.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: [],
    exec: async (nango, input) => {
        await authorizeMarketplaces(nango, input);
        return OutputSchema.parse(await getJson(nango, '/finances/2024-06-19/transactions', input));
    },
});

export default action;
