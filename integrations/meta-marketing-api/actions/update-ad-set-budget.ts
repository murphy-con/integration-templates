import { createAction } from 'nango';
import { z } from 'zod';

// Non-idempotent mutations must never be replayed after an ambiguous failure.
const NO_WRITE_RETRIES = 0;

const Id = z.string().regex(/^\d{1,64}$/);
const InputSchema = z.strictObject({
    ad_set_id: Id,
    end_time: z.string().datetime({ offset: true }).optional(),
    daily_budget: z.number().int().min(100).max(100000000).optional(),
    lifetime_budget: z.number().int().min(100).max(1000000000).optional()
}).refine(value => (value.daily_budget === undefined) !== (value.lifetime_budget === undefined), {
    message: 'Provide exactly one budget type'
}).refine(value => value.lifetime_budget === undefined || value.end_time !== undefined, { message: 'Lifetime budget requires end_time' });
const OutputSchema = z.object({ success: z.boolean(), id: Id.optional() });

export default createAction({
    description: 'Set exactly one bounded budget on a Meta ad set.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: ['ads_management'],
    exec: async (nango, rawInput): Promise<z.infer<typeof OutputSchema>> => {
        const input = InputSchema.parse(rawInput);
        const response = await nango.post({ retries: NO_WRITE_RETRIES, endpoint: `/v26.0/${input.ad_set_id}`, data: {
            ...(input.end_time !== undefined ? { end_time: input.end_time } : {}),
            ...(input.daily_budget !== undefined ? { daily_budget: input.daily_budget } : {}),
            ...(input.lifetime_budget !== undefined ? { lifetime_budget: input.lifetime_budget } : {})
        }});
        const result = OutputSchema.parse(response.data);
        if (!result.success) throw new Error('Meta did not confirm the mutation');
        return result;
    }
});
