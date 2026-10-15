import { createAction } from 'nango';
import { z } from 'zod';

// Non-idempotent mutations must never be replayed after an ambiguous failure.
const NO_WRITE_RETRIES = 0;

const Id = z.string().regex(/^\d{1,64}$/);
const InputSchema = z.strictObject({ ad_set_id: Id, status: z.enum(['ACTIVE', 'PAUSED']) });
const OutputSchema = z.object({ success: z.boolean(), id: Id.optional() });

export default createAction({
    description: 'Activate or pause one Meta ad set.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: ['ads_management'],
    exec: async (nango, rawInput): Promise<z.infer<typeof OutputSchema>> => {
        const input = InputSchema.parse(rawInput);
        const response = await nango.post({ retries: NO_WRITE_RETRIES, endpoint: `/v26.0/${input.ad_set_id}`, data: { status: input.status } });
        const result = OutputSchema.parse(response.data);
        if (!result.success) throw new Error('Meta did not confirm the mutation');
        return result;
    }
});
