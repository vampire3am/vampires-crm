import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";

function crmSyncPlugin(): Plugin {
  const dataDir = path.resolve(process.cwd(), "data");
  const messagesFile = path.resolve(dataDir, "shared_messages.json");
  const presenceFile = path.resolve(dataDir, "shared_presence.json");
  const callsFile = path.resolve(dataDir, "shared_calls.json");
  const emailTemplatesFile = path.resolve(dataDir, "email_templates.json");
  const emailAutomationsFile = path.resolve(dataDir, "email_automations.json");
  const emailLogsFile = path.resolve(dataDir, "email_logs.json");
  const emailSettingsFile = path.resolve(dataDir, "email_settings.json");

  // Ensure data folder and files exist
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(messagesFile)) {
    fs.writeFileSync(messagesFile, JSON.stringify([]), "utf-8");
  }
  if (!fs.existsSync(presenceFile)) {
    fs.writeFileSync(presenceFile, JSON.stringify({}), "utf-8");
  }
  if (!fs.existsSync(callsFile)) {
    fs.writeFileSync(callsFile, JSON.stringify({}), "utf-8");
  }
  if (!fs.existsSync(emailLogsFile)) {
    fs.writeFileSync(emailLogsFile, JSON.stringify([]), "utf-8");
  }
  if (!fs.existsSync(emailSettingsFile)) {
    fs.writeFileSync(
      emailSettingsFile,
      JSON.stringify({
        provider: "smtp",
        senderName: "AECS Global Admissions",
        senderEmail: "admissions@abroad.edu.np",
        replyTo: "info@abroad.edu.np",
        smtpHost: "smtp.gmail.com",
        smtpPort: 587,
        smtpUser: "admissions@abroad.edu.np",
        apiKey: "",
        enableRealSending: true,
      }),
      "utf-8"
    );
  }

  const sseClients = new Set<any>();

  function broadcast(event: string, payload: any) {
    const dataString = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    sseClients.forEach(client => {
      try {
        client.write(dataString);
      } catch {
        sseClients.delete(client);
      }
    });
  }

  function readMessages(): any[] {
    try {
      const content = fs.readFileSync(messagesFile, "utf-8");
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  function saveMessages(msgs: any[]) {
    fs.writeFileSync(messagesFile, JSON.stringify(msgs, null, 2), "utf-8");
  }

  function readActiveCalls(): Record<string, any> {
    try {
      const content = fs.readFileSync(callsFile, "utf-8");
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  function saveActiveCalls(calls: Record<string, any>) {
    fs.writeFileSync(callsFile, JSON.stringify(calls, null, 2), "utf-8");
  }

  return {
    name: "vite-plugin-crm-sync",
    configureServer(server) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const url = req.url?.split("?")[0] || "";

        // 1. SSE Real-Time Event Stream across LAN
        if (url === "/api/sync/events") {
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": "*",
          });
          res.write(`event: connected\ndata: ${JSON.stringify({ status: "connected" })}\n\n`);

          sseClients.add(res);
          req.on("close", () => {
            sseClients.delete(res);
          });
          return;
        }

        // 2. Messages REST API
        if (url === "/api/sync/messages") {
          if (req.method === "GET") {
            const msgs = readMessages();
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.end(JSON.stringify(msgs));
            return;
          }

          if (req.method === "POST") {
            let body = "";
            req.on("data", (chunk: any) => (body += chunk));
            req.on("end", () => {
              try {
                const parsed = JSON.parse(body);
                const current = readMessages();
                const updated = [...current, parsed];
                saveMessages(updated);
                broadcast("new_message", parsed);
                res.setHeader("Content-Type", "application/json");
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.end(JSON.stringify({ success: true, message: parsed }));
              } catch (e: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: e.message }));
              }
            });
            return;
          }
        }

        // 3. Reaction API
        if (url === "/api/sync/messages/reaction" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk: any) => (body += chunk));
          req.on("end", () => {
            try {
              const { messageId, emoji, userName } = JSON.parse(body);
              const current = readMessages();
              const updated = current.map(msg => {
                if (msg.id !== messageId) return msg;
                const reactions = msg.reactions || [];
                const existingIdx = reactions.findIndex((r: any) => r.emoji === emoji);
                if (existingIdx > -1) {
                  const reaction = reactions[existingIdx];
                  const userIdx = reaction.users.indexOf(userName);
                  if (userIdx > -1) {
                    reaction.users.splice(userIdx, 1);
                    reaction.count -= 1;
                    if (reaction.count <= 0) reactions.splice(existingIdx, 1);
                  } else {
                    reaction.users.push(userName);
                    reaction.count += 1;
                  }
                } else {
                  reactions.push({ emoji, count: 1, users: [userName] });
                }
                return { ...msg, reactions };
              });
              saveMessages(updated);
              broadcast("messages_updated", updated);
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Access-Control-Allow-Origin", "*");
              res.end(JSON.stringify({ success: true, messages: updated }));
            } catch (e: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        // 4. Pin Toggle API
        if (url === "/api/sync/messages/pin" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk: any) => (body += chunk));
          req.on("end", () => {
            try {
              const { messageId } = JSON.parse(body);
              const current = readMessages();
              const updated = current.map(msg => (msg.id === messageId ? { ...msg, isPinned: !msg.isPinned } : msg));
              saveMessages(updated);
              broadcast("messages_updated", updated);
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Access-Control-Allow-Origin", "*");
              res.end(JSON.stringify({ success: true, messages: updated }));
            } catch (e: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        // 5. Delete Message API
        if (url === "/api/sync/messages/delete" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk: any) => (body += chunk));
          req.on("end", () => {
            try {
              const { messageId } = JSON.parse(body);
              const current = readMessages();
              const updated = current.filter(m => m.id !== messageId);
              saveMessages(updated);
              broadcast("messages_updated", updated);
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Access-Control-Allow-Origin", "*");
              res.end(JSON.stringify({ success: true, messages: updated }));
            } catch (e: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        // 6. Presence API
        if (url === "/api/sync/presence") {
          if (req.method === "GET") {
            try {
              const data = JSON.parse(fs.readFileSync(presenceFile, "utf-8"));
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Access-Control-Allow-Origin", "*");
              res.end(JSON.stringify(data));
            } catch {
              res.end(JSON.stringify({}));
            }
            return;
          }

          if (req.method === "POST") {
            let body = "";
            req.on("data", (chunk: any) => (body += chunk));
            req.on("end", () => {
              try {
                const { userId, presence } = JSON.parse(body);
                let current: Record<string, string> = {};
                try {
                  current = JSON.parse(fs.readFileSync(presenceFile, "utf-8"));
                } catch {}
                current[userId] = presence;
                fs.writeFileSync(presenceFile, JSON.stringify(current), "utf-8");
                broadcast("presence_updated", current);
                res.setHeader("Content-Type", "application/json");
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.end(JSON.stringify({ success: true, presence: current }));
              } catch (e: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: e.message }));
              }
            });
            return;
          }
        }

        // =========================================================================
        // 7. REAL-TIME WEB CALLING SIGNALING ENDPOINTS (VOICE & VIDEO CALLS)
        // =========================================================================

        // Start Call / Outgoing Call Offer
        if (url === "/api/sync/call/start" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk: any) => (body += chunk));
          req.on("end", () => {
            try {
              const callSession = JSON.parse(body);
              const activeCalls = readActiveCalls();
              activeCalls[callSession.callId] = {
                ...callSession,
                status: "RINGING",
                startedAt: Date.now(),
              };
              saveActiveCalls(activeCalls);
              broadcast("call_incoming", callSession);
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Access-Control-Allow-Origin", "*");
              res.end(JSON.stringify({ success: true, call: activeCalls[callSession.callId] }));
            } catch (e: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        // Answer Call / Accept Offer
        if (url === "/api/sync/call/answer" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk: any) => (body += chunk));
          req.on("end", () => {
            try {
              const { callId, answer, responderId } = JSON.parse(body);
              const activeCalls = readActiveCalls();
              if (activeCalls[callId]) {
                activeCalls[callId].status = "CONNECTED";
                activeCalls[callId].answeredAt = Date.now();
                activeCalls[callId].answer = answer;
                saveActiveCalls(activeCalls);
                broadcast("call_answered", { callId, answer, responderId, call: activeCalls[callId] });
              }
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Access-Control-Allow-Origin", "*");
              res.end(JSON.stringify({ success: true, call: activeCalls[callId] }));
            } catch (e: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        // ICE Candidate Relay for WebRTC
        if (url === "/api/sync/call/ice" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk: any) => (body += chunk));
          req.on("end", () => {
            try {
              const { callId, candidate, senderId, targetId } = JSON.parse(body);
              const activeCalls = readActiveCalls();
              if (activeCalls[callId]) {
                activeCalls[callId].candidates = activeCalls[callId].candidates || [];
                activeCalls[callId].candidates.push({ candidate, senderId, targetId });
                saveActiveCalls(activeCalls);
              }
              broadcast("call_ice_candidate", { callId, candidate, senderId, targetId });
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Access-Control-Allow-Origin", "*");
              res.end(JSON.stringify({ success: true }));
            } catch (e: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        // Real-Time LAN Audio Packet Stream Relay (Guaranteed 2-Way Voice Delivery)
        if (url === "/api/sync/call/audio-packet" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk: any) => (body += chunk));
          req.on("end", () => {
            try {
              const { callId, senderId, targetId, audioBase64 } = JSON.parse(body);
              broadcast("call_audio_packet", { callId, senderId, targetId, audioBase64 });
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Access-Control-Allow-Origin", "*");
              res.end(JSON.stringify({ success: true }));
            } catch (e: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        // End Call / Decline Call
        if (url === "/api/sync/call/end" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk: any) => (body += chunk));
          req.on("end", () => {
            try {
              const { callId, endedBy, reason, durationSeconds } = JSON.parse(body);
              const activeCalls = readActiveCalls();
              const call = activeCalls[callId];
              delete activeCalls[callId];
              saveActiveCalls(activeCalls);

              // Auto-log call to shared messages stream
              if (call) {
                const isAudio = call.callType === "audio";
                const icon = isAudio ? "📞" : "🎥";
                const typeText = isAudio ? "Audio Call" : "Video Call";
                const durText = durationSeconds
                  ? `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`
                  : reason === "declined"
                  ? "Declined"
                  : "Missed Call";

                const logMessage = {
                  id: `msg-call-${Date.now()}`,
                  senderId: call.callerId,
                  senderName: call.callerName,
                  senderRole: call.callerRole,
                  senderAvatarBg: call.callerAvatarBg || "#2563EB",
                  recipientId: call.recipientId,
                  content: `${icon} ${typeText} · ${durText}`,
                  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  reactions: [],
                };

                const currentMsgs = readMessages();
                saveMessages([...currentMsgs, logMessage]);
                broadcast("new_message", logMessage);
              }

              broadcast("call_ended", { callId, endedBy, reason, durationSeconds });
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Access-Control-Allow-Origin", "*");
              res.end(JSON.stringify({ success: true }));
            } catch (e: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        // Get Call Status
        if (url === "/api/sync/call/status") {
          const activeCalls = readActiveCalls();
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.end(JSON.stringify(activeCalls));
          return;
        }

        // ==========================================
        // EMAIL AUTOMATION & DRIP CAMPAIGN API
        // ==========================================

        // Email Templates CRUD
        if (url === "/api/sync/email/templates") {
          if (req.method === "GET") {
            try {
              const data = fs.existsSync(emailTemplatesFile)
                ? JSON.parse(fs.readFileSync(emailTemplatesFile, "utf-8"))
                : [];
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Access-Control-Allow-Origin", "*");
              res.end(JSON.stringify(data));
            } catch {
              res.end(JSON.stringify([]));
            }
            return;
          }

          if (req.method === "POST") {
            let body = "";
            req.on("data", chunk => (body += chunk));
            req.on("end", () => {
              try {
                const templates = JSON.parse(body);
                fs.writeFileSync(emailTemplatesFile, JSON.stringify(templates, null, 2), "utf-8");
                broadcast("email_templates_updated", templates);
                res.setHeader("Content-Type", "application/json");
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.end(JSON.stringify({ success: true, count: templates.length }));
              } catch (err: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }
        }

        // Email Automation Rules CRUD
        if (url === "/api/sync/email/automations") {
          if (req.method === "GET") {
            try {
              const data = fs.existsSync(emailAutomationsFile)
                ? JSON.parse(fs.readFileSync(emailAutomationsFile, "utf-8"))
                : [];
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Access-Control-Allow-Origin", "*");
              res.end(JSON.stringify(data));
            } catch {
              res.end(JSON.stringify([]));
            }
            return;
          }

          if (req.method === "POST") {
            let body = "";
            req.on("data", chunk => (body += chunk));
            req.on("end", () => {
              try {
                const automations = JSON.parse(body);
                fs.writeFileSync(emailAutomationsFile, JSON.stringify(automations, null, 2), "utf-8");
                broadcast("email_automations_updated", automations);
                res.setHeader("Content-Type", "application/json");
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.end(JSON.stringify({ success: true, count: automations.length }));
              } catch (err: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }
        }

        // Email Activity Logs
        if (url === "/api/sync/email/logs") {
          if (req.method === "GET") {
            try {
              const data = fs.existsSync(emailLogsFile)
                ? JSON.parse(fs.readFileSync(emailLogsFile, "utf-8"))
                : [];
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Access-Control-Allow-Origin", "*");
              res.end(JSON.stringify(data));
            } catch {
              res.end(JSON.stringify([]));
            }
            return;
          }

          if (req.method === "POST") {
            let body = "";
            req.on("data", chunk => (body += chunk));
            req.on("end", () => {
              try {
                const newLog = JSON.parse(body);
                const currentLogs = fs.existsSync(emailLogsFile)
                  ? JSON.parse(fs.readFileSync(emailLogsFile, "utf-8"))
                  : [];
                const updated = [newLog, ...currentLogs].slice(0, 1000);
                fs.writeFileSync(emailLogsFile, JSON.stringify(updated, null, 2), "utf-8");
                broadcast("email_log_added", newLog);
                res.setHeader("Content-Type", "application/json");
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.end(JSON.stringify({ success: true, log: newLog }));
              } catch (err: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }
        }

        // Email Settings / SMTP Provider
        if (url === "/api/sync/email/settings") {
          if (req.method === "GET") {
            try {
              const data = fs.existsSync(emailSettingsFile)
                ? JSON.parse(fs.readFileSync(emailSettingsFile, "utf-8"))
                : {};
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Access-Control-Allow-Origin", "*");
              res.end(JSON.stringify(data));
            } catch {
              res.end(JSON.stringify({}));
            }
            return;
          }

          if (req.method === "POST") {
            let body = "";
            req.on("data", chunk => (body += chunk));
            req.on("end", () => {
              try {
                const settings = JSON.parse(body);
                fs.writeFileSync(emailSettingsFile, JSON.stringify(settings, null, 2), "utf-8");
                res.setHeader("Content-Type", "application/json");
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.end(JSON.stringify({ success: true, settings }));
              } catch (err: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }
        }

        // Dispatch Email / Campaign Send with Real Delivery Transport
        if (url === "/api/sync/email/send" && req.method === "POST") {
          let body = "";
          req.on("data", chunk => (body += chunk));
          req.on("end", async () => {
            try {
              const { to, toName, subject, bodyHtml, templateId, automationId, triggerEvent, studentId } = JSON.parse(body);
              
              // Load current SMTP / Provider settings
              const settings = fs.existsSync(emailSettingsFile)
                ? JSON.parse(fs.readFileSync(emailSettingsFile, "utf-8"))
                : {};

              let deliveryStatus: "DELIVERED" | "BOUNCED" = "DELIVERED";
              let deliveryError: string | null = null;
              let serverMessageId: string | null = null;

              const smtpUser = settings.smtpUser || settings.senderEmail;
              const smtpPass = settings.smtpPass || settings.apiKey;

              // 1. If Resend API Key is set
              if (settings.provider === "resend" || (settings.apiKey && settings.apiKey.startsWith("re_"))) {
                try {
                  const resendRes = await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${settings.apiKey}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      from: `${settings.senderName || "AECS Admissions"} <onboarding@resend.dev>`,
                      to: [to],
                      subject: subject,
                      html: bodyHtml,
                    }),
                  });
                  const resendData: any = await resendRes.json();
                  if (!resendRes.ok) {
                    deliveryStatus = "BOUNCED";
                    deliveryError = resendData.message || "Resend dispatch failed";
                  } else {
                    serverMessageId = resendData.id;
                  }
                } catch (e: any) {
                  deliveryStatus = "BOUNCED";
                  deliveryError = e.message;
                }
              }
              // 2. If SMTP / Gmail credentials are configured
              else if (smtpUser && smtpPass) {
                try {
                  const transporter = nodemailer.createTransport({
                    host: settings.smtpHost || "smtp.gmail.com",
                    port: Number(settings.smtpPort) || 587,
                    secure: Number(settings.smtpPort) === 465,
                    auth: {
                      user: smtpUser,
                      pass: smtpPass,
                    },
                    tls: {
                      rejectUnauthorized: false,
                    },
                  });

                  const mailInfo = await transporter.sendMail({
                    from: `"${settings.senderName || "AECS Global Admissions"}" <${settings.senderEmail || smtpUser}>`,
                    to: to,
                    replyTo: settings.replyTo || settings.senderEmail || smtpUser,
                    subject: subject,
                    html: `
                      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1E293B; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; background: #ffffff;">
                        <div style="background: #2563EB; color: #ffffff; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center;">
                          <h2 style="margin: 0; font-size: 18px; color: #ffffff; font-weight: 800;">AECS Education Consultancy</h2>
                        </div>
                        <div style="padding: 24px; line-height: 1.6; font-size: 14px; color: #1E293B;">
                          ${bodyHtml}
                        </div>
                        <div style="background: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 16px 24px; font-size: 11px; color: #64748B; text-align: center;">
                          AECS Education Consultancy Pvt. Ltd. · Putalisadak, Kathmandu, Nepal · Tel: +977 1 4420000<br/>
                          Official Education Agent for Australia, UK, USA, Canada & New Zealand.
                        </div>
                      </div>
                    `,
                  });
                  serverMessageId = mailInfo.messageId;
                } catch (e: any) {
                  deliveryStatus = "BOUNCED";
                  deliveryError = e.message;
                }
              } else {
                // Inform user in log that SMTP credentials are required for real inbox delivery
                deliveryStatus = "BOUNCED";
                deliveryError = "No SMTP App Password configured in Settings -> SMTP & Sender tab.";
              }

              const logEntry = {
                id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                to,
                toName: toName || to.split("@")[0],
                subject,
                templateId: templateId || "custom",
                automationId: automationId || null,
                triggerEvent: triggerEvent || "Manual Send",
                studentId: studentId || null,
                status: deliveryStatus,
                error: deliveryError,
                messageId: serverMessageId,
                deliveredAt: new Date().toISOString(),
                openedAt: deliveryStatus === "DELIVERED" ? new Date().toISOString() : null,
                clickedAt: null,
                previewSnippet: bodyHtml ? bodyHtml.replace(/<[^>]+>/g, "").substring(0, 120) + "…" : "",
              };

              const currentLogs = fs.existsSync(emailLogsFile)
                ? JSON.parse(fs.readFileSync(emailLogsFile, "utf-8"))
                : [];
              const updated = [logEntry, ...currentLogs].slice(0, 1000);
              fs.writeFileSync(emailLogsFile, JSON.stringify(updated, null, 2), "utf-8");

              broadcast("email_sent", logEntry);
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Access-Control-Allow-Origin", "*");
              res.end(JSON.stringify({ success: deliveryStatus === "DELIVERED", log: logEntry, error: deliveryError }));
            } catch (err: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // Test SMTP Connection Endpoint
        if (url === "/api/sync/email/test-connection" && req.method === "POST") {
          let body = "";
          req.on("data", chunk => (body += chunk));
          req.on("end", async () => {
            try {
              const testConfig = JSON.parse(body);
              const smtpUser = testConfig.smtpUser || testConfig.senderEmail;
              const smtpPass = testConfig.smtpPass || testConfig.apiKey;

              if (!smtpUser || !smtpPass) {
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: false, error: "Please provide both SMTP User/Email and Password/API Key." }));
                return;
              }

              const transporter = nodemailer.createTransport({
                host: testConfig.smtpHost || "smtp.gmail.com",
                port: Number(testConfig.smtpPort) || 587,
                secure: Number(testConfig.smtpPort) === 465,
                auth: {
                  user: smtpUser,
                  pass: smtpPass,
                },
                tls: {
                  rejectUnauthorized: false,
                },
              });

              await transporter.verify();
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Access-Control-Allow-Origin", "*");
              res.end(JSON.stringify({ success: true, message: "250 OK: SMTP Authentication Successful!" }));
            } catch (err: any) {
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Access-Control-Allow-Origin", "*");
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), basicSsl(), crmSyncPlugin()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    cors: true,
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.indexOf("recharts") >= 0 || id.indexOf("d3-") >= 0) return "charts";
          if (id.indexOf("framer-motion") >= 0) return "motion";
          if (id.indexOf("@supabase") >= 0) return "supabase";
          if (id.indexOf("react") >= 0 || id.indexOf("scheduler") >= 0) return "react-vendor";
        },
      },
    },
  },
});
