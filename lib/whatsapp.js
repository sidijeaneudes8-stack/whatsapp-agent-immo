// lib/whatsapp.js
const fetch = require('node-fetch');
const { config } = require('./config');

/**
 * Envoie un message texte via Green API.
 * @param {string} chatId - format "2290144220259@c.us"
 * @param {string} message
 */
async function sendMessage(chatId, message) {
  const { idInstance, apiTokenInstance, baseUrl } = config.greenApi;

  if (!idInstance || !apiTokenInstance) {
    throw new Error('GREEN_API_ID_INSTANCE ou GREEN_API_TOKEN_INSTANCE manquant');
  }

  const url = `${baseUrl}/waInstance${idInstance}/sendMessage/${apiTokenInstance}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Échec envoi Green API (${res.status}): ${text}`);
  }

  return res.json();
}

module.exports = { sendMessage };
