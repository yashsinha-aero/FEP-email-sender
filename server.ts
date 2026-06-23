import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

if (process.env.NODE_ENV !== "production") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}


async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  app.post("/api/send-email", async (req, res) => {
    try {
      const { smtpHost, smtpPort, smtpUser, smtpPass, fromAddress, ccAddress, to, subject, body, bccMyself } = req.body;

      if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !fromAddress || !to || !subject || !body) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(smtpPort),
        secure: Number(smtpPort) === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const htmlBody = body.replace(/\n/g, '<br>');

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

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
      }

      if (!researchInterest) {
        return res.status(400).json({ error: "Missing researchInterest" });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const prompt = `You have to generate a short 1-2 line description of how the professor's work would benefit students. Their research interest is: "${researchInterest}".
Your response must be a single, objective sentence describing how this research area would be highly beneficial for undergraduate students to explore. 
Format it similar to : "Your pioneering work in [topic] offers an excellent opportunity for undergraduate students to gain valuable insights into [specific aspect]."
and similar phrases to concisely explain how the professor's guidance and expertise will benefit students. DO NOT use any first-person pronouns (no "I", "me", "my", "we", "our"). Do not use phrases like "I will be" or "I am writing to".
Keep it professional, polite, and concise. Do not include any greetings or sign-offs, just the sentences itself.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      res.json({ text: response.text });
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
