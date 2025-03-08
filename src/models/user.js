const mongoose = require("mongoose");
const validator = require("validator");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      // validate(value) {
      //   const regex = /^[a-zA-Z_]{4,25}$/;
      //   if (!regex.test(value)) {
      //     throw new Error("Username must be of 4-25 characters, consisting of alphabets or underscore");
      //   }
      // }
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      validate(value) {
        if (value.length > 300) {
          throw new Error("Email cannot be of more than 300 characters!")
        }
        if (!validator.isEmail(value)) {
          throw new Error("Invalid email address: " + value);
        }
      },
    },
    password: {
      type: String,
      required: true,
    },
    photoUrl: {
      type: String,
      default: "https://geographyandyou.com/images/user-profile.png",
      maxLength: 2000,
      validate(value) {
        if (!validator.isURL(value)) {
          throw new Error("Invalid Photo URL: " + value);
        }
      },
    },
  },
  {
    timestamps: true,
  }
);

userSchema.methods.getJWT = async function () {
  const user = this;

  const token = jwt.sign({ _id: user._id }, process.env.SECRET_KEY, {
    expiresIn: "30d",
  });

  return token;
};

userSchema.methods.validatePassword = async function (passwordInputByUser) {
  const user = this;
  const passwordHash = user.password;

  const isPasswordValid = await bcrypt.compare(
    passwordInputByUser,
    passwordHash
  );

  return isPasswordValid;
};

module.exports = mongoose.model("User", userSchema);