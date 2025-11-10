import React, { useState } from "react";

const ChatPopup = ({ aiData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [userName, setUserName] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `Hey there! 👋 I'm your HomePod AI — the caffeine-fueled assistant ☕ ready to help! 
But first things first... what should I call you? 😄`
    }
  ]);
  const [loading, setLoading] = useState(false);

  // 💡 Replace this with your actual Gemini API key
  const GEMINI_API_KEY = "AIzaSyAl67WwtFQKBhZndkPzjRKq9PQw-1LYu8E";

  const togglePopup = () => setIsOpen(!isOpen);

const sendMessage = async () => {
  if (!input.trim()) return;

  if (!userName) {
    setUserName(input.trim());
    setMessages((prev) => [
      ...prev,
      { role: "user", content: input },
      {
        role: "assistant",
        content: `Awesome, ${input.trim()}! 😎 Glad to have you here. Would you like me to show your latest dashboard charts and stats? 📊`
      }
    ]);
    setInput("");
    setLoading(false);
    return;
  }

  const userMessage = { role: "user", content: input };
  setMessages((prev) => [...prev, userMessage]);
  setInput("");
  setLoading(true);
  console.log('aiData snapshot:', aiData);

  try {
    // ⏳ Prevent hitting rate limit by waiting 1 second before sending the request
    await new Promise(resolve => setTimeout(resolve, 1000));
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
text: `
You are HomePod AI — the witty, smart assistant of the HomePod Servers dashboard. 
You have two types of data available: 
1️⃣ Local Folder Data — aiData.folderCount, aiData.fileCount, etc. (for current folder)
2️⃣ Global Dashboard Data — aiData.globalStats (for all user files)

Use these to answer naturally. 
If the user asks "How many folders are there?", use globalStats.totalFolders.
If they ask "How many files are in this folder?", use folderCount.

Here’s the data you know:
{
  "globalStats": ${JSON.stringify(aiData.globalStats || {}, null, 2)},
  "localFolder": ${JSON.stringify(aiData || {}, null, 2)}
}

When responding:
- If the data is 0, reply humorously (e.g. "Looks like we’re keeping it minimalist here, 0 files!").
- If the user asks about totals, use the global data.
- Keep your tone warm, witty, and human-like.
- Avoid repeating numbers unless directly asked.

User (${userName || "Guest"}): ${input}
`,
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();

    // ✅ Correct way to extract Gemini’s response text
    const aiResponse =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      data?.candidates?.[0]?.output ||
      data?.error?.message ||
      "⚠️ No response text from Gemini.";

    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: aiResponse },
    ]);
  } catch (err) {
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "❌ Network error or invalid key" },
    ]);
  } finally {
    setLoading(false);
  }
};

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={togglePopup}
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          background: "#2563eb",
          color: "white",
          fontSize: "24px",
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
          border: "none",
          cursor: "pointer",
          zIndex: 9999,
        }}
      >
        💬
      </button>

      {/* Popup Chat Window */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: "90px",
            right: "20px",
            width: "360px",
            height: "480px",
            background: "#ffffff",
            borderRadius: "16px",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.1)",
            color: "#000000",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            border: "1px solid #e5e7eb",
            animation: "fadeInScale 0.3s ease forwards",
            zIndex: 10000,
          }}
        >
          <style>
            {`
              @keyframes fadeInScale {
                0% {
                  opacity: 0;
                  transform: scale(0.95);
                }
                100% {
                  opacity: 1;
                  transform: scale(1);
                }
              }
            `}
          </style>

          <div
            style={{
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              padding: "12px 16px",
              borderBottom: "1px solid #e5e7eb",
              fontWeight: "600",
              fontSize: "15px",
              color: "#1a1a1a",
            }}
          >
            <span style={{ marginRight: 8 }}>💬</span> AI ChatBot
          </div>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 16px",
              background: "#f9fafb",
              fontFamily:
                "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
              fontSize: "15px",
            }}
          >
            {messages.map((msg, i) => (
              <p
                key={i}
                style={{
                  maxWidth: "75%",
                  margin: "8px 0",
                  padding: "10px 14px",
                  borderRadius:
                    msg.role === "user"
                      ? "16px 16px 0 16px"
                      : "16px 16px 16px 0",
                  background:
                    msg.role === "user" ? "#2563eb" : "#f3f4f6",
                  color: msg.role === "user" ? "#ffffff" : "#1f2937",
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {msg.content}
              </p>
            ))}
          </div>

          <div
            style={{
              background: "#ffffff",
              borderTop: "1px solid #e5e7eb",
              padding: "12px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <input
              type="text"
              placeholder="Ask Homepod..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              style={{
                flex: 1,
                background: "#f3f4f6",
                border: "none",
                borderRadius: "20px",
                padding: "10px 14px",
                outline: "none",
                fontSize: "14px",
                color: "#111827",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) {
                  sendMessage();
                }
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading}
              style={{
                background: "#2563eb",
                borderRadius: "50%",
                border: "none",
                color: "#ffffff",
                fontSize: "18px",
                width: "38px",
                height: "38px",
                marginLeft: "8px",
                cursor: loading ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
            >
              {loading ? "..." : "➤"}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatPopup;