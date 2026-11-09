const express = require("express");

const router = express.Router();

const upload = require("../middleware/userUpload");

const {
  registerUser,
  verifyRegisterOtp,
  resendRegisterOtp,
  loginUser,
  verifyLoginOtp,
  getUserById,
  updateUser,
  uploadProfileImage,
  changePassword,
  forgotPassword,
  resetPassword
} = require("../controllers/userController");


// ================================
// AUTH
// ================================

router.post("/register", registerUser);

router.post(
  "/register/verify-otp",
  verifyRegisterOtp
);

router.post(
  "/register/resend-otp",
  resendRegisterOtp
);

router.post(
  "/login",
  loginUser
);

router.post(
  "/login/verify-otp",
  verifyLoginOtp
);


// ================================
// USER
// ================================

router.get("/:id", getUserById);

router.put("/:id", updateUser);

// Profile image upload
router.put(
  "/:id/profile-image",
  upload.single("profileImage"),
  uploadProfileImage
);


// ================================
// PASSWORD
// ================================

router.put(
  "/:id/change-password",
  changePassword
);

router.post(
  "/forgot-password",
  forgotPassword
);

router.post(
  "/reset-password/:token",
  resetPassword
);


module.exports = router;