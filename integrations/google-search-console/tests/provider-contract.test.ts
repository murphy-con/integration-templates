import { describe, expect, it, vi } from 'vitest';
import listSites from '../actions/list-sites.js';
import getSite from '../actions/get-site.js';
import listSitemaps from '../actions/list-sitemaps.js';
import getSitemap from '../actions/get-sitemap.js';
import queryAnalytics from '../actions/query-analytics.js';
import inspectUrl from '../actions/inspect-url.js';

const scope = 'https://www.googleapis.com/auth/webmasters.readonly';
const siteUrl = 'https://example.com/';
const encodedSite = encodeURIComponent(siteUrl);

const cases = [
    { action: listSites, input: {}, method: 'get', endpoint: '/v3/sites', result: { siteEntry: [{ siteUrl, permissionLevel: 'siteOwner' }] } },
    { action: getSite, input: { siteUrl }, method: 'get', endpoint: `/v3/sites/${encodedSite}`, result: { siteUrl, permissionLevel: 'siteOwner' } },
    {
        action: listSitemaps,
        input: { siteUrl },
        method: 'get',
        endpoint: `/v3/sites/${encodedSite}/sitemaps`,
        result: { sitemap: [{ path: `${siteUrl}sitemap.xml`, isPending: false }] }
    },
    {
        action: getSitemap,
        input: { siteUrl, feedpath: `${siteUrl}sitemap.xml` },
        method: 'get',
        endpoint: `/v3/sites/${encodedSite}/sitemaps/${encodeURIComponent(`${siteUrl}sitemap.xml`)}`,
        result: { path: `${siteUrl}sitemap.xml`, isPending: false }
    },
    {
        action: queryAnalytics,
        input: { siteUrl, startDate: '2026-08-01', endDate: '2026-08-07', dimensions: ['query'], rowLimit: 100, startRow: 0 },
        method: 'post',
        endpoint: `/v3/sites/${encodedSite}/searchAnalytics/query`,
        result: { rows: [{ keys: ['example'], clicks: 1, impressions: 2, ctr: 0.5, position: 3 }], responseAggregationType: 'byProperty' }
    },
    {
        action: inspectUrl,
        input: { inspectionUrl: 'https://example.com/page', siteUrl },
        method: 'post',
        endpoint: '/v1/urlInspection/index:inspect',
        result: { inspectionResult: { indexStatusResult: { coverageState: 'Submitted and indexed' }, inspectionResultLink: 'https://search.google.com/' } }
    }
] as const;

describe('Google Search Console provider contract', () => {
    for (const { action, input, method, endpoint, result } of cases) {
        it(`${endpoint} sends a scoped, fixed provider request and validates its response`, async () => {
            expect(action.scopes).toContain(scope);
            const call = vi.fn().mockResolvedValue({ data: result });
            const nango = { get: call, post: call };
            const parsed = action.input.parse(input);
            const output = await action.exec(nango as never, parsed as never);
            expect(action.output.parse(output)).toEqual(result);
            expect(call).toHaveBeenCalledOnce();
            const config = call.mock.calls[0]?.[0];
            expect(config).toMatchObject({ endpoint, retries: 3 });
            expect(config.baseUrlOverride).toBe(method === 'post' && action === inspectUrl ? 'https://searchconsole.googleapis.com' : undefined);
            if (action === queryAnalytics) {
                expect(config.data).toMatchObject({ startDate: '2026-08-01', endDate: '2026-08-07', dimensions: ['query'], rowLimit: 100, startRow: 0 });
            }
            if (action === inspectUrl) {
                expect(config.data).toEqual(input);
            }
        });
        it(`${endpoint} rejects malformed response envelopes`, async () => {
            const call = vi.fn().mockResolvedValue({ data: { unexpected: true } });
            await expect(action.exec({ get: call, post: call } as never, input as never)).rejects.toThrow();
        });
    }
    it('rejects reversed analytics dates and out-of-bounds pagination', () => {
        const base = { siteUrl, startDate: '2026-08-07', endDate: '2026-08-01' };
        expect(queryAnalytics.input.safeParse(base).success).toBe(false);
        expect(queryAnalytics.input.safeParse({ ...base, endDate: '2026-08-07', rowLimit: 25001 }).success).toBe(false);
    });
    it('rejects unknown input properties and invalid sitemap URLs', () => {
        expect(getSite.input.safeParse({ siteUrl, connectionId: 'arbitrary' }).success).toBe(false);
        expect(getSitemap.input.safeParse({ siteUrl, feedpath: 'relative.xml' }).success).toBe(false);
    });
    it('supports documented sitemap index, inspection language and hourly data state', () => {
        expect(listSitemaps.input.parse({ siteUrl, sitemapIndex: `${siteUrl}index.xml` }).sitemapIndex).toBe(`${siteUrl}index.xml`);
        expect(inspectUrl.input.parse({ siteUrl, inspectionUrl: `${siteUrl}page`, languageCode: 'de-CH' }).languageCode).toBe('de-CH');
        expect(queryAnalytics.input.safeParse({ siteUrl, startDate: '2026-08-01', endDate: '2026-08-07', dataState: 'hourly_all' }).success).toBe(true);
    });
    it('forwards the optional sitemap index and inspection language', async () => {
        const get = vi.fn().mockResolvedValue({ data: {} });
        await listSitemaps.exec({ get } as never, { siteUrl, sitemapIndex: `${siteUrl}index.xml` });
        expect(get).toHaveBeenCalledWith(expect.objectContaining({ params: { sitemapIndex: `${siteUrl}index.xml` } }));
        const post = vi.fn().mockResolvedValue({ data: { inspectionResult: {} } });
        await inspectUrl.exec({ post } as never, { siteUrl, inspectionUrl: `${siteUrl}page`, languageCode: 'de-CH' });
        expect(post).toHaveBeenCalledWith(expect.objectContaining({ data: { siteUrl, inspectionUrl: `${siteUrl}page`, languageCode: 'de-CH' } }));
    });
    it('drops undocumented inspection fields at every output level', async () => {
        const post = vi.fn().mockResolvedValue({ data: {
            inspectionResult: {
                inspectionResultLink: 'https://search.google.com/',
                unknownTopLevel: { privateField: 'do-not-return' },
                indexStatusResult: { coverageState: 'Indexed', unknownNested: { privateField: 'do-not-return' } },
                ampResult: { verdict: 'PASS', unknownIssue: { privateField: 'do-not-return' } },
                mobileUsabilityResult: { verdict: 'PASS', unknownIssue: { privateField: 'do-not-return' } },
                richResultsResult: { verdict: 'PASS', unknownIssue: { privateField: 'do-not-return' } }
            }
        } });
        const output = await inspectUrl.exec({ post } as never, { siteUrl, inspectionUrl: `${siteUrl}page` });
        expect(output).toEqual({ inspectionResult: {
            inspectionResultLink: 'https://search.google.com/',
            indexStatusResult: { coverageState: 'Indexed' },
            ampResult: { verdict: 'PASS' },
            mobileUsabilityResult: { verdict: 'PASS' },
            richResultsResult: { verdict: 'PASS' }
        } });
    });
    it('rejects duplicate grouping dimensions', () => {
        expect(queryAnalytics.input.safeParse({ siteUrl, startDate: '2026-08-01', endDate: '2026-08-07', dimensions: ['query', 'query'] }).success).toBe(false);
    });
});
