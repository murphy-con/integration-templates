import { z } from 'zod';
import { createAction } from 'nango';
import { authorizeMarketplaces, MarketplaceIdsSchema, PageSizeSchema, TokenSchema, IsoDateSchema, OrderIncludedDataSchema, csv, getJson } from '../shared.js';
// Standalone action entry points cannot import named exports from other actions.
const OrderSchema = z.object({
    orderId: z.string(), createdTime: z.string().optional(), lastUpdatedTime: z.string().optional(),
    salesChannel: z.object({ channelName: z.string().optional(), marketplaceId: z.string().optional(), marketplaceName: z.string().optional() }).optional(),
    proceeds: z.object({ grandTotal: z.object({ amount: z.string(), currencyCode: z.string() }).optional() }).optional(),
    fulfillment: z.object({ fulfilledBy: z.string().optional(), fulfillmentServiceLevel: z.string().optional(), fulfillmentStatus: z.string().optional(), shipByWindow: z.object({ earliestDateTime: z.string().optional(), latestDateTime: z.string().optional() }).optional(), deliverByWindow: z.object({ earliestDateTime: z.string().optional(), latestDateTime: z.string().optional() }).optional() }).optional(),
    orderItems: z.array(z.object({ orderItemId: z.string().optional(), quantityOrdered: z.number().optional(), product: z.object({ asin: z.string().optional(), sellerSku: z.string().optional() }).optional() })).max(100).optional()
});

const InputSchema = z
    .strictObject({
        marketplaceIds: MarketplaceIdsSchema,
        createdAfter: IsoDateSchema.optional(),
        createdBefore: IsoDateSchema.optional(),
        lastUpdatedAfter: IsoDateSchema.optional(),
        lastUpdatedBefore: IsoDateSchema.optional(),
        fulfillmentStatuses: z.array(z.enum(['PENDING_AVAILABILITY', 'PENDING', 'UNSHIPPED', 'PARTIALLY_SHIPPED', 'SHIPPED', 'CANCELLED', 'UNFULFILLABLE'])).min(1).max(7).optional(),
        fulfilledBy: z.array(z.enum(['MERCHANT', 'AMAZON'])).min(1).max(2).optional(),
        includedData: OrderIncludedDataSchema,
        maxResultsPerPage: PageSizeSchema,
        paginationToken: TokenSchema.optional()
    })
    .refine((value) => Boolean(value.createdAfter) !== Boolean(value.lastUpdatedAfter)
        && !(value.createdAfter && value.lastUpdatedBefore)
        && !(value.lastUpdatedAfter && value.createdBefore), {
        message: 'Provide exactly one time window: createdAfter/createdBefore or lastUpdatedAfter/lastUpdatedBefore'
    });
const OutputSchema = z.object({ orders: z.array(OrderSchema).max(100), pagination: z.object({ nextToken: z.string().optional() }).optional(), lastUpdatedBefore: z.string().optional(), createdBefore: z.string().optional() });

const action = createAction({
    description: 'Search one bounded page of Amazon orders without buyer or recipient PII.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: [],
    exec: async (nango, input) => {
        await authorizeMarketplaces(nango, input);
        const params = {
            marketplaceIds: csv(input.marketplaceIds),
            createdAfter: input.createdAfter,
            createdBefore: input.createdBefore,
            lastUpdatedAfter: input.lastUpdatedAfter,
            lastUpdatedBefore: input.lastUpdatedBefore,
            fulfillmentStatuses: input.fulfillmentStatuses ? csv(input.fulfillmentStatuses) : undefined,
            fulfilledBy: input.fulfilledBy ? csv(input.fulfilledBy) : undefined,
            includedData: csv(input.includedData),
            maxResultsPerPage: input.maxResultsPerPage,
            paginationToken: input.paginationToken
        };
        return OutputSchema.parse(await getJson(nango, '/orders/2026-01-01/orders', params));
    }
});

export default action;
