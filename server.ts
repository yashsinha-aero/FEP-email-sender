import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

if (process.env.NODE_ENV !== "production") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}


function sanitizeGeneratedText(text: string): string {
  let cleaned = text.trim();
  
  cleaned = cleaned.replace(/\u2011/g, '-');
  
  cleaned = cleaned.replace(/\u2013/g, '-').replace(/\u2014/g, '-');
  
  cleaned = cleaned.replace(/[\u201c\u201d]/g, '"');
  cleaned = cleaned.replace(/[\u2018\u2019]/g, "'");
  
  cleaned = cleaned.replace(/\u00a0/g, ' ');
  
  cleaned = cleaned.replace(/^["'“‘”’]+|["'“‘”’]+$/g, '');
  cleaned = cleaned.trim();
  
  return cleaned;
}

function formatHtmlEmail(body: string): string {
  const paragraphs = body.split(/\n\s*\n/);

  const wrappedParagraphs = paragraphs.map(p => {
    const trimmed = p.trim();
    if (!trimmed) return "";

    const lineBreakContent = trimmed.replace(/\n/g, "<br>");
    return `<p style="margin: 0 0 1em 0; font-size: 10pt; font-family: Verdana,Geneva,sans-serif; line-height: 1.5; color: #000000;">${lineBreakContent}</p>`;
  }).filter(Boolean);

  return `<div style="font-size: 10pt; font-family: Verdana,Geneva,sans-serif; line-height: 1.5; color: #000000;">
${wrappedParagraphs.join("\n")}
</div>`;
}

let cachedTransporter: any = null;
let cachedTransporterKey = "";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  app.post("/api/send-email", async (req, res) => {
    try {
      const { smtpHost, smtpPort, smtpUser, smtpPass, fromAddress, ccAddress, to, subject, body, bccMyself } = req.body;

      if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !fromAddress || !to || !subject || !body) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const transporterKey = `${smtpHost}:${smtpPort}:${smtpUser}:${smtpPass}`;
      let transporter = cachedTransporter;

      if (!transporter || cachedTransporterKey !== transporterKey) {
        if (transporter) {
          try {
            transporter.close();
          } catch (e) {
            console.error("Error closing old transporter:", e);
          }
        }

        transporter = nodemailer.createTransport({
          pool: true,
          maxConnections: 1,
          maxMessages: 100,
          rateLimit: 1,
          rateDelta: 10000,
          host: smtpHost,
          port: Number(smtpPort),
          secure: Number(smtpPort) === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 20000,
        });

        cachedTransporter = transporter;
        cachedTransporterKey = transporterKey;
      }

      const htmlBody = formatHtmlEmail(body);

      const mailOptions: any = {
        from: fromAddress,
        to,
        subject,
        html: htmlBody,
      };

      if (ccAddress) {
        mailOptions.cc = ccAddress;
      }

      if (bccMyself) {
        mailOptions.bcc = fromAddress;
      }

      await transporter.sendMail(mailOptions);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: error.message || "Failed to send email" });
    }
  });

  app.post("/api/generate-personalization", async (req, res) => {
    try {
      const { researchInterest, profName } = req.body;

      if (!process.env.NVIDIA_API_KEY) {
        return res.status(500).json({ error: "NVIDIA_API_KEY is not configured" });
      }

      if (!researchInterest) {
        return res.status(400).json({ error: "Missing researchInterest" });
      }

      const openai = new OpenAI({
        apiKey: process.env.NVIDIA_API_KEY,
        baseURL: "https://integrate.api.nvidia.com/v1"
      });

      const prompt = `You have to generate a short 1-2 line description of how learning from the professor's experience, expertise, and guidance in their field would benefit students. Their research interest is: "${researchInterest}".
Your response must be a single, objective sentence describing how gaining insights under their mentorship, leadership, or expertise in this research area would be highly beneficial for undergraduate students.
Crucially, keep the sentence professor-centered (focusing on their mentorship, guidance, expertise, knowledge, or leadership in this field) but vary the sentence structure and vocabulary each time.
You must write in the second-person ("your", "under your mentorship", "your expertise", "your guidance") to address the professor directly (e.g. "your expertise" instead of "the professor's expertise").
Avoid using the exact phrase "your pioneering work" or "offers an excellent opportunity" repeatedly. Instead, use a wide variety of natural phrasings.

Here are a few different styles and phrasings you can draw inspiration from (do not copy them verbatim, vary them):
- "Learning from your extensive expertise and guidance in [topic] would provide students with an invaluable foundation in [specific aspect]."
- "Your deep knowledge and research leadership in [topic] will offer a unique mentorship opportunity for students looking to excel in [specific aspect]."
- "Studying under your mentorship on projects involving [topic] would help students bridge the gap between theory and practical application in [specific aspect]."
- "Gaining insights from your established research in [topic] would enable undergraduates to develop a rigorous understanding of [specific aspect]."
- "Your expert perspective and hands-on experience in [topic] create an ideal environment for students to master [specific aspect]."

DO NOT use any first-person pronouns (no "I", "me", "my", "we", "our"). Do not use phrases like "I will be" or "I am writing to".
Keep it professional, polite, and concise. Do not include any greetings or sign-offs, just the sentence itself.`;

      const response = await openai.chat.completions.create({
        model: "openai/gpt-oss-20b",
        messages: [{ role: "user", content: prompt }]
      });

      const rawText = response.choices[0]?.message?.content || "";
      const cleanedText = sanitizeGeneratedText(rawText);

      res.json({ text: cleanedText });
    } catch (error: any) {
      console.error("Error generating text:", error);
      res.status(500).json({ error: "Failed to generate text" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
