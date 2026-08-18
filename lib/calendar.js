// lib/calendar.js
// Crée des événements dans Google Calendar via OAuth classique (client
// ID + secret + refresh token), PAS via un compte de service. Ce choix
// évite les règles d'organisation Google Cloud qui bloquent la création
// de clés de compte de service sur les projets récents — voir README.md
// pour la procédure de récupération du refresh token.

const { OAuth2Client } = require('google-auth-library');
const fetch = require('node-fetch');
const { config } = require('./config');

let oauthClient = null;

function getOAuthClient() {
  if (!oauthClient) {
    const { oauthClientId, oauthClientSecret, oauthRefreshToken } = config.googleCalendar;
    if (!oauthClientId || !oauthClientSecret || !oauthRefreshToken) {
      throw new Error(
        'Config Google Calendar OAuth manquante (GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN)'
      );
    }
    oauthClient = new OAuth2Client(oauthClientId, oauthClientSecret);
    oauthClient.setCredentials({ refresh_token: oauthRefreshToken });
  }
  return oauthClient;
}

/**
 * Additionne 1h à "HH:MM" pour obtenir l'heure de fin par défaut.
 * Volontairement simple pour la démo (pas de gestion du changement de jour).
 */
function addOneHour(time) {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10));
  const endH = (h + 1) % 24;
  return `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Crée un événement de rendez-vous dans le calendrier configuré.
 * @param {{summary: string, description?: string, date: string, time: string}} params
 *   date au format YYYY-MM-DD, time au format HH:MM (24h)
 */
async function createAppointment({ summary, description, date, time }) {
  const client = getOAuthClient();
  const { token: accessToken } = await client.getAccessToken();

  if (!accessToken) {
    throw new Error("Impossible d'obtenir un access token Google (refresh token invalide ou expiré ?)");
  }

  const calendarId = encodeURIComponent(config.googleCalendar.calendarId);
  const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;

  const endTime = addOneHour(time);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary,
      description: description || '',
      start: { dateTime: `${date}T${time}:00`, timeZone: config.googleCalendar.timeZone },
      end: { dateTime: `${date}T${endTime}:00`, timeZone: config.googleCalendar.timeZone },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
          { method: 'popup', minutes: 24 * 60 },
        ],
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Échec création événement Calendar (${res.status}): ${text}`);
  }

  return res.json();
}

module.exports = { createAppointment };
