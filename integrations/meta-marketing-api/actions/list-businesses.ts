import { createAction } from 'nango';
import { z } from 'zod';

const InputSchema = z.strictObject({
    limit: z.number().int().min(1).max(100).optional(),
    after: z.string().min(1).max(512).optional()
});

const BusinessSchema = z.object({
    id: z.string(),
    name: z.string()
});

const OutputSchema = z.object({
    data: z.array(BusinessSchema),
    paging: z.object({ cursors: z.object({ before: z.string().optional(), after: z.string().optional() }).optional() }).optional()
});

export default createAction({
    description: 'Read businesses accessible to the connected Meta user.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: ['business_management'],
    exec: async (nango, rawInput): Promise<z.infer<typeof OutputSchema>> => {
        const input = InputSchema.parse(rawInput);
        const response = await nango.get({
            endpoint: '/v26.0/me/businesses',
            retries: 3,
            params: {
                fields: 'id,name',
                limit: String(input.limit ?? 100),
                ...(input.after !== undefined && { after: input.after })
            }
        });
        return OutputSchema.parse(response.data);
    }
});
