import {
  runSoundnessCheck,
  type SoundnessResult,
} from '../../soundnessResult';

function setup() {
  return {
    button: document.createElement('button'),
    bar: document.createElement('div'),
    showResult: jest.fn(),
    formatError: (error: unknown) => String(error),
  };
}

describe('soundness results', () => {
  test.each([
    [true, 'green'],
    [false, 'rgb(255, 33, 41)'],
    [null, ''],
  ] as const)('renders verdict %s', async (verdict, color) => {
    const options = setup();
    const result: SoundnessResult = {
      is_sound: verdict,
      message: 'Result',
      explanation: 'ADA explanation\nExecution trace',
    };
    await runSoundnessCheck({ ...options, request: async () => result });
    expect(options.bar.style.backgroundColor).toBe(color);
    if (verdict === true) {
      expect(options.showResult).not.toHaveBeenCalled();
    } else {
      expect(options.showResult).toHaveBeenCalledWith(result);
    }
    expect(options.button.disabled).toBe(false);
  });

  test('keeps the button disabled until checking finishes', async () => {
    const options = setup();
    let finish!: (result: SoundnessResult) => void;
    const request = jest.fn(() =>
      new Promise<SoundnessResult>(resolve => { finish = resolve; }),
    );
    const pending = runSoundnessCheck({ ...options, request });
    expect(options.button.disabled).toBe(true);
    expect(options.bar.style.backgroundColor).toBe('purple');
    await runSoundnessCheck({ ...options, request });
    expect(request).toHaveBeenCalledTimes(1);
    finish({
      is_sound: true,
      message: 'The model is sound.',
      explanation: 'Example is data-aware sound',
    });
    await pending;
    expect(options.button.disabled).toBe(false);
  });

  test('shows request failures without marking the model unsound', async () => {
    const options = setup();
    await runSoundnessCheck({
      ...options,
      request: async () => { throw new Error('Connection failed'); },
    });
    expect(options.bar.style.backgroundColor).toBe('');
    expect(options.showResult).toHaveBeenCalledWith({
      is_sound: null,
      message: 'The soundness check could not complete.',
      explanation: 'Error: Connection failed',
    });
    expect(options.button.disabled).toBe(false);
  });
});
