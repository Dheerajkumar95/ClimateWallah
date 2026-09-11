let loader;

export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error("Could not load Razorpay Checkout."));
    document.head.appendChild(script);
  });
  return loader;
}

export async function openRazorpayCheckout(order, options = {}) {
  const Razorpay = await loadRazorpay();
  if (!Razorpay) throw new Error("Razorpay Checkout is unavailable.");
  return new Promise((resolve, reject) => {
    const checkout = new Razorpay({
      key: order.key_id,
      amount: order.amount,
      currency: order.currency || "INR",
      order_id: order.order_id,
      name: "ClimateWallah",
      description: options.description || "Secure payment",
      prefill: options.prefill || {},
      theme: { color: "#27F580", backdrop_color: "rgba(23,32,51,.78)" },
      handler: resolve,
      modal: { ondismiss: () => reject(new Error("Payment cancelled.")) },
    });
    checkout.on("payment.failed", (event) => {
      reject(new Error(event?.error?.description || "Payment failed."));
    });
    checkout.open();
  });
}

export const money = (paise = 0) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(paise || 0) / 100);
