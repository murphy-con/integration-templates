import { z } from 'zod';
import { createAction } from 'nango';
import { authorizeMarketplaces, patchJson, sellerId } from '../shared.js';

const LocalizedValue = z.strictObject({ value: z.string().min(1).max(500), languageTag: z.string().regex(/^[a-z]{2}_[A-Z]{2}$/) });
const InputSchema = z.strictObject({
    sellerSku: z.string().min(1).max(40),
    productType: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
    marketplaceId: z.string().regex(/^[A-Z0-9]{5,32}$/),
    attributes: z.object({
        itemName: z.array(LocalizedValue).max(1).optional(),
        brand: z.array(LocalizedValue).max(1).optional(),
        bulletPoint: z.array(LocalizedValue).max(5).optional(),
        genericKeyword: z.array(LocalizedValue).max(5).optional(),
        description: z.array(LocalizedValue).max(1).optional()
    }).strict()
}).refine((value) => Object.values(value.attributes).some((items) => items && items.length > 0), 'At least one allowlisted attribute is required');
const ListingSubmissionSchema = z.object({ sku: z.string(), status: z.string(), submissionId: z.string(), issues: z.array(z.object({ code: z.string().optional(), severity: z.string().optional() })).max(100).optional() });
const OutputSchema = ListingSubmissionSchema;

const pathByAttribute = {
    itemName: 'item_name',
    brand: 'brand',
    bulletPoint: 'bullet_point',
    genericKeyword: 'generic_keyword',
    description: 'product_description'
} as const;

const action = createAction({
    description: 'Update only explicitly allowlisted localized Amazon listing attributes.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: [],
    exec: async (nango, input) => {
        await authorizeMarketplaces(nango, input);
        const patches = Object.entries(input.attributes).filter(([, values]) => values && values.length > 0).map(([key, values]) => ({
            op: 'replace',
            path: `/attributes/${pathByAttribute[key as keyof typeof pathByAttribute]}`,
            value: values!.map((entry) => ({ value: entry.value, language_tag: entry.languageTag, marketplace_id: input.marketplaceId }))
        }));
        return OutputSchema.parse(await patchJson(nango, `/listings/2021-08-01/items/${encodeURIComponent(await sellerId(nango))}/${encodeURIComponent(input.sellerSku)}`, {
            productType: input.productType,
            patches
        }, { marketplaceIds: input.marketplaceId }));
    }
});

export default action;
