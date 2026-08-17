// lib/history.js
// Historique de conversation minimal, optionnel.
// Si UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN ne sont pas
// configurés, ces fonctions deviennent des no-op : le service reste
// 100% stateless (chaque message est traité indépendamment), comme
// demandé pour la démo. C'est le mode par défaut recommandé.

const fetch = require('node-fetch');

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const HISTORY_ENABLED = Boolean(REDIS_URL && REDIS_TOKEN);
const MAX_TURNS = 6; // ~6 échanges gardés, pour rester léger sur le plan freemium
const TTL_SECONDS = 60 * 60 * 6; // 6h : une conversation de démo n'a pas besoin de plus

function key(senderDigits) {
  return `wa-history:${senderDigits}`;
}

async function redisCall(commandParts) {
  const res = await fetch(`${REDIS_URL}/${commandParts.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Erreur Redis (${res.status})`);
  return res.json();
}

async function getHistory(senderDigits) {
  if (!HISTORY_ENABLED) return [];
  try {
    const result = await redisCall(['GET', key(senderDigits)]);
    if (!result || !result.result) return [];
    return JSON.parse(result.result);
  } catch (err) {
    // Un souci Redis ne doit jamais bloquer la réponse au prospect.
    console.error('history:getHistory error', err.message);
    return [];
  }
}

async function saveHistory(senderDigits, history) {
  if (!HISTORY_ENABLED) return;
  try {
    const trimmed = history.slice(-MAX_TURNS * 2);
    await redisCall(['SET', key(senderDigits), JSON.stringify(trimmed), 'EX', String(TTL_SECONDS)]);
  } catch (err) {
    console.error('history:saveHistory error', err.message);
  }
}

module.exports = { getHistory, saveHistory, HISTORY_ENABLED };
