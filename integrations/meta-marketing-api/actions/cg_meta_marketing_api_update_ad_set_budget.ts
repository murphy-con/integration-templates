import { createAction } from 'nango';
import { z } from 'zod';

const Id = z.string().regex(/^\d{1,64}$/);
const InputSchema = z.object({
    ad_set_id: Id,
    daily_budget: z.number().int().min(100).max(100000000).optional(),
    lifetime_budget: z.number().int().min(100).max(1000000000).optional()
}).refine(value => (value.daily_budget === undefined) !== (value.lifetime_budget === undefined), {
    message: 'Provide exactly one budget type'
});
const OutputSchema = z.object({ success: z.boolean(), id: Id.optional() });

export default createAction({
    description: 'Set exactly one bounded budget on a Meta ad set.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: ['ads_management'],
    exec: async (nango, input): Promise<z.infer<typeof OutputSchema>> => {
        const response = await nango.post({ endpoint: `/v26.0/${input.ad_set_id}`, data: {
            ...(input.daily_budget !== undefined ? { daily_budget: input.daily_budget } : {}),
            ...(input.lifetime_budget !== undefined ? { lifetime_budget: input.lifetime_budget } : {})
        }});
        const body = response.data as { success?: unknown; id?: unknown };
        return OutputSchema.parse({ success: body.success === true, ...(typeof body.id === 'string' ? { id: body.id } : {}) });
    }
});
