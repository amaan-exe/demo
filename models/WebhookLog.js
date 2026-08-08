import mongoose from 'mongoose'

const WebhookLogSchema = new mongoose.Schema({
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  eventType: {
    type: String,
    required: true,
  },
  receivedAt: {
    type: Date,
    default: Date.now,
  },
  processedAt: Date,
  processingStatus: {
    type: String,
    enum: ['PROCESSED', 'DUPLICATE', 'FAILED', 'IGNORED'],
    default: 'PROCESSED',
  },
  razorpayPaymentId: String,
  razorpayOrderId: String,
  internalOrderId: String,
  payload: mongoose.Schema.Types.Mixed,
  error: String,
  createdAt: {
    type: Date,
    default: Date.now,
  }
})

export default mongoose.models.WebhookLog || mongoose.model('WebhookLog', WebhookLogSchema)
