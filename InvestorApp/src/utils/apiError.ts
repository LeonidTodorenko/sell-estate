import { Alert } from 'react-native';
import type { AxiosError } from 'axios';

type HandleApiErrorOptions = {
  title?: string;          // заголовок алерта
  fallbackMessage?: string;// текст если вообще ничего нет
  showDetails?: boolean;   // показывать детали (лучше только в dev)
  maxLen?: number;         // ограничение длины Alert
};

function safeStringify(obj: any) {
  try {
    return JSON.stringify(obj);
  } catch {
    return String(obj);
  }
}

export function extractApiErrorMessage(error: any): string {
  // AxiosError
  const ax = error as AxiosError<any>;

  // 1) есть ответ сервера
  if (ax?.response) {
    const data = ax.response.data;

    // популярные поля
    if (typeof data === 'string' && data.trim()) return data;
    if (data?.message) return String(data.message);
    if (data?.error) return String(data.error);
    if (data?.title) return String(data.title);

    // валидейшн из ASP.NET иногда так приходит:
    // { errors: { field: ["msg1","msg2"] }, ... }
    if (data?.errors && typeof data.errors === 'object') {
      const msgs: string[] = [];
      for (const key of Object.keys(data.errors)) {
        const arr = data.errors[key];
        if (Array.isArray(arr)) msgs.push(...arr.map(String));
      }
      if (msgs.length) return msgs.join('\n');
    }

    // иначе просто статусы
    const status = ax.response.status;
    const statusText = ax.response.statusText || '';
    return `Request failed (${status} ${statusText})`.trim();
  }

  // 2) запрос ушёл, но ответа нет (timeout / network / CORS / offline)
  if (ax?.request) {
    // Axios часто кладёт сюда: "Network Error"
    return 'Network error. Please check your internet connection.';
  }

  // 3) обычная ошибка JS
  return error?.message ? String(error.message) : 'Unknown error';
}

export function handleApiError(
  error: any,
  contextMessage?: string,
  options?: HandleApiErrorOptions
) {
  const {
    title = 'Error',
    fallbackMessage = 'Something went wrong',
    showDetails = __DEV__,
    maxLen = 1000,
  } = options || {};

  const main = extractApiErrorMessage(error) || fallbackMessage;
  const prefix = contextMessage ? `${contextMessage}\n\n` : '';
  let text = `${prefix}${main}`;

  if (showDetails) {
    const ax = error as AxiosError<any>;
    const details: string[] = [];

    if (ax?.config?.url) details.push(`URL: ${ax.config.url}`);
    if (ax?.config?.method) details.push(`Method: ${String(ax.config.method).toUpperCase()}`);
    if (ax?.response?.status) details.push(`Status: ${ax.response.status}`);
    if (ax?.response?.data) details.push(`Response: ${safeStringify(ax.response.data)}`);

    if (details.length) text += `\n\n---\n${details.join('\n')}`;
  }

  Alert.alert(title, text.slice(0, maxLen));

  console.error(contextMessage ?? 'API Error', error);
}
