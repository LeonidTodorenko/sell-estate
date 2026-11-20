import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL, signOut } from './api';
import type { Session } from './types';
import { faqQuestions, useAssistant } from './use-assistant';
import './assistant.css';

const destinations = {
  balance: '/finance', investments: '/investments', applications: '/applications',
  payments: '/transactions', properties: '/properties',
} as const;

export function AssistantPage({ session }: { session: Session }) {
  return <Conversation key={session.accessToken} token={session.accessToken}/>;
}

function Conversation({ token }: { token: string }) {
  const { messages, send, pending, error, allowExternal, setAllowExternal, copy, sections } = useAssistant(API_BASE_URL, token);
  const [draft, setDraft] = useState('');
  const latest = useRef<HTMLDivElement>(null);
  const disabled = pending || error === 'expired';
  useEffect(() => {
    if (messages.length) latest.current?.scrollIntoView({ block: 'nearest' });
  }, [messages, pending]);

  return <section className="assistant-page" aria-labelledby="assistant-title">
    <header className="assistant-heading">
      <h1 id="assistant-title">{copy.title}</h1>
    </header>
    <details id="assistant-faq" open>
      <summary>{copy.faq}</summary>
      <div className="assistant-actions">
        {faqQuestions.map(question => <button key={question} disabled={disabled} onClick={() => void send(question)}>{question}</button>)}
      </div>
    </details>
    <details open>
      <summary>{copy.account}</summary>
      <div className="assistant-actions">
        {sections.map(section => <button key={section} disabled={disabled} onClick={() => void send(copy[section], section)}>{copy[section]}</button>)}
      </div>
    </details>
    <div role="log" aria-label={copy.title} className="assistant-history">
      {messages.map((message, index) => <div className="assistant-turn" key={index}>
        <p className="assistant-question">{message.question}</p>
        {message.answer && <div className="assistant-answer">
          <p>{message.answer}</p>
          {!!message.sources?.length && <small>Sources: {message.sources.join(", ")}</small>}
          {message.destination && <Link to={destinations[message.destination]}>{copy[message.destination]}</Link>}
          {message.unknown && <a href="#assistant-faq">{copy.faq}</a>}
        </div>}
      </div>)}
      {pending && <p role="status">{copy.pending}</p>}
      {error && <p role="alert">{copy[error]} {error === 'expired' && <button type="button" onClick={() => void signOut()}>{copy.signIn}</button>}</p>}
      <div ref={latest}/>
    </div>
    <label><input type="checkbox" checked={allowExternal} disabled={pending}
      onChange={event => setAllowExternal(event.target.checked)}/>
      Allow Google Gemini to process general chat messages for this session. Google may use them to improve its products. Do not enter private information.
    </label>
    <form className="assistant-composer" onSubmit={event => {
      event.preventDefault();
      if (disabled || !draft.trim()) return;
      void send(draft);
      setDraft('');
    }}>
      <input aria-label={copy.prompt} placeholder={copy.prompt} maxLength={400} value={draft} onChange={event => setDraft(event.target.value)}/>
      <button className="button" disabled={disabled || !draft.trim()}>{copy.send}</button>
    </form>
  </section>;
}
