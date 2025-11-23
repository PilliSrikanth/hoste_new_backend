const express = require("express");
const router = express.Router();
const callController = require("../controllers/callController");

router.post("/create", callController.createCall);
router.put("/update/:callId", callController.updateCallStatus);
router.get("/user/:userId", callController.getUserCalls);

module.exports = router;
