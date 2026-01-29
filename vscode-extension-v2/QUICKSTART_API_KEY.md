# Quick Start: Secure API Key Setup

## 🎯 Recommended Method (30 seconds)

1. Open Command Palette: `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
2. Type: `DevCopilot v2: Set API Key`
3. Enter your API key (it will be hidden as you type)
4. Done! Your key is now stored securely

## 🔑 Where to Get an API Key

### Groq (Recommended - Free & Fast)
1. Go to [https://console.groq.com](https://console.groq.com)
2. Sign up (it's free!)
3. Navigate to API Keys
4. Create a new key
5. Copy and use in DevCopilot

### OpenAI (Alternative)
1. Go to [https://platform.openai.com](https://platform.openai.com)
2. Sign up and add payment method
3. Navigate to API Keys
4. Create a new key
5. Copy and use in DevCopilot

## 🌍 Alternative: Environment Variable

**Windows (PowerShell):**
```powershell
$env:LLM_API_KEY="your-key-here"
```

**macOS/Linux:**
```bash
export LLM_API_KEY="your-key-here"
```

Then restart VS Code.

## ✅ Verify Your Setup

1. Run any DevCopilot command (e.g., "Search Code (HyDE)")
2. If prompted for API key, follow the setup steps
3. If search works, you're all set!

## ❓ Troubleshooting

**"API key not configured" error?**
- Run "DevCopilot v2: Set API Key" command
- Or set `LLM_API_KEY` environment variable and restart VS Code

**Need to update your key?**
- Just run "Set API Key" command again with the new key

**Key not working?**
- Verify it's valid at your provider's dashboard
- Make sure you have API credits/quota available
- Check that you copied the entire key (no spaces)

## 🔒 Security Note

✅ **Secure**: Keys stored in OS-level encrypted storage  
✅ **Private**: Never synced to cloud or exposed in files  
✅ **Safe**: Can't be accessed by other extensions  

❌ **Don't**: Store keys in settings.json or commit them to git

---

**Need more help?** See the full [README.md](README.md) or [SECURITY.md](SECURITY.md)
