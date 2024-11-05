const User = require('../models/User');
const Player = require('../models/Player');
const UserBalances = require('../models/UserBalances');
const Wager = require('../models/Wager');
const crypto = require('crypto');

class GameController {
  static async playGame(userId, betAmount, gameType = 'RR (Solo)') {
    try {
      // Get user and balance information
      const userBalance = await UserBalances.findOne({ user_id: userId });
      const player = await Player.findOne({ username: userId });

      if (!userBalance || !player) {
        throw new Error('User not found');
      }

      // Verify sufficient balance
      if (parseFloat(userBalance.cash_balance.toString()) < betAmount) {
        throw new Error('Insufficient balance');
      }

      // Generate unique seeds for this game instance
      const serverSeed = crypto.randomBytes(32).toString('hex');
      const clientSeed = crypto.randomBytes(32).toString('hex');
      const nonce = Math.floor(Math.random() * 1000000);
      
      // Create wager record
      const wager = new Wager({
        user_id: userId,
        game_name: gameType,
        game_id: crypto.randomBytes(16).toString('hex'),
        balance_before: userBalance.cash_balance,
        wager_amount: betAmount,
        target: 1, // Default target multiplier
        currency: 'USD' // Or dynamic based on user preference
      });

      // Run game simulation
      const gameResult = await this.runGameSimulation({
        serverSeed,
        clientSeed,
        nonce,
        betAmount,
        totalRounds: 1
      });

      // Calculate total win amount
      const totalWinAmount = gameResult.totalBaseWinAmount + gameResult.totalBonusWinAmount;

      // Update wager record
      wager.won_amount = totalWinAmount;
      wager.rtp = totalWinAmount > 0 ? (totalWinAmount / betAmount) * 100 : 0;
      wager.site_profit = betAmount - totalWinAmount;
      await wager.save();

      // Update player statistics and game history
      await this.updatePlayerStats(player, gameResult, {
        serverSeed,
        clientSeed,
        nonce,
        betAmount,
        winAmount: totalWinAmount
      });

      // Update user balance
      await this.updateUserBalance(userBalance, gameResult);

      return {
        success: true,
        gameResult,
        serverSeed,
        clientSeed,
        nonce,
        wager: {
          id: wager._id,
          betAmount,
          winAmount: totalWinAmount,
          rtp: wager.rtp
        }
      };
    } catch (error) {
      throw error;
    }
  }

  static async runGameSimulation({ serverSeed, clientSeed, nonce, betAmount, totalRounds }) {
    // Import your existing game simulation logic
    const {
      generateFloats,
      GAME_CONSTANTS,
      bonusMultipliers,
      baseAmmoCounts,
      bonusAmmoCounts

    } = require('../utils/gamestimulation');

    let cursor = 0;
    
    // Initialize result variables
    let playerBalance = betAmount;
    let totalBaseWinAmount = 0;
    let totalBonusWinAmount = 0;
    let totalBaseWins = 0;
    let totalBonusWins = 0;
    let bonusesTriggered = 0;
    let bonusRetriggersCount = 0;

    // Generate game result for base game
    const baseMultiplier = Math.floor(
      Math.max(1, 0xffffffff / (generateFloats({ serverSeed, clientSeed, nonce, cursor }) * 0xffffffff + 1)) * 100
    ) / 100;
    cursor += 4;

    const firstRoll = Math.floor(generateFloats({ serverSeed, clientSeed, nonce, cursor }) * 63);
    cursor += 4;

    const winResultRoll = Math.floor(generateFloats({ serverSeed, clientSeed, nonce, cursor }) * 6);
    cursor += 4;

    const baseAmmoCount = baseAmmoCounts[firstRoll];

    // Check for base game win
    if (baseMultiplier >= GAME_CONSTANTS.BASE_WIN_MULTIPLIER_TARGET && winResultRoll < baseAmmoCount) {
      const winAmount = betAmount * GAME_CONSTANTS.BASE_WIN_MULTIPLIER_TARGET;
      playerBalance += winAmount;
      totalBaseWins++;
      totalBaseWinAmount += winAmount;
    }

    // Check for bonus trigger
    if (Math.floor(generateFloats({ serverSeed, clientSeed, nonce, cursor }) * 200) === 0) {
      bonusesTriggered++;
      let bonusRoundsRemaining = GAME_CONSTANTS.INITIAL_BONUS_ROUNDS;
      cursor += 4;

      // Bonus rounds loop
      while (bonusRoundsRemaining > 0) {
        const bonusRoundMultiplier = Math.floor(
          Math.max(1, 0xffffffff / (generateFloats({ serverSeed, clientSeed, nonce, cursor }) * 0xffffffff + 1)) * 100
        ) / 100;
        cursor += 4;

        const bonusWinResultRoll = Math.floor(generateFloats({ serverSeed, clientSeed, nonce, cursor }) * 6);
        cursor += 4;

        const bonusAmmoCount = bonusAmmoCounts[Math.floor(generateFloats({ serverSeed, clientSeed, nonce, cursor }) * 186)];
        cursor += 4;

        // Check for bonus win
        if (bonusRoundMultiplier >= GAME_CONSTANTS.BONUS_MULTIPLIER_TARGET && 
            bonusWinResultRoll < baseAmmoCount + bonusAmmoCount) {
          const winAmount = betAmount * GAME_CONSTANTS.BONUS_MULTIPLIER_TARGET;
          playerBalance += winAmount;
          totalBonusWins++;
          totalBonusWinAmount += winAmount;
        }

        // Check for bonus retrigger
        if (Math.floor(generateFloats({ serverSeed, clientSeed, nonce, cursor }) * 200) === 0) {
          bonusRetriggersCount++;
          bonusRoundsRemaining += GAME_CONSTANTS.BONUS_RETRIGGER_ROUNDS;
        }
        cursor += 4;

        bonusRoundsRemaining--;
      }
    }

    const finalBalance = playerBalance;

    return {
      playerBalance: finalBalance,
      totalBaseWinAmount,
      totalBonusWinAmount,
      totalBaseWins,
      totalBonusWins,
      totalBetAmount: betAmount,
      bonusesTriggered,
      bonusRetriggersCount
    };
  }

  static async updatePlayerStats(player, gameResult, gameDetails) {
    // Update game statistics
    player.totalBaseWins += gameResult.totalBaseWins;
    player.totalBonusWins += gameResult.totalBonusWins;
    player.totalBaseWinAmount += gameResult.totalBaseWinAmount;
    player.totalBonusWinAmount += gameResult.totalBonusWinAmount;
    player.totalBetAmount += gameResult.totalBetAmount;
    player.bonusesTriggered += gameResult.bonusesTriggered;
    player.bonusRetriggersCount += gameResult.bonusRetriggersCount;
    
    // Add to game history
    player.gameHistory.push({
      serverSeed: gameDetails.serverSeed,
      clientSeed: gameDetails.clientSeed,
      nonce: gameDetails.nonce,
      betAmount: gameDetails.betAmount,
      winAmount: gameDetails.winAmount,
      timestamp: new Date()
    });
    
    await player.save();
  }

  static async updateUserBalance(userBalance, gameResult) {
    const netWin = gameResult.totalBaseWinAmount + gameResult.totalBonusWinAmount - gameResult.totalBetAmount;
    
    // Convert Decimal128 to float for calculation
    const currentBalance = parseFloat(userBalance.cash_balance.toString());
    userBalance.cash_balance = currentBalance + netWin;
    
    await userBalance.save();
  }
}

module.exports = GameController;
