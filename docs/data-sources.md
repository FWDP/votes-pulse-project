# PULSE data-source registry

This registry separates authoritative context from public-discourse signals. A source being publicly viewable does not automatically authorize automated collection.

## Ingestion priority

1. Official API or bulk download
2. RSS/Atom feed supplied by the publisher
3. Licensed or explicitly authorized platform API
4. Public HTML/PDF collection only after reviewing robots.txt, terms, rate limits, and copyright constraints
5. Manual upload when automated reuse is unclear

Never bypass authentication, CAPTCHAs, paywalls, access controls, or rate limits. Store source URL, retrieval time, license, parser version, content hash, and raw-response reference with every record.

## Tier 1 — authoritative reference and baseline data

| Source | Value to PULSE | Geography | Preferred ingestion | Cadence | Notes |
|---|---|---|---|---|---|
| [PSA PSGC API](https://psa.gov.ph/classifications-api/psgc) | Regions, provinces, cities, municipalities, barangays, official codes and historical versions | Barangay to national | Official API | Quarterly/versioned | Geographic master data; never match places by name alone |
| [PSA OpenSTAT API](https://openstat.psa.gov.ph/API-Documentation) | Population, inflation, employment, poverty, agriculture and other official statistics | Varies by table | PXWeb API | Monthly/quarterly/annual | Use as context, not sentiment |
| [PSA QuickStat](https://psa.gov.ph/statistics/quickstat) | Monthly national and regional economic indicators | Regional/national | XLSX/PDF download | Monthly | Prefer spreadsheets over PDF extraction |
| [Open Data Philippines](https://data.gov.ph/) | Cross-agency public datasets | Varies | Dataset download/catalog | Dataset-specific | Check the license on each resource and credit the publishing agency |
| [COMELEC election statistics](https://www.comelec.gov.ph/?r=2025NLE/Statistics) | Registered voters, seats, turnout context and election statistics | Precinct/LGU/district where published | Official files/pages | Election cycle | Preserve election year and “official/partial/unofficial” status |
| [House of Representatives members](https://congress.gov.ph/house-members) | Current district representatives and district labels | Congressional district | Public page/manual verified import | Per Congress/change | District boundaries require separate legal mappings |
| [Official Gazette](https://www.officialgazette.gov.ph/) | Laws, executive issuances and proclamations | National/LGU when specified | Search/page metadata; archive documents | Event-driven | Quote sparingly; retain issuance number and canonical URL |
| [Lawphil](https://lawphil.net/) | Searchable laws, jurisprudence and issuances | National | Public document metadata/text where permitted | Event-driven | Useful fallback for legal text; identify the official legal instrument |
| [DBM](https://www.dbm.gov.ph/) | National budget, releases and agency allocations | Agency/region/program | Official XLSX/PDF downloads | Annual/periodic | Model appropriations separately from actual disbursement |
| [PhilGEPS](https://notices.philgeps.gov.ph/) | Procurement notices and awards | Procuring entity/location | Authorized search/download | Daily | Procurement data needs entity normalization and deduplication |
| [DILG Full Disclosure Policy Portal](https://fdpp.blgs.gov.ph/) | LGU financial and governance disclosures | LGU | Official documents/download | Quarterly/annual | Verify document completeness and reporting period |

## Tier 2 — issue and event context

| Source | Value to PULSE | Geography | Preferred ingestion | Cadence | Notes |
|---|---|---|---|---|---|
| [DSWD DROMIC situation reports](https://dromic.dswd.gov.ph/category/situation-reports/) | Disaster impact, affected families, assistance and incident locations | Barangay/LGU/region | Page index + official PDF extraction | Event-driven | Preserve report number and “as of” timestamp; later reports supersede earlier figures |
| [PAGASA](https://www.pagasa.dost.gov.ph/) | Weather bulletins, cyclone/flood context and climate publications | Forecast area/station | Official bulletins/files | Hourly to monthly | Raw climate datasets may require a request and terms of use |
| [PHIVOLCS](https://www.phivolcs.dost.gov.ph/) | Earthquake, volcano and tsunami bulletins | Coordinates/site/LGU | Official feeds or bulletins | Near real time | Never rewrite safety classifications; link to the original bulletin |
| [DOH](https://doh.gov.ph/) | Health advisories and epidemiological reports | Varies | Official reports/downloads | Weekly/monthly | Aggregate health data; do not ingest identifiable patient information |
| [Department of Agriculture](https://www.da.gov.ph/) | Commodity prices, agriculture programs and advisories | Market/region | Official files/pages | Daily/weekly | Useful for validating cost-of-living and food-price conversations |
| [Department of Education](https://www.deped.gov.ph/) | Education orders, enrollment and school advisories | School division/region | Official issuances/files | Event-driven | Keep policy announcements distinct from outcome statistics |
| [DPWH](https://www.dpwh.gov.ph/) | Infrastructure projects, advisories and project status | Project/LGU/region | Official project pages/files | Project-specific | Normalize project IDs, contractors, allocation and completion status |
| [Senate](https://legacy.senate.gov.ph/lis/leg_sys.aspx) and [House](https://congress.gov.ph/legislative-documents) legislative systems | Bills, resolutions, sponsors and status | National | Official search/pages/files | Daily in session | Useful for issue timelines; status changes must be timestamped |

## Tier 3 — public discourse and media signals

These sources measure attention and discussion, not representative public opinion.

| Source | Value to PULSE | Use this | Avoid |
|---|---|---|---|
| News publishers | Issue volume, framing, named entities and local events | Publisher RSS/API, licensed feeds, article metadata and short extracts | Copying full articles or crawling sites that prohibit it |
| [GDELT](https://www.gdeltproject.org/) | Broad news-event discovery and multilingual trend signals | GDELT API/data exports | Treating automated tone as ground truth |
| [YouTube Data API](https://developers.google.com/youtube/v3) | Public video/channel metadata and comment signals where authorized | Official API with quota controls | Scraping rendered pages or collecting private user information |
| [Reddit API](https://www.reddit.com/dev/api/) | Public discussion from Philippine and local communities | Official API, subreddit rules and deletion handling | Assuming Reddit users represent the electorate |
| Meta Content Library/API | Public Facebook and Instagram research data for eligible users | Authorized Meta research products | Scraping Facebook pages, profiles or groups |
| X API | Public post and trend signals according to the subscribed tier | Official API and permitted retention | Browser scraping or retaining content beyond platform rules |
| TikTok Research API | Public research dataset for approved projects/regions | Authorized research API | Automated collection from the consumer website |
| Google Trends | Relative search interest by time and place | Approved export or compliant research workflow | Treating values as search counts or using fragile unofficial scraping in production |

## Sources to reject

- Leaked voter lists, private group messages, or purchased personal profiles
- Scraped Facebook profiles, phone numbers, email addresses, or inferred political affiliation
- Data obtained by bypassing login, paywall, CAPTCHA, robots directives, or technical controls
- Anonymous datasets without provenance or collection dates
- “Sentiment datasets” that cannot be traced back to source records and model versions
- Precinct or barangay outputs that could expose an individual’s political preference

## Required source metadata

Every ingestion connector must publish:

```ts
type SourceRecord = {
  sourceId: string
  publisher: string
  canonicalUrl: string
  retrievedAt: string
  publishedAt?: string
  licenseOrTermsUrl: string
  ingestionMethod: 'api' | 'rss' | 'download' | 'authorized-crawl' | 'manual'
  parserVersion: string
  contentHash: string
  geographicCodes: string[]
  electionCycle?: string
  supersedesRecordId?: string
  quality: {
    provenance: 'primary' | 'secondary'
    completeness: number
    confidence: number
  }
}
```

## Recommended first connectors

1. PSGC API — geographic foundation
2. PSA OpenSTAT — demographic and socioeconomic baselines
3. COMELEC statistics — voter and election context
4. DROMIC — location-specific events
5. Government issuances — policy timeline
6. Two or three publisher-supplied RSS feeds — news signals
7. One authorized social API — public-discourse pilot

This sequence gives the sentiment layer enough factual context before expanding social collection.
