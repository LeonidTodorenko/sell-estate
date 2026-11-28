import api from '../src/api';
import { fetchPropertiesWithExtras } from '../src/services/properties';

jest.mock('../src/api', () => ({ get: jest.fn() }));

const get = api.get as jest.Mock;

describe('catalog investment availability', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('uses server eligibility independently of the existence of a payment plan', async () => {
    get.mockImplementation(async (path: string) => {
      if (path === '/properties') {
        return { data: [{ id: 'open', title: ' Open ' }, { id: 'closed', title: ' Closed\n' }] };
      }
      if (path.startsWith('/investment-workflow/')) {
        return { data: { canApply: path.endsWith('/open'), stages: [{}] } };
      }
      return { data: [] };
    });

    const result = await fetchPropertiesWithExtras(20, true, true);

    expect(result.map(({ title, canApply, hasPaymentPlan }) => ({ title, canApply, hasPaymentPlan }))).toEqual([
      { title: 'Closed', canApply: false, hasPaymentPlan: true },
      { title: 'Open', canApply: true, hasPaymentPlan: true },
    ]);
  });

  it('preserves the plan but disables investing if eligibility cannot be verified', async () => {
    get.mockImplementation(async (path: string) => {
      if (path === '/properties') {
        return { data: [{ id: 'one', title: 'Apartment' }] };
      }
      if (path.startsWith('/investment-workflow/')) {
        throw new Error('Unavailable');
      }
      return { data: path.endsWith('/payment-plans') ? [{}] : [] };
    });

    const result = await fetchPropertiesWithExtras(20, true, true);

    expect(result[0]).toMatchObject({ hasPaymentPlan: true, canApply: false });
  });
});
