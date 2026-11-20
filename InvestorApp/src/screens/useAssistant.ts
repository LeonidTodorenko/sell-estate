import { useEffect, useRef, useState } from 'react';

const personalPaths = {
  balance: 'me/balance',
  investments: 'me/investments',
  applications: 'me/applications',
  payments: 'me/payments',
} as const;
type Section = keyof typeof personalPaths;
type Destination = Section | 'properties';
type Message = { question: string; answer?: string; destination?: Destination; unknown?: boolean; sources?: string[] };
type FaqAnswer = { status: 'answered' | 'unknown' | 'language_changed' | 'consent_required' | 'faq_fallback' | 'retry_later'; topic: string | null; answer: string; conversationId?: string; sources?: string[] };
type AccountItem = { shares?: number; investedAmount?: number; requestedShares?: number; status?: string | number; walletAmount?: number; walletCurrency?: string; createdAt: string };
type AccountAnswer = { balance?: number; currency?: string; status?: string; items?: AccountItem[] };

export const faqQuestions = [
  'Property details',
  'Property photos',
  'Payment plan',
] as const;

const english = {
  title: 'AI Assistant', faq: 'Frequently asked questions', account: 'My account',
  balance: 'Wallet balance', investments: 'My investments', applications: 'My applications',
  payments: 'My payments', properties: 'Properties', prompt: 'Ask about OwnersClub', send: 'Send',
  pending: 'Getting an answer…', signIn: 'Sign in again',
  expired: 'Your session has expired. Sign in again to continue.',
  forbidden: 'The assistant is unavailable for this account.',
  limited: 'Too many requests. Wait a minute and try again.',
  network: 'Could not reach the assistant. Check your connection and try again.',
  timeout: 'The assistant took too long to respond. Please try again.',
  unavailable: 'The assistant is temporarily unavailable. Please try again.',
  noItems: 'No records found.', demoPayments: 'Payments are unavailable in Demo mode.',
  shares: 'shares', latest: 'Latest records (up to 25)',
};

class HttpError extends Error {
  constructor(readonly status: number) { super(String(status)); }
}

function accountText(section: Section, data: AccountAnswer) {
  const copy = english;
  const locale = 'en-US';
  const money = (value: number, currency = 'USD') =>
    new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
  if (section === 'balance' && typeof data.balance === 'number') return money(data.balance, data.currency);
  if (data.status === 'unavailable_in_demo') return copy.demoPayments;
  if (!Array.isArray(data.items)) throw new HttpError(502);
  if (!data.items.length) return copy.noItems;
  const statuses: Record<string, string> = { pending: 'Pending', accepted: 'Accepted', partial: 'Partially accepted', rejected: 'Rejected', carried: 'Carried over',
        credited: 'Credited', failed: 'Failed', cancelled: 'Cancelled', confirmed: 'Confirmed' };
  const lines = data.items.map(item => {
    const date = new Date(item.createdAt).toLocaleDateString(locale);
    const shares = item.shares ?? item.requestedShares;
    const amount = item.investedAmount ?? item.walletAmount;
    return [date, shares === undefined ? null : `${shares} ${copy.shares}`,
      amount === undefined ? null : money(amount, item.walletCurrency),
      typeof item.status === 'string' && Object.prototype.hasOwnProperty.call(statuses, item.status.toLowerCase())
        ? statuses[item.status.toLowerCase()] : item.status].filter(value => value != null).join(' · ');
  });
  return [copy.latest, ...lines].join('\n');
}

export function useAssistant(baseUrl: string, token: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [allowExternal, setAllowExternal] = useState(false);
  const conversation = useRef<string | undefined>(undefined);
  const [error, setError] = useState<keyof typeof english>();
  const [pending, setPending] = useState(false);
  const active = useRef<AbortController | null>(null);
  const copy = english;

  useEffect(() => () => {
    active.current?.abort();
    active.current = null;
  }, []);

  async function send(text: string, section?: Section) {
    const question = text.trim();
    if (!question || question.length > 400 || active.current || error === 'expired') return;
    const controller = new AbortController();
    active.current = controller;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 20000);
    setError(undefined);
    setPending(true);
    setMessages(previous => [...previous, { question }]);

    try {
      const path = section ? personalPaths[section] : 'ask';
      const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/assistant/${path}`, {
        method: section ? 'GET' : 'POST',
        credentials: 'omit',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          ...(section ? {} : { 'Content-Type': 'application/json' }),
        },
        body: section ? undefined : JSON.stringify({ text: question, conversationId: conversation.current, allowExternal }),
        signal: controller.signal,
      });
      if (!response.ok) throw new HttpError(response.status);
      const data = await response.json();
      if (active.current !== controller) return;
      let result: Message;
      if (section) {
        result = { question, answer: accountText(section, data), destination: section };
      } else {
        const { answer, topic, status, conversationId, sources } = data as FaqAnswer;
        if (typeof answer !== 'string') throw new HttpError(502);
        conversation.current = conversationId;
        const destination = topic && ['properties', 'property-images', 'payment-plan'].includes(topic)
          ? 'properties' : topic && Object.prototype.hasOwnProperty.call(personalPaths, topic) ? topic as Section : undefined;
        result = { question, answer, destination, sources, unknown: status === 'unknown' || status === 'faq_fallback' };
      }
      setMessages(previous => [...previous.slice(0, -1), result]);
    } catch (failure) {
      if (active.current !== controller) return;
      const status = failure instanceof HttpError ? failure.status : 0;
      setError(timedOut || status === 504 ? 'timeout' : status === 401 ? 'expired' :
        status === 403 ? 'forbidden' : status === 429 ? 'limited' : status ? 'unavailable' : 'network');
    } finally {
      clearTimeout(timer);
      if (active.current === controller) {
        active.current = null;
        setPending(false);
      }
    }
  }

  return { messages, allowExternal, setAllowExternal, error, pending, copy, send, sections: Object.keys(personalPaths) as Section[] };
}
