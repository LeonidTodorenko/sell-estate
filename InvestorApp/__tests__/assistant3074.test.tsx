import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AssistantScenarioCard, type Scenario } from '../src/components/AssistantScenarioCard';
import { useAssistant } from '../src/screens/useAssistant';

test('preserves detailed account routes and keeps English UI after Russian chat replies', async () => {
  const fetchMock = jest.spyOn(global, 'fetch');
  const reply = (data: unknown) => ({ ok: true, json: async () => data } as Response);
  fetchMock.mockResolvedValueOnce(reply({ balance: 1000, currency: 'USD' }));
  fetchMock.mockResolvedValueOnce(reply({ status: 'unknown', topic: null, answer: 'No verified answer.', conversationId: 'conversation-id', language: 'en' }));
  fetchMock.mockResolvedValueOnce(reply({ status: 'language_changed', topic: null, answer: 'Теперь я отвечаю по-русски.', language: 'ru', conversationId: 'conversation-id' }));
  let controller!: ReturnType<typeof useAssistant>;
  let tree!: ReactTestRenderer;
  function Harness() {
    controller = useAssistant('http://127.0.0.1/api', 'fixture-jwt');
    return null;
  }
  try {
    await act(async () => { tree = create(<Harness/>); });
    await act(async () => controller.send('Wallet balance', 'balance'));
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://127.0.0.1/api/assistant/me/balance',
      expect.objectContaining({ method: 'GET', body: undefined, headers: expect.objectContaining({ Authorization: 'Bearer fixture-jwt' }) }));
    expect(controller.messages[0].answer).toBe('$1,000.00');
    await act(async () => controller.send('произвольный вопрос'));
    expect(controller.copy.send).toBe('Send');
    expect(controller.messages[1].unknown).toBe(true);
    await act(async () => controller.send('Отвечай по-русски'));
    expect(controller.copy.prompt).toBe('Ask about OwnersClub');
    expect(controller.messages[2].answer).toMatch(/русски/);
    expect(JSON.parse(fetchMock.mock.calls[2][1]!.body as string)).toEqual({
      text: 'Отвечай по-русски', conversationId: 'conversation-id', allowExternal: false,
    });
    expect(controller.messages).toHaveLength(3);
    expect(controller.messages[2].russian).toBe(true);
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204 } as Response);
    await act(async () => { expect(await controller.reset()).toBe(true); });
    expect(fetchMock).toHaveBeenNthCalledWith(4, 'http://127.0.0.1/api/assistant/conversations/conversation-id',
      expect.objectContaining({ method: 'DELETE' }));
    expect(controller.messages).toEqual([]);
    expect(controller.allowExternal).toBe(false);
  } finally {
    fetchMock.mockRestore();
    if (tree) await act(async () => tree.unmount());
  }
});


test('Android assistant exposes English controls without a reply-language button', () => {
  const screen = readFileSync(join(__dirname, '../src/screens/AssistantScreen.tsx'), 'utf8');
  expect(screen).not.toMatch(/Русский|Answer in English|Отвечай по-русски|\bsetRussian\b/);
  expect(screen).toContain('accessibilityLabel="Allow Google Gemini"');
});

test.each([false, true])('Android hides stress until the risk toggle is opened (Demo: %s)', async demo => {
  const card: Scenario = {
    property: 'Damac lagoons', demo, horizon: 5,
    data: { schemaVersion: 1, currency: 'USD', shares: 2, asOf: '2026-11-27', primaryPurchaseCost: 2000,
      scenarios: [
        { id: 'negative', annualGrowthPercent: -10, points: [{ year: 0, positionValue: 2000 }, { year: 5, positionValue: 1181 }] },
        { id: 'base', annualGrowthPercent: -6, points: [{ year: 0, positionValue: 2000 }, { year: 5, positionValue: 1467 }] },
        { id: 'optimistic', annualGrowthPercent: -2, points: [{ year: 0, positionValue: 2000 }, { year: 5, positionValue: 1808 }] },
      ],
    },
  };
  let tree!: ReactTestRenderer;
  try {
    await act(async () => { tree = create(<AssistantScenarioCard card={card} russian={demo}/>); });
    const labels = () => JSON.stringify(tree.toJSON());
    expect(labels()).toContain(demo ? 'Базовый' : 'Base');
    expect(labels()).toContain('-6');
    expect(labels()).toContain('-2');
    expect(labels()).not.toContain('-10');
    const toggle = tree.root.findAll(node => node.props.accessibilityState?.expanded === false && typeof node.props.onPress === 'function')[0];
    await act(async () => toggle.props.onPress());
    expect(labels()).toContain('-10');
    expect(labels()).toContain(demo ? 'Стрессовый' : 'Stress');
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});
