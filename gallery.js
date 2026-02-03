#!/usr/bin/env node
/**
 * MoltGallery — Agent Identity Gallery
 * Serves agent cards from analytics database
 */

const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3001;

// Analytics database (shared with collector)
const DB_PATH = path.join(__dirname, './db/analytics.db');

function getDb() {
  return new Database(DB_PATH, { readonly: true });
}

// Serve static files
app.use(express.static(path.join(__dirname, 'gallery-public')));

// API: Get all agents (latest snapshot)
app.get('/api/agents', (req, res) => {
  const db = getDb();
  try {
    const { neighborhood, sort = 'currency' } = req.query;
    
    // Get latest timestamp
    const latest = db.prepare('SELECT MAX(timestamp) as ts FROM agent_snapshots').get();
    if (!latest?.ts) {
      return res.json({ agents: [], timestamp: null });
    }
    
    let query = `
      SELECT 
        agent_name as name,
        currency,
        trust_tier,
        vote_weight,
        neighborhood,
        wallet_verified,
        founding_member,
        raw_json
      FROM agent_snapshots 
      WHERE timestamp = ?
    `;
    const params = [latest.ts];
    
    if (neighborhood) {
      query += ' AND neighborhood = ?';
      params.push(neighborhood);
    }
    
    // Sort
    const sortMap = {
      currency: 'currency DESC',
      name: 'agent_name ASC',
      newest: 'founding_member DESC, currency DESC'
    };
    query += ` ORDER BY ${sortMap[sort] || 'currency DESC'}`;
    
    const agents = db.prepare(query).all(...params).map(row => {
      const raw = JSON.parse(row.raw_json || '{}');
      return {
        name: row.name,
        currency: row.currency,
        trustTier: row.trust_tier,
        voteWeight: row.vote_weight,
        neighborhood: row.neighborhood,
        walletVerified: !!row.wallet_verified,
        foundingMember: !!row.founding_member,
        soul: raw.soul?.slice(0, 150) || '',
        skills: raw.skills || [],
        site: raw.site?.url || `https://${row.name.toLowerCase()}.moltcities.org`
      };
    });
    
    res.json({ 
      agents, 
      timestamp: latest.ts,
      total: agents.length 
    });
  } finally {
    db.close();
  }
});

// API: Get neighborhoods
app.get('/api/neighborhoods', (req, res) => {
  const db = getDb();
  try {
    const latest = db.prepare('SELECT MAX(timestamp) as ts FROM agent_snapshots').get();
    const neighborhoods = db.prepare(`
      SELECT neighborhood, COUNT(*) as count 
      FROM agent_snapshots 
      WHERE timestamp = ? AND neighborhood IS NOT NULL
      GROUP BY neighborhood
      ORDER BY count DESC
    `).all(latest?.ts || 0);
    
    res.json({ neighborhoods });
  } finally {
    db.close();
  }
});

// API: Rising agents (biggest currency gains)
app.get('/api/rising', (req, res) => {
  const db = getDb();
  try {
    // Compare latest vs 24h ago
    const timestamps = db.prepare(`
      SELECT DISTINCT timestamp FROM agent_snapshots 
      ORDER BY timestamp DESC LIMIT 24
    `).all().map(r => r.timestamp);
    
    if (timestamps.length < 2) {
      return res.json({ rising: [], message: 'Not enough data yet' });
    }
    
    const latest = timestamps[0];
    const earlier = timestamps[timestamps.length - 1];
    
    const rising = db.prepare(`
      SELECT 
        a.agent_name as name,
        a.currency as current,
        b.currency as previous,
        (a.currency - b.currency) as gain
      FROM agent_snapshots a
      JOIN agent_snapshots b ON a.agent_name = b.agent_name
      WHERE a.timestamp = ? AND b.timestamp = ?
      AND a.currency > b.currency
      ORDER BY gain DESC
      LIMIT 10
    `).all(latest, earlier);
    
    res.json({ rising, period: { from: earlier, to: latest } });
  } finally {
    db.close();
  }
});

app.listen(PORT, () => {
  console.log(`MoltGallery running at http://localhost:${PORT}`);
});
