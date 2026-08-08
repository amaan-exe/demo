import mongoose from 'mongoose'

const PaymentTransactionSchema = new mongoose.Schema({
  id: {
    type: String,
    sparse: true,
  },
  paymentId: {
    type: String,
    sparse: true,
    index: true,
  },
  internalOrderId: {
    type: String,
    required: true,
    index: true,
  },
  razorpayOrderId: {
    type: String,
    index: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'INR',
  },
  status: {
    type: String,
    enum: ['PENDING', 'DONE', 'FAILED', 'CANCELLED'],
    default: 'PENDING',
    index: true,
  },
  razorpayStatus: {
    type: String,
    default: 'created',
  },
  paymentMethod: {
    type: String,
    default: 'RAZORPAY',
  },
  methodDetails: {
    vpa: String,
    cardNetwork: String,
    cardType: String,
    bank: String,
    wallet: String,
  },
  customerName: String,
  customerEmail: String,
  customerPhone: String,
  failureCode: String,
  failureReason: String,
  razorpayEventId: String,
  lastWebhookEvent: String,
  authorizedAt: Date,
  capturedAt: Date,
  failedAt: Date,
  timeline: [
    {
      event: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
      notes: String,
      source: String,
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
})

PaymentTransactionSchema.pre('save', function (next) {
  this.updatedAt = new Date()
  if (!this.paymentId && this.id) {
    this.paymentId = this.id
  }
  next()
})

export default mongoose.models.PaymentTransaction || mongoose.model('PaymentTransaction', PaymentTransactionSchema)
