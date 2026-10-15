# Amazon Selling Partner Actions

This contribution contains 33 bounded, provider-specific Actions and no Syncs. Each Action has a closed input contract, a fixed SP-API route, a bounded response projection, and (where marketplace-scoped) a check against the seller's participating marketplaces before the target call. The seller identity is read from Nango's Amazon connection configuration, never from Action input.

The source contracts were checked against the Amazon Selling Partner API models at commit `713565ff394d136629a342120872e65cb073d162`. The current internal `cg_amazon_` names preserve compatibility with previously deployed custom Functions; an upstream contribution may rename them to catalog conventions after review. The associated Nango provider/auth definition must support the seller ID in `connection_config` and the Sellers marketplace-participation API.

No report/feed document bodies or unreviewed opaque-ID lookup Actions are included. The package does not configure tenant routing, customer permissions, write approvals, OAuth credentials, or deployment environments; these belong to the integrating application. Publishing these Action templates does not grant a caller permission to execute provider writes.
