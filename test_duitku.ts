import { createHash } from "crypto";

const DUITKU_MERCHANT_CODE = "DS28826";
const DUITKU_API_KEY = "61b42b401519c6483b1516a1d818c563";
const DUITKU_SANDBOX_URL = "https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry";

function md5(str: string): string {
  return createHash("md5").update(str).digest("hex");
}

async function testDuitku() {
  const merchantOrderId = "TEST-" + Date.now();
  const amount = 15000;
  const signature = md5(`${DUITKU_MERCHANT_CODE}${merchantOrderId}${amount}${DUITKU_API_KEY}`);

  const body = {
    merchantCode: DUITKU_MERCHANT_CODE,
    paymentAmount: amount,
    paymentMethod: "VC", // Credit Card
    merchantOrderId,
    productDetails: "Test Order",
    email: "test@example.com",
    phoneNumber: "08123456789",
    callbackUrl: "http://localhost:3001/api/payment/callback",
    returnUrl: "http://localhost:3000/order",
    signature,
    itemDetails: [{ name: "Test Product", price: 15000, quantity: 1 }]
  };

  try {
    const res = await fetch(DUITKU_SANDBOX_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Error:", e);
  }
}

testDuitku();
