const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
// Static key derived from a salt. Consistent across restarts so stored keys can always be decrypted.
const SECRET_KEY = crypto.scryptSync('clinic-operating-system-secure-salt-2026', 'salt', 32);
const IV = Buffer.alloc(16, 0); // Consistent initialization vector for settings database storage

function encrypt(text) {
  if (!text) return '';
  try {
    const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, IV);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.finish('hex');
    return encrypted;
  } catch (err) {
    console.error('Encryption failed:', err);
    return text;
  }
}

function decrypt(text) {
  if (!text) return '';
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, IV);
    let decrypted = decipher.update(text, 'hex', 'utf8');
    decrypted += decipher.finish('utf8');
    return decrypted;
  } catch (err) {
    // Return the original text if it was not encrypted (e.g. plaintext migration or clean settings)
    return text;
  }
}

module.exports = {
  encrypt,
  decrypt
};
