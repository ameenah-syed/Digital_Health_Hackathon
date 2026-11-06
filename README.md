# Airwise asthma demo

Airwise is a small asthma check-in prototype with two separate SwiftUI iOS apps and a browser dashboard. The browser demo includes four entirely synthetic patients with daily mood, controller-medication, rescue-inhaler, symptom, trigger, and peak-flow entries. Patient Preview writes to the same database shown by the provider dashboard.

## iOS apps

Open `AsthmaDash/AsthmaDash.xcodeproj` in Xcode and choose an iPhone simulator. The project has two schemes:

- `ProviderApp` launches the provider dashboard with patient metrics and symptom charts.
- `PatientApp` launches the kid-friendly check-in, symptom education, streaks, and badges.

The native apps currently keep their local demo data separate. Check-ins entered in `PatientApp` do not appear in `ProviderApp`; connecting them needs an approved shared data service or iOS shared-container entitlement. The browser demo's patient and provider views do share the database described below.

## Run the browser demo locally

Node.js 26.12 or newer is needed for the built-in SQLite API. No package installation is needed for local use:

```sh
npm start
```

Open `http://localhost:3000`. The demo database defaults to `./data/airwise.db`; set `DATA_DIR` to change its location. It is seeded with four synthetic profiles.

## Free public demo deployment

The public setup uses Cloudflare Pages for the site and Pages Functions API, with Cloudflare D1 (SQLite) for shared persistent check-ins. It avoids Render and other paid hosting plans. GitHub Pages alone is not used because it cannot run the API or database.

To create the free Cloudflare resources and publish a URL:

1. Create a free Cloudflare account, then authenticate Wrangler:

   ```sh
   npx wrangler login
   ```

2. Create a D1 database and copy its database ID into `wrangler.toml`, replacing `REPLACE_WITH_D1_DATABASE_ID`:

   ```sh
   npx wrangler d1 create airwise-asthma-demo
   ```

3. Apply the schema and synthetic seed data, then deploy the site and API:

   ```sh
   npx wrangler d1 migrations apply airwise-asthma-demo --remote
   npx wrangler pages deploy ./web --project-name=airwise-asthma-demo
   ```

The first Pages deployment creates the project and prints its public `pages.dev` URL. Later releases can use `npm run deploy`. The dashboard and API share one origin, and check-ins submitted from Patient Preview are saved in D1 and visible to every judge using that deployment.

Cloudflare's free plan has daily usage limits. See [Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), and [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

**Demo only:** patient names and check-ins are fabricated, not sourced from real people or Synthea. Do not enter real patient information. This prototype has no login or access controls and is not for clinical use.
