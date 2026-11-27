import AssetAllocation from '../components/AssetAllocation';
import { AssistantScenarioCard } from "../components/AssistantScenarioCard";
import React, { useCallback, useContext, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { API_BASE_URL } from '../api';
import { parseJwt } from '../services/auth';
import { jwtOwner } from '../services/purchaseIntentCore';
import { loadSession } from '../services/sessionStorage';
import theme from '../constants/theme';
import { AuthContext } from '../contexts/AuthContext';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { faqQuestions, useAssistant } from './useAssistant';

type Props = NativeStackScreenProps<RootStackParamList, 'Assistant'>;
const destinations = {
  balance: 'MyFinance', investments: 'MyProperties', applications: 'MyProperties',
  payments: 'UserTransactions', properties: 'Properties', market: 'ShareMarketplaces', 'rental-income': 'MyRentIncome',
} as const;

export default function AssistantScreen(props: Props) {
  const { session, signOut } = useContext(AuthContext);
  const contextToken = session?.accessToken;
  const [stored, setStored] = useState<{ contextToken: string; activeToken: string }>();
  useFocusEffect(useCallback(() => {
    if (!contextToken) return;
    let current = true;
    void loadSession().then(next => {
      const activeToken = next?.accessToken;
      if (!current || !activeToken) return;
      const previousClaims = parseJwt(contextToken);
      const activeClaims = parseJwt(activeToken);
      if (String(previousClaims?.isDemo) === String(activeClaims?.isDemo) &&
          jwtOwner(previousClaims, true) === jwtOwner(activeClaims, true))
        setStored({ contextToken, activeToken });
    }).catch(() => undefined);
    return () => { current = false; };
  }, [contextToken]));
  const token = stored?.contextToken === contextToken ? stored?.activeToken : contextToken;
  if (!token) return <View style={styles.page}>
    <Action label="Sign in to use the assistant" press={() => props.navigation.replace('Login')}/>
  </View>;
  return <Conversation key={token} token={token} navigation={props.navigation} context={props.route?.params}
    signIn={async () => { await signOut(); props.navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); }}/>;
}

function Action({ label, press, disabled }: { label: string; press: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={press}
    style={[styles.action, disabled && styles.disabled]}><Text style={styles.actionText}>{label}</Text></Pressable>;
}

function Conversation({ token, navigation, context, signIn }: {
  token: string;
  navigation: Props['navigation'];
  context: Props['route']['params'];
  signIn: () => Promise<void>;
}) {
  const { messages, send, pending, error, allowExternal, setAllowExternal, copy, sections, russian, reset } = useAssistant(API_BASE_URL, token);
  const [draft, setDraft] = useState(context?.question ?? '');
  const [propertyId, setPropertyId] = useState(context?.propertyId);
  useFocusEffect(useCallback(() => {
    if (context?.question) {
      setDraft(context.question);
      setPropertyId(context.propertyId);
      navigation.setParams({ question: '', propertyId: undefined });
    }
  }, [context?.question, context?.propertyId, navigation]));
  const log = useRef<ScrollView>(null);
  const faqY = useRef(0);
  const stayAtFaq = useRef(false);
  const disabled = pending || error === 'expired';
  const ask = (question: string, section?: typeof sections[number]) => {
    stayAtFaq.current = false;
    void send(question, section);
  };

  return <View style={styles.page}>
    <ScrollView ref={log} style={styles.log} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
      onContentSizeChange={() => { if (messages.length && !stayAtFaq.current) log.current?.scrollToEnd({ animated: false }); }}>
      <Action label={russian ? "Новый диалог" : "New Chat"} disabled={disabled} press={async () => { if (await reset()) { setDraft(""); setPropertyId(undefined); } }}/>
      <Text accessibilityRole="header" style={styles.heading} onLayout={event => { faqY.current = event.nativeEvent.layout.y; }}>{copy.faq}</Text>
      <View style={styles.row}>{faqQuestions.map(question => <Action key={question} label={question} disabled={disabled}
        press={() => ask(question)}/>)}</View>
      <Text accessibilityRole="header" style={styles.heading}>{copy.account}</Text>
      <View style={styles.row}>{sections.map(section => <Action key={section} label={copy[section]} disabled={disabled}
        press={() => ask(copy[section], section)}/>)}</View>
      {messages.map(({ question, answer, destination, sources, unknown, forecast, allocation, russian: answerRussian }, index) => <View key={index} style={styles.turn}>
        <Text style={styles.question}>{question}</Text>
        {answer && <View style={styles.answer}>
          <Text selectable style={styles.text}>{answer}</Text>
          {allocation && <AssetAllocation russian={answerRussian} title={`${answerRussian ? 'Структура активов' : 'Asset structure'}${allocation.demo ? ' · Demo' : ''}`}
            description={answerRussian ? "Оценка активов в долларах США. Кошелёк включает зачисленные арендные выплаты." : "Estimated values in USD. The wallet includes credited rental payouts."} items={allocation.items}/>}
          {forecast && <AssistantScenarioCard card={forecast} russian={answerRussian}/>}
          {!!sources?.length && <Text selectable style={styles.text}>Sources: {sources.join(", ")}</Text>}
          {destination && <Action label={copy[destination]} press={() => navigation.navigate(destinations[destination])}/>}
          {unknown && <Action label={copy.faq} press={() => {
            stayAtFaq.current = true;
            log.current?.scrollTo({ y: faqY.current });
          }}/>}
        </View>}
      </View>)}
      {pending && <View style={styles.row}><ActivityIndicator color={theme.colors.primary}/>
        <Text accessibilityLiveRegion="polite" style={styles.text}>{copy.pending}</Text></View>}
      {error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.text}>{copy[error]}</Text>}
      {error === 'expired' && <Action label={copy.signIn} press={() => void signIn()}/>}
    </ScrollView>
    <View style={styles.consent}>
      <Switch accessibilityLabel="Allow Google Gemini" value={allowExternal} disabled={pending}
        onValueChange={setAllowExternal}/>
      <Text style={[styles.text, styles.consentText]}>Allow Google Gemini to process general chat messages for this session. Google may use them to improve its products. Account answers and purchase estimates stay on OwnersClub. Do not enter private information in general chat.</Text>
    </View>
    <View style={styles.composer}>
      <TextInput accessibilityLabel={copy.prompt} placeholder={copy.prompt} placeholderTextColor={theme.colors.textSecondary}
        value={draft} onChangeText={setDraft} maxLength={400} style={styles.input}/>
      <Action label={copy.send} disabled={disabled || !draft.trim()} press={() => {
        stayAtFaq.current = false;
        void send(draft, undefined, propertyId);
        setPropertyId(undefined);
        setDraft('');
      }}/>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  log: { flex: 1 },
  content: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  heading: { fontWeight: '700', fontSize: 16, color: theme.colors.text },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#e3f3e9' },
  actionText: { color: theme.colors.text, fontWeight: '600' },
  disabled: { opacity: .55 },
  turn: { gap: 8 },
  question: { alignSelf: 'flex-end', maxWidth: '90%', color: theme.colors.text, padding: 12, borderRadius: 12, backgroundColor: '#dcf2e6' },
  answer: { alignSelf: 'flex-start', maxWidth: '95%', gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#f1f6f3' },
  text: { color: theme.colors.text, lineHeight: 22 },
  consent: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8 },
  consentText: { flex: 1 },
  composer: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8, borderTopWidth: 1, borderColor: theme.colors.border },
  input: { flex: 1, minHeight: 48, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.text },
});
