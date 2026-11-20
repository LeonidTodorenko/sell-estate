import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

test('Web assistant has English controls and no language selector', () => {
  const page = readFileSync(new URL('../src/assistant-page.tsx', import.meta.url), 'utf8');
  const hook = readFileSync(new URL('../src/use-assistant.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(page + hook, /Русский|Отвечай по-русски|Answer in English|\bsetRussian\b/);
  assert.match(page, /Allow Google Gemini/);
  assert.match(hook, /conversationId: conversation.current/);
});
