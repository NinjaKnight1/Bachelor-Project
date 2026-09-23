export interface SoundnessResult {
  is_sound: boolean | null;
  message: string;
  explanation: string;
}

interface SoundnessCheckOptions {
  button: HTMLButtonElement;
  bar: HTMLElement;
  request: () => Promise<SoundnessResult>;
  showResult: (result: SoundnessResult) => void;
  formatError: (error: unknown) => string;
}

export async function runSoundnessCheck({
  button,
  bar,
  request,
  showResult,
  formatError,
}: SoundnessCheckOptions): Promise<void> {
  if (button.disabled) return;

  button.disabled = true;
  bar.style.backgroundColor = 'purple';

  try {
    const result = await request();

    if (
      !result ||
      ![true, false, null].includes(result.is_sound) ||
      typeof result.message !== 'string' ||
      typeof result.explanation !== 'string'
    ) {
      throw new Error(
        'The server returned an invalid soundness result.',
      );
    }

    bar.style.backgroundColor =
      result.is_sound === true
        ? 'green'
        : result.is_sound === false
          ? '#ff2129'
          : '';

    if (result.is_sound !== true) {
      showResult(result);
    }
  } catch (error) {
    bar.style.backgroundColor = '';

    showResult({
      is_sound: null,
      message: 'The soundness check could not complete.',
      explanation: formatError(error),
    });
  } finally {
    button.disabled = false;
  }
}
