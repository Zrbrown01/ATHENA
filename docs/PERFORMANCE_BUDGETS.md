# Browser performance budgets

Athena enforces bounded browser regression budgets against the locally served production build on the home workspace and cost-governance route. `npm run test:performance` records the measurements as JSON attachments in the ignored local evidence directory and fails the release gate when a route exceeds any limit. The ordinary interaction suite remains on the development server and explicitly excludes this production-bundle measurement.

| Measurement | Budget |
| --- | ---: |
| DOM content loaded | 2,500 ms |
| First contentful paint | 2,000 ms |
| Encoded JavaScript resources | 2,500,000 bytes |
| Encoded stylesheet resources | 300,000 bytes |
| Encoded image resources | 1,500,000 bytes |

These thresholds catch large local regressions in the actual Chromium-rendered production bundle. They are not deployed latency or capacity evidence: the test uses one synthetic principal, the local Worker/D1 runtime, and no representative concurrency, external provider, or edge/WAF load. Production readiness therefore remains false until separately operated representative load and deployed telemetry satisfy approved targets.
