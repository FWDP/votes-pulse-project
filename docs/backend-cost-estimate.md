# VOTES Backend Cost Estimate

**Prepared:** 6 August 2026  
**Currency:** Philippine peso (PHP)  
**Planning exchange rate:** ₱61 per US dollar

> Actual foreign-currency charges should be converted using the prevailing [Bangko Sentral ng Pilipinas reference exchange rate](https://www.bsp.gov.ph/sitepages/statistics/exchangerate.aspx). Prices exclude taxes and may change as providers revise their plans.

## Executive summary

The VOTES backend cost has three parts:

1. One-time backend development and production hardening
2. Recurring cloud infrastructure
3. Recurring maintenance, data-connector and scraping operations
4. Optional commercial social-listening subscriptions

| Tier | One-time backend work | Infrastructure/month | Maintenance/month | Social listening/month | Total recurring/month |
|---|---:|---:|---:|---:|---:|
| Minimal prototype | ₱120,000–₱250,000 | ₱700–₱2,000 | ₱10,000–₱25,000 | ₱0 | ₱10,700–₱27,000 |
| Lean pilot | ₱300,000–₱650,000 | ₱5,000–₱15,000 | ₱25,000–₱60,000 | ₱40,000–₱150,000 | ₱70,000–₱225,000 |
| Production | ₱700,000–₱1.5 million | ₱25,000–₱70,000 | ₱60,000–₱150,000 | ₱150,000–₱400,000 | ₱235,000–₱620,000 |
| Premium | ₱1.8–₱4 million+ | ₱120,000–₱450,000+ | ₱150,000–₱500,000+ | ₱400,000–₱1 million+ | ₱670,000–₱1.95 million+ |

These development estimates assume continued work on the existing VOTES prototype rather than a new implementation.

## Tier 1: Minimal prototype

**Estimated infrastructure:** ₱700–₱2,000 per month

### Suggested configuration

- One 2 GB Linux virtual server
- Nginx reverse proxy
- Application API and collection jobs on the same server
- PostgreSQL or SQLite on the same server
- Cloudflare Free plan
- Daily database backup
- Existing DSWD, PSGC, GDELT and congressional-district connectors
- No paid social-listening platform; official and openly available sources only
- Basic server logs

AWS Lightsail currently lists a 2 GB Linux instance at $12 per month, including SSD storage and bundled transfer. See [AWS Lightsail pricing](https://aws.amazon.com/lightsail/pricing/).

### Limitations

- The server is a single point of failure.
- There is no guaranteed uptime or failover.
- Scrapers may stop when publishers change their websites.
- It is unsuitable for sensitive personal or political-profile data.
- The current in-memory source cache requires persistent storage before a public release.

## Tier 2: Lean pilot — recommended starting tier

**Estimated infrastructure:** ₱5,000–₱15,000 per month

| Service | Monthly estimate |
|---|---:|
| 4 GB application and scraper server | ₱1,200–₱2,000 |
| Managed database or isolated database server | ₱1,000–₱4,000 |
| Backups and object storage | ₱300–₱1,000 |
| Monitoring and error reporting | ₱0–₱1,500 |
| Email and notifications | ₱0–₱1,000 |
| Light proxy and scraping allowance | ₱1,000–₱5,000 |
| Cloudflare/CDN | ₱0–₱305 |
| Contingency | ₱1,000–₱2,000 |

Cloudflare Workers has a free tier, while its paid plan starts at $5 per month with an included usage allocation. See [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

### Expected capacity and features

- Approximately 100–1,000 regular users
- Scheduled collection every 15–60 minutes
- Persistent PostgreSQL database
- Background ingestion workers
- Searchable normalized records
- Administrator authentication
- Basic roles and permissions
- Data-source health dashboard
- Daily backups
- Seven- to thirty-day raw-data retention
- Staging and production deployments

### Recommended pilot budget

- Backend completion: ₱400,000–₱650,000
- Infrastructure: approximately ₱8,000–₱12,000 per month
- Maintenance: ₱30,000–₱60,000 per month
- Meltwater procurement reserve: approximately ₱40,000–₱150,000 per month pending quotation

## Tier 3: Full production

**Estimated infrastructure:** ₱25,000–₱70,000 per month

### Suggested architecture

- Two application instances
- Separate ingestion and scraping worker
- Managed PostgreSQL or MongoDB database
- Redis queue and cache
- Object storage for exports and source artifacts
- Load balancer
- Automated backups
- Centralized logs and error tracking
- Search service
- Proxy or scraping provider
- Separate staging environment
- CI/CD and security scanning

An AWS Lightsail load balancer currently costs $18 per month. See [Lightsail load-balancer pricing](https://aws.amazon.com/lightsail/features/load-balancing/).

MongoDB Atlas M10 currently starts at approximately $56.94 per month on AWS with 2 GB RAM and 10 GB storage; managed backup and expanded capacity are additional. See [MongoDB Atlas AWS pricing](https://www.mongodb.com/products/platform/atlas-cloud-providers/aws/pricing).

### Expected production features

- User accounts and role-based access control
- Audit logs
- Saved dashboards and reports
- Durable field-report storage
- Asynchronous export generation
- Connector retries and failure queues
- API rate limiting
- Source-level provenance
- Privacy and retention enforcement
- Disaster-recovery procedures
- Uptime monitoring and alerts
- Moderate traffic-spike capacity

## Tier 4: Premium deployment

**Estimated infrastructure:** ₱120,000–₱450,000+ per month

### Possible architecture

- Multi-zone application cluster
- Managed Kubernetes or autoscaling containers
- Dedicated ingestion workers
- High-availability database and replicas
- Point-in-time database recovery
- Elasticsearch or OpenSearch
- Redis cluster
- Large proxy and scraping allowance
- Web-application firewall
- Security information and event monitoring
- Long-term analytical warehouse
- AI-assisted classification and summarization
- Dedicated staging, testing and disaster-recovery environments
- 24/7 operational support

MongoDB documentation uses an M30 example of roughly $388 per month before additional storage and services. See the [MongoDB Atlas invoice example](https://www.mongodb.com/docs/atlas/billing/invoice-breakdown/).

At this scale, scraping, search, AI processing and observability will generally cost more than the application servers.

## One-time backend development scope

The current prototype still requires the following for a production backend:

- Persistent database design and migrations
- User authentication
- Role-based access control
- Administrator interface
- Secure and durable field-report storage
- Background job queue
- Scraper scheduling, retries and dead-letter handling
- Duplicate-record detection
- Geographic normalization
- Congressional-district versioning
- Full-text search
- Export generation
- Source provenance and confidence scoring
- Audit trail
- API rate limiting
- Automated tests
- Backup and restoration procedures
- CI/CD deployment
- Privacy and data-retention controls
- Monitoring and operational documentation

### Development ranges

- Pilot-quality backend: ₱400,000–₱650,000
- Production-quality backend: ₱700,000–₱1.5 million
- Premium/high-availability backend: ₱1.8–₱4 million+

## Scraping and connector costs

Web scraping is the least predictable portion of the budget. Cost increases when:

- Publishers block automated requests.
- Residential proxies are required.
- JavaScript browsers must render every page.
- Collection runs every few minutes.
- Historical documents must be downloaded.
- Publisher layouts change frequently.
- Manual verification is required.
- Social-media or commercial news-data licenses are required.

### Suggested monthly allowance

- Pilot: ₱2,000–₱5,000
- Production: ₱10,000–₱40,000
- Premium: ₱50,000–₱200,000+

These figures exclude paid surveys, commercial social-listening feeds, proprietary election datasets and restricted publisher licenses. Commercial social listening is budgeted separately below.

## Social-listening subscription costs

Social-listening subscriptions are a data-acquisition cost, not ordinary server infrastructure. The final cost depends on the number of topics or keywords, monthly mention volume, historical coverage, user seats, monitored countries and whether VOTES needs automated API access.

### Meltwater price reference

VOTES will use **Meltwater** as its social-listening platform and pricing reference. [Meltwater's official pricing page](https://www.meltwater.com/en/pricing) does not publish a fixed subscription amount. Meltwater provides a tailored quotation based on the selected packages and modules, monitored sources and regions, data volume, number of users, integrations, onboarding and support.

Until Meltwater supplies its written quotation, this estimate uses a **₱100,000 monthly reference amount** for the lean pilot. This is an internal budgeting assumption—not a published or guaranteed Meltwater price. The final computation must replace this value with the accepted quotation.

| Deployment level | Subscription allowance | Intended approach |
|---|---:|---|
| Minimal | ₱0/month | Official APIs, open datasets and compliant public-web collection |
| Lean pilot | ₱40,000–₱150,000/month | Meltwater listening for a limited topic set and analyst team |
| Production | ₱150,000–₱400,000/month | Broader coverage, more users and licensed integration |
| Premium | ₱400,000–₱1 million+/month | Multiple modules, historical data, regions, integrations and support |

For the project computation, VOTES assigns **₱100,000 per month or ₱1,200,000 per year** to Meltwater. This cost is included in the monthly operating cost and complete first-year total below. It remains a planning assumption until replaced by Meltwater's formal quotation. The request for quotation must separately identify media monitoring, social listening, historical search, Philippine and regional sources, user seats, exports, API or data-feed access, onboarding, support, taxes and contract duration. API access must be written into the proposal if Meltwater results will flow automatically into VOTES.

## Recommended VOTES budget

The recommended first deployment is the lean pilot tier:

| Item | Monthly cost | First-year computation | First-year cost |
|---|---:|---:|---:|
| One-time backend completion | — | One-time | ₱500,000 |
| Cloud infrastructure | ₱10,000 | ₱10,000 × 12 | ₱120,000 |
| Maintenance and connector support | ₱40,000 | ₱40,000 × 12 | ₱480,000 |
| **Meltwater subscription** | **₱100,000** | **₱100,000 × 12** | **₱1,200,000** |
| First-year operating contingency | — | One-time | ₱100,000 |
| **Approximate first-year total** |  | **₱500,000 + ₱120,000 + ₱480,000 + ₱1,200,000 + ₱100,000** | **₱2,400,000** |

The continuing operating cost after implementation is approximately **₱150,000 per month**, comprising ₱10,000 infrastructure, ₱40,000 maintenance and ₱100,000 Meltwater. Meltwater therefore represents **₱1.2 million, or 50%, of the ₱2.4 million first-year budget**.

The first-year computation includes Meltwater rather than treating it as an exclusion or optional add-on. At the lean planning range of **₱40,000–₱150,000 per month**, the actual first-year total would be approximately **₱1.68–₱3.0 million**. Every ₱10,000 monthly difference in the final Meltwater quotation changes the annual total by ₱120,000. Replace the assumed amount with the accepted quotation before budget approval; VAT, foreign-card charges, onboarding and API fees may change the total.

VOTES can move to the production tier once user traffic, collection frequency, retention volume and institutional requirements justify the increase. Before purchasing any platform, conduct a short coverage test for Philippine languages, local news sources, public Facebook content and the required retention period.

## Exclusions and assumptions

The estimate does not include:

- VAT, withholding tax or foreign-card fees
- Commercial datasets beyond the social-listening allowance above
- Paid public-opinion surveys
- Legal and privacy-compliance consultancy
- Full-time employee salaries
- 24/7 human support unless included in the premium tier
- Mobile applications
- GIS boundary acquisition requiring a separate license
- Major redesign of the existing frontend

Actual cost should be recalculated after confirming:

- Expected monthly users and peak concurrent traffic
- Number of sources and collection frequency
- Historical data-retention period
- Raw document and media-storage volume
- Authentication and organization requirements
- Availability target and recovery-time objective
- Whether AI classification or summarization is required
- Whether commercial social-media data will be purchased
- Required platforms, keywords, mention volume, seats and historical lookback
- Whether analysts will use a vendor dashboard or VOTES requires licensed API ingestion

## Pricing references

- [Bangko Sentral ng Pilipinas exchange rates](https://www.bsp.gov.ph/sitepages/statistics/exchangerate.aspx)
- [AWS Lightsail pricing](https://aws.amazon.com/lightsail/pricing/)
- [AWS Lightsail load-balancer pricing](https://aws.amazon.com/lightsail/features/load-balancing/)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [MongoDB Atlas pricing on AWS](https://www.mongodb.com/products/platform/atlas-cloud-providers/aws/pricing)
- [MongoDB Atlas billing example](https://www.mongodb.com/docs/atlas/billing/invoice-breakdown/)
- [Meltwater pricing](https://www.meltwater.com/en/pricing)
