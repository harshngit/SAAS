// Shared Razorpay checkout orchestration for paying for a SaaS plan - used by AdminPlans.jsx.
// Keeps the order->checkout->verify sequence in one place instead of duplicating it anywhere
// else this flow might be triggered from.
import { createRazorpayOrder, verifyRazorpayPayment } from '../../api/billing'
import { loadRazorpayCheckout } from '../../utils/loadRazorpayCheckout'

// `accentColor` is the live theme accent (falls back to the brand green) - Razorpay's own
// `theme.color` option, purely cosmetic on their checkout modal.
export async function payForPlan({ plan, billingCycle, accentColor, onFailed, onCancelled, onOrderCreated }) {
  const orderResult = await createRazorpayOrder({ planId: plan.id, billingCycle })
  if (!orderResult.success) return orderResult

  // Lets the caller show a "TEST MODE" indicator the moment we know the key - rzp_test_* keys
  // are Razorpay's own well-documented test-mode prefix, never used for a live key.
  onOrderCreated?.({ keyId: orderResult.keyId, isTestMode: (orderResult.keyId || '').startsWith('rzp_test_') })

  let Razorpay
  try {
    Razorpay = await loadRazorpayCheckout()
  } catch (error) {
    return { success: false, error: error.message }
  }

  return new Promise((resolve) => {
    const checkout = new Razorpay({
      key: orderResult.keyId,
      order_id: orderResult.orderId,
      amount: orderResult.amount,
      currency: orderResult.currency,
      name: 'Beas Suite',
      description: `${orderResult.planName || plan.name} - ${orderResult.billingCycle || billingCycle}`,
      prefill: orderResult.prefill,
      theme: { color: accentColor || '#063b00' },
      handler: async (response) => {
        const verifyResult = await verifyRazorpayPayment({
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        })
        resolve(verifyResult)
      },
      modal: {
        ondismiss: () => {
          onCancelled?.()
          resolve({ success: false, cancelled: true })
        },
      },
    })

    checkout.on('payment.failed', (event) => {
      const message = event?.error?.description || 'Payment failed. Please try again.'
      onFailed?.(message)
      resolve({ success: false, error: message })
    })

    checkout.open()
  })
}
