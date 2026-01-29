# Security Guide for DevCopilot v2

## Overview

DevCopilot v2 implements multiple layers of security to protect your API keys and maintain privacy of your codebase.

## API Key Security

### Recommended: SecretStorage (Most Secure)

**Use the built-in command:**
1. Open Command Palette (`Ctrl+Shift+P`)
2. Run: `DevCopilot v2: Set API Key`
3. Enter your API key when prompted

**How it works:**
- Keys are stored using VS Code's SecretStorage API
- Encrypted at the OS level:
  - **Windows**: Windows Credential Manager
  - **macOS**: Keychain
  - **Linux**: Secret Service API (libsecret)
- Never stored in plaintext files
- Not synced to cloud or included in backups
- Automatically cleared when extension is uninstalled

### Alternative: Environment Variable (Secure)

**Set the environment variable:**

**Windows (PowerShell):**
```powershell
$env:LLM_API_KEY="your-api-key-here"
```

**Windows (Command Prompt):**
```cmd
set LLM_API_KEY=your-api-key-here
```

**macOS/Linux:**
```bash
export LLM_API_KEY="your-api-key-here"
```

**Make it permanent:**
- Windows: Add to System Environment Variables via Control Panel
- macOS/Linux: Add to `~/.bashrc`, `~/.zshrc`, or equivalent

**Advantages:**
- Not stored in VS Code files
- Good for CI/CD and automated environments
- Can be managed via system-level tools

### Not Recommended: VS Code Settings

**Why it's discouraged:**
- Stored in plaintext in `settings.json`
- May be synced to cloud (VS Code Settings Sync)
- Exposed in backups and version control
- Visible to anyone with file system access

**Only use if:**
- Other methods are not available
- You understand the security implications
- The settings file is properly protected

## API Key Lookup Order

The extension checks for API keys in the following order:

1. **SecretStorage** (highest priority, most secure)
2. **Environment Variable** (`LLM_API_KEY`)
3. **VS Code Settings** (`devcopilotV2.apiKey`)

If no key is found, the extension will prompt you to configure one.

## Privacy & Data Protection

### What Stays Local

- **All code embeddings**: Generated and stored locally in ChromaDB
- **Your codebase**: Never uploaded to external servers
- **Search queries**: Processed locally using your embeddings
- **Repository structure**: Remains on your machine

### What's Sent to LLM API

Only the following data is sent to your configured LLM API:

1. **HyDE Search**: Your search query (e.g., "error handling functions") to generate hypothetical code
2. **RAG Queries**: Your question + retrieved code snippets (from your local embeddings) for context-aware answers
3. **PR Summarization**: Git diff output (changes only, not entire codebase) for summary generation

**No sensitive data is sent:**
- API keys are never included in logs or error messages
- File paths are sanitized before display
- Your full codebase is never transmitted

## Best Practices

### For Individual Developers

1. ✅ Use the "Set API Key" command for secure storage
2. ✅ Get a free API key from Groq (generous free tier)
3. ✅ Keep your API key private—never share or commit it
4. ✅ Use environment variables for automation/scripting
5. ❌ Never store API keys in `settings.json`
6. ❌ Never commit API keys to version control

### For Teams

1. ✅ Instruct team members to use "Set API Key" command
2. ✅ Document environment variable approach for CI/CD
3. ✅ Use separate API keys per developer/environment
4. ✅ Rotate API keys regularly
5. ❌ Never share API keys in team documentation
6. ❌ Never use the same key for development and production

### For CI/CD Environments

1. ✅ Use environment variables (`LLM_API_KEY`)
2. ✅ Store keys in secure secret management (GitHub Secrets, Azure Key Vault, etc.)
3. ✅ Use read-only or limited-scope API keys
4. ✅ Rotate keys regularly and audit usage
5. ❌ Never hardcode keys in scripts or config files

## Security Checklist

Before using DevCopilot v2 in production:

- [ ] API key stored securely (SecretStorage or environment variable)
- [ ] No API keys in `settings.json` or config files
- [ ] No API keys in version control (check `.gitignore`)
- [ ] API key has appropriate rate limits/quotas
- [ ] Team members trained on secure key management
- [ ] Separate keys for development/staging/production
- [ ] Regular API key rotation schedule established

## Reporting Security Issues

If you discover a security vulnerability in DevCopilot v2:

1. **Do not** open a public GitHub issue
2. Contact the maintainers privately
3. Provide detailed reproduction steps
4. Allow reasonable time for a fix before public disclosure

## Compliance Notes

### GDPR/Privacy Regulations

- Code embeddings are generated and stored locally
- No personal data is sent to external servers without explicit user action
- Users control what data (queries, diffs) is sent to LLM APIs

### API Key Management Standards

DevCopilot v2 follows industry best practices:
- Encryption at rest (OS-level credential storage)
- No plaintext storage in extension files
- No logging of sensitive data
- Secure transmission (HTTPS only for API calls)

## FAQ

**Q: Is my API key visible to other VS Code extensions?**  
A: No. SecretStorage is extension-specific and isolated. Other extensions cannot access your DevCopilot API key.

**Q: What happens to my API key if I uninstall the extension?**  
A: Keys stored in SecretStorage are automatically cleared. Environment variables remain (you must delete them manually).

**Q: Can I use the same API key across multiple machines?**  
A: Yes, but you must configure it on each machine. SecretStorage does not sync across devices for security reasons.

**Q: How do I rotate my API key?**  
A: Run "DevCopilot v2: Set API Key" again with the new key. The old key is overwritten.

**Q: What if my API key is compromised?**  
A: 
1. Immediately revoke the key at your provider's dashboard (Groq, OpenAI, etc.)
2. Generate a new key
3. Update the key using "Set API Key" command or environment variable
4. Review your API usage logs for unauthorized activity

## Additional Resources

- [VS Code Security Best Practices](https://code.visualstudio.com/docs/editor/workspace-trust)
- [Groq API Security](https://console.groq.com/docs/security)
- [OpenAI API Best Practices](https://platform.openai.com/docs/guides/safety-best-practices)
