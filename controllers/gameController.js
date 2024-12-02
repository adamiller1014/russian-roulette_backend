const crypto = require("crypto");
const mongoose = require("mongoose");
const Player = require("../models/Player");
const UserBalances = require("../models/UserBalances");
const Wager = require("../models/Wager");
const logger = require("../utils/logger");
const { getConfigValue } = require("../utils/configuration");
const { generateSeed } = require("../utils/crypto");
const {
  generateFloats,
  GAME_CONSTANTS,
  baseAmmoCounts,
  bonusAmmoCounts,
} = require("../utils/gamestimulation");
const GroupGame = require("../models/GroupGame");

class GameController {
  // Main function to play a game, determines if it's a solo or group game
  static async playGame(userId, betAmount, gameType = "RR (Solo)") {
    try {
      if (gameType === "RR (Solo)") {
        return await this.playSoloGame(userId, betAmount);
      } else if (gameType === "RR (Group)") {
        return await this.playGroupGame(userId, betAmount);
      }
      throw new Error("Invalid game type");
    } catch (error) {
      logger.error(`Error in playGame for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  // Function to handle solo game logic
  static async playSoloGame(userId, betAmount) {
    try {
      logger.info(`Starting game for user ${userId} with bet amount ${betAmount}`);

      // Retrieve user balance and player information
      const userBalance = await UserBalances.findOne({ user_id: userId });
      const player = await Player.findOne({ username: userId });

      // Check if user and player exist and have sufficient balance
      if (!userBalance || !player) {
        throw new Error("User or player not found");
      }
      if (parseFloat(userBalance.cash_balance.toString()) < betAmount) {
        throw new Error("Insufficient balance");
      }

      // Deduct bet amount from user balance
      userBalance.cash_balance = new mongoose.Types.Decimal128(
        (parseFloat(userBalance.cash_balance.toString()) - betAmount).toString()
      );
      await userBalance.save();

      // Generate seeds for game simulation
      const { serverSeed, clientSeed, nonce } = this.generateGameSeeds();

      // Create a new wager record
      const wager = new Wager({
        user_id: userId,
        game_name: "RR (Solo)",
        game_id: crypto.randomBytes(16).toString("hex"),
        balance_before: userBalance.cash_balance,
        wager_amount: betAmount,
        target: (await getConfigValue("default_target")) || 1,
        currency: "USD",
      });

      // Run game simulation
      const gameResult = await this.runGameSimulation({
        serverSeed,
        clientSeed,
        nonce,
        betAmount,
        totalRounds: 1,
      });

      // Calculate total win amount
      const totalWinAmount = gameResult.totalBaseWinAmount + gameResult.totalBonusWinAmount;

      // Update user balance with win amount
      await this.updateUserBalance(userBalance, gameResult);

      // Update player statistics and game history
      await this.updatePlayerStats(player, gameResult, {
        serverSeed,
        clientSeed,
        nonce,
        betAmount,
        winAmount: totalWinAmount,
      });

      // Save wager result
      wager.won_amount = totalWinAmount;
      wager.rtp = totalWinAmount > 0 ? (totalWinAmount / betAmount) * 100 : 0;
      wager.site_profit = betAmount - totalWinAmount;
      await wager.save();

      logger.info(`Game result for user ${userId}: ${JSON.stringify(gameResult)}`);

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
          rtp: wager.rtp,
        },
      };
    } catch (error) {
      logger.error(`Error in playSoloGame for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  // Function to handle group game logic
  static async playGroupGame(userId, betAmount) {
    try {
      const userBalance = await UserBalances.findOne({ user_id: userId });
      const player = await Player.findOne({ username: userId });

      // Check if user and player exist and have sufficient balance
      if (!userBalance || !player) {
        throw new Error("User or player not found");
      }
      if (parseFloat(userBalance.cash_balance.toString()) < betAmount) {
        throw new Error("Insufficient balance");
      }

      // Deduct bet amount from user balance
      userBalance.cash_balance = new mongoose.Types.Decimal128(
        (parseFloat(userBalance.cash_balance.toString()) - betAmount).toString()
      );
      await userBalance.save();

      // Find or create an active group game
      let groupGame = await GroupGame.findOne({
        status: 'pending',
        end_time: { $gt: new Date() }
      });

      if (!groupGame) {
        groupGame = new GroupGame({
          game_id: crypto.randomBytes(16).toString("hex"),
          start_time: new Date(),
          end_time: new Date(Date.now() + 30000), // 30 second countdown
          status: 'pending'
        });
        await groupGame.save();
      }

      // Create wager for this player
      const wager = new Wager({
        user_id: userId,
        game_name: "RR (Group)",
        game_id: groupGame.game_id,
        balance_before: userBalance.cash_balance,
        wager_amount: betAmount,
        target: (await getConfigValue("default_target")) || 1,
        currency: "USD",
        status: 'pending'
      });
      await wager.save();

      return {
        success: true,
        gameId: groupGame.game_id,
        endTime: groupGame.end_time,
        wager: {
          id: wager._id,
          betAmount,
        }
      };
    } catch (error) {
      logger.error(`Error in playGroupGame for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  // Function to generate seeds for game simulation
  static generateGameSeeds() {
    const serverSeed = generateSeed();
    const clientSeed = generateSeed();
    const nonce = Math.floor(Math.random() * 1000000);
    return { serverSeed, clientSeed, nonce };
  }

  // Function to run the game simulation
  static async runGameSimulation({
    serverSeed,
    clientSeed,
    nonce,
    betAmount,
    totalRounds,
  }) {
    let cursor = 0;
    let playerBalance = betAmount;
    let totalBaseWinAmount = 0;
    let totalBonusWinAmount = 0;
    let totalBaseWins = 0;
    let totalBonusWins = 0;
    let bonusesTriggered = 0;
    let bonusRetriggersCount = 0;

    // Game simulation logic
    for (let i = 0; i < totalRounds; i++) {
      nonce++;
      cursor = 0;

      playerBalance -= betAmount;
      totalBaseRounds++;

      // Generate random numbers for game logic
      const firstRoll = Math.floor(
        generateFloats({ serverSeed, clientSeed, nonce, cursor }) * 63
      );
      cursor += 4;

      const baseAmmoCount = baseAmmoCounts[firstRoll];

      const winResultRoll = Math.floor(
        generateFloats({ serverSeed, clientSeed, nonce, cursor }) * 6
      );
      cursor += 4;

      const baseMultiplier = GAME_CONSTANTS.BASE_WIN_MULTIPLIER_TARGET;

      // Determine win result
      if (
        baseMultiplier >= GAME_CONSTANTS.BASE_WIN_MULTIPLIER_TARGET &&
        winResultRoll < baseAmmoCount
      ) {
        const winAmount = betAmount * GAME_CONSTANTS.BASE_WIN_MULTIPLIER_TARGET;
        playerBalance += winAmount;
        totalBaseWins++;
        totalBaseWinAmount += winAmount;
      }

      // Check for bonus trigger
      if (Math.floor(generateRandomFloat() * 200) === 0) {
        bonusesTriggered++;
        let bonusRoundsRemaining = GAME_CONSTANTS.INITIAL_BONUS_ROUNDS;
        cursor += 4;

        // Run bonus rounds
        while (bonusRoundsRemaining > 0) {
          const bonusRoundMultiplier =
            Math.floor(
              Math.max(
                1,
                0xffffffff /
                  (generateFloats({ serverSeed, clientSeed, nonce, cursor }) *
                    0xffffffff +
                    1)
              ) * 100
            ) / 100;
          cursor += 4;

          const bonusWinResultRoll = Math.floor(
            generateFloats({ serverSeed, clientSeed, nonce, cursor }) * 6
          );
          cursor += 4;

          if (
            bonusRoundMultiplier >= GAME_CONSTANTS.BONUS_MULTIPLIER_TARGET &&
            bonusWinResultRoll < baseAmmoCount + bonusAmmoCount
          ) {
            const winAmount = betAmount * GAME_CONSTANTS.BONUS_MULTIPLIER_TARGET;
            playerBalance += winAmount;
            totalBonusWins++;
            totalBonusWinAmount += winAmount;
          }

          // Check for bonus retrigger
          if (Math.floor(generateRandomFloat() * 200) === 0) {
            bonusRetriggersCount++;
            bonusRoundsRemaining += GAME_CONSTANTS.BONUS_RETRIGGER_ROUNDS;
          }
          bonusRoundsRemaining--;
        }
      }
    }

    const finalBalance = playerBalance;

    // Calculate accurate RTP for the game session
    const totalWagered = betAmount * totalRounds;
    const totalWon = totalBaseWinAmount + totalBonusWinAmount;
    const sessionRTP = (totalWon / totalWagered) * 100;

    return {
      playerBalance: finalBalance,
      totalBaseWinAmount,
      totalBonusWinAmount,
      totalBaseWins,
      totalBonusWins,
      totalBetAmount: totalWagered,
      bonusesTriggered,
      bonusRetriggersCount,
      rtp: sessionRTP
    };
  }

  // Function to update user balance after game result
  static async updateUserBalance(userBalance, gameResult) {
    const netWin =
      gameResult.totalBaseWinAmount +
      gameResult.totalBonusWinAmount -
      gameResult.totalBetAmount;

    const currentBalance = parseFloat(userBalance.cash_balance.toString());
    userBalance.cash_balance = currentBalance + netWin;
    await userBalance.save();
  }

  // Function to update player statistics and game history
  static async updatePlayerStats(player, gameResult, gameDetails) {
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
      timestamp: new Date(),
    });

    await player.save();
  }
}

module.exports = GameController;
