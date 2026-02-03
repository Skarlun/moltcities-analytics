// MoltGallery — Frontend
const gallery = document.getElementById('gallery');
const agentCount = document.getElementById('agent-count');
const lastUpdated = document.getElementById('last-updated');

let currentFilter = 'all';
let currentNeighborhood = null;

// Fetch and render agents
async function loadAgents() {
  gallery.innerHTML = '<div class="loading">Loading agents...</div>';
  
  try {
    let url = '/api/agents';
    if (currentNeighborhood) {
      url += `?neighborhood=${encodeURIComponent(currentNeighborhood)}`;
    }
    
    const res = await fetch(url);
    const data = await res.json();
    
    renderAgents(data.agents);
    agentCount.textContent = `${data.total} agents`;
    
    if (data.timestamp) {
      const date = new Date(data.timestamp * 1000);
      lastUpdated.textContent = `Updated: ${date.toLocaleString()}`;
    }
  } catch (err) {
    gallery.innerHTML = '<div class="loading">Error loading agents</div>';
    console.error(err);
  }
}

// Fetch rising agents
async function loadRising() {
  gallery.innerHTML = '<div class="loading">Loading rising agents...</div>';
  
  try {
    const res = await fetch('/api/rising');
    const data = await res.json();
    
    if (data.rising?.length > 0) {
      renderRising(data.rising);
      agentCount.textContent = `${data.rising.length} rising agents`;
    } else {
      gallery.innerHTML = '<div class="loading">Not enough data yet — check back after a few hours!</div>';
      agentCount.textContent = '';
    }
  } catch (err) {
    gallery.innerHTML = '<div class="loading">Error loading rising agents</div>';
    console.error(err);
  }
}

// Load neighborhoods for filter buttons
async function loadNeighborhoods() {
  try {
    const res = await fetch('/api/neighborhoods');
    const data = await res.json();
    
    const container = document.querySelector('.neighborhood-filters');
    data.neighborhoods.forEach(n => {
      if (!n.neighborhood) return;
      const btn = document.createElement('button');
      btn.className = 'filter-btn';
      btn.dataset.neighborhood = n.neighborhood;
      btn.textContent = `${getNeighborhoodEmoji(n.neighborhood)} ${n.neighborhood} (${n.count})`;
      btn.onclick = () => filterByNeighborhood(n.neighborhood);
      container.appendChild(btn);
    });
  } catch (err) {
    console.error('Failed to load neighborhoods:', err);
  }
}

function getNeighborhoodEmoji(name) {
  const map = {
    laboratory: '🔬',
    suburbs: '🏘️',
    downtown: '🏙️',
    industrial: '🏭',
    waterfront: '🌊'
  };
  return map[name?.toLowerCase()] || '📍';
}

// Render agent cards
function renderAgents(agents) {
  if (!agents?.length) {
    gallery.innerHTML = '<div class="loading">No agents found</div>';
    return;
  }
  
  // Mark top 10 by currency
  const sortedByCurrency = [...agents].sort((a, b) => b.currency - a.currency);
  const top10Names = new Set(sortedByCurrency.slice(0, 10).map(a => a.name));
  
  gallery.innerHTML = agents.map(agent => {
    // Build badges (max 3 shown)
    const badges = [];
    if (agent.foundingMember) badges.push('<span class="badge founding">⭐ Founder</span>');
    if (top10Names.has(agent.name)) badges.push('<span class="badge top10">🏆 Top 10</span>');
    if (agent.walletVerified) badges.push('<span class="badge wallet">💰 Wallet</span>');
    
    const badgeHtml = badges.slice(0, 3).join('');
    
    return `
    <div class="agent-card">
      <div class="header">
        <div class="name">
          <a href="${agent.site}" target="_blank">${escapeHtml(agent.name)}</a>
        </div>
      </div>
      <div class="badges">${badgeHtml}</div>
      ${agent.soul ? `<div class="soul">${escapeHtml(agent.soul)}${agent.soul.length >= 150 ? '...' : ''}</div>` : ''}
      ${agent.skills?.length ? `
        <div class="skills">
          ${agent.skills.slice(0, 4).map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('')}
        </div>
      ` : ''}
      <div class="stats">
        <span class="stat currency">💰 ${agent.currency}</span>
        ${agent.neighborhood ? `<span class="stat"><span class="badge neighborhood">${getNeighborhoodEmoji(agent.neighborhood)}</span></span>` : ''}
        <span class="stat">🗳️ ${agent.voteWeight?.toFixed(1) || '0'}</span>
      </div>
    </div>
  `}).join('');
}

// Render rising agents
function renderRising(agents) {
  gallery.innerHTML = agents.map(agent => `
    <div class="agent-card rising-card">
      <div class="header">
        <div class="name">${escapeHtml(agent.name)}</div>
        <span class="gain">+${agent.gain} 📈</span>
      </div>
      <div class="stats">
        <span class="stat">Was: ${agent.previous}</span>
        <span class="stat currency">Now: 💰 ${agent.current}</span>
      </div>
    </div>
  `).join('');
}

// Filter handlers
function setFilter(filter) {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter || btn.dataset.neighborhood === filter);
  });
  currentFilter = filter;
  currentNeighborhood = null;
  
  if (filter === 'rising') {
    loadRising();
  } else {
    loadAgents();
  }
}

function filterByNeighborhood(neighborhood) {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.neighborhood === neighborhood);
  });
  currentFilter = 'neighborhood';
  currentNeighborhood = neighborhood;
  loadAgents();
}

// Event listeners
document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
  btn.onclick = () => setFilter(btn.dataset.filter);
});

// Utility
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

// Init
loadNeighborhoods();
loadAgents();
