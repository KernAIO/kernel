import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import diff from 'highlight.js/lib/languages/diff'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import go from 'highlight.js/lib/languages/go'
import http from 'highlight.js/lib/languages/http'
import ini from 'highlight.js/lib/languages/ini'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import php from 'highlight.js/lib/languages/php'
import python from 'highlight.js/lib/languages/python'
import ruby from 'highlight.js/lib/languages/ruby'
import rust from 'highlight.js/lib/languages/rust'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'
import { createLowlight } from 'lowlight'

/**
 * Syntax highlighting for a wiki page's code blocks.
 *
 * Named languages rather than lowlight's `common`, and the difference is not tidiness. `common` is
 * about 37 grammars and most of a hundred kilobytes; this is the set a Kern page actually contains
 * — the shell commands, config and queries in a runbook, plus the languages somebody documenting
 * an integration writes in. Adding one is a line, and the cost of each is visible.
 *
 * This module is loaded on demand, so a surface that never opens a page never pays for it. See the
 * dynamic import in `CollaborativeEditor.svelte`.
 */
export function createPageLowlight() {
  const lowlight = createLowlight()
  lowlight.register({
    bash,
    css,
    diff,
    dockerfile,
    go,
    http,
    ini,
    java,
    javascript,
    json,
    markdown,
    php,
    python,
    ruby,
    rust,
    sql,
    typescript,
    xml,
    yaml,
  })
  return lowlight
}

/**
 * What the language dropdown offers, and what the renderer will find in `attrs.language`.
 *
 * `xml` covers HTML — that is highlight.js' own name for the grammar, and a document that says
 * `html` still highlights because lowlight falls back to plain text rather than throwing.
 */
export const PAGE_CODE_LANGUAGES = [
  'bash',
  'css',
  'diff',
  'dockerfile',
  'go',
  'http',
  'ini',
  'java',
  'javascript',
  'json',
  'markdown',
  'php',
  'python',
  'ruby',
  'rust',
  'sql',
  'typescript',
  'xml',
  'yaml',
] as const
