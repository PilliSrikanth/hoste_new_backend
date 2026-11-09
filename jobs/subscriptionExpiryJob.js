// jobs/subscriptionExpiryJob.js

const cron = require('node-cron');
const OwnerSubscription = require('../models/OwnerSubscription');
const Hostel = require('../models/hostelModel');

let isJobRunning = false;

function startSubscriptionExpiryJob() {
  cron.schedule('*/5 * * * *', async () => {
    if (isJobRunning) return;

    isJobRunning = true;

    try {
      const now = new Date();

      // Find subscriptions whose expiry date has passed.
      // Include EXPIRED records so a failed hostel update can be retried.
      const expiredSubscriptions = await OwnerSubscription.find({
        status: { $in: ['ACTIVE', 'EXPIRED'] },
        endDate: { $lte: now }
      }).select('_id ownerId hostelId status');

      let expiredCount = 0;
      let unpublishedCount = 0;

      for (const subscription of expiredSubscriptions) {
        try {
          // Unpublish only the hostel linked to this subscription.
          const hostelResult = await Hostel.updateOne(
            {
              _id: subscription.hostelId,
              ownerId: subscription.ownerId,
              subscriptionId: subscription._id
            },
            {
              $set: {
                subscriptionStatus: 'EXPIRED',
                isPublished: false
              }
            }
          );

          if (hostelResult.modifiedCount > 0) {
            unpublishedCount++;
          }

          // Mark this subscription expired.
          const subscriptionResult = await OwnerSubscription.updateOne(
            {
              _id: subscription._id,
              status: { $in: ['ACTIVE', 'EXPIRED'] },
              endDate: { $lte: now }
            },
            {
              $set: { status: 'EXPIRED' }
            }
          );

          if (subscriptionResult.modifiedCount > 0) {
            expiredCount++;
          }
        } catch (error) {
          console.error(
            `[Subscription Expiry] Failed for subscription ${subscription._id}:`,
            error
          );
        }
      }

      if (expiredCount > 0 || unpublishedCount > 0) {
        console.log(
          `[Subscription Expiry] ${expiredCount} subscription(s) expired; ` +
          `${unpublishedCount} hostel(s) unpublished`
        );
      }
    } catch (error) {
      console.error('[Subscription Expiry] Job failed:', error);
    } finally {
      isJobRunning = false;
    }
  });

  console.log('[Subscription Expiry] Background job scheduled every 5 minutes');
}

module.exports = startSubscriptionExpiryJob;