import { z } from 'zod';
import { createAction } from 'nango';
import { authorizeMarketplaces, postJson } from '../shared.js';

const PriceSchema = z.strictObject({
    currencyCode: z.string().regex(/^[A-Z]{3}$/),
    amount: z.number().nonnegative().max(1000000),
});
const InputSchema = z.strictObject({
    asin: z.string().regex(/^[A-Z0-9]{10}$/),
    marketplaceId: z.string().regex(/^[A-Z0-9]{5,32}$/),
    isAmazonFulfilled: z.boolean(),
    priceToEstimateFees: z.strictObject({
        listingPrice: PriceSchema,
        shipping: PriceSchema.optional(),
        points: z.strictObject({ pointsNumber: z.number().int().nonnegative() }).optional(),
    }),
});
// Closed, bounded provider projection: never include free-text, identity, address or tax fields.
const OutputSchema = z.object({
    payload: z.object({
        FeesEstimateResult: z
            .object({
                Status: z.string().max(40).optional(),
                FeesEstimate: z
                    .object({
                        TimeOfFeesEstimation: z.string().max(40).optional(),
                        TotalFeesEstimate: z
                            .object({ CurrencyCode: z.string().max(3).optional(), Amount: z.number().optional() })
                            .optional(),
                        FeeDetailList: z
                            .array(
                                z.object({
                                    FeeType: z.string().max(80).optional(),
                                    FeeAmount: z
                                        .object({
                                            CurrencyCode: z.string().max(3).optional(),
                                            Amount: z.number().optional(),
                                        })
                                        .optional(),
                                    FinalFee: z
                                        .object({
                                            CurrencyCode: z.string().max(3).optional(),
                                            Amount: z.number().optional(),
                                        })
                                        .optional(),
                                }),
                            )
                            .max(40)
                            .optional(),
                    })
                    .optional(),
                Error: z
                    .object({ Type: z.string().max(60).optional(), Code: z.string().max(60).optional() })
                    .optional(),
            })
            .optional(),
    }),
});

const action = createAction({
    description: 'Estimate Amazon fees for one ASIN using explicit price and fulfillment inputs.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: [],
    exec: async (nango, input) =>
        {
        await authorizeMarketplaces(nango, input);
        return (OutputSchema.parse(
            await postJson(nango, `/products/fees/v0/items/${encodeURIComponent(input.asin)}/feesEstimate`, {
                FeesEstimateRequest: {
                    MarketplaceId: input.marketplaceId,
                    IsAmazonFulfilled: input.isAmazonFulfilled,
                    Identifier: input.asin,
                    PriceToEstimateFees: {
                        ListingPrice: {
                            CurrencyCode: input.priceToEstimateFees.listingPrice.currencyCode,
                            Amount: input.priceToEstimateFees.listingPrice.amount,
                        },
                        Shipping: input.priceToEstimateFees.shipping
                            ? {
                                  CurrencyCode: input.priceToEstimateFees.shipping.currencyCode,
                                  Amount: input.priceToEstimateFees.shipping.amount,
                              }
                            : undefined,
                        Points: input.priceToEstimateFees.points
                            ? { PointsNumber: input.priceToEstimateFees.points.pointsNumber }
                            : undefined,
                    },
                },
            }),
        ));
    },
});

export default action;
