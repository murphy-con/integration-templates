import { z } from 'zod';
import { createAction } from 'nango';
import { getJson } from '../shared.js';

const InputSchema = z.strictObject({});
// Closed, bounded provider projection: never include free-text, identity, address or tax fields.
const OutputSchema = z.object({
    payload: z.object({
        businessType: z.string().max(40).optional(),
        sellingPlan: z.string().max(40).optional(),
        marketplaceParticipationList: z
            .array(
                z.object({
                    marketplace: z
                        .object({
                            id: z.string().max(32).optional(),
                            countryCode: z.string().max(3).optional(),
                            defaultCurrencyCode: z.string().max(3).optional(),
                            defaultLanguageCode: z.string().max(16).optional(),
                        })
                        .optional(),
                    participation: z
                        .object({
                            isParticipating: z.boolean().optional(),
                            hasSuspendedListings: z.boolean().optional(),
                        })
                        .optional(),
                }),
            )
            .max(100)
            .optional(),
    }),
});

const action = createAction({
    description: 'Retrieve the Amazon seller account bound to this connection.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: [],
    exec: async (nango) => OutputSchema.parse(await getJson(nango, '/sellers/v1/account')),
});

export default action;
