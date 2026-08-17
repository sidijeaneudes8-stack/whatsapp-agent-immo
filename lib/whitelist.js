// lib/whitelist.js
// Filtrage strict : extrait l'expéditeur du payload Green API et vérifie
// qu'il correspond EXACTEMENT au numéro autorisé. Toute incertitude
// (champ manquant, format inattendu) => refus, jamais un "peut-être oui".

const { config, normalizeDigits } = require('./config');

/**
 * Extrait le numéro de l'expéditeur depuis un payload webhook Green API.
 * Green API envoie généralement senderData.sender ou senderData.chatId
 * sous la forme "2290144220259@c.us".
 */
function extractSenderDigits(body) {
  const senderData = body && body.senderData ? body.senderData : {};
  const candidates = [senderData.sender, senderData.chatId, senderData.chatName];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      const digits = normalizeDigits(candidate.split('@')[0]);
      if (digits) return digits;
    }
  }
  return null;
}

/**
 * Retourne true UNIQUEMENT si le message provient du numéro whitelisté.
 * Comparaison stricte sur les chiffres normalisés (égalité exacte).
 */
function isFromAllowedNumber(body) {
  const senderDigits = extractSenderDigits(body);
  if (!senderDigits || !config.allowedNumberDigits) return false;
  return senderDigits === config.allowedNumberDigits;
}

module.exports = { isFromAllowedNumber, extractSenderDigits };
