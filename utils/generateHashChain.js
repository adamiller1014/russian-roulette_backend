// generateHashChain.js
const crypto = require('crypto');
const fs = require('fs');

function generateHashChain(hashChainLength, saveInterval) {
  const hashChain = [];
  let currentHash = crypto.randomBytes(32).toString('hex');

  for (let i = 0; i < hashChainLength; i++) {
    hashChain.unshift(currentHash);
    if ((i + 1) % saveInterval === 0 || i === hashChainLength - 1) {
      saveHashChain(hashChain, i === hashChainLength - 1);
    }
    currentHash = crypto.createHash('sha256').update(currentHash).digest('hex');
  }

  return hashChain; // Return the chain instead of logging for API use
}

function saveHashChain(hashChain, isFinalSave) {
  fs.writeFileSync('hashChain.json', JSON.stringify(hashChain, null, 2));
  if (isFinalSave) {
    fs.writeFileSync('finalHash.json', JSON.stringify({ finalHash: hashChain[0] }, null, 2));
  }
}

module.exports = { generateHashChain, saveHashChain };
