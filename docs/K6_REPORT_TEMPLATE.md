# k6 Load Test Report Template

## Command
```bash
k6 run -e BASE_URL=http://localhost:3000 load-tests/teamforge.k6.js
```

## Scenarios
1. **Discovery Browsing (`discovery_browsing`)**: Ramping up to 100 concurrent VUs browsing `/api/teams?hasOpenSeats=true`, `/api/hackathons`, and `/api/teams/:id`.
2. **Concurrent Join Burst (`concurrent_join_burst`)**: 50 VUs executing parallel join attempts with unique `Idempotency-Key` headers.

## Measured Metrics (Fill with actual run output)
| Metric | Target | Measured |
| --- | --- | --- |
| Discovery Board p50 Latency | — | `___ ms` |
| Discovery Board p95 Latency | `< 200 ms` | `___ ms` |
| Discovery Board p99 Latency | — | `___ ms` |
| Throughput (req/s) | — | `___ req/s` |
| HTTP Failure Rate | `< 5%` | `___ %` |
| Concurrent Join Winners (201) | `<= open seats` | `___` |
