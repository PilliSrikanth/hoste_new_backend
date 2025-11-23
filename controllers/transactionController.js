const crypto = require("crypto");
const { PayData } = require("../payu.config");
const Transaction = require("../models/transactionModel");
const User = require("../models/userModel");
const Hostel = require("../models/hostelModel");

exports.getPayment = async (req, res) => {
  try {
    const txn_id = 'PAYU_MONEY_' + Math.floor(Math.random() * 8888888);
    const { amount, product, firstname, email, mobile, userId, hostelId, ownerId } = req.body;

    if (!amount || !product || !firstname || !email || !mobile || !userId || !hostelId || !ownerId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Save transaction as pending
    const transaction = new Transaction({
      user: userId,
      hostel: hostelId,
      owner: ownerId,
      txnId: txn_id,
      product,
      amount,
      status: "pending"
    });
    await transaction.save();

    // Generate hash for PayU
    const udf1 = '', udf2 = '', udf3 = '', udf4 = '', udf5 = '';
    const hashString = `${PayData.payu_key}|${txn_id}|${amount}|${JSON.stringify(product)}|${firstname}|${email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${PayData.payu_salt}`;
    const hash = crypto.createHash('sha512').update(hashString).digest('hex');

    // Initiate payment
    const data = await PayData.payuClient.paymentInitiate({
      isAmountFilledByCustomer: false,
      txnid: txn_id,
      amount,
      currency: 'INR',
      productinfo: JSON.stringify(product),
      firstname,
      email,
      phone: mobile,
      surl: `http://localhost:${process.env.PORT}/verify/${txn_id}`,
      furl: `http://localhost:${process.env.PORT}/verify/${txn_id}`,
      hash
    });

    res.send(data);

  } catch (error) {
    res.status(400).json({ message: error.message, stack: error.stack });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const txnId = req.params.txnid;
    const verified_Data = await PayData.payuClient.verifyPayment(txnId);
    const data = verified_Data.transaction_details[txnId];

    // Update transaction in MongoDB
    await Transaction.findOneAndUpdate(
      { txnId },
      { status: data.status, response: data },
      { new: true }
    );

    // Redirect user to frontend with status
    res.redirect(`http://localhost:60768/payment/${data.status}/${data.txnid}`);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


exports.getUserTransactions = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const user = await User.findById(userId).select("name email phone");
    if (!user) return res.status(404).json({ message: "User not found" });

    // Fetch all transactions for this user
    const transactions = await Transaction.find({ user: userId })
      .populate("hostel", "name area") // populate hostel info
      .populate("owner", "name email"); // populate owner info

    res.status(200).json({
      user,
      count: transactions.length,
      transactions,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching transactions", error: error.message });
  }
};
