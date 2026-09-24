import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import listTransactions from '../actions/cg_amazon_list_transactions.js';
import updateListingPrice from '../actions/cg_amazon_update_listing_price.js';

const marketplaceId = 'ATVPDKIKX0DER';
const otherMarketplace = 'A1PA6795UKMFR9';
const postedAfter = '2026-01-01T00:00:00Z';

function connection() {
    const calls: Array<{ endpoint: string; params?: Record<string, string> }> = [];
    const nango = {
        getConnection: async () => ({ connection_config: { selling_partner_id: 'A12345' } }),
        get: async (request: { endpoint: string; params?: Record<string, string> }) => {
            calls.push(request);
            if (request.endpoint === '/sellers/v1/marketplaceParticipations') {
                return { data: { payload: [{ marketplace: { id: marketplaceId }, participation: { isParticipating: true } }] } };
            }
            return { data: { payload: { transactions: [] } } };
        },
        patch: async (request: { endpoint: string; params?: Record<string, string> }) => {
            calls.push(request);
            return { data: { sku: 'SKU1', status: 'ACCEPTED', submissionId: '1' } };
        }
    };
    return { nango, calls };
}

describe('Amazon Selling Partner reviewed Action templates', () => {
    it('registers exactly the bounded Actions, without Syncs or open HTTP controls', async () => {
        const index = await readFile(new URL('../../index.ts', import.meta.url), 'utf8');
        const start = index.indexOf('// -- Integration: amazon-selling-partner');
        const end = index.indexOf('// -- Integration: amplitude', start);
        expect(start).toBeGreaterThan(0);
        const imports = [...index.slice(start, end).matchAll(/'\.\/amazon-selling-partner\/actions\/(cg_amazon_[a-z0-9_]+)\.js'/g)].map((match) => match[1]);
        const files = (await readdir(new URL('../actions/', import.meta.url))).filter((name) => /^cg_amazon_.*\.ts$/.test(name)).map((name) => name.slice(0, -3));
        expect(imports).toHaveLength(33);
        expect(new Set(imports).size).toBe(33);
        expect([...imports].sort()).toEqual(files.sort());
        expect(index.slice(start, end)).not.toContain('/syncs/');
        for (const name of imports) {
            const text = await readFile(new URL(`../actions/${name}.ts`, import.meta.url), 'utf8');
            expect(text).not.toMatch(/\b(?:url|method|connectionId|tenantId):\s*z\./);
        }
    });

    it('requires a dated financial query and denies unauthorized marketplaces before finances', async () => {
        expect(listTransactions.input.safeParse({ marketplaceId }).success).toBe(false);
        expect(listTransactions.input.safeParse({ marketplaceId, postedAfter, relatedIdentifierName: 'SHIPMENT_ID' }).success).toBe(false);
        const { nango, calls } = connection();
        await expect(listTransactions.exec(nango as never, listTransactions.input.parse({ marketplaceId: otherMarketplace, postedAfter }))).rejects.toThrow(/marketplace/i);
        expect(calls.map((call) => call.endpoint)).toEqual(['/sellers/v1/marketplaceParticipations']);
    });

    it('forwards postedAfter and an authorized marketplace to the fixed Finances route', async () => {
        const { nango, calls } = connection();
        await listTransactions.exec(nango as never, listTransactions.input.parse({ marketplaceId, postedAfter }));
        expect(calls[1]?.endpoint).toBe('/finances/2024-06-19/transactions');
        expect(calls[1]?.params).toMatchObject({ marketplaceId, postedAfter });
    });

    it('binds listing PATCH marketplaceIds to the checked participation', async () => {
        const { nango, calls } = connection();
        await updateListingPrice.exec(nango as never, updateListingPrice.input.parse({ sellerSku: 'SKU1', productType: 'PRODUCT', marketplaceId, currency: 'USD', amount: 10 }));
        expect(calls[1]?.endpoint).toMatch(/^\/listings\/2021-08-01\/items\//);
        expect(calls[1]?.params?.marketplaceIds).toBe(marketplaceId);
    });
});
