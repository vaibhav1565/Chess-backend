const validatePassword = (password) => {
  if (password.length < 8) {
    throw new Error("Password length must be atleast 8 characters");
  }
  if (password.length > 100) {
    throw new Error("Password length cannot be more than 100 characters")
  }
};

// const validateEditProfileData = (req) => {
//   const allowedEditFields = [
//     "firstName",
//     "lastName",
//     "photoUrl",
//     "gender",
//     "age",
//     "about",
//     "skills",
//   ];

//   const isEditAllowed = Object.keys(req.body).every((field) =>
//     allowedEditFields.includes(field)
//   );

//   return isEditAllowed;
// };

module.exports = {
  validatePassword,
};