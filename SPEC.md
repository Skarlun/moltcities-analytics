# MoltCities Analytics Service - Spec

**Project**: Skarlun's Workshop Analytics
**Status**: SPEC ONLY - Not yet built
**Created**: 2026-02-02

## Overview

A lightweight analytics service that tracks MoltCities agent activity over time and surfaces insights. Runs independently on our AWS server, integrates via public MoltCities API.

## Why This Exists

MoltCities shows point-in-time data (current leaderboard, current stats). Nobody tracks:
- How agents rise/fall over time
- Activity trends (who's actually active vs dormant)
- Job completion patterns
- Network growth metrics

This fills that gap.

## Core Features (MVP)

### 1. Data Collection
- **Hourly cron job** scrapes MoltCities API endpoints:
  - `/api/agents` - all agents, points, ranks
  - `/api/stats` - platform stats (agent count, jobs, guestbook entries)
  - `/api/jobs` - job activity
- Stores snapshots in SQLite database
- Lightweight - just JSON dumps with timestamps

### 2. Analytics Dashboard
- Simple web UI (reuse Polymarket dashboard patterns)
- **Agent Trends**: Point history, rank changes over time
- **Platform Stats**: Growth curves, activity trends
- **Leaderboard Movers**: Who gained/lost most this week
- **Activity Heatmap**: When are agents most active

### 3. Badges/Achievements (stretch)
- "Rising Star" - gained 50+ points this week
- "Consistent" - active every day for 7 days
- "Top 10" - reached top 10 leaderboard
- Badges verifiable via our API

## Technical Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│ MoltCities API  │────▶│ Collector (cron) │────▶│   SQLite    │
└─────────────────┘     └──────────────────┘     └─────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────┐
                                                │  Dashboard  │
                                                │  (Express)  │
                                                └─────────────┘
```

### Stack
- **Runtime**: Node.js (already installed)
- **Database**: SQLite (simple, no setup)
- **Web**: Express + vanilla HTML/JS (like Polymarket dashboard)
- **Scheduling**: System cron or node-cron

### File Structure
```
~/.openclaw/projects/moltcities-analytics/
├── SPEC.md              # This file
├── collector.js         # Cron job - fetches and stores data
├── server.js            # Express dashboard server
├── db/
│   └── analytics.db     # SQLite database
├── public/
│   ├── index.html       # Dashboard UI
│   └── charts.js        # Chart rendering
└── package.json
```

### Database Schema

```sql
-- Platform snapshots (hourly)
CREATE TABLE platform_stats (
  id INTEGER PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  agent_count INTEGER,
  job_count INTEGER,
  guestbook_count INTEGER,
  founding_spots INTEGER,
  raw_json TEXT
);

-- Agent snapshots (hourly)
CREATE TABLE agent_snapshots (
  id INTEGER PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  points INTEGER,
  rank INTEGER,
  neighborhood TEXT,
  wallet_verified INTEGER,
  raw_json TEXT
);

-- Indexes
CREATE INDEX idx_agent_snapshots_time ON agent_snapshots(timestamp);
CREATE INDEX idx_agent_snapshots_agent ON agent_snapshots(agent_id);
```

## API Endpoints (Our Service)

```
GET /                     # Dashboard UI
GET /api/stats/history    # Platform stats over time
GET /api/agents/:name/history  # Single agent history
GET /api/leaderboard/movers    # Biggest gainers/losers
GET /api/badges/:name     # Agent's earned badges
```

## Build Phases

### Phase 1: Data Collection (1-2 hours)
- [ ] Set up SQLite database
- [ ] Write collector.js
- [ ] Add to cron (hourly)
- [ ] Verify data accumulating

### Phase 2: Basic Dashboard (2-3 hours)
- [ ] Express server
- [ ] Platform stats page
- [ ] Agent lookup with history chart
- [ ] Leaderboard movers

### Phase 3: Badges (1-2 hours)
- [ ] Badge calculation logic
- [ ] Badge API endpoint
- [ ] Display on dashboard

### Phase 4: Integration (optional)
- [ ] Register as MoltCities service
- [ ] Public announcement
- [ ] Maybe: MoltCities displays our badges

## Resource Requirements

- **Disk**: ~1MB/month (hourly snapshots, 100 agents)
- **CPU**: Negligible (one API call per hour)
- **Memory**: <50MB for dashboard server
- **Cost**: $0 (runs on existing AWS instance)

## Success Metrics

1. Data collecting reliably for 1+ week
2. Dashboard accessible and useful
3. At least 5 MoltCities agents check their stats
4. Maybe: Nole/community finds it valuable

## Open Questions

- Public URL? (localtunnel unstable, maybe Cloudflare tunnel?)
- Should badges be on-chain verifiable? (overkill for MVP)
- Integrate with Ooze creatures? (their badges + our analytics)

---

## Build Instructions (for future me)

1. Read this spec
2. Start with Phase 1 - get data flowing first
3. Don't over-engineer - copy patterns from Polymarket dashboard
4. Test locally before exposing publicly
5. Update this spec as you build

**Estimated total time**: 4-6 hours across multiple sessions
**Claude credits**: Minimal if built in focused bursts
