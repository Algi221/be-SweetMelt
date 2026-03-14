import { Hono } from "hono";

const otp = new Hono();

// Simple in-memory storage for OTPs (In production, use Redis or a DB table)
const otpStore = new Map<string, { code: string; expires: number }>();

// Helper to normalize phone number to International format (62...)
function normalizePhone(phone: string) {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  } else if (cleaned.startsWith("8")) {
    cleaned = "62" + cleaned;
  }
  return cleaned;
}

// POST /api/otp/send - Send OTP via Telegram Bot
otp.post("/send", async (c) => {
  const { phone: chatId } = await c.req.json();
  if (!chatId) return c.json({ error: "Telegram Chat ID wajib diisi" }, 400);

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = Date.now() + 5 * 60 * 1000; // 5 minutes expiry

  otpStore.set(chatId.toString(), { code, expires });

  console.log(`[OTP] Sending ${code} to Telegram Chat ID ${chatId}...`);

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.warn("TELEGRAM_BOT_TOKEN not found in env");
    return c.json({ error: "Sistem Telegram belum dikonfigurasi" }, 500);
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🍪 *SweetMelt OTP*\n\nKode verifikasi Anda adalah: *${code}*\n\nJangan berikan kode ini kepada siapa pun.`,
        parse_mode: "Markdown"
      }),
    });
    
    const data = await res.json() as any;
    console.log("[OTP] Telegram Response:", JSON.stringify(data));

    if (data.ok) {
      return c.json({ success: true, message: "OTP berhasil dikirim ke Telegram" });
    } else {
      return c.json({ error: "Gagal mengirim OTP. Pastikan sudah Chat @bot_anda dan tekan /start", details: data.description }, 400);
    }
  } catch (error) {
    console.error("[OTP] Telegram Error:", error);
    return c.json({ error: "Terjadi kesalahan saat menghubungi Telegram" }, 500);
  }
});

// POST /api/otp/verify - Verify OTP code
otp.post("/verify", async (c) => {
  const { phone, code } = await c.req.json();
  if (!phone || !code) return c.json({ error: "Nomor dan kode wajib diisi" }, 400);

  const stored = otpStore.get(phone);
  if (!stored) return c.json({ error: "Harap kirim OTP terlebih dahulu" }, 400);

  if (Date.now() > stored.expires) {
    otpStore.delete(phone);
    return c.json({ error: "Kode OTP telah kedaluwarsa" }, 400);
  }

  if (stored.code === code) {
    otpStore.delete(phone);
    return c.json({ success: true, message: "OTP valid" });
  } else {
    return c.json({ error: "Kode OTP tidak valid" }, 400);
  }
});

export default otp;
