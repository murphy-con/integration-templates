import { describe, expect, it, vi } from 'vitest';
import createCampaign from '../actions/create-campaign.js';
import createAdSet from '../actions/create-ad-set.js';
import createCreative from '../actions/create-ad-creative.js';
import createAd from '../actions/create-ad.js';
import listAccounts from '../actions/list-ad-accounts.js';
import listBusinesses from '../actions/list-businesses.js';
import listCampaigns from '../actions/list-campaigns.js';
import getInsights from '../actions/get-insights.js';
import setCampaignStatus from '../actions/set-campaign-status.js';
import setAdSetStatus from '../actions/set-ad-set-status.js';
import setAdStatus from '../actions/set-ad-status.js';
import updateCampaignBudget from '../actions/update-campaign-budget.js';
import updateAdSetBudget from '../actions/update-ad-set-budget.js';

const reads = [listAccounts, listBusinesses, listCampaigns, getInsights];
const writes = [createCampaign, createAdSet, createCreative, createAd, setCampaignStatus, setAdSetStatus, setAdStatus, updateCampaignBudget, updateAdSetBudget];
const validInputs = [
    { ad_account_id: '123', name: 'Campaign', objective: 'OUTCOME_TRAFFIC' },
    { ad_account_id: '123', campaign_id: '456', name: 'Set', daily_budget: 500, billing_event: 'IMPRESSIONS', optimization_goal: 'LINK_CLICKS', targeting: { geo_locations: { countries: ['US'] } } },
    { ad_account_id: '123', name: 'Creative', page_id: '456', link_url: 'https://example.org', message: 'Hello', image_hash: 'abc123' },
    { ad_account_id: '123', ad_set_id: '456', creative_id: '789', name: 'Ad' },
    { campaign_id: '456', status: 'ACTIVE' },
    { ad_set_id: '456', status: 'ACTIVE' },
    { ad_id: '456', status: 'ACTIVE' },
    { campaign_id: '456', daily_budget: 500 },
    { ad_set_id: '456', daily_budget: 500 }
];
const paths = ['/v26.0/act_123/campaigns', '/v26.0/act_123/adsets', '/v26.0/act_123/adcreatives', '/v26.0/act_123/ads', '/v26.0/456', '/v26.0/456', '/v26.0/456', '/v26.0/456', '/v26.0/456'];

function transport(data: unknown) {
    return { get: vi.fn().mockResolvedValue({ data }), post: vi.fn().mockResolvedValue({ data }) };
}

describe('Meta Marketing v26 offline contracts', () => {
    it.each(reads)('retries only idempotent reads, with a fixed v26 path', async (action) => {
        const nango = transport({ data: [] });
        const input = action === listCampaigns || action === getInsights ? { ad_account_id: '123' } : {};
        await action.exec(nango as never, input as never);
        expect(nango.get).toHaveBeenCalledOnce();
        expect(nango.get.mock.calls[0]?.[0]).toMatchObject({ endpoint: expect.stringMatching(/^\/v26\.0\/(me|act_123)\//), retries: 3 });
        expect(nango.post).not.toHaveBeenCalled();
    });
    it.each(writes.map((action, i) => [action, validInputs[i], paths[i]] as const))('validates and sends a single non-retried write', async (action, input, path) => {
        const nango = transport(path.includes('act_') ? { id: '99' } : { success: true });
        await action.exec(nango as never, input as never);
        expect(nango.post).toHaveBeenCalledOnce();
        expect(nango.post.mock.calls[0]?.[0]).toMatchObject({ endpoint: path, retries: 0 });
        expect(nango.get).not.toHaveBeenCalled();
    });
    it.each(writes.map((action, i) => [action, validInputs[i]] as const))('rejects unexpected write fields before transport', async (action, input) => {
        const nango = transport({ success: true });
        await expect(action.exec(nango as never, { ...input, access_token: 'unexpected' } as never)).rejects.toThrow();
        expect(nango.post).not.toHaveBeenCalled();
    });
    it('does not return Meta paging URLs that can contain access tokens', async () => {
        const nango = transport({ data: [], paging: { next: 'https://graph.facebook.com/v26.0/me/adaccounts?access_token=secret', cursors: { after: 'cursor' } } });
        const result = await listAccounts.exec(nango as never, {});
        expect(JSON.stringify(result)).not.toContain('secret');
        expect(result.paging).toEqual({ cursors: { after: 'cursor' } });
    });
    it('rejects a creative without an existing image hash', async () => {
        const nango = transport({ id: '99' });
        await expect(createCreative.exec(nango as never, { ...validInputs[2], image_hash: undefined } as never)).rejects.toThrow();
        expect(nango.post).not.toHaveBeenCalled();
    });
    it('rejects a lifetime ad-set budget without an end time', async () => {
        const nango = transport({ id: '99' });
        await expect(createAdSet.exec(nango as never, { ...validInputs[1], daily_budget: undefined, lifetime_budget: 1000 } as never)).rejects.toThrow();
        expect(nango.post).not.toHaveBeenCalled();
    });
    it('rejects a malformed read envelope instead of returning empty data', async () => {
        const nango = transport({ error: { message: 'bad' } });
        await expect(listAccounts.exec(nango as never, {})).rejects.toThrow();
    });
    it('rejects a failed mutation acknowledgment', async () => {
        const nango = transport({ success: false });
        await expect(setAdStatus.exec(nango as never, { ad_id: '456', status: 'ACTIVE' })).rejects.toThrow();
    });
    it('does not activate resources during creation', async () => {
        const nango = transport({ id: '99' });
        for (const [action, input] of writes.slice(0, 4).map((action, i) => [action, validInputs[i]] as const)) {
            await action.exec(nango as never, input as never);
        }
        expect(nango.post.mock.calls[0]?.[0].data.status).toBe('PAUSED');
        expect(nango.post.mock.calls[1]?.[0].data.status).toBe('PAUSED');
        expect(nango.post.mock.calls[3]?.[0].data.status).toBe('PAUSED');
    });
    it('rejects unbounded or simultaneous budgets before transport', async () => {
        const nango = transport({ success: true });
        for (const action of [updateCampaignBudget, updateAdSetBudget]) {
            const id = action === updateCampaignBudget ? { campaign_id: '456' } : { ad_set_id: '456' };
            for (const budget of [{ daily_budget: 100000001 }, { daily_budget: 500, lifetime_budget: 1000 }, {}]) {
                await expect(action.exec(nango as never, { ...id, ...budget } as never)).rejects.toThrow();
            }
        }
        expect(nango.post).not.toHaveBeenCalled();
    });
});
