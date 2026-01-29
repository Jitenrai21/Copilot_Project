# DevCopilot v2 - Demo Quick Reference

## 🚀 Pre-Demo Checklist

### Environment Setup
- [ ] Python 3.8+ installed and activated
- [ ] Dependencies installed: `pip install -r requirements.txt`
- [ ] VS Code with both extensions loaded (v0.1 + v2)
- [ ] API key configured (Groq or OpenAI)

### Verification Commands
```bash
# Test CLI v2
python cli_v2.py version

# Verify API key
python cli_v2.py search "test" --mode hyde --top-k 3
```

### VS Code Settings
```json
{
  "devcopilot.apiKey": "your-key-here",
  "devcopilot.apiUrl": "https://api.groq.com/openai/v1/chat/completions",
  "devcopilot.modelName": "llama-3.3-70b-versatile"
}
```

---

## 📋 Demo Flow

### Part 1: Index Repository (Both Versions)

#### v0.1 Baseline
1. Ctrl+Shift+P → **DevCopilot: Index Codebase**
2. Select: `d:\demo-repo`
3. Wait for completion

#### v2 Enhanced
1. Ctrl+Shift+P → **DevCopilot v2: Index Repository**
2. Select: `d:\demo-repo`
3. Wait for completion

**Show:** Same indexing process, v2 uses Jina v2 embeddings

---

### Part 2: Code Search Comparison

#### v0.1 - Basic Semantic Search
1. Ctrl+Shift+P → **DevCopilot: Search Codebase**
2. Query: `"database connection setup"`
3. **Show Results:**
   - Simple ranked list
   - Basic similarity scores
   - File paths with line numbers

#### v2 - HyDE Search
1. Ctrl+Shift+P → **DevCopilot v2: Search Code (HyDE)**
2. Query: `"database connection setup"`
3. **Show Results:**
   - HyDE generates hypothetical code first
   - More accurate matches
   - Same format but better relevance

**Key Message:** HyDE improves search quality by thinking like a developer

---

### Part 3: RAG Queries (v2 Only)

1. Ctrl+Shift+P → **DevCopilot v2: Query Codebase (RAG)**
2. Query: `"How does Flask handle routing?"`
3. **Show Results:**
   - ✨ **Generated Answer** (not just search results!)
   - 📚 **Supporting Sources** (with relevance scores)
   - Interactive links to navigate code

**Example Queries:**
- "What is the Blueprint class used for?"
- "How are database models defined?"
- "Where is authentication implemented?"

**Key Message:** RAG provides answers, not just results

---

### Part 4: PR Summarization Comparison

#### Setup (Make Some Changes First)
```bash
cd d:\demo-repo
# Edit a file, add a function, change config
git add .
```

#### v0.1 - Basic Summarization
1. Ctrl+Shift+P → **DevCopilot: Summarize PR**
2. **Show Results:**
   - File change list
   - Basic diff summary
   - Generic descriptions

#### v2 - Atomic Change Detection
1. Ctrl+Shift+P → **DevCopilot v2: Summarize PR**
2. **Show Results:**
   - 🆕 **New/Modified/Deleted** tags
   - **Atomic changes per file** with purpose
   - **AI-generated PR title** and description
   - More structured and actionable

**Key Message:** v2 breaks down changes atomically with intelligent summaries

---

## 🎯 Key Talking Points

### HyDE Search (v2)
- **What:** Generates hypothetical code before searching
- **Why:** Better matches for conceptual queries
- **Demo:** Compare results for "database connection" between v0.1 and v2

### RAG Queries (v2 Exclusive)
- **What:** Answers questions using codebase context
- **Why:** Natural language interface to code understanding
- **Demo:** Ask "How does routing work?" and get an answer, not just search results

### Atomic PR Summaries (v2)
- **What:** Detects atomic changes with LLM analysis
- **Why:** Clearer PR descriptions, better code reviews
- **Demo:** Show file-by-file breakdown with purpose statements

### API-Based LLM (v2)
- **What:** Uses Groq/OpenAI instead of local models
- **Why:** Faster, more accurate, production-ready
- **Demo:** Show configuration in VS Code settings

---

## 💡 Demo Script Suggestions

### Opening (2 min)
*"DevCopilot v2 enhances the baseline with three major improvements: HyDE search for better relevance, RAG queries for natural language answers, and atomic PR summaries for clearer change descriptions. Let me show you side-by-side."*

### Search Demo (3 min)
1. Run same query in v0.1 and v2
2. Compare result quality
3. Highlight HyDE's conceptual understanding

### RAG Demo (4 min)
1. Ask a question (not a search query)
2. Show generated answer at top
3. Click through supporting sources
4. Try 2-3 different questions

### PR Summary Demo (3 min)
1. Make a small change (add function)
2. Run both versions
3. Compare v0.1's generic output vs v2's atomic breakdown
4. Highlight AI-generated PR title/description

### Closing (1 min)
*"v2 transforms code search from keyword matching to intelligent understanding, and PR summaries from diffs to insights. Both versions work together—v0.1 for speed, v2 for depth."*

---

## 🔧 Troubleshooting During Demo

### "No Results Found"
- Check: Repository indexed?
- Fix: Re-run Index Repository command
- Time: ~30 seconds

### "API Error"
- Check: API key in settings?
- Fix: Open Settings (Ctrl+,), search "DevCopilot", add key
- Time: ~15 seconds

### "Extension Not Responding"
- Check: Output panel (DevCopilot channel) for errors
- Fix: Reload window (Ctrl+R in dev host)
- Time: ~10 seconds

### CLI Not Found
- Check: Working directory is `d:\dev-copilot`?
- Fix: Extension uses absolute paths, should work automatically
- Fallback: Run CLI manually to verify: `python cli_v2.py version`

---

## 📊 Side-by-Side Feature Matrix

| Feature | v0.1 | v2 |
|---------|------|-----|
| **Semantic Search** | ✅ Basic | ✅ HyDE Enhanced |
| **RAG Queries** | ❌ | ✅ Answer + Sources |
| **PR Summaries** | ✅ Basic | ✅ Atomic + AI |
| **LLM Integration** | Local | API (Groq/OpenAI) |
| **Embeddings** | Generic | Jina v2 (Code-Specific) |
| **Query Interface** | Search only | Search + Questions |
| **Results Format** | Ranked list | Answer + Evidence |

---

## 🎬 Sample Demo Queries

### Good HyDE Search Queries
- "authentication middleware implementation"
- "database connection pooling"
- "error handling decorator"
- "API route definition"

### Good RAG Questions
- "How does the application initialize?"
- "What authentication methods are supported?"
- "Where are database migrations handled?"
- "How is logging configured?"

### Changes for PR Demo
```python
# Add this to test file
def calculate_total(items, tax_rate=0.08):
    """Calculate total with tax."""
    subtotal = sum(item.price for item in items)
    return subtotal * (1 + tax_rate)
```

---

## ⏱️ Timing Guide

- **Setup & Introduction:** 2 minutes
- **Indexing Demo:** 2 minutes
- **Search Comparison:** 3 minutes
- **RAG Queries:** 4 minutes
- **PR Summaries:** 3 minutes
- **Q&A Buffer:** 1 minute
- **Total:** 15 minutes

---

## 📸 Screenshots to Capture

1. ✅ Both extensions installed (Extensions panel)
2. ✅ API configuration (Settings)
3. ✅ HyDE search results (DevCopilot Results panel)
4. ✅ RAG answer with sources (DevCopilot Results panel)
5. ✅ Atomic PR summary (DevCopilot Results panel)
6. ✅ CLI v2 running in terminal

---

## 🚨 Common Gotchas

1. **API Key Not Set:** Extension shows error immediately
   - Fix: Set in settings before demo starts

2. **Repository Not Indexed:** Commands show "Index first"
   - Fix: Pre-index demo repository

3. **Wrong Python Environment:** CLI fails to import
   - Fix: Activate correct venv before launching VS Code

4. **ChromaDB Lock:** If indexing fails with "database locked"
   - Fix: Close other VS Code instances, delete `chroma_db/chroma.sqlite3-wal`

5. **Results Panel Hidden:** Results generated but not visible
   - Fix: Run command: `DevCopilot: Focus on Results View`

---

## ✅ Post-Demo Checklist

- [ ] Show both extensions side-by-side in Extensions panel
- [ ] Demonstrate at least 2 RAG queries
- [ ] Compare PR summaries (v0.1 vs v2)
- [ ] Highlight API configuration simplicity
- [ ] Mention Jina v2 embeddings advantage
- [ ] Show webview navigation (click to open file)
- [ ] Answer questions about architecture

---

## 📝 Key Takeaways for Audience

1. **HyDE Search:** Better relevance through hypothetical document generation
2. **RAG Queries:** Get answers, not just search results
3. **Atomic PR Summaries:** Clearer change descriptions for better reviews
4. **API-Based LLM:** Production-ready, scalable, configurable
5. **Side-by-Side:** v0.1 and v2 coexist, choose based on needs

**Demo Ready!** 🎉
