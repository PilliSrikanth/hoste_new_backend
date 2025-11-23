const Review = require("../models/reviewModel");
const Hostel = require("../models/hostelModel");

// Add a new review
exports.addReview = async (req, res) => {
  try {
    const { hostelId, userId, rating, comment } = req.body;

    if (!hostelId || !userId || !rating) {
      return res.status(400).json({ message: "hostelId, userId, and rating are required" });
    }

    // Save review
    const review = new Review({ hostelId, userId, rating, comment });
    await review.save();

    // Update hostel average rating
    const reviews = await Review.find({ hostelId });
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    await Hostel.findByIdAndUpdate(hostelId, { rating: avgRating.toFixed(1) });

    res.status(201).json({ message: "Review added successfully", data: review });
  } catch (error) {
    res.status(500).json({ message: "Error adding review", error: error.message });
  }
};

// Get all reviews for a hostel
exports.getHostelReviews = async (req, res) => {
  try {
    const { hostelId } = req.params;
    const reviews = await Review.find({ hostelId })
      .populate("userId", "name email");

    res.status(200).json({ count: reviews.length, data: reviews });
  } catch (error) {
    res.status(500).json({ message: "Error fetching reviews", error: error.message });
  }
};

// Get single review
exports.getReviewById = async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId)
      .populate("userId", "name email")
      .populate("hostelId", "name area");

    if (!review) return res.status(404).json({ message: "Review not found" });

    res.status(200).json(review);
  } catch (error) {
    res.status(500).json({ message: "Error fetching review", error: error.message });
  }
};

// Delete a review
exports.deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const review = await Review.findByIdAndDelete(reviewId);

    if (!review) return res.status(404).json({ message: "Review not found" });

    // Update hostel rating after deletion
    const reviews = await Review.find({ hostelId: review.hostelId });
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    await Hostel.findByIdAndUpdate(review.hostelId, { rating: avgRating.toFixed(1) });

    res.status(200).json({ message: "Review deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting review", error: error.message });
  }
};
