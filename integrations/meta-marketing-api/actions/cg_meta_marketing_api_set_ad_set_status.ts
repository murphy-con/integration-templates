import { createAction } from 'nango';
import { z } from 'zod';

const Id = z.string().regex(/^\d{1,64}$/);
const InputSchema = z.object({ ad_set_id: Id, status: z.enum(['ACTIVE', 'PAUSED']) });
const OutputSchema = z.object({ success: z.boolean(), id: Id.optional() });

export default createAction({
    description: 'Activate or pause one Meta ad set.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: ['ads_management'],
    exec: async (nango, input): Promise<z.infer<typeof OutputSchema>> => {
        const response = await nango.post({ endpoint: `/v26.0/${input.ad_set_id}`, data: { status: input.status } });
        const body = response.data as { success?: unknown; id?: unknown };
        return OutputSchema.parse({ success: body.success === true, ...(typeof body.id === 'string' ? { id: body.id } : {}) });
    }
});
