// api/webhook.js
// Point d'entrée Vercel (serverless function). Reçoit les webhooks Green API.
//
// Flux :
//   1. Valide la méthode HTTP et (optionnellement) un token de sécurité.
//   2. Filtre strictement : ignore silencieusement tout expéditeur
//      différent du numéro whitelisté (renvoie 200 sans rien faire d'autre).
//   3. Extrait le texte du message.
//   4. Appelle Groq pour générer une réponse.
//   5. Envoie la réponse via Green API.
//
// Important : on répond TOUJOURS 200 à Green API rapidement (même en cas
// d'erreur interne) pour éviter les retries en boucle depuis leur côté,
// SAUF si l'expéditeur n'est pas autorisé, où on répond 200 sans action.

const { config } = require('../lib/config');
const { isFromAllowedNumber, extractSenderDigits } = require('../lib/whitelist');
const { generateReply } = require('../lib/groq');
const { sendMessage } = require('../lib/whatsapp');
const { getHistory, saveHistory } = require('../lib/history');

function extractTextMessage(body) {
  const messageData = body && body.messageData ? body.messageData : {};
  const typeMessage = messageData.typeMessage;

  if (typeMessage === 'textMessage' && messageData.textMessageData) {
    return messageData.textMessageData.textMessage || null;
  }
  if (typeMessage === 'extendedTextMessage' && messageData.extendedTextMessageData) {
    return messageData.extendedTextMessageData.text || null;
  }
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Validation optionnelle d'un token partagé si configuré côté Green API
  // (header custom que tu peux définir toi-même en config Green API).
  if (config.greenApi.webhookToken) {
    const receivedToken = req.headers['x-webhook-token'];
    if (receivedToken !== config.greenApi.webhookToken) {
      // On ne révèle rien : 200 vide, comme pour un numéro non autorisé.
      res.status(200).json({ ok: true });
      return;
    }
  }

  const body = req.body || {};

  // On ne traite que les messages entrants (Green API envoie aussi des
  // notifications de statut d'envoi, etc., qu'on ignore).
  if (body.typeWebhook !== 'incomingMessageReceived') {
    res.status(200).json({ ok: true });
    return;
  }

  // --- FILTRAGE STRICT DU NUMÉRO ---
  if (!isFromAllowedNumber(body)) {
    // Silence total : pas de message, pas d'erreur, juste un 200.
    res.status(200).json({ ok: true });
    return;
  }

  try {
    const senderDigits = extractSenderDigits(body);
    const chatId = body.senderData.chatId || `${senderDigits}@c.us`;
    const text = extractTextMessage(body);

    if (!text) {
      // Message non textuel (image, audio, etc.) : réponse courte et humaine.
      await sendMessage(
        chatId,
        "Merci pour votre message ! Pourriez-vous me l'écrire en texte ? Je pourrai ainsi mieux vous orienter 🙂"
      );
      res.status(200).json({ ok: true });
      return;
    }

    const history = await getHistory(senderDigits);
    const reply = await generateReply(text, history);

    await sendMessage(chatId, reply);

    const updatedHistory = [
      ...history,
      { role: 'user', content: text },
      { role: 'assistant', content: reply },
    ];
    await saveHistory(senderDigits, updatedHistory);

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('webhook error:', err);
    // On répond quand même 200 pour éviter les retries Green API en boucle,
    // l'erreur est loguée côté Vercel pour le debug.
    res.status(200).json({ ok: true });
  }
};
