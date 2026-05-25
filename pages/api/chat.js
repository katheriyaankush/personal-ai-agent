import { retrieveContext } from '../../lib/rag.js';

const SYSTEM_PROMPT = `You are Ankush Katharia's AI Portfolio Assistant. You represent Ankush in a professional, friendly, and impressive manner.

IMPORTANT: You will be given CONTEXT retrieved from Ankush's knowledge base. Answer questions ONLY based on the provided context. If the context doesn't contain enough information to answer, use the record_unknown_question tool.

## Rules
- Answer based on the provided context
- Be professional, concise, and accurate
- Highlight relevant experience with specific numbers and metrics
- If asked about something not in the context, ALWAYS call record_unknown_question tool
- After calling the tool, tell the user: "I've forwarded your question to Ankush along with your contact details. He'll personally get back to you soon! 📧"
- Keep responses focused (2-4 paragraphs max unless detailed explanation needed)
- Position Ankush as a senior leader who can both architect and execute
`;

// Tool definition for recording unknown questions
const TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'record_unknown_question',
        description: "Always use this tool to record any question that couldn't be answered because you didn't know the answer. Use it for anything outside Ankush's professional background.",
        parameters: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: 'The question that could not be answered',
            },
          },
          required: ['question'],
        },
      },
    ],
  },
];

// Send email notification for unknown question
async function sendUnknownQuestionEmail(question, visitorEmail, visitorPhone) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn('[Tool] RESEND_API_KEY not set — skipping email');
    return;
  }
  const { Resend } = await import('resend');
  const resend = new Resend(resendKey);
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'desiankush143@gmail.com',
      subject: `❓ Unanswered question from your AI Portfolio`,
      html: `
        <div style="font-family: Inter, Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #0f0f0f; color: #fafafa; border-radius: 12px; overflow: hidden; border: 1px solid #2a2a2a;">
          <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 24px 28px;">
            <h1 style="margin: 0; font-size: 20px; color: white;">❓ Unanswered Question</h1>
            <p style="margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 13px;">Your AI Portfolio couldn't answer this — follow up needed</p>
          </div>
          <div style="padding: 24px 28px;">
            <div style="background: #1c1c1c; border: 1px solid #2a2a2a; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
              <p style="margin: 0; font-size: 15px; color: #fafafa; line-height: 1.6;">"${question}"</p>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #2a2a2a; color: #737373; font-size: 11px; text-transform: uppercase; width: 100px;">Visitor Email</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #2a2a2a; color: #34d399; font-size: 13px;">${visitorEmail || 'Not provided'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #2a2a2a; color: #737373; font-size: 11px; text-transform: uppercase;">Phone</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #2a2a2a; color: #fafafa; font-size: 13px;">${visitorPhone || 'Not provided'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #737373; font-size: 11px; text-transform: uppercase;">Time (IST)</td>
                <td style="padding: 8px 0; color: #fafafa; font-size: 13px;">${now}</td>
              </tr>
            </table>
          </div>
          <div style="padding: 14px 28px; border-top: 1px solid #2a2a2a; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #737373;">Ankush Katharia • AI Portfolio Assistant</p>
          </div>
        </div>
      `,
    });
    console.log(`[Tool] Unknown question email sent for: "${question.slice(0, 60)}"`);
  } catch (err) {
    console.error('[Tool] Failed to send unknown question email:', err.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, history = [], visitorEmail, visitorPhone } = req.body;

  console.log(`[Chat] Incoming request — message: "${message?.slice(0, 60)}${message?.length > 60 ? '...' : ''}", history length: ${history.length}`);

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured. Please set GEMINI_API_KEY in .env.local' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const contents = [
    { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
    { role: 'model', parts: [{ text: "I understand. I am Ankush Katharia's AI Portfolio Assistant powered by RAG. I will retrieve relevant context from the knowledge base to answer questions. If I cannot find the answer, I will use the record_unknown_question tool. How can I help you?" }] },
    ...history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    })),
  ];

  // ── RAG: Retrieve relevant context for the user's question ──
  let ragContext = '';
  try {
    ragContext = await retrieveContext(message, apiKey, 4);
    console.log('[RAG] Context retrieved successfully');
  } catch (ragErr) {
    console.error('[RAG] Failed to retrieve context:', ragErr.message);
    ragContext = 'No context available — answer based on general knowledge about Ankush.';
  }

  // Build the final user message with RAG context injected
  const userMessageWithContext = `## Retrieved Context from Knowledge Base:\n${ragContext}\n\n## User Question:\n${message}`;
  contents.push({ role: 'user', parts: [{ text: userMessageWithContext }] });

  const generationConfig = { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 2048 };

  try {
    // ── Phase 1: Non-streaming call with tools to detect function calls ──
    console.log('[Chat] Phase 1 — checking for tool calls');
    const phase1Res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
        body: JSON.stringify({ contents, tools: TOOLS, generationConfig }),
      }
    );

    if (!phase1Res.ok) {
      const errText = await phase1Res.text();
      console.error('=== Gemini Phase 1 Error ===', phase1Res.status, errText);
      res.write(`data: ${JSON.stringify({ error: `Gemini API error ${phase1Res.status}` })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const phase1Data = await phase1Res.json();
    const candidate = phase1Data.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    // Check if Gemini wants to call our tool
    const functionCallPart = parts.find(p => p.functionCall);

    if (functionCallPart) {
      const { name, args } = functionCallPart.functionCall;
      console.log(`[Chat] Tool call detected: ${name}`, args);

      if (name === 'record_unknown_question') {
        // Fire email in background — don't await to keep response fast
        sendUnknownQuestionEmail(args.question, visitorEmail, visitorPhone);

        // ── Phase 2: Send tool result back and get final response (streaming) ──
        const contentsWithTool = [
          ...contents,
          { role: 'model', parts: [{ functionCall: { name, args } }] },
          {
            role: 'user',
            parts: [{
              functionResponse: {
                name,
                response: { recorded: true, message: 'Question recorded and email sent to Ankush.' },
              },
            }],
          },
        ];

        console.log('[Chat] Phase 2 — streaming final response after tool call');
        const phase2Res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:streamGenerateContent?alt=sse`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
            body: JSON.stringify({ contents: contentsWithTool, generationConfig }),
          }
        );

        if (!phase2Res.ok) {
          const errText = await phase2Res.text();
          console.error('=== Gemini Phase 2 Error ===', phase2Res.status, errText);
          // Fallback friendly message
          const visitorContact = visitorEmail ? `at **${visitorEmail}**` : 'with your contact details';
          res.write(`data: ${JSON.stringify({ text: `I don't have that information in my knowledge base, but I've forwarded your **question** and **contact** details to Ankush at **katheriyaankush@gmail.com**. He'll get back to you soon! 📧` })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }

        await streamResponse(phase2Res, res);
        return;
      }
    }

    // ── No tool call — stream the direct answer ──
    console.log('[Chat] No tool call — streaming direct answer');
    const streamRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:streamGenerateContent?alt=sse`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
        body: JSON.stringify({ contents, tools: TOOLS, generationConfig }),
      }
    );

    if (!streamRes.ok) {
      const errText = await streamRes.text();
      console.error('=== Gemini Stream Error ===', streamRes.status, errText);
      res.write(`data: ${JSON.stringify({ error: `Gemini API error ${streamRes.status}` })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    await streamResponse(streamRes, res);

  } catch (error) {
    console.error('=== Chat Handler Error ===');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('=========================');
    res.write(`data: ${JSON.stringify({ error: 'Internal server error' })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
}

// Helper: pipe a Gemini SSE stream to the client
async function streamResponse(geminiRes, res) {
  const reader = geminiRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (!data) continue;
        try {
          const parsed = JSON.parse(data);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
        } catch (e) {
          console.warn('[Stream] Failed to parse chunk:', e.message);
        }
      }
    }
  }

  // Flush remaining buffer
  if (buffer.startsWith('data: ')) {
    const data = buffer.slice(6).trim();
    if (data) {
      try {
        const parsed = JSON.parse(data);
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
      } catch (e) { /* ignore */ }
    }
  }

  res.write('data: [DONE]\n\n');
  res.end();
}
