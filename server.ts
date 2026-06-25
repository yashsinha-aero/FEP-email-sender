import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { chromium, Page, BrowserContext } from 'playwright';

let activePage: Page | null = null;
let activeContext: BrowserContext | null = null;

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
      const { ccAddress, to, subject, body, manualSend } = req.body;

      if (!activePage || activePage.isClosed()) {
        return res.status(400).json({ error: "Webmail is not connected. Please connect it first from the UI." });
      }

      if (!to || !subject || !body) {
        return res.status(400).json({ error: "Missing required fields: to, subject, or body" });
      }

      // IITK Webmail Rate Limit Recommendations:
      // - Not more than 80 emails in 10 minutes
      // - Not more than 150 emails in an hour
      // - Not more than 400 emails in a day
      const htmlBody = formatHtmlEmail(body);

      const dialogHandler = (dialog: any) => {
        console.warn(`Roundcube dialog popped up: ${dialog.message()}`);
        dialog.accept().catch(() => {});
      };

      try {
        activePage.on('dialog', dialogHandler);

        await activePage.goto('https://nwm.iitk.ac.in/?_task=mail&_action=compose');
        
        await activePage.waitForSelector('#_to');
        await activePage.fill('#_to', to);
        await activePage.fill('#compose-subject', subject);
        
        await activePage.evaluate(`((cc) => {
          if (cc) {
            const ccEl = document.getElementById('_cc');
            if (ccEl) {
              ccEl.value = cc;
              ccEl.dispatchEvent(new Event('input', { bubbles: true }));
              ccEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        })(${JSON.stringify(ccAddress)})`);

        const injectionResult = (await activePage.evaluate(`(async (html) => {
          const getEditor = () => {
            const tinymce = window.tinymce;
            if (tinymce && tinymce.activeEditor) {
              return tinymce.activeEditor;
            }
            return null;
          };

          for (let i = 0; i < 100; i++) {
            const editor = getEditor();
            if (editor && editor.initialized) {
              editor.setContent(html);
              if (typeof editor.save === 'function') {
                editor.save();
              }
              return { success: true, method: 'tinymce' };
            }
            
            const iframe = document.getElementById('composebody_ifr');
            if (iframe && iframe.contentDocument) {
              const iframeBody = iframe.contentDocument.getElementById('tinymce');
              if (iframeBody) {
                iframeBody.innerHTML = html;
                const textarea = document.getElementById('composebody');
                if (textarea) {
                  textarea.value = html;
                }
                return { success: true, method: 'iframe_direct' };
              }
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          const textarea = document.getElementById('composebody');
          if (textarea) {
            textarea.value = html;
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            return { success: true, method: 'textarea_fallback' };
          }

          return { success: false, error: 'Could not find any editor element or TinyMCE instance.' };
        })(${JSON.stringify(htmlBody)})`)) as any;

        if (!injectionResult || !injectionResult.success) {
          throw new Error((injectionResult && injectionResult.error) || "Failed to inject content (result was undefined or failed)");
        }
        console.log(`Email body injected using method: ${injectionResult.method}`);

        await activePage.waitForTimeout(1000);

        if (manualSend) {
          console.log("Manual send option active. Waiting for manual submit or navigation away from compose...");
          await activePage.waitForURL((url) => !url.href.includes('_action=compose'), { timeout: 600000 });
          console.log("Manual navigation detected.");
        } else {
          const sendButtonSelectors = [
            'button.send',
            'button:has-text("Send")',
            '#rcmbtn107',
            '.btn-primary.send',
            'a.send',
            'a:has-text("Send")',
            'input[type="submit"].send',
            'input[value="Send"]'
          ];

          const clickSendButton = async () => {
            for (const selector of sendButtonSelectors) {
              try {
                const locator = activePage.locator(selector);
                if (await locator.count() > 0) {
                  const button = locator.first();
                  if (await button.isVisible()) {
                    await button.click();
                    console.log(`Clicked Send button using selector: ${selector}`);
                    return true;
                  }
                }
              } catch (err: any) {
                console.warn(`Attempted selector ${selector} but failed:`, err.message);
              }
            }
            return false;
          };

          let clicked = await clickSendButton();

          if (!clicked) {
            try {
              await activePage.evaluate(`(() => {
                const form = document.querySelector('form[name="form"]') || document.querySelector('form');
                if (form) {
                  form.submit();
                  return true;
                }
                return false;
              })()`);
              clicked = true;
              console.log("Submitted the compose form directly via DOM submit fallback");
            } catch (err: any) {
              console.error("Failed to submit form directly:", err.message);
            }
          }

          if (!clicked) {
            throw new Error("Could not find or click the Send button.");
          }

          try {
            await activePage.waitForURL((url) => !url.href.includes('_action=compose'), { timeout: 3000 });
          } catch (e) {
            console.log("Navigation did not happen in 3s. Attempting a second click to bypass potential spelling/warning prompts...");
            const secondClickSucceeded = await clickSendButton();
            if (!secondClickSucceeded) {
              console.log("Second click on Send button locator failed, attempting form submit fallback again...");
              await activePage.evaluate(`(() => {
                const form = document.querySelector('form[name="form"]') || document.querySelector('form');
                if (form) {
                  form.submit();
                  return true;
                }
                return false;
              })()`).catch(() => {});
            }
          }
          
          await activePage.waitForURL((url) => !url.href.includes('_action=compose'), { timeout: 30000 });
        }

        res.json({ success: true });
      } catch (error: any) {
        console.error("Error sending email:", error);
        res.status(500).json({ error: error.message || "Failed to send email" });
      } finally {
        try {
          activePage.off('dialog', dialogHandler);
        } catch (err) {}
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/start-nwm", async (req, res) => {
    try {
      if (!activePage || activePage.isClosed()) {
        const browser = await chromium.launch({ headless: false });
        activeContext = await browser.newContext();
        activePage = await activeContext.newPage();
        await activePage.goto("https://nwm.iitk.ac.in/", { timeout: 60000 });
      } else {
        await activePage.bringToFront();
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error("Playwright launch error:", err);
      res.status(500).json({ error: "Failed to launch browser: " + err.message });
    }
  });

  app.get("/api/nwm-status", (req, res) => {
    if (!activePage || activePage.isClosed()) {
      return res.json({ status: 'disconnected' });
    }
    const url = activePage.url();
    if (url.includes('_task=mail') || url.includes('mail')) {
      return res.json({ status: 'connected' });
    }
    return res.json({ status: 'waiting_for_login' });
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
