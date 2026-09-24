import { createAction } from 'nango';
import { z } from 'zod';

// Non-idempotent mutations must never be replayed after an ambiguous failure.
const NO_WRITE_RETRIES = 0;

const Id = z.string().regex(/^\d{1,64}$/);
const InputSchema = z.strictObject({
    campaign_id: Id,
    daily_budget: z.number().int().min(100).max(100000000).optional(),
    lifetime_budget: z.number().int().min(100).max(1000000000).optional()
}).refine(value => (value.daily_budget === undefined) !== (value.lifetime_budget === undefined), {
    message: 'Provide exactly one budget type'
});
const OutputSchema = z.object({ success: z.boolean(), id: Id.optional() });

export default createAction({
    description: 'Set exactly one bounded budget on a Meta campaign.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: ['ads_management'],
    exec: async (nango, rawInput): Promise<z.infer<typeof OutputSchema>> => {
        const input = InputSchema.parse(rawInput);
        const response = await nango.post({ retries: NO_WRITE_RETRIES,
            endpoint: `/v26.0/${input.campaign_id}`,
            data: {
                ...(input.daily_budget !== undefined ? { daily_budget: input.daily_budget } : {}),
                ...(input.lifetime_budget !== undefined ? { lifetime_budget: input.lifetime_budget } : {})
            }
        });
        const result = OutputSchema.parse(response.data);
        if (!result.success) throw new Error('Meta did not confirm the mutation');
        return result;
    }
});
