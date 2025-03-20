const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { validateData, fieldFilter } = require("../utils/validation");
const User = require("../models/user");

const authRouter = express.Router();
authRouter.post("/register", async (req, res) => {
  try {
    //Validate the data
    validateData(req.body);

    // Encrypt the password
    const { password } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);

    const user = new User({ ...req.body, password: passwordHash });

    await user.save();
    // console.log(user);
    res.json({ data: fieldFilter(user) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      throw new Error("Invalid credentials");
    }
    const isPasswordValid = await user.validatePassword(password);

    if (isPasswordValid) {
      const token = await user.getJWT();

      res.cookie("token", token,
        {
          expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        }
      );

      res.json({ data: fieldFilter(user), token });
    } else {
      throw new Error("Invalid credentials");
    }
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

authRouter.post("/logout", async (req, res) => {
  res.cookie("token", null, {
    expires: new Date(Date.now()),
  });
  res.end();
  // res.json({ success: true });
});

module.exports = authRouter;
