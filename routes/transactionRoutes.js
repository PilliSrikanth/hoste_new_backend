const express = require("express")
const router = express.Router()
const { getPayment, verifyPayment, getUserTransactions} = require("../controllers/transactionController")

router.post("/get-payment", getPayment)
router.post("/verify/:txnid", verifyPayment)

router.get("/user/:userId", getUserTransactions);

module.exports = router
