import {Alert} from 'react-native';
import {handleApiError} from '../src/utils/apiError';

test('API error diagnostics never log Axios credentials or response bodies', () => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  try {
    handleApiError({message: 'request failed', code: 'ERR_BAD_REQUEST',
      config: {headers: {Authorization: 'Bearer private-token'}, data: {password: 'private-password'}},
      response: {status: 403, data: {message: 'Denied', secret: 'private-response'}}}, undefined, {showDetails: false});
    const output = JSON.stringify(log.mock.calls);
    expect(output).not.toContain('private-token');
    expect(output).not.toContain('private-password');
    expect(output).not.toContain('private-response');
    expect(alert).toHaveBeenCalledWith('Error', 'Denied');
  } finally {log.mockRestore();alert.mockRestore();}
});
