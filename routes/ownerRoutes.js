const express = require("express");
const router = express.Router();
const { registerOwner, loginOwner, verifyPayU } = require("../controllers/ownerController");

router.post("/register", registerOwner);
router.post("/login", loginOwner);
router.get("/verify/:id", verifyPayU);

module.exports = router;
