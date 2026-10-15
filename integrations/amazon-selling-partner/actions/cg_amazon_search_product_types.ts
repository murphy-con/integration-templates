import { z } from 'zod';
import { createAction } from 'nango';
import { authorizeMarketplaces, MarketplaceIdsSchema, csv, getJson } from '../shared.js';

const InputSchema = z
    .strictObject({
        marketplaceIds: MarketplaceIdsSchema,
        keywords: z.array(z.string().min(1).max(100)).min(1).max(20).optional(),
        itemName: z.string().min(1).max(200).optional(),
        locale: z
            .string()
            .regex(/^[a-z]{2}(_[A-Z]{2})?$/)
            .optional(),
    })
    .refine((v) => !v.keywords || !v.itemName, 'keywords and itemName are mutually exclusive');
// Closed, bounded provider projection: never include free-text, identity, address or tax fields.
const OutputSchema = z.object({
    productTypes: z
        .array(
            z.object({
                name: z.string().max(100).optional(),
                marketplaceIds: z.array(z.string().max(32)).max(10).optional(),
            }),
        )
        .max(100),
    productTypeVersion: z.string().max(40).optional(),
});

const action = createAction({
    description: 'Search supported Amazon product types for a marketplace.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: [],
    exec: async (nango, input) =>
        {
        await authorizeMarketplaces(nango, input);
        return (OutputSchema.parse(
            await getJson(nango, '/definitions/2020-09-01/productTypes', {
                marketplaceIds: csv(input.marketplaceIds),
                keywords: input.keywords ? csv(input.keywords) : undefined,
                itemName: input.itemName,
                locale: input.locale,
            }),
        ));
    },
});

export default action;
