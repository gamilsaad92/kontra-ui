const mockCreate = jest.fn();

jest.mock('openai', () => jest.fn().mockImplementation(() => ({
  chat: { completions: { create: mockCreate } },
})));

describe('underwriting sensitive-field boundary', () => {
  beforeEach(() => {
    jest.resetModules();
    mockCreate.mockReset();
    process.env.OPENAI_API_KEY = 'underwriting-test-key';
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            name: 'Example Borrower',
            address: '1 Main Street',
            income: 100000,
            ssn: '123-45-6789',
            ein: '12-3456789',
          }),
        },
      }],
    });
  });

  test('does not send or return SSNs/EINs through auto-fill', async () => {
    const { autoFillFields } = require('./services/underwriting');
    const result = await autoFillFields(Buffer.from(
      'Name: Example Borrower\nSSN: 123-45-6789\nEIN: 12-3456789\nAddress: 1 Main Street',
    ));
    const userContent = mockCreate.mock.calls[0][0].messages
      .find(message => message.role === 'user').content;

    expect(userContent).not.toContain('123-45-6789');
    expect(userContent).not.toContain('12-3456789');
    expect(result.ssn).toBeUndefined();
    expect(result.ein).toBeUndefined();
    expect(result.name).toBe('Example Borrower');
    expect(result.address).toBe('1 Main Street');
  });
});