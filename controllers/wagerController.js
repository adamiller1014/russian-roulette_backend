const Wager = require("../models/Wager");
const UserBalances = require("../models/UserBalances");

// Get all wagers for a user
exports.getUserWagers = async (req, res) => {
  try {
    const wagers = await Wager.find({ user_id: req.user.id }).sort({
      wager_time: -1,
    });
    res.json(wagers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create a new wager
exports.createWager = async (req, res) => {
  const { game_name, game_id, wager_amount, target, currency } = req.body;

  try {
    const userBalances = await UserBalances.findOne({ user_id: req.user.id });
    if (!userBalances)
      return res.status(404).json({ error: "User balances not found." });

    // Check if user has enough balance for the wager
    const balance =
      currency === "USD"
        ? userBalances.cash_balance
        : userBalances.crypto_balance;
    if (balance < wager_amount) {
      return res.status(400).json({ error: "Insufficient balance." });
    }

    // Deduct the wager amount
    const balanceAfter = balance - wager_amount;
    if (currency === "USD") userBalances.cash_balance = balanceAfter;
    else userBalances.crypto_balance = balanceAfter;

    // Simulate game outcome (Random Win/Loss)
    const wonAmount = Math.random() < 0.5 ? wager_amount * 2 : 0; // 50% win chance
    const rtp = wonAmount > 0 ? 100 : 0; // Return-to-player percentage
    const siteProfit = wonAmount === 0 ? wager_amount : 0;

    // Update balance with winnings if applicable
    if (wonAmount > 0) {
      if (currency === "USD") userBalances.cash_balance += wonAmount;
      else userBalances.crypto_balance += wonAmount;
    }

    await userBalances.save();

    // Create and save the wager record
    const wager = new Wager({
      user_id: req.user.id,
      game_name,
      game_id,
      balance_before: balance,
      wager_amount,
      target,
      won_amount: wonAmount,
      currency,
      rtp,
      site_profit: siteProfit,
      wager_time: new Date(),
    });

    await wager.save();
    res.status(201).json({ message: "Wager placed successfully.", wager });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all wagers (Admin Access)
exports.getAllWagers = async (req, res) => {
  try {
    const wagers = await Wager.find().sort({ wager_time: -1 });
    res.json(wagers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
