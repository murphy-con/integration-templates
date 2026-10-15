import { z } from 'zod';
import { createAction } from 'nango';
import { authorizeMarketplaces, postJson } from '../shared.js';

const RequestSchema = z.strictObject({
    asin: z.string().regex(/^[A-Z0-9]{10}$/),
    marketplaceId: z.string().regex(/^[A-Z0-9]{5,32}$/),
    includedData: z
        .array(z.enum(['featuredBuyingOptions', 'referencePrices', 'lowestPricedOffers', 'similarItems']))
        .min(1)
        .max(4)
        .default(['featuredBuyingOptions', 'referencePrices']),
});
const InputSchema = z.strictObject({ requests: z.array(RequestSchema).min(1).max(20) });
// Closed, bounded provider projection: never include free-text, identity, address or tax fields.
const Money = z.object({ currencyCode: z.string().max(3).optional(), amount: z.number().optional() });
const SafeOffer = z.object({
    condition: z.string().max(30).optional(),
    fulfillmentType: z.string().max(30).optional(),
    listingPrice: Money.optional(),
});
const OutputSchema = z.object({
    responses: z
        .array(
            z.object({
                status: z.object({ statusCode: z.number().int().optional() }).optional(),
                body: z
                    .object({
                        asin: z.string().max(10).optional(),
                        marketplaceId: z.string().max(32).optional(),
                        featuredBuyingOptions: z
                            .array(
                                z.object({
                                    buyingOptionType: z.string().max(30).optional(),
                                    segmentedFeaturedOffers: z.array(SafeOffer).max(20).optional(),
                                }),
                            )
                            .max(10)
                            .optional(),
                        lowestPricedOffers: z
                            .array(
                                z.object({
                                    lowestPricedOffersInput: z
                                        .object({
                                            itemCondition: z.string().max(30).optional(),
                                            offerType: z.string().max(30).optional(),
                                        })
                                        .optional(),
                                    offers: z.array(SafeOffer).max(20).optional(),
                                }),
                            )
                            .max(20)
                            .optional(),
                        referencePrices: z
                            .array(
                                z.object({
                                    name: z
                                        .string()
                                        .regex(/^[A-Za-z][A-Za-z0-9_-]{0,79}$/)
                                        .optional(),
                                    price: Money.optional(),
                                }),
                            )
                            .max(30)
                            .optional(),
                        similarItems: z
                            .array(
                                z.object({
                                    items: z
                                        .array(z.object({ asin: z.string().max(10).optional() }))
                                        .max(20)
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
    description: 'Retrieve bounded competitive and Buy Box summary data for ASINs.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: [],
    exec: async (nango, input) =>
        {
        await authorizeMarketplaces(nango, input);
        return (OutputSchema.parse(
            await postJson(nango, '/batches/products/pricing/2022-05-01/items/competitiveSummary', {
                requests: input.requests.map((request) => ({
                    ...request,
                    method: 'GET',
                    uri: '/products/pricing/2022-05-01/items/competitiveSummary',
                })),
            }),
        ));
    },
});

export default action;
