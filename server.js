const express = require("express");
const passport = require("./config/passport");
const connectDB = require("./config/db");
const { PORT } = require("./config/env");
// const authRoutes = require("./routes/auth");
// const userRoutes = require("./routes/user");

const app = express();

// Middleware
app.use(express.json());
app.use(passport.initialize());

// Routes
// app.use("/auth", authRoutes);
// app.use("/user", userRoutes);

// Connect to MongoDB
connectDB();

// Start the server
const port = PORT || 5000;
app.listen(port, () =>
  console.log(`Server running on http://localhost:${port}`)
);
