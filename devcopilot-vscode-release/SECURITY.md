# Security Best Practices - DevCopilot v2

## API Key Management

### Secure Storage

DevCopilot v2 implements multi-layered API key management with security as the top priority:

1. **VS Code SecretStorage (Recommended)** ✅
   - Encrypted storage using OS-level credential managers
   - Windows: Credential Manager
   - macOS: Keychain
   - Linux: libsecret
   - Per-user, per-machine encryption
   - Never stored in plain text

2. **Environment Variables** ✅
   - Good for CI/CD pipelines and automation
   - Set `LLM_API_KEY` in your environment
   - Not committed to version control
   - Requires VS Code restart to apply

3. **VS Code Settings** ⚠️
   - Fallback only, not recommended
   - Stored in plain text in `settings.json`
   - Risk of accidental exposure if settings are synced or committed

### Using the Set API Key Command

1. Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Run: **DevCopilot: Set API Key**
3. Enter your API key (input is masked)
4. Key is immediately stored in SecretStorage

The extension will:
- Validate the key is not empty
- Store it securely in VS Code's SecretStorage
- Use it automatically for all LLM-powered features

### Checking Your API Key

To verify which API key source is active:
1. Run: **DevCopilot v2: Show Pipeline Status**
2. The status will show the API key source (without exposing the actual key)

### Clearing Your API Key

To remove a stored API key:
1. Open VS Code Settings
2. Search for `devcopilotV2.apiKey`
3. Clear any value in settings (if present)
4. For SecretStorage, use the "Set API Key" command and cancel (or set a new key)

## What We Never Do

❌ **Never hardcode API keys in source code**
❌ **Never commit API keys to version control**
❌ **Never log API keys to console or files**
❌ **Never transmit API keys over unencrypted connections**
❌ **Never store API keys in publicly accessible locations**

## What We Always Do

✅ **Always use SecretStorage for user-entered keys**
✅ **Always validate API keys before use**
✅ **Always prompt users if no key is configured**
✅ **Always use HTTPS for API calls**
✅ **Always provide clear security guidance**

## For Developers

### Accessing API Keys in Code

```typescript
import { ApiKeyManager } from './apiKeyManager';

// In your command or integration
const apiKey = await apiKeyManager.getApiKeyWithPrompt();
if (!apiKey) {
    vscode.window.showWarningMessage('No API key configured');
    return;
}

// Use the key for API calls
await callLLMAPI(apiKey);
```

### Key Retrieval Priority

The `ApiKeyManager` checks sources in this order:
1. SecretStorage (`context.secrets.get()`)
2. Environment variable (`process.env.LLM_API_KEY`)
3. VS Code settings (`config.get('devcopilotV2.apiKey')`)

If none are found, the user is prompted to set one.

## Security Audit Checklist

- [x] API keys stored in SecretStorage (encrypted)
- [x] No hardcoded keys in source code
- [x] No API keys in configuration defaults
- [x] Input masking for API key entry
- [x] Clear user guidance on secure storage
- [x] No logging of sensitive data
- [x] HTTPS-only API communication
- [x] User prompted if key is missing
- [x] Documentation emphasizes security

## Compliance

This implementation follows:
- OWASP secure credential storage guidelines
- VS Code extension security best practices
- Industry-standard secret management patterns

## Reporting Security Issues

If you discover a security vulnerability, please report it to:
- **Email**: [Your security contact email]
- **GitHub**: Private security advisory (preferred)

Do not open public issues for security vulnerabilities.
