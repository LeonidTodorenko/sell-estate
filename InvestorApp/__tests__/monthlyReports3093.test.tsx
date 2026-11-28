import React from 'react';
import { Text } from 'react-native';
import api from '../src/api';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useQuery } from '@tanstack/react-query';
import { loadSession } from '../src/services/sessionStorage';
import MonthlyReportsScreen from '../src/screens/MonthlyReportsScreen';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('../src/services/sessionStorage', () => ({ loadSession: jest.fn() }));
jest.mock('../src/api', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('../src/components/AssetAllocation', () => 'AssetAllocation');
jest.mock('../src/components/DemoModeBanner', () => 'DemoModeBanner');

test.each([false, true])('monthly report uses the correct owner cache and API, Demo %s', async isDemo => {
  (loadSession as jest.Mock).mockResolvedValue({ isDemo, user: { id: 'owner' } });
  (useQuery as jest.Mock).mockReturnValue({ data: [], isLoading: false, isFetching: false, refetch: jest.fn() });
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<MonthlyReportsScreen/>); });
  const options = (useQuery as jest.Mock).mock.calls[(useQuery as jest.Mock).mock.calls.length - 1][0];
  expect(options.queryKey).toEqual(['monthly-reports', isDemo ? '/demo/monthly-reports' : '/monthly-reports', 'owner']);
  expect(options.enabled).toBe(true);
  (api.get as jest.Mock).mockResolvedValue({ data: [] });
  await options.queryFn();
  expect(api.get).toHaveBeenLastCalledWith(isDemo ? '/demo/monthly-reports' : '/monthly-reports', { headers: { 'Accept-Language': 'en-US' } });
  expect(tree.root.findAllByType(Text).map(node => node.props.children).join(' ')).toMatch(isDemo ? /demo report/ : /No monthly snapshots/);
  await act(async () => tree.unmount());
});

test.each([false, true])('snapshot text, UTC date and USD amounts follow the English interface, Demo %s', async isDemo => {
  (loadSession as jest.Mock).mockResolvedValue({ isDemo, user: { id: 'owner' } });
  (useQuery as jest.Mock).mockReturnValue({
    data: [{ id: 'snapshot', reportMonth: '2026-11-28T12:00:00Z', walletBalance: 1200.50,
      investmentValue: 200, totalCapital: 1400.50, capitalChange: 0, rentalIncome: 20,
      commentary: 'Initial snapshot at the actual capture date. A previous snapshot is unavailable.' }],
    isLoading: false, isFetching: false, refetch: jest.fn()
  });
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<MonthlyReportsScreen/>); });
  const text = tree.root.findAllByType(Text).map(node => node.props.children).join(' ');
  expect(text).not.toMatch(/[А-Яа-яЁё]/);
  expect(text).toContain('Monthly Reports');
  expect(text).toContain('Nov 28, 2026');
  expect(text).toContain('$1,200.50');
  expect(text).toContain('Initial snapshot');
  await act(async () => tree.unmount());
});
