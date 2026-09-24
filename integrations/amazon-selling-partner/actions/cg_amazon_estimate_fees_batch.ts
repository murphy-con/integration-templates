import { z } from 'zod';
import { createAction } from 'nango';
import { authorizeMarketplaces, postJson } from '../shared.js';

const PriceSchema = z.strictObject({
    currencyCode: z.string().regex(/^[A-Z]{3}$/),
    amount: z.number().nonnegative().max(1000000),
});
const RequestSchema = z.strictObject({
    identifier: z.string().min(1).max(40),
    identifierType: z.enum(['ASIN', 'SellerSKU']),
    marketplaceId: z.string().regex(/^[A-Z0-9]{5,32}$/),
    isAmazonFulfilled: z.boolean(),
    priceToEstimateFees: z.strictObject({
        listingPrice: PriceSchema,
        shipping: PriceSchema.optional(),
        points: z.strictObject({ pointsNumber: z.number().int().nonnegative() }).optional(),
    }),
});
const InputSchema = z.strictObject({ requests: z.array(RequestSchema).min(1).max(20) });
// Closed, bounded provider projection: never include free-text, identity, address or tax fields.
const OutputSchema = z
    .array(
        z.object({
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
            Error: z.object({ Type: z.string().max(60).optional(), Code: z.string().max(60).optional() }).optional(),
        }),
    )
    .max(20);

const action = createAction({
    description: 'Estimate Amazon fees for a bounded batch of ASINs or SKUs.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: [],
    exec: async (nango, input) =>
        {
        await authorizeMarketplaces(nango, input);
        return (OutputSchema.parse(
            await postJson(
                nango,
                '/products/fees/v0/feesEstimate',
                input.requests.map((request) => ({
                    IdType: request.identifierType,
                    IdValue: request.identifier,
                    FeesEstimateRequest: {
                        MarketplaceId: request.marketplaceId,
                        IsAmazonFulfilled: request.isAmazonFulfilled,
                        Identifier: request.identifier,
                        PriceToEstimateFees: {
                            ListingPrice: {
                                CurrencyCode: request.priceToEstimateFees.listingPrice.currencyCode,
                                Amount: request.priceToEstimateFees.listingPrice.amount,
                            },
                            Shipping: request.priceToEstimateFees.shipping
                                ? {
                                      CurrencyCode: request.priceToEstimateFees.shipping.currencyCode,
                                      Amount: request.priceToEstimateFees.shipping.amount,
                                  }
                                : undefined,
                            Points: request.priceToEstimateFees.points
                                ? { PointsNumber: request.priceToEstimateFees.points.pointsNumber }
                                : undefined,
                        },
                    },
                })),
            ),
        ));
    },
});

export default action;
