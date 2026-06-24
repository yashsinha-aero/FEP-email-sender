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

      const prompt = `You are helping personalize an outreach email to a professor for IIT Kanpur's Foreign Exposure Programme (FEP).

Input:
Research Interest: "${researchInterest}"

Task:
Generate exactly 1-2 professional sentences that can be inserted into an email after the introduction paragraph.

Instructions:

1. First identify the professor's primary research theme from the provided research interests.
2. If many research interests are provided, group them into a broader theme instead of listing them individually.
3. Mention at most 2 specific research areas if necessary.
4. Explain how a research opportunity under the professor's guidance would benefit undergraduate students through research exposure, mentorship, and practical experience.
5. Keep the tone professional, concise, and personalized.
6. Avoid excessive praise, generic compliments, or marketing language.
7. Do not directly ask for a project.
8. Do not repeat information already present in the email.
9. Output only the customization text.
10. Keep the output between 30 and 70 words.

Examples:

Research Interest:
Machine Learning, Deep Learning, Computer Vision, Medical Imaging, Pattern Recognition, AI for Healthcare

Output:
Given your contributions to AI-driven healthcare research, an opportunity to work under your guidance would expose students to the development of advanced computational methods for solving real-world challenges. Such experience would help them strengthen both their technical foundations and research capabilities.

Research Interest:
Composite Materials, Structural Dynamics, Aerospace Structures, Fatigue Analysis, Experimental Mechanics, Aircraft Design

Output:
Your research in advanced aerospace structures and materials would provide students with valuable exposure to the challenges of designing and analyzing modern engineering systems. Working in this area would help them develop strong analytical and experimental research skills.
`;

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
