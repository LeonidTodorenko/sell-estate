import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useAssistant } from '../src/screens/useAssistant';

test('keeps account questions on local read routes and only changes language on server confirmation', async () => {
  const fetchMock = jest.spyOn(global, 'fetch');
  const reply = (data: unknown) => ({ ok: true, json: async () => data } as Response);
  fetchMock.mockResolvedValueOnce(reply({ balance: 1000, currency: 'USD' }));
  fetchMock.mockResolvedValueOnce(reply({ status: 'unknown', topic: null, answer: 'No verified answer.', language: 'en' }));
  fetchMock.mockResolvedValueOnce(reply({ status: 'language_changed', topic: null, answer: 'Теперь я отвечаю по-русски.', language: 'ru' }));
  let controller!: ReturnType<typeof useAssistant>;
  let tree!: ReactTestRenderer;
  function Harness() {
    controller = useAssistant('http://127.0.0.1/api', 'fixture-jwt');
    return null;
  }
  try {
    await act(async () => { tree = create(<Harness/>); });
    await act(async () => controller.send('My balance?'));
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://127.0.0.1/api/assistant/me/balance',
      expect.objectContaining({ method: 'GET', body: undefined, headers: expect.objectContaining({ Authorization: 'Bearer fixture-jwt' }) }));
    expect(controller.messages[0].answer).toBe('$1,000.00');
    await act(async () => controller.send('произвольный вопрос'));
    expect(controller.ru).toBe(false);
    expect(controller.messages[1].unknown).toBe(true);
    await act(async () => controller.send('Отвечай по-русски'));
    expect(controller.ru).toBe(true);
    expect(controller.messages).toHaveLength(3);
  } finally {
    fetchMock.mockRestore();
    if (tree) await act(async () => tree.unmount());
  }
});
