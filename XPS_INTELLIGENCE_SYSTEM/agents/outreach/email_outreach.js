const nodemailer = require("nodemailer");

async function sendEmail(lead) {
  if (!lead.email) return;

  let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.OUTREACH_EMAIL,
      pass: process.env.OUTREACH_PASS,
    },
  });

  let message = {
    from: process.env.OUTREACH_EMAIL,
    to: lead.email,
    subject: "Concrete polishing opportunity",
    text: "We help contractors generate high-value concrete polishing jobs. Interested in seeing how?",
  };

  await transporter.sendMail(message);

  console.log("Email sent to", lead.email);
}

module.exports = sendEmail;
