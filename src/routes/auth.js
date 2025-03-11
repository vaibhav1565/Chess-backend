const express = require("express");
const authRouter = express.Router();

const { validatePassword } = require("../utils/validation");
const User = require("../models/user");
const bcrypt = require("bcrypt");

const USER_SAFE_DATA = "_id username email";
authRouter.post("/register", async (req, res) => {
  try {
    const { password } = req.body;
    //Validate the password
    validatePassword(password);

    // Encrypt the password
    const passwordHash = await bcrypt.hash(password, 10);

    const u = { ...req.body, password: passwordHash };
    const user = new User(u);

    await user.save();
    // console.log(u);
    res.send("User Added successfully!");
  } catch (e) {
    res.status(400).send("ERROR : " + e.message);
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
      const selectedFields = {};
      USER_SAFE_DATA.split(" ").forEach((field) => {
          selectedFields[field] = user[field];
      });
      res.json({message: "Login successful", data: selectedFields});
    } else {
      throw new Error("Invalid credentials");
    }
  } catch (e) {
    res.status(400).send("ERROR : " + e.message);
  }
});

authRouter.post("/logout", async (req, res) => {
  res.cookie("token", null, {
    expires: new Date(Date.now()),
  });
  res.send("Logout successful");
});

module.exports = authRouter;
