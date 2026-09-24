import { z } from 'zod';
import { createAction } from 'nango';
import { authorizeMarketplaces, postJson } from '../shared.js';

const RequestSchema = z
    .object({
        sku: z.string().min(1).max(40),
        marketplaceId: z.string().regex(/^[A-Z0-9]{5,32}$/),
    })
    .strict();
const InputSchema = z.strictObject({ requests: z.array(RequestSchema).min(1).max(20) });
// Closed, bounded provider projection: never include free-text, identity, address or tax fields.
const OutputSchema = z.object({
    responses: z
        .array(
            z.object({
                status: z.object({ statusCode: z.number().int().optional() }).optional(),
                request: z
                    .object({ sku: z.string().max(40).optional(), marketplaceId: z.string().max(32).optional() })
                    .optional(),
                body: z
                    .object({
                        featuredOfferExpectedPriceResults: z
                            .array(
                                z.object({
                                    resultStatus: z.string().max(40).optional(),
                                    featuredOfferExpectedPrice: z
                                        .object({
                                            listingPrice: z
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
                                        })
                                        .optional(),
                                }),
                            )
                            .max(20)
                            .optional(),
                    })
                    .optional(),
            }),
        )
        .max(20),
});

const action = createAction({
    description: 'Estimate the expected featured offer price for a small SKU batch.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: [],
    exec: async (nango, input) =>
        {
        await authorizeMarketplaces(nango, input);
        return (OutputSchema.parse(
            await postJson(nango, '/batches/products/pricing/2022-05-01/offer/featuredOfferExpectedPrice', {
                requests: input.requests.map((request) => ({
                    ...request,
                    method: 'GET',
                    uri: '/products/pricing/2022-05-01/offer/featuredOfferExpectedPrice',
                })),
            }),
        ));
    },
});

export default action;
