// In-memory stand-in for the browser's SpeechRecognition (TESTING_STRATEGY §8c): no microphone and
// no network. A test makes the "browser" hear words, fail or end through the instance.

type Handlers = {
  onstart: (() => void) | null;
  onresult:
    | ((event: {
        resultIndex: number;
        results: { isFinal: boolean; 0: { transcript: string }; length: number }[];
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export class FakeSpeechRecognition implements Handlers {
  static instances: FakeSpeechRecognition[] = [];

  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onstart: Handlers["onstart"] = null;
  onresult: Handlers["onresult"] = null;
  onerror: Handlers["onerror"] = null;
  onend: Handlers["onend"] = null;
  isRunning = false;
  private heard: { isFinal: boolean; 0: { transcript: string }; length: number }[] = [];

  constructor() {
    FakeSpeechRecognition.instances.push(this);
  }

  start() {
    this.isRunning = true;
    this.onstart?.();
  }

  stop() {
    this.isRunning = false;
    this.onend?.();
  }

  abort() {
    this.stop();
  }

  /** The words still being recognised (not final yet). */
  hearInterim(transcript: string) {
    this.push(transcript, false);
  }

  /** Words the browser is sure about. */
  hearFinal(transcript: string) {
    this.push(transcript, true);
  }

  fail(error: string) {
    this.onerror?.({ error });
  }

  /** The browser ends the session by itself (silence, timeout). */
  end() {
    this.isRunning = false;
    this.onend?.();
  }

  private push(transcript: string, isFinal: boolean) {
    const index = this.heard.length;
    this.heard.push({ isFinal, 0: { transcript }, length: 1 });
    this.onresult?.({ resultIndex: index, results: this.heard });
  }

  static get last(): FakeSpeechRecognition {
    const instance = FakeSpeechRecognition.instances.at(-1);
    if (!instance) throw new Error("Nothing started listening");
    return instance;
  }
}

export function installFakeSpeech() {
  FakeSpeechRecognition.instances = [];
  Object.defineProperty(window, "SpeechRecognition", {
    value: FakeSpeechRecognition,
    configurable: true,
    writable: true,
  });
}

export function removeFakeSpeech() {
  Reflect.deleteProperty(window, "SpeechRecognition");
  Reflect.deleteProperty(window, "webkitSpeechRecognition");
  FakeSpeechRecognition.instances = [];
}
