import { useEffect, useRef, useState } from 'react';

const personalPaths = {
  balance: 'me/balance',
  investments: 'me/investments',
  applications: 'me/applications',
  payments: 'me/payments',
} as const;
type Section = keyof typeof personalPaths;
const accountQuestions: Record<string, Section> = {
  'my balance': 'balance', 'my wallet balance': 'balance', 'мой баланс': 'balance', 'баланс моего кошелька': 'balance',
  'my investments': 'investments', 'мои инвестиции': 'investments',
  'my applications': 'applications', 'мои заявки': 'applications',
  'my payments': 'payments', 'мои платежи': 'payments',
};
type Destination = Section | 'properties';
type Message = { question: string; answer?: string; destination?: Destination; unknown?: boolean };
type FaqAnswer = { status: 'answered' | 'unknown' | 'language_changed'; topic: string | null; answer: string; language: 'en' | 'ru' };
type AccountItem = { shares?: number; investedAmount?: number; requestedShares?: number; status?: string | number; walletAmount?: number; walletCurrency?: string; createdAt: string };
type AccountAnswer = { balance?: number; currency?: string; status?: string; items?: AccountItem[] };

export const faqQuestions = [
  ['Property details', 'Карточка объекта'],
  ['Property photos', 'Фотографии объекта'],
  ['Payment plan', 'График платежей'],
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
const russian = {
  title: 'AI-ассистент', faq: 'Частые вопросы', account: 'Мой аккаунт',
  balance: 'Баланс кошелька', investments: 'Мои инвестиции', applications: 'Мои заявки',
  payments: 'Мои платежи', properties: 'Объекты', prompt: 'Задайте вопрос об OwnersClub', send: 'Отправить',
  pending: 'Готовим ответ…', signIn: 'Войти снова',
  expired: 'Срок действия сеанса истёк. Войдите снова, чтобы продолжить.',
  forbidden: 'Ассистент недоступен для этого аккаунта.',
  limited: 'Слишком много запросов. Подождите минуту и повторите.',
  network: 'Не удалось связаться с ассистентом. Проверьте соединение и повторите.',
  timeout: 'Ассистент не успел ответить. Попробуйте снова.',
  unavailable: 'Ассистент временно недоступен. Попробуйте снова.',
  noItems: 'Записей нет.', demoPayments: 'Платежи недоступны в деморежиме.',
  shares: 'долей', latest: 'Последние записи (до 25)',
};

class HttpError extends Error {
  constructor(readonly status: number) { super(String(status)); }
}

function accountText(section: Section, data: AccountAnswer, ru: boolean) {
  const copy = ru ? russian : english;
  const locale = ru ? 'ru-RU' : 'en-US';
  const money = (value: number, currency = 'USD') =>
    new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
  if (section === 'balance' && typeof data.balance === 'number') return money(data.balance, data.currency);
  if (data.status === 'unavailable_in_demo') return copy.demoPayments;
  if (!Array.isArray(data.items)) throw new HttpError(502);
  if (!data.items.length) return copy.noItems;
  const statuses: Record<string, string> = ru
    ? { pending: 'Ожидает', accepted: 'Принята', partial: 'Частично принята', rejected: 'Отклонена', carried: 'Перенесена',
        credited: 'Зачислен', failed: 'Ошибка', cancelled: 'Отменён', confirmed: 'Подтверждён' }
    : { pending: 'Pending', accepted: 'Accepted', partial: 'Partially accepted', rejected: 'Rejected', carried: 'Carried over',
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
  const [ru, setRussian] = useState(false);
  const [error, setError] = useState<keyof typeof english>();
  const [pending, setPending] = useState(false);
  const active = useRef<AbortController | null>(null);
  const copy = ru ? russian : english;

  useEffect(() => () => {
    active.current?.abort();
    active.current = null;
  }, []);

  async function send(text: string, section?: Section) {
    const question = text.trim();
    if (!question || question.length > 400 || active.current || error === 'expired') return;
    const normalized = question.toLowerCase().replace(/[.!?]+$/, '');
    if (!section && Object.prototype.hasOwnProperty.call(accountQuestions, normalized))
      section = accountQuestions[normalized];
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
        body: section ? undefined : JSON.stringify({ text: question }),
        signal: controller.signal,
      });
      if (!response.ok) throw new HttpError(response.status);
      const data = await response.json();
      if (active.current !== controller) return;
      let result: Message;
      if (section) {
        result = { question, answer: accountText(section, data, ru), destination: section };
      } else {
        const { answer, topic, status, language } = data as FaqAnswer;
        if (typeof answer !== 'string') throw new HttpError(502);
        setRussian(language === 'ru');
        const destination = topic && ['properties', 'property-images', 'payment-plan'].includes(topic)
          ? 'properties' : undefined;
        result = { question, answer, destination, unknown: status === 'unknown' };
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

  return { messages, ru, error, pending, copy, send, sections: Object.keys(personalPaths) as Section[] };
}
