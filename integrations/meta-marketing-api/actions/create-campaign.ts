import { createAction } from 'nango';
import { z } from 'zod';

// Non-idempotent mutations must never be replayed after an ambiguous failure.
const NO_WRITE_RETRIES = 0;

const Id = z.string().regex(/^\d{1,64}$/);
const InputSchema = z.strictObject({
    ad_account_id: Id,
    name: z.string().trim().min(1).max(255),
    objective: z.enum([
        'OUTCOME_AWARENESS', 'OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT',
        'OUTCOME_LEADS', 'OUTCOME_APP_PROMOTION', 'OUTCOME_SALES'
    ]),
    special_ad_categories: z.array(z.enum(['HOUSING', 'EMPLOYMENT', 'CREDIT', 'ISSUES_ELECTIONS_POLITICS'])).max(4).default([])
});
const OutputSchema = z.object({ id: Id });

export default createAction({
    description: 'Create a paused Meta advertising campaign.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: ['ads_management'],
    exec: async (nango, rawInput): Promise<z.infer<typeof OutputSchema>> => {
        const input = InputSchema.parse(rawInput);
        const response = await nango.post({ retries: NO_WRITE_RETRIES,
            endpoint: `/v26.0/act_${input.ad_account_id}/campaigns`,
            data: {
                name: input.name,
                objective: input.objective,
                special_ad_categories: input.special_ad_categories,
                status: 'PAUSED',
                is_adset_budget_sharing_enabled: false
            }
        });
        return OutputSchema.parse(response.data);
    }
});
