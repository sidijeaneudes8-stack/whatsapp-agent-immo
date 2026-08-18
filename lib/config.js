// lib/config.js
// Centralise la lecture des variables d'environnement et la normalisation
// du numéro whitelisté. Ne jette pas d'erreur au chargement du module :
// les erreurs de config sont vérifiées explicitement dans le handler,
// pour ne jamais faire planter le webhook silencieusement.

function normalizeDigits(value) {
  if (!value) return '';
  // Enlève tout ce qui n'est pas un chiffre : "+229 01 44 22 02 59",
  // "2290144220259@c.us", "229-01-44-22-02-59" -> "2290144220259"
  return String(value).replace(/\D/g, '');
}

const config = {
  greenApi: {
    idInstance: process.env.GREEN_API_ID_INSTANCE || '',
    apiTokenInstance: process.env.GREEN_API_TOKEN_INSTANCE || '',
    // Certains comptes Green API utilisent un domaine dédié (media/apiUrl).
    // Par défaut on utilise le domaine standard.
    baseUrl: process.env.GREEN_API_BASE_URL || 'https://api.green-api.com',
    // Optionnel : secret partagé pour valider que l'appel webhook vient bien
    // de Green API (si configuré côté Green API "Webhook URL Token").
    webhookToken: process.env.GREEN_API_WEBHOOK_TOKEN || '',
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  },
  agency: {
    name: process.env.AGENCY_NAME || 'Agence Bénin Immo',
    agentFirstName: process.env.AGENT_FIRST_NAME || 'Awa',
  },
  // Numéro autorisé, stocké normalisé (chiffres uniquement, sans "+").
  allowedNumberDigits: normalizeDigits(process.env.ALLOWED_WHATSAPP_NUMBER || '+2290144220259'),
};

module.exports = { config, normalizeDigits };
