// lib/groq.js
const Groq = require('groq-sdk');
const { config } = require('./config');
const { buildSystemPrompt } = require('./systemPrompt');

let client = null;
function getClient() {
  if (!client) {
    if (!config.groq.apiKey) {
      throw new Error('GROQ_API_KEY manquant dans les variables d\'environnement');
    }
    client = new Groq({ apiKey: config.groq.apiKey });
  }
  return client;
}

/**
 * Génère une réponse via Groq.
 * @param {string} userMessage - message texte du prospect
 * @param {Array<{role: 'user'|'assistant', content: string}>} history - historique court (optionnel)
 */
async function generateReply(userMessage, history = []) {
  const groq = getClient();

  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    ...history,
    { role: 'user', content: userMessage },
  ];

  const completion = await groq.chat.completions.create({
    model: config.groq.model,
    messages,
    temperature: 0.7,
    max_tokens: 400,
  });

  const reply = completion.choices?.[0]?.message?.content;
  if (!reply) {
    throw new Error('Réponse Groq vide ou inattendue');
  }
  return reply.trim();
}

module.exports = { generateReply };
