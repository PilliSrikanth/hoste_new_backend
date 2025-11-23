/**
 * const crypto = require("crypto")
 const { PayData } = require("../payu.config")
 
 exports.getPayment = async (req, res) => {
     try {
         const txn_id = 'PAYU_MONEY_' + Math.floor(Math.random() * 8888888)
         const { amount, product, firstname, email, mobile } = req.body
 
         let udf1 = '', udf2 = '', udf3 = '', udf4 = '', udf5 = ''
 
         const hashString = `${PayData.payu_key}|${txn_id}|${amount}|${JSON.stringify(product)}|${firstname}|${email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${PayData.payu_salt}`;
         const hash = crypto.createHash('sha512').update(hashString).digest('hex');
 
         const data = await PayData.payuClient.paymentInitiate({
             isAmountFilledByCustomer: false,
             txnid: txn_id,
             amount: amount,
             currency: 'INR',
             productinfo: JSON.stringify(product),
             firstname: firstname,
             email: email,
             phone: mobile,
             surl: `http://localhost:${process.env.PORT}/verify/${txn_id}`,
             furl: `http://localhost:${process.env.PORT}/verify/${txn_id}`,
             hash
         })
 
         res.send(data)
 
     } catch (error) {
         res.status(400).send({
             msg: error.message,
             stack: error.stack
         })
     }
 }
 
 
 exports.verifyPayment = async (req, res) => {
     const verified_Data = await PayData.payuClient.verifyPayment(req.params.txnid);
     const data = verified_Data.transaction_details[req.params.txnid]
 
       res.redirect(`http://localhost:60768/payment/${data.status}/${data.txnid}`)
 }
 
 */

 /**
  * const express = require("express")
  const router = express.Router()
  const { getPayment, verifyPayment } = require("../controllers/transactionController")
  
  router.post("/get-payment", getPayment)
  router.post("/verify/:txnid", verifyPayment)
  
  module.exports = router
  
  */