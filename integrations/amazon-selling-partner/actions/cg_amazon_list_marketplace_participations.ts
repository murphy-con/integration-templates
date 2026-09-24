import { z } from 'zod';
import { createAction } from 'nango';
import { getJson } from '../shared.js';

const InputSchema = z.strictObject({});
// Closed, bounded provider projection: never include free-text, identity, address or tax fields.
const OutputSchema = z.object({
    payload: z
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
                    .object({ isParticipating: z.boolean().optional(), hasSuspendedListings: z.boolean().optional() })
                    .optional(),
            }),
        )
        .max(100),
});

const action = createAction({
    description: 'List Amazon marketplace participations for the connected seller.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: [],
    exec: async (nango) => OutputSchema.parse(await getJson(nango, '/sellers/v1/marketplaceParticipations')),
});

export default action;
