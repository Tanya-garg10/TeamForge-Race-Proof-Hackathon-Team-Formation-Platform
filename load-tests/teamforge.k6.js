import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const boardLatency = new Trend('discovery_board_duration', true);
const detailLatency = new Trend('team_detail_duration', true);
const joinSuccesses = new Counter('concurrent_join_successes');
const joinConflicts = new Counter('concurrent_join_conflicts');

export const options = {
  scenarios: {
    discovery_browsing: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '15s', target: 50 },
        { duration: '30s', target: 100 },
        { duration: '15s', target: 0 },
      ],
      exec: 'browseDiscovery',
    },
    concurrent_join_burst: {
      executor: 'per-vu-iterations',
      vus: 50,
      iterations: 1,
      startTime: '20s',
      exec: 'concurrentJoinBurst',
    },
  },
  thresholds: {
    discovery_board_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.05'],
  },
};

export function setup() {
  const teamsRes = http.get(`${BASE_URL}/api/teams?limit=10`);
  const parsed = JSON.parse(teamsRes.body);
  const teamIds = (parsed.items || []).map((t) => t.id);
  return { teamIds };
}

export function browseDiscovery(data) {
  const boardRes = http.get(`${BASE_URL}/api/teams?hasOpenSeats=true&limit=20`);
  boardLatency.add(boardRes.timings.duration);
  check(boardRes, {
    'discovery board 200': (r) => r.status === 200,
  });

  const hackRes = http.get(`${BASE_URL}/api/hackathons`);
  check(hackRes, {
    'hackathons list 200': (r) => r.status === 200,
  });

  if (data.teamIds && data.teamIds.length > 0) {
    const id = data.teamIds[__VU % data.teamIds.length];
    const detailRes = http.get(`${BASE_URL}/api/teams/${id}`);
    detailLatency.add(detailRes.timings.duration);
    check(detailRes, {
      'team detail 200': (r) => r.status === 200,
    });
  }

  sleep(0.3);
}

export function concurrentJoinBurst(data) {
  const email = `k6.vu.${__VU}.${Date.now()}@loadtest.local`;
  const regRes = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({
      name: `K6 Contender ${__VU}`,
      email,
      password: 'Password123!',
      timezone: 'UTC',
      skills: ['TypeScript'],
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (regRes.status !== 201) return;
  const token = JSON.parse(regRes.body).token;
  const targetTeamId = (data.teamIds && data.teamIds[0]) || 'team_atomicsync';

  const joinRes = http.post(
    `${BASE_URL}/api/teams/${targetTeamId}/join`,
    JSON.stringify({}),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': `k6-${targetTeamId}-${__VU}`,
      },
    },
  );

  if (joinRes.status === 201) joinSuccesses.add(1);
  if (joinRes.status === 409) joinConflicts.add(1);

  check(joinRes, {
    'join returned deterministic 201 or 409': (r) => r.status === 201 || r.status === 409,
  });
}
