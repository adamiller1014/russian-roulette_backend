const mongoose = require("mongoose");
const { Schema } = mongoose;

const wagerSchema = new Schema({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  game_name: {
    type: String,
    enum: ["RR (Solo)", "RR (Group)", "Other"],
    required: true,
  },
  game_id: {
    type: String, // Unique identifier for the game instance
    required: true,
  },
  balance_before: {
    type: Schema.Types.Decimal128,
    required: true,
  },
  wager_amount: {
    type: Schema.Types.Decimal128,
    required: true,
  },
  target: {
    type: Schema.Types.Decimal128, // A value to determine win conditions
    required: true,
  },
  won_amount: {
    type: Schema.Types.Decimal128,
    default: 0,
  },
  currency: {
    type: String,
    enum: ["USD", "BTC", "ETH"],
    required: true,
  },
  rtp: {
    type: Schema.Types.Decimal128, // Return-to-Player Percentage
    default: 0,
  },
  site_profit: {
    type: Schema.Types.Decimal128, // Profit earned by the platform
    default: 0,
  },
  wager_time: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Wager", wagerSchema);
