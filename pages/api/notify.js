import { Resend } from 'resend';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, phone, name } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[Notify] RESEND_API_KEY not set in .env.local');
    // Don't block login if email fails — just log it
    return res.status(200).json({ success: true, emailSent: false });
  }

  const resend = new Resend(apiKey);

  const visitorName = name?.trim() || 'A visitor';
  const visitorPhone = phone?.trim() || 'Not provided';
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'desiankush143@gmail.com',
      subject: `🔔 New visitor on your AI Portfolio — ${email}`,
      html: `
        <div style="font-family: Inter, Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #0f0f0f; color: #fafafa; border-radius: 12px; overflow: hidden; border: 1px solid #2a2a2a;">
          <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 28px 32px;">
            <h1 style="margin: 0; font-size: 22px; color: white;">👋 New Portfolio Visitor</h1>
            <p style="margin: 6px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">Someone just accessed your AI Portfolio Assistant</p>
          </div>
          <div style="padding: 28px 32px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #2a2a2a; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; width: 120px;">Name</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #2a2a2a; color: #fafafa; font-size: 14px; font-weight: 500;">${visitorName}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #2a2a2a; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Email</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #2a2a2a; color: #34d399; font-size: 14px; font-weight: 500;">${email}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #2a2a2a; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Phone</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #2a2a2a; color: #fafafa; font-size: 14px;">${visitorPhone}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Time (IST)</td>
                <td style="padding: 10px 0; color: #fafafa; font-size: 14px;">${now}</td>
              </tr>
            </table>
            <div style="margin-top: 24px; padding: 16px; background: #1c1c1c; border-radius: 8px; border: 1px solid #2a2a2a;">
              <p style="margin: 0; font-size: 13px; color: #a3a3a3;">This person is now chatting with your AI Portfolio Assistant. They may be a recruiter or interviewer exploring your experience.</p>
            </div>
          </div>
          <div style="padding: 16px 32px; border-top: 1px solid #2a2a2a; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #737373;">Ankush Katharia • AI Portfolio Assistant</p>
          </div>
        </div>
      `,
    });

    console.log(`[Notify] Email sent for visitor: ${email}`);
    return res.status(200).json({ success: true, emailSent: true });
  } catch (error) {
    console.error('[Notify] Resend error:', error.message);
    // Don't block login if email fails
    return res.status(200).json({ success: true, emailSent: false });
  }
}
