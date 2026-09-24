import { createAction } from 'nango';
import { z } from 'zod';

const InputSchema = z.strictObject({
    limit: z.number().int().min(1).max(100).optional(),
    after: z.string().min(1).max(512).optional()
});

const AccountSchema = z.object({
    id: z.string(),
    name: z.string().optional(),
    account_status: z.number().int().optional(),
    currency: z.string().optional()
});

const OutputSchema = z.object({
    data: z.array(AccountSchema),
    paging: z.object({ cursors: z.object({ before: z.string().optional(), after: z.string().optional() }).optional() }).optional()
});

function normalizeAdAccountId(value: string): string {
    return value.startsWith('act_') ? value.slice(4) : value;
}

export default createAction({
    description: 'Read Meta ad accounts accessible to the connected user.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: ['ads_read'],
    exec: async (nango, rawInput): Promise<z.infer<typeof OutputSchema>> => {
        const input = InputSchema.parse(rawInput);
        const response = await nango.get({
            endpoint: '/v26.0/me/adaccounts',
            retries: 3,
            params: {
                fields: 'id,name,account_status,currency',
                limit: String(input.limit ?? 100),
                ...(input.after !== undefined && { after: input.after })
            }
        });
        const body = OutputSchema.parse(response.data);
        const accounts = Array.isArray(body.data)
            ? body.data.map((value) => {
                const account = AccountSchema.parse(value);
                return { ...account, id: normalizeAdAccountId(account.id) };
            })
            : [];
        return OutputSchema.parse({
            data: accounts,
            paging: body.paging
        });
    }
});
