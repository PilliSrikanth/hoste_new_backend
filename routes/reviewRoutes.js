const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/reviewController");

// Add review
router.post("/add", reviewController.addReview);

// Get reviews for a hostel
router.get("/hostel/:hostelId", reviewController.getHostelReviews);

// Get single review
router.get("/:reviewId", reviewController.getReviewById);

// Delete review
router.delete("/:reviewId", reviewController.deleteReview);

module.exports = router;
