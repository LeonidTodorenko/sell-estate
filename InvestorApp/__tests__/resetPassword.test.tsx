import React from 'react';
import {act, create} from 'react-test-renderer';
import {Alert} from 'react-native';
import ResetPassword from '../src/screens/ResetPasswordScreen';
import api from '../src/api';
import BlueButton from '../src/components/BlueButton';
let mockParams: {token: string} | undefined;
jest.mock('@react-navigation/native', () => ({useRoute: () => ({params: mockParams}), useNavigation: () => ({navigate: jest.fn()})}));
jest.mock('../src/api', () => ({__esModule: true, default: {post: jest.fn()}}));
test('missing reset token blocks a request instead of crashing or sending undefined', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  let tree: ReturnType<typeof create>;
  await act(async () => {tree = create(<ResetPassword/>);});
  await act(async () => {await tree.root.findByType(BlueButton).props.onPress();});
  expect(api.post).not.toHaveBeenCalled();
  expect(alert).toHaveBeenCalledWith('Error', 'Reset token is missing');
  await act(async () => tree.unmount());
  alert.mockRestore();
});
