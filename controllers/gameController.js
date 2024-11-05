const crypto = require('crypto');
const fs = require('fs');
const {
  generateHashChain,
  saveHashChain,
} = require("../utils/generateHashChain");
const verifyHashChain = require("../utils/verifyHashChain");

// Load or generate hash chain
let hashChain;
try {
  hashChain = JSON.parse(fs.readFileSync("hashChain.json", "utf-8"));
} catch (error) {
  hashChain = generateHashChain(100, 10);
  saveHashChain(hashChain, true);
}
let hashIndex = 0;

// Automated hash generation
function automatedHashGeneration() {
  const hashChainLimit = 100; // Set the limit for the hash chain length
  if (hashChain.length < hashChainLimit) {
    const newHashes = generateHashChain(100, 10);
    hashChain = [...hashChain, ...newHashes];
    saveHashChain(hashChain, false);
    console.log(`Generated and saved ${newHashes.length} new hashes.`);
  }
}

// Set an interval for hash generation (e.g., every 5 minutes)
setInterval(automatedHashGeneration, 5 * 60 * 1000); // Adjust time as needed

// Utility function for generating normalized random numbers from hashes
function getRandomFloatFromHash() {
  const hash = hashChain[hashIndex];
  hashIndex = (hashIndex + 1) % hashChain.length;
  return parseInt(hash, 16) / 0xffffffffffffffff;
}

// Statistics and logging setup
let totalRoundsPlayed = 0;
let totalPayout = 0;
let totalBetAmount = 0;
let baseWins = 0;
let bonusWins = 0;

// Main game logic with stats tracking
function playGameRound(betAmount, targetMultiplier) {
  const roll = getRandomFloatFromHash();
  let outcome = "EMPTY";
  let payout = 0;
  let bonusRounds = 0;

  if (roll < 0.3) {
    outcome = "FIRE"; 
    payout = betAmount * targetMultiplier;
    baseWins++;
  } else if (roll >= 0.3 && roll < 0.35) {
    outcome = "BONUS"; 
    payout = betAmount * targetMultiplier * 2;
    bonusRounds = 10;
    bonusWins++;
  }

  return { outcome, payout, bonusRounds };
}

function calculateBonusRounds(betAmount, targetMultiplier, rounds) {
  let totalBonusWin = 0;
  for (let i = 0; i < rounds; i++) {
    const roll = getRandomFloatFromHash();
    if (roll < 0.1) { 
      totalBonusWin += betAmount * targetMultiplier * 2;
    }
  }
  return totalBonusWin;
}

async function playGame(req, res) {
  try {
    const { betAmount, targetMultiplier } = req.body;

    if (typeof betAmount !== 'number' || betAmount <= 0) {
      return res.status(400).json({ error: "Invalid bet amount." });
    }
    if (typeof targetMultiplier !== 'number' || targetMultiplier <= 0) {
      return res.status(400).json({ error: "Invalid target multiplier." });
    }

    // Track statistics
    totalBetAmount += betAmount;
    totalRoundsPlayed++;

    // Base game round
    const baseGame = playGameRound(betAmount, targetMultiplier);
    let roundPayout = baseGame.payout;
    let outcome = baseGame.outcome;
    let bonusRounds = baseGame.bonusRounds;

    // Bonus rounds calculation if applicable
    if (bonusRounds > 0) {
      const bonusPayout = calculateBonusRounds(betAmount, targetMultiplier, bonusRounds);
      roundPayout += bonusPayout;
    }

    totalPayout += roundPayout;

    // Calculate RTP and win rates
    const baseWinRate = (baseWins / totalRoundsPlayed) * 100;
    const bonusWinRate = (bonusWins / totalRoundsPlayed) * 100;
    const totalRTP = (totalPayout / totalBetAmount) * 100;

    // Result with stats
    const result = {
      outcome,
      payout: roundPayout,
      playerBalance: roundPayout - betAmount,
      statistics: {
        totalRoundsPlayed,
        baseWinRate,
        bonusWinRate,
        totalRTP,
      },
      hashUsed: hashChain[hashIndex - 1],
      nextHash: hashChain[hashIndex],
      verification: verifyHashChain(hashChain), 
    };

    res.status(200).json(result);
  } catch (error) {
    console.error("Error in playGame:", error);
    res.status(500).json({ error: "An error occurred while playing the game." });
  }
}

module.exports = { playGame };
