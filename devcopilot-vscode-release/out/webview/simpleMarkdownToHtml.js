"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.simpleMarkdownToHtml = simpleMarkdownToHtml;
// Lightweight markdown-to-HTML converter for VS Code webview (supports basic markdown)
// Only supports: headings, bold, italic, code, lists, blockquotes, links, emoji, paragraphs
function simpleMarkdownToHtml(md) {
    if (!md)
        return '';
    let html = md;
    // Remove box-drawing characters
    html = html.replace(/[│─┌┐└┘]+/g, '');
    // Headings (##, #)
    html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');
    // Bold **text**
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic *text*
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // Inline code `code`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Blockquotes
    html = html.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>');
    // Unordered lists
    html = html.replace(/^(\s*)[-*] (.*)$/gm, '$1<li>$2</li>');
    html = html.replace(/(<li>.*<\/li>\s*)+/g, match => `<ul>${match}</ul>`);
    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    // Emoji (simple: :smile:)
    html = html.replace(/:([a-z0-9_+-]+):/g, '<span class="emoji">:$1:</span>');
    // Paragraphs (add <p> for lines not already wrapped)
    html = html.replace(/^(?!<h\d|<ul>|<li>|<blockquote>|<pre>|<code>|<p>|<\/ul>|<\/li>|<\/blockquote>|<\/pre>|<\/code>|<\/p>)(.+)$/gm, '<p>$1</p>');
    // Remove multiple <ul> wrappers
    html = html.replace(/(<\/ul>\s*)<ul>/g, '');
    return html;
}
//# sourceMappingURL=simpleMarkdownToHtml.js.map