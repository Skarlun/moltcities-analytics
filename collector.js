#!/usr/bin/env node
/**
 * MoltCities Analytics Collector
 * Hourly cron job that snapshots MoltCities data
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Use better-sqlite3 if available, else sqlite3
let Database;
try {
  Database = require('better-sqlite3');
} catch {
  console.error('better-sqlite3 not found, will try sqlite3...');
  Database = null;
}

const DB_PATH = path.join(__dirname, 'db', 'analytics.db');
const MC_API = 'https://moltcities.org/api';

// Simple HTTPS GET
function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'skarlun-analytics/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

// Initialize database
function initDb() {
  if (!Database) {
    console.error('No SQLite library available. Install: npm install better-sqlite3');
    process.exit(1);
  }
  
  const db = new Database(DB_PATH);
  
  db.exec(`
    -- Platform snapshots (hourly)
    CREATE TABLE IF NOT EXISTS platform_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      agent_count INTEGER,
      founding_remaining INTEGER,
      total_currency INTEGER,
      raw_json TEXT
    );

    -- Agent snapshots (hourly)
    CREATE TABLE IF NOT EXISTS agent_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      agent_name TEXT NOT NULL,
      currency INTEGER,
      trust_tier INTEGER,
      vote_weight REAL,
      neighborhood TEXT,
      wallet_verified INTEGER,
      founding_member INTEGER,
      raw_json TEXT
    );

    -- Job snapshots
    CREATE TABLE IF NOT EXISTS job_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      open_count INTEGER,
      completed_count INTEGER,
      total_paid_lamports INTEGER,
      raw_json TEXT
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_agent_time ON agent_snapshots(timestamp);
    CREATE INDEX IF NOT EXISTS idx_agent_name ON agent_snapshots(agent_name);
    CREATE INDEX IF NOT EXISTS idx_platform_time ON platform_stats(timestamp);
  `);
  
  return db;
}

async function collectStats(db) {
  const timestamp = Math.floor(Date.now() / 1000);
  console.log(`[${new Date().toISOString()}] Starting collection...`);

  // 1. Fetch agents list (API caps at 100, no working pagination)
  try {
    const agentsData = await fetch(`${MC_API}/agents?limit=100`);
    const agents = agentsData.agents || [];
    
    // Platform stats
    const platformInsert = db.prepare(`
      INSERT INTO platform_stats (timestamp, agent_count, founding_remaining, raw_json)
      VALUES (?, ?, ?, ?)
    `);
    platformInsert.run(
      timestamp,
      agents.length,
      agentsData.founding_remaining || null,
      JSON.stringify(agentsData)
    );
    console.log(`  Platform: ${agents.length} agents`);

    // Agent snapshots
    const agentInsert = db.prepare(`
      INSERT INTO agent_snapshots 
      (timestamp, agent_name, currency, trust_tier, vote_weight, neighborhood, wallet_verified, founding_member, raw_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((agents) => {
      for (const agent of agents) {
        agentInsert.run(
          timestamp,
          agent.name,
          agent.currency || 0,
          agent.trust_tier || 0,
          agent.vote_weight || 0,
          agent.site?.neighborhood || null,
          agent.has_wallet ? 1 : 0,
          agent.is_founding ? 1 : 0,
          JSON.stringify(agent)
        );
      }
    });
    insertMany(agents);
    console.log(`  Agents: ${agents.length} snapshots saved`);
  } catch (e) {
    console.error(`  Directory fetch failed: ${e.message}`);
  }

  // 2. Fetch jobs stats
  try {
    const jobs = await fetch(`${MC_API}/jobs`);
    const openJobs = (jobs.jobs || []).filter(j => j.status === 'open');
    const completedJobs = (jobs.jobs || []).filter(j => j.status === 'completed');
    
    const jobInsert = db.prepare(`
      INSERT INTO job_snapshots (timestamp, open_count, completed_count, total_paid_lamports, raw_json)
      VALUES (?, ?, ?, ?, ?)
    `);
    jobInsert.run(
      timestamp,
      openJobs.length,
      completedJobs.length,
      jobs.total_paid_lamports || 0,
      JSON.stringify({ open: openJobs.length, completed: completedJobs.length })
    );
    console.log(`  Jobs: ${openJobs.length} open, ${completedJobs.length} completed`);
  } catch (e) {
    console.error(`  Jobs fetch failed: ${e.message}`);
  }

  console.log(`[${new Date().toISOString()}] Collection complete`);
}

async function main() {
  const db = initDb();
  
  try {
    await collectStats(db);
  } finally {
    db.close();
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
