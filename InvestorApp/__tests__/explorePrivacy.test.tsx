import React from 'react';
import {act, create} from 'react-test-renderer';
import {Text} from 'react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {AuthContext} from '../src/contexts/AuthContext';
import PropertyListScreen from '../src/screens/PropertyListScreen';
import api from '../src/api';
jest.mock('../src/api', () => ({__esModule: true, default: {get: jest.fn()}}));
jest.mock('@react-navigation/native', () => ({useNavigation: () => ({navigate: jest.fn()})}));

test.each(['investor', 'admin', 'guest', 'demo'])('Explore %s never reads private users or displays their ID', async role => {
  const get = api.get as jest.Mock;
  get.mockReset().mockImplementation(async (url: string) => {
    if (url === '/properties') return {data: [{id: 'property261', title: 'QA property', location: 'Test', listingType: 'rent', availableShares: 12, price: 1000, priorityInvestorId: 'PRIVATE-USER-261'}]};
    if (/^\/properties\/property261\/(images|media|payment-plans)$/.test(url)) return {data: []};
    throw new Error('Unexpected request: ' + url);
  });
  const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}});
  let tree: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<QueryClientProvider client={client}><AuthContext.Provider value={{isGuest: role === 'guest', user: {role, isDemo: role === 'demo'}} as any}><PropertyListScreen/></AuthContext.Provider></QueryClientProvider>);
    for(let i=0; i<15; i++) await Promise.resolve();
  });
  await act(async () => {await jest.advanceTimersByTimeAsync(100);});
  const rendered = tree!.root.findAllByType(Text).map(node => node.props.children).flat(Infinity).filter(value => typeof value === 'string').join(' ');
  expect(rendered).toContain('QA property');
  expect(rendered).toContain('Assigned to a priority investor');
  expect(rendered).not.toContain('PRIVATE-USER-261');
  expect(get.mock.calls.some(([url]) => /^\/users\//.test(url))).toBe(false);
  expect(get).toHaveBeenCalledTimes(4);
  await act(async () => tree!.unmount());
  client.clear();
});
