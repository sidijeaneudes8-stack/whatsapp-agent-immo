// lib/groq.js
const Groq = require('groq-sdk');
const { config } = require('./config');
const { buildSystemPrompt } = require('./systemPrompt');
const { createAppointment } = require('./calendar');

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

// Outil que Groq peut appeler lui-même quand le prospect confirme une
// date et une heure précises pour une visite.
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'schedule_appointment',
      description:
        "Enregistre un rendez-vous de visite dans l'agenda de l'agence. À utiliser dès que le prospect a confirmé une date et une heure précises pour une visite ou un appel.",
      parameters: {
        type: 'object',
        properties: {
          prospect_name: {
            type: 'string',
            description: 'Nom du prospect si connu, sinon "Prospect WhatsApp"',
          },
          date: { type: 'string', description: 'Date du rendez-vous, format YYYY-MM-DD' },
          time: { type: 'string', description: 'Heure du rendez-vous, format HH:MM en 24h' },
          subject: {
            type: 'string',
            description: 'Résumé court du RDV, ex: "Visite appartement 2 chambres Cotonou"',
          },
        },
        required: ['date', 'time', 'subject'],
      },
    },
  },
];

async function runToolCall(toolCall) {
  if (toolCall.function.name !== 'schedule_appointment') {
    return 'Outil inconnu, non exécuté.';
  }

  let args = {};
  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch (err) {
    return "Arguments invalides reçus pour la prise de rendez-vous, RDV non enregistré.";
  }

  try {
    await createAppointment({
      summary: `${args.subject || 'RDV immobilier'} — ${args.prospect_name || 'Prospect WhatsApp'}`,
      description: 'Rendez-vous pris automatiquement via l\'agent WhatsApp.',
      date: args.date,
      time: args.time,
    });
    return `Rendez-vous ajouté avec succès à l'agenda pour le ${args.date} à ${args.time}.`;
  } catch (err) {
    console.error('schedule_appointment error:', err.message);
    return "Échec de l'ajout à l'agenda (problème technique côté agence) — informe poliment le prospect qu'un conseiller confirmera le créneau très vite.";
  }
}

/**
 * Génère une réponse via Groq. Peut déclencher la création d'un
 * rendez-vous dans Google Calendar via function calling si le modèle
 * juge que le prospect a confirmé une date/heure précise.
 * @param {string} userMessage - message texte du prospect
 * @param {Array<{role: string, content: string}>} history - historique court (optionnel)
 */
async function generateReply(userMessage, history = []) {
  const groq = getClient();

  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    ...history,
    { role: 'user', content: userMessage },
  ];

  let completion = await groq.chat.completions.create({
    model: config.groq.model,
    messages,
    temperature: 0.7,
    max_tokens: 400,
    tools: TOOLS,
    tool_choice: 'auto',
  });

  let choice = completion.choices?.[0];
  const toolCalls = choice?.message?.tool_calls;

  if (toolCalls && toolCalls.length > 0) {
    messages.push(choice.message);

    for (const toolCall of toolCalls) {
      const resultText = await runToolCall(toolCall);
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: resultText,
      });
    }

    // Deuxième appel : le modèle formule la réponse finale au prospect
    // en tenant compte du résultat de la prise de rendez-vous.
    completion = await groq.chat.completions.create({
      model: config.groq.model,
      messages,
      temperature: 0.7,
      max_tokens: 400,
    });
    choice = completion.choices?.[0];
  }

  const reply = choice?.message?.content;
  if (!reply) {
    throw new Error('Réponse Groq vide ou inattendue');
  }
  return reply.trim();
}

module.exports = { generateReply };
