import Head from "next/head";
import Image from "next/image";
import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const SUGGESTED_QUESTIONS = [
  "What projects has Ankush worked on?",
  "What cloud and AI tools does he know?",
  "Show backend scaling projects.",
  "What is his strongest skill?",
  "Why should we hire Ankush?",
];

const TIMELINE = [
  { year: "2025 - Present", role: "Architect Fullstack Manager", company: "Tredence Inc.", desc: "Leading 10+ engineers, EA Sports ReefChat, BDD Forge, Vertex AI", highlight: true },
  { year: "2020 - 2025", role: "Technical Lead", company: "HCL Tech", desc: "BlueJeans (Verizon) Video SDK, Uber Delivery App" },
  { year: "2020", role: "Assistant Manager", company: "Ola Cabs", desc: "IVR System & Real-time Dashboard" },
  { year: "2019 - 2020", role: "Sr. Product Engineer", company: "Flipkart", desc: "Unified Communication, IVR & Analytics Dashboard" },
  { year: "2019", role: "Sr. Software Engineer", company: "Swiggy", desc: "Food delivery platform engineering" },
  { year: "2015 - 2019", role: "Sr. Product Engineer", company: "Drishti Soft (Ameyo/Exotel)", desc: "CRM System, IVR Integration, 50+ enterprise clients" },
];

const SKILLS = [
  { name: "React.js / Next.js", level: 95, years: "8+" },
  { name: "Node.js", level: 92, years: "8+" },
  { name: "JavaScript / TypeScript", level: 95, years: "10+" },
  { name: "Databases (SQL & NoSQL)", level: 90, years: "8+" },
  { name: "AWS", level: 82, years: "4+" },
  { name: "GenAI / RAG / Agentic AI", level: 80, years: "2+" },
  { name: "System Design & Architecture", level: 88, years: "6+" },
  { name: "Team Leadership", level: 90, years: "5+" },
  { name: "Azure / GCP", level: 75, years: "2+" },
  { name: "Docker / DevOps", level: 78, years: "3+" },
];

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [showWelcome, setShowWelcome] = useState(true);
  const [showContact, setShowContact] = useState(false);
  const [streamingText, setStreamingText] = useState("");

  // Login gate state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ name: "", email: "", phone: "" });
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") setShowContact(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!loginForm.email.trim()) {
      setLoginError("Email address is required.");
      return;
    }
    if (!emailRegex.test(loginForm.email.trim())) {
      setLoginError("Please enter a valid email address.");
      return;
    }
    setLoginLoading(true);
    try {
      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: loginForm.name.trim(),
          email: loginForm.email.trim(),
          phone: loginForm.phone.trim(),
        }),
      });
    } catch (_) {
      // Don't block login on network error
    }
    setLoginLoading(false);
    setIsLoggedIn(true);
  };

  const sendMessage = useCallback(async (text) => {    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    setShowWelcome(false);
    const userMessage = { role: "user", content: messageText };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStreamingText("");

    try {
      const history = [...messages];
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          history,
          visitorEmail: loginForm.email,
          visitorPhone: loginForm.phone,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Sorry, I encountered an error: ${errorData.error || "Unknown error"}` },
        ]);
        setIsLoading(false);
        return;
      }

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") break;
            if (!data) continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                fullText += `\n\nError: ${parsed.error}`;
                setStreamingText(fullText);
              } else if (parsed.text) {
                fullText += parsed.text;
                setStreamingText(fullText);
              }
            } catch (e) {
              // Skip malformed chunks
            }
          }
        }
      }

      // Finalize message
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: fullText || "I apologize, I could not generate a response. Please try again." },
      ]);
      setStreamingText("");
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
      setStreamingText("");
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      <Head>
        <title>Ankush Katharia | AI Portfolio Assistant</title>
        <meta name="description" content="Interactive AI-powered portfolio assistant for Ankush Katharia - Full Stack Architect Manager with 10+ years of experience" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link rel="icon" href="/favicon.ico" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div className="app">
        {/* Animated Background */}
        <div className="bg-animation">
          <div className="bg-gradient"></div>
          <div className="bg-grid"></div>
          <div className="floating-orb orb-1"></div>
          <div className="floating-orb orb-2"></div>
          <div className="floating-orb orb-3"></div>
        </div>

        {/* Login Gate */}
        {!isLoggedIn && (
          <div className="login-overlay">
            <div className="login-card">
              <div className="login-profile">
                <Image src="/profile.jpeg" alt="Ankush Katharia" width={72} height={72} className="login-avatar" />
                <h1 className="login-name">Ankush Katharia</h1>
                <p className="login-role">Full Stack Architect Manager • 10+ Years</p>
                <div className="login-badges">
                  <span className="login-badge">React 8yr</span>
                  <span className="login-badge">Node 8yr</span>
                  <span className="login-badge">GenAI 2yr</span>
                  <span className="login-badge">AWS 4yr</span>
                </div>
              </div>

              <div className="login-divider">
                <span>Enter your details to start chatting</span>
              </div>

              <form className="login-form" onSubmit={handleLogin} noValidate>
                <div className="login-field">
                  <label className="login-label">Name <span className="optional">(optional)</span></label>
                  <input
                    type="text"
                    className="login-input"
                    placeholder="Your name"
                    value={loginForm.name}
                    onChange={(e) => setLoginForm(f => ({ ...f, name: e.target.value }))}
                    autoComplete="name"
                  />
                </div>
                <div className="login-field">
                  <label className="login-label">Email <span className="required">*</span></label>
                  <input
                    type="email"
                    className={`login-input ${loginError ? "input-error" : ""}`}
                    placeholder="your@email.com"
                    value={loginForm.email}
                    onChange={(e) => { setLoginForm(f => ({ ...f, email: e.target.value })); setLoginError(""); }}
                    autoComplete="email"
                    required
                  />
                  {loginError && <p className="login-error">{loginError}</p>}
                </div>
                <div className="login-field">
                  <label className="login-label">Phone <span className="optional">(optional)</span></label>
                  <input
                    type="tel"
                    className="login-input"
                    placeholder="+91 98765 43210"
                    value={loginForm.phone}
                    onChange={(e) => setLoginForm(f => ({ ...f, phone: e.target.value }))}
                    autoComplete="tel"
                  />
                </div>
                <button type="submit" className="login-btn" disabled={loginLoading}>
                  {loginLoading ? (
                    <span className="login-spinner"></span>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      Start Chatting
                    </>
                  )}
                </button>
              </form>

              <p className="login-note">
                Your details help Ankush know who visited his portfolio. No spam, ever.
              </p>
            </div>
          </div>
        )}

        {/* Contact Modal */}
        {showContact && (
          <div className="modal-overlay" onClick={() => setShowContact(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowContact(false)} aria-label="Close">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
              <div className="modal-header">
                <Image src="/profile.jpeg" alt="Ankush Katharia" width={64} height={64} className="modal-avatar-img" />
                <h2>Ankush Katharia</h2>
                <p className="modal-role">Full Stack Architect Manager</p>
              </div>
              <div className="modal-body">
                <a href="tel:+918130935017" className="contact-item">
                  <div className="contact-icon phone-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                  </div>
                  <div className="contact-detail">
                    <span className="contact-value">+91 8130935017</span>
                  </div>
                </a>
                <a href="mailto:katheriyaankush@gmail.com" className="contact-item">
                  <div className="contact-icon email-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </div>
                  <div className="contact-detail">
                    <span className="contact-value">katheriyaankush@gmail.com</span>
                  </div>
                </a>
                <a href="https://www.linkedin.com/in/ankush-katharia-738036b1/" target="_blank" rel="noopener noreferrer" className="contact-item">
                  <div className="contact-icon linkedin-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
                      <rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
                    </svg>
                  </div>
                  <div className="contact-detail">
                    <span className="contact-value">ankushkatharia-738036b1</span>
                  </div>
                </a>
                <div className="contact-item no-hover">
                  <div className="contact-icon location-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                  </div>
                  <div className="contact-detail">
                    <span className="contact-value">Bangalore, India</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <a href="/Ankush-Katharia-Resume.pdf" download className="download-resume-btn">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download Resume
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <header className="header">
          <div className="header-content">
            <div className="logo-section">
              <div className="avatar-ring">
                <Image src="/profile.jpeg" alt="Ankush Katharia" width={40} height={40} className="avatar-img" />
              </div>
              <div className="header-info">
                <h1 className="name">Ankush Katharia</h1>
                <p className="title">Full Stack Architect Manager</p>
              </div>
            </div>
            <div className="header-actions">
              <span className="status-badge">
                <span className="status-dot"></span>
                Available
              </span>
              <a href="/Ankush-Katharia-Resume.pdf" download className="resume-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                <span className="btn-label">Resume</span>
              </a>
              <button className="contact-btn" onClick={() => setShowContact(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <span className="btn-label">Contact</span>
              </button>
            </div>
          </div>
        </header>

        {/* Navigation Tabs */}
        <nav className="tabs">
          <button className={`tab ${activeTab === "chat" ? "active" : ""}`} onClick={() => setActiveTab("chat")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            AI Chat
          </button>
          <button className={`tab ${activeTab === "timeline" ? "active" : ""}`} onClick={() => setActiveTab("timeline")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            Experience
          </button>
          <button className={`tab ${activeTab === "skills" ? "active" : ""}`} onClick={() => setActiveTab("skills")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            Skills
          </button>
        </nav>

        {/* Main Content */}
        <main className="main-content">
          {activeTab === "chat" && (
            <div className="chat-container">
              <div className="messages-area">
                {showWelcome && (
                  <div className="welcome-section">
                    <div className="welcome-icon">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                    </div>
                    <h2 className="welcome-title">Hi! I&apos;m Ankush&apos;s AI Assistant 👋</h2>
                    <p className="welcome-subtitle">
                      I can tell you about Ankush&apos;s 10+ years of experience building scalable
                      applications at companies like Tredence, HCL/Verizon, Flipkart, Ola &amp; more.
                      Ask me anything!
                    </p>
                    <div className="quick-stats">
                      <div className="stat"><span className="stat-number">10+</span><span className="stat-label">Years Exp</span></div>
                      <div className="stat"><span className="stat-number">4+</span><span className="stat-label">Companies</span></div>
                      <div className="stat"><span className="stat-number">10+</span><span className="stat-label">Team Size</span></div>
                      <div className="stat"><span className="stat-number">8+</span><span className="stat-label">React/Node</span></div>
                    </div>
                    <div className="suggested-questions">
                      {SUGGESTED_QUESTIONS.map((q, i) => (
                        <button key={i} className="suggestion-chip" onClick={() => sendMessage(q)}>{q}</button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div key={i} className={`message ${msg.role === "user" ? "user-message" : "ai-message"}`}>
                    {msg.role === "assistant" && (
                      <div className="message-avatar">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                      </div>
                    )}
                    <div className="message-content">
                      {msg.role === "assistant" ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      ) : (
                        <p>{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}

                {/* Streaming message */}
                {isLoading && streamingText && (
                  <div className="message ai-message">
                    <div className="message-avatar">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                    </div>
                    <div className="message-content streaming">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
                      <span className="cursor-blink">▊</span>
                    </div>
                  </div>
                )}

                {/* Typing indicator before stream starts */}
                {isLoading && !streamingText && (
                  <div className="message ai-message">
                    <div className="message-avatar">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                    </div>
                    <div className="typing-indicator"><span></span><span></span><span></span></div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="input-area">
                <div className="input-wrapper">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about experience.."
                    rows={1}
                    className="chat-input"
                  />
                  <button onClick={() => sendMessage()} disabled={!input.trim() || isLoading} className="send-btn" aria-label="Send message">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  </button>
                </div>
                <p className="input-hint">Powered by AI • Press Enter to send</p>
              </div>
            </div>
          )}

          {/* Timeline Tab */}
          {activeTab === "timeline" && (
            <div className="timeline-container">
              <h2 className="section-title">Career Journey</h2>
              <p className="section-subtitle">10+ years of building products at scale across top companies</p>
              <div className="timeline">
                {TIMELINE.map((item, i) => (
                  <div key={i} className={`timeline-item ${item.highlight ? "highlight" : ""}`}>
                    <div className="timeline-dot"></div>
                    <div className="timeline-content">
                      <span className="timeline-year">{item.year}</span>
                      <h3 className="timeline-role">{item.role}</h3>
                      <p className="timeline-company">{item.company}</p>
                      <p className="timeline-desc">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="timeline-cta">
                <p>Want to know more about any role or project?</p>
                <button className="cta-btn" onClick={() => { setActiveTab("chat"); setTimeout(() => { setInput("Tell me about Ankush's most impactful projects."); inputRef.current?.focus(); }, 100); }}>
                  Ask the AI Assistant →
                </button>
              </div>
            </div>
          )}

          {/* Skills Tab */}
          {activeTab === "skills" && (
            <div className="skills-container">
              <h2 className="section-title">Technical Expertise</h2>
              <p className="section-subtitle">Deep expertise across the full stack with years of production experience</p>
              <div className="skills-grid">
                {SKILLS.map((skill, i) => (
                  <div key={i} className="skill-card">
                    <div className="skill-header">
                      <span className="skill-name">{skill.name}</span>
                      <span className="skill-years">{skill.years} yrs</span>
                    </div>
                    <div className="skill-bar">
                      <div className="skill-fill" style={{ width: `${skill.level}%`, animationDelay: `${i * 0.1}s` }}></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="tech-tags">
                <h3>Full Technology Stack</h3>
                <div className="tags-grid">
                  {["React.js","Next.js","Node.js","TypeScript","JavaScript","Redux","MobX","RemixJS","Express.js","MongoDB","PostgreSQL","MySQL","DynamoDB","Redis","GraphQL","REST APIs","WebSocket","AWS Lambda","AWS S3","CloudFront","Docker","Azure Functions","GCP Vertex AI","GenAI","RAG","Agentic AI","OpenAI","LLM","Microservices","Serverless","CI/CD","Shopify APIs","Jira","Git","Agile/Scrum"].map((tag, i) => (
                    <span key={i} className="tech-tag">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="footer">
          <p>
            Built with Next.js &amp; AI by Ankush Katharia •{" "}
            <button className="footer-link" onClick={() => setShowContact(true)}>Contact</button>
            {" "}•{" "}
            <a href="https://www.linkedin.com/in/ankush-katharia-738036b1/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
            {" "}•{" "}
            <a href="/Ankush-Katharia-Resume.pdf" download>Download Resume</a>
          </p>
        </footer>
      </div>
    </>
  );
}
