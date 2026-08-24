# Election reference data

This directory contains the source documents and Phase 1 normalized election
reference datasets for the May 12, 2025 Philippine national and local
elections.

## Sources

- `LIST-CITIES-MUN-LEGDIST-2025.xls` — cities and municipalities grouped by
  legislative district.
- `2025 ELECTED PARTY LIST.pdf` — proclaimed party-list organizations,
  national vote totals, and proclaimed nominees.
- `reference/psgc-localities-2025.json` — the region, province, city, and
  municipality subset of the July 8, 2025 PSGC data. The snapshot was derived
  from the PSA Q2 2025 publication data packaged by
  [`barangay` 2025.7.31.1](https://pypi.org/project/barangay/2025.7.31.1/).
- `reference/legislative-barangay-boundaries-2025.geojson` — cached GeoRiskPH
  PSA boundary inputs for the 1,814 barangays assigned to split-city districts,
  plus the whole Pateros locality used by the mixed Taguig-Pateros district.
- `reference/legislative-barangay-boundaries-2025.manifest.json` — retrieval
  metadata and SHA-256 checksum for the cached geometry input.

Every normalized dataset records the SHA-256 checksum of its source document.

## Generated outputs

- `normalized/legislative-districts-2025.json`
- `normalized/party-lists-2025.json`
- `normalized/legislative-district-boundaries-2025.geojson`
- `normalized/legislative-district-subdivisions-2025.json`
- `normalized/validation/legislative-district-psgc-crosswalk.json`
- `normalized/validation/legislative-district-exceptions.json`
- `normalized/validation/party-list-exceptions.json`

The exception reports distinguish blocking errors from intentional warnings.
Generated data is acceptable only when both reports contain zero errors.

## Commands

Generate the datasets:

```bash
npm run data:normalize:elections
```

Validate checked-in outputs without invoking document-conversion tools:

```bash
npm run data:validate:elections
```

Synchronize the editable legislative-boundary GeoJSON with the current list of
partial-city districts:

```bash
npm run data:sync:election-boundaries
```

Regenerate the barangay/submunicipality district crosswalk from the pinned
`barangay` package's `barangay_flat.json`:

```bash
npm run data:normalize:election-subdivisions -- --psgc /path/to/barangay_flat.json
```

Fetch and pin the boundary inputs from GeoRiskPH after regenerating subdivision
membership. This is the only network-dependent step:

```bash
npm run data:fetch:election-barangay-boundaries
```

Dissolve the cached barangay polygons into all 36 partial-city legislative
district boundaries without accessing the network:

```bash
npm run data:generate:election-boundaries
```

Clean self-intersections, close rings, and normalize outer-ring winding after
entering or importing coordinates:

```bash
npm run data:clean:election-boundaries
```

The sync command adds newly detected partial districts and updates their
descriptive properties. It preserves existing geometry, sources, notes, and
any stale hand-entered features. The generation command replaces all active
partial-city geometry with one consistent source-derived set.

### Entering legislative boundary coordinates

Edit `normalized/legislative-district-boundaries-2025.geojson`. Each of the 36
partial-city districts has a feature whose `id` matches the normalized
legislative district ID. Empty entries begin with:

```json
{
  "properties": {
    "boundaryStatus": "missing",
    "source": null,
    "sourceUrl": null,
    "notes": null
  },
  "geometry": null
}
```

Replace `geometry` with a valid GeoJSON `Polygon` or `MultiPolygon` in
EPSG:4326 longitude/latitude order. Change `boundaryStatus` to `draft` while
the shape is under review, or `verified` once it has been checked. Verified
features must identify their `source`; `sourceUrl` is strongly recommended.

Example polygon:

```json
"geometry": {
  "type": "Polygon",
  "coordinates": [
    [
      [120.9800, 14.6000],
      [120.9900, 14.6000],
      [120.9900, 14.6100],
      [120.9800, 14.6000]
    ]
  ]
}
```

Polygon rings must contain at least four positions and must close by repeating
the first position as the last. Rings must not self-intersect or overlap, and
outer rings use counter-clockwise winding. Run the cleanup and validator after
every coordinate edit.

## Read-only API

- `GET /api/elections/status?year=2025`
- `GET /api/elections/legislative-districts?year=2025`
- `GET /api/elections/legislative-districts/:id`
- `GET /api/elections/legislative-districts/:id/localities`
- `GET /api/elections/legislative-districts/:id/subdivisions`
- `GET /api/elections/legislative-districts/:id/boundary`
- `GET /api/elections/party-lists?year=2025`
- `GET /api/elections/party-lists/:id?year=2025`

CoverageFilter election selections are encoded in the browser query string so
legislative-district and party-list views can be bookmarked or shared.

The normalization command requires `libreoffice` for the legacy `.xls` file
and Poppler's `pdftotext` for positional PDF extraction.

To replace the PSGC snapshot, pass a flat PSGC JSON file containing `name`,
`type`, `psgc_id`, and `parent_psgc_id` fields:

```bash
npm run data:normalize:elections -- --psgc /path/to/psgc-flat.json
```

## Known source limitations

- Councilor and provincial-board districts are excluded from the legislative
  dataset.
- Cities represented by multiple legislative districts are marked with
  `coverage: "partial"`. Their barangay crosswalk is maintained separately
  because the source workbook does not contain internal membership. All 36
  partial-city districts have verified subdivision coverage: 1,814 barangays
  plus the ten Manila submunicipalities whose barangays lie wholly within one
  district. Cross-district submunicipalities are represented by their
  constituent barangays instead of being assigned wholesale.
- GeoRiskPH currently exposes the ten EMBO polygons under their former Makati
  PSGC codes. The cached boundary input records an explicit `legacy-code`
  reconciliation for their current Taguig codes.
- GeoRiskPH currently exposes Caloocan's former Barangay 176 as one polygon,
  not separate polygons for Barangays 176-A through 176-F. Because all six
  successors belong to the same legislative district, generation uses the
  predecessor footprint as one `aggregate-predecessor` input. It must not be
  used to infer boundaries between those six barangays.
- Generated legislative polygons begin with `boundaryStatus: "draft"` and
  should be promoted to `verified` only after visual review.
- The workbook places Sulu under Region IX, while the July 8, 2025 PSGC
  reference places it under BARMM. The normalized records use the PSGC parent
  and retain a warning documenting the source difference.
- Party-list vote totals are national. They must not be presented as results
  for a selected region, province, district, city, or municipality.
- Party-list seat counts are not inferred from the number of proclaimed
  nominees.
