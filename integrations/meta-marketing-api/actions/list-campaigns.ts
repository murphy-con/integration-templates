import { createAction } from 'nango';
import { z } from 'zod';

const InputSchema = z.strictObject({
    ad_account_id: z.string().regex(/^(?:act_)?\d{1,64}$/),
    limit: z.number().int().min(1).max(100).optional(),
    after: z.string().min(1).max(512).optional()
});

const CampaignSchema = z.object({
    id: z.string(),
    name: z.string().optional(),
    status: z.string().optional(),
    effective_status: z.string().optional(),
    objective: z.string().optional(),
    created_time: z.string().optional(),
    updated_time: z.string().optional()
});

const OutputSchema = z.object({
    data: z.array(CampaignSchema),
    paging: z.object({ cursors: z.object({ before: z.string().optional(), after: z.string().optional() }).optional() }).optional()
});

function normalizeAdAccountId(value: string): string {
    return value.startsWith('act_') ? value.slice(4) : value;
}

export default createAction({
    description: 'Read campaigns for one accessible Meta ad account.',
    version: '2.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: ['ads_read'],
    exec: async (nango, rawInput): Promise<z.infer<typeof OutputSchema>> => {
        const input = InputSchema.parse(rawInput);
        const response = await nango.get({
            endpoint: `/v26.0/act_${encodeURIComponent(normalizeAdAccountId(input.ad_account_id))}/campaigns`,
            retries: 3,
            params: {
                fields: 'id,name,status,effective_status,objective,created_time,updated_time',
                limit: String(input.limit ?? 100),
                ...(input.after !== undefined && { after: input.after })
            }
        });
        return OutputSchema.parse(response.data);
    }
});
