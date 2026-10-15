import { z } from 'zod';
import { MarketplaceIdsSchema } from '../shared.js';

const DateSchema = z.string().date();
const AsinsSchema = z.array(z.string().regex(/^[A-Z0-9]{10}$/)).min(1).max(20);
type Base = { startDate: string; endDate: string; marketplaceIds: string[] };

export function salesTrafficQuery(input: Base): string {
    const marketplaces = input.marketplaceIds.map((id) => JSON.stringify(id)).join(',');
    return `query { analytics_salesAndTraffic_2024_04_24 { salesAndTrafficByDate(aggregateBy:DAY startDate:"${input.startDate}" endDate:"${input.endDate}" marketplaceIds:[${marketplaces}]) { startDate endDate marketplaceId sales { orderedProductSales { amount currencyCode } unitsOrdered } traffic { pageViews sessions } } } }`;
}

export function salesTrafficTrendsQuery(input: Base & { asins: string[] }): string {
    const asins = input.asins.map((asin) => JSON.stringify(asin)).join(',');
    const filters = input.marketplaceIds.map((id) => `{marketplaceId:${JSON.stringify(id)} asins:[${asins}]}`).join(',');
    return `query { analytics_salesAndTraffic_2024_04_24 { salesAndTrafficTrends(asinAggregation:CHILD dateAggregation:DAY startDate:"${input.startDate}" endDate:"${input.endDate}" filters:[${filters}]) { startDate endDate marketplaceId childAsin sales { orderedProductSales { amount currencyCode } unitsOrdered } traffic { pageViews sessions } } } }`;
}

// A query ID alone is not proof that the result belongs to our safe analytics
// queries. Compare the provider-returned query against the exact templates
// that our create actions send, including the fixed selection set.
export function assertAllowedSalesTrafficQuery(query: string): void {
    if (query.length > 4096) throw new Error('Unsupported Amazon Data Kiosk query');
    const date = query.match(/^query \{ analytics_salesAndTraffic_2024_04_24 \{ salesAndTrafficByDate\(aggregateBy:DAY startDate:"([^"]{1,20})" endDate:"([^"]{1,20})" marketplaceIds:(\[[^\]]{1,512}\])\) \{ startDate endDate marketplaceId sales \{ orderedProductSales \{ amount currencyCode \} unitsOrdered \} traffic \{ pageViews sessions \} \} \} \}$/);
    const trends = query.match(/^query \{ analytics_salesAndTraffic_2024_04_24 \{ salesAndTrafficTrends\(asinAggregation:CHILD dateAggregation:DAY startDate:"([^"]{1,20})" endDate:"([^"]{1,20})" filters:(.{1,3000})\) \{ startDate endDate marketplaceId childAsin sales \{ orderedProductSales \{ amount currencyCode \} unitsOrdered \} traffic \{ pageViews sessions \} \} \} \}$/);
    try {
        if (date) {
            const startDate = DateSchema.parse(date[1]);
            const endDate = DateSchema.parse(date[2]);
            const marketplaceIds = MarketplaceIdsSchema.parse(JSON.parse(date[3]!));
            if (query === salesTrafficQuery({ startDate, endDate, marketplaceIds })) return;
        }
        if (trends) {
            const startDate = DateSchema.parse(trends[1]);
            const endDate = DateSchema.parse(trends[2]);
            const filters = [...trends[3]!.matchAll(/\{marketplaceId:"([A-Z0-9]{5,32})" asins:(\[[A-Z0-9",]{12,500}\])\}/g)];
            const marketplaceIds = MarketplaceIdsSchema.parse(filters.map((match) => match[1]));
            if (!filters.length) throw new Error('Missing marketplace filters');
            const asins = AsinsSchema.parse(JSON.parse(filters[0]![2]!));
            if (query === salesTrafficTrendsQuery({ startDate, endDate, marketplaceIds, asins })) return;
        }
    } catch { /* Non-canonical or invalid values must fail closed. */ }
    throw new Error('Unsupported Amazon Data Kiosk query');
}
