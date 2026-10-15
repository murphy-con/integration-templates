import { createAction } from 'nango';
import { z } from 'zod';

// Non-idempotent mutations must never be replayed after an ambiguous failure.
const NO_WRITE_RETRIES = 0;

const Id = z.string().regex(/^\d{1,64}$/);
const InputSchema = z.strictObject({
    ad_account_id: Id,
    ad_set_id: Id,
    creative_id: Id,
    name: z.string().trim().min(1).max(255)
});
const OutputSchema = z.object({ id: Id });

export default createAction({
    description: 'Create a paused Meta ad from an existing approved creative and ad set.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: ['ads_management'],
    exec: async (nango, rawInput): Promise<z.infer<typeof OutputSchema>> => {
        const input = InputSchema.parse(rawInput);
        const response = await nango.post({ retries: NO_WRITE_RETRIES,
            endpoint: `/v26.0/act_${input.ad_account_id}/ads`,
            data: { name: input.name, adset_id: input.ad_set_id, creative: { creative_id: input.creative_id }, status: 'PAUSED' }
        });
        return OutputSchema.parse(response.data);
    }
});
