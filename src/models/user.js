const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      trim: true,
      unique: [true, "This username has already been taken"],
      minLength: [5, "Username must be of atleast 5 characters"],
      validate: {
        validator: (value) => /^[a-zA-Z0-9]*$/.test(value),
        message: "Username must consist of alphabets or digits only",
      },
    },
    email: {
      type: String,
      required: true,
      unique: [true, "This email address is already registered"],
      trim: true,
      lowercase: true,
      maxLength: [350, "Email address cannot be more than 350 characters long"],
    },
    password: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.methods.getJWT = function (guest = false) {
  const user = this;

  const token = jwt.sign({ _id: user._id }, process.env.SECRET_KEY,
    {
      expiresIn: guest ?  10 * 60 : "30d"
    }
  );

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