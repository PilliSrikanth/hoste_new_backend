const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Test SMTP connection
const verifyEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log("✅ Email SMTP connection successful");
  } catch (error) {
    console.error("❌ Email SMTP connection failed:", error.message);
  }
};

const sendEmailOtp = async (email, otp, type = "register") => {

  const title =
    type === "login"
      ? "Login Verification OTP"
      : "Registration Verification OTP";

  await transporter.sendMail({
    from: `"Hostel App" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: `Hostel App - ${title}`,

    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial">

        <div style="
          max-width:500px;
          margin:30px auto;
          background:white;
          padding:30px;
          border-radius:12px;
          text-align:center;
        ">

          <h2 style="color:#ff4b00;">
            Hostel App
          </h2>

          <p>
            Your ${type === "login" ? "login" : "registration"} verification OTP is:
          </p>

          <div style="
            font-size:32px;
            font-weight:bold;
            letter-spacing:8px;
            margin:25px 0;
            color:#222;
          ">
            ${otp}
          </div>

          <p>
            This OTP is valid for <strong>5 minutes</strong>.
          </p>

          <p style="color:#777;font-size:13px;">
            Do not share this OTP with anyone.
          </p>

        </div>

      </body>
      </html>
    `
  });

  console.log(`✅ OTP email sent to ${email}`);
};

module.exports = {
  sendEmailOtp,
  verifyEmailConnection
};