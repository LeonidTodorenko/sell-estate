/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import AppNavigator from '../src/navigation/AppNavigator';
import {navigationRef} from '../src/navigation/navigationRef';
import notifee from '@notifee/react-native';

test('renders correctly', async () => {
  let tree: ReturnType<typeof ReactTestRenderer.create>;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  expect(tree!.root.findAllByType(AppNavigator)).toHaveLength(1);
  expect(navigationRef.isReady()).toBe(true);
  expect(navigationRef.getCurrentRoute()?.name).toBe('Login');
  expect(notifee.createChannel).toHaveBeenCalledWith(expect.objectContaining({id: 'default'}));
  await ReactTestRenderer.act(async () => tree.unmount());
});
