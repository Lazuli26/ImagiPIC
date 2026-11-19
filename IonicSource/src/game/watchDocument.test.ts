import { getDocFromServer, onSnapshot } from 'firebase/firestore';
import { watchDocument } from './watchDocument';

jest.mock('firebase/firestore', () => ({ getDocFromServer: jest.fn(), onSnapshot: jest.fn() }));
const listen = onSnapshot as jest.Mock;
const read = getDocFromServer as jest.Mock;
const snapshot = (state: string, fromCache = false, hasPendingWrites = false) => ({
  data: () => ({ state }), metadata: { fromCache, hasPendingWrites },
});
let receive: (snapshot: any) => void;
let fail: (error: Error) => void;
let stop: () => void;
let unsubscribe: jest.Mock;
let next: jest.Mock;
let error: jest.Mock;
const tick = async () => { jest.advanceTimersByTime(10000); await Promise.resolve(); await Promise.resolve(); };
beforeEach(() => {
  jest.useFakeTimers();
  unsubscribe = jest.fn(); next = jest.fn(); error = jest.fn();
  listen.mockImplementation((_ref, _options, onNext, onError) => { receive = onNext; fail = onError; return unsubscribe; });
  read.mockResolvedValue(snapshot('IN_PROGRESS'));
  stop = watchDocument({} as any, next, error);
});
afterEach(() => { stop(); jest.clearAllTimers(); jest.useRealTimers(); jest.clearAllMocks(); });

test('recovers a missed start even after the preview has loaded', async () => {
  receive(snapshot('PROCESSING'));
  await tick();
  expect(next.mock.calls.map(([value]) => value.data().state)).toEqual(['PROCESSING', 'IN_PROGRESS']);
  read.mockResolvedValue(snapshot('ADJUDICATION'));
  await tick();
  expect(next.mock.calls[2][0].data().state).toBe('ADJUDICATION');
});
test('a cached setup cannot undo an authoritative turn update', () => {
  receive(snapshot('IN_PROGRESS'));
  receive(snapshot('TURN_START', true));
  expect(next).toHaveBeenCalledTimes(1);
});
test('an old server read cannot overwrite a newer listener event', async () => {
  let resolve: (value: any) => void = () => {};
  read.mockImplementation(() => new Promise(done => { resolve = done; }));
  jest.advanceTimersByTime(10000);
  receive(snapshot('IN_PROGRESS'));
  resolve(snapshot('PROCESSING'));
  await Promise.resolve();
  expect(next).toHaveBeenCalledTimes(1);
  expect(next.mock.calls[0][0].data().state).toBe('IN_PROGRESS');
});
test('pending controls and their rollback are preserved', async () => {
  receive(snapshot('PROCESSING'));
  receive(snapshot('IN_PROGRESS', true, true));
  await tick();
  expect(next).toHaveBeenCalledTimes(2);
  receive(snapshot('PROCESSING', true));
  expect(next).toHaveBeenCalledTimes(3);
});
test('reconnects after a listener error and refreshes when focus or connectivity returns', async () => {
  const previous = listen.mock.calls.length;
  fail(new Error('disconnected'));
  jest.advanceTimersByTime(1000);
  expect(listen).toHaveBeenCalledTimes(previous + 1);
  window.dispatchEvent(new Event('online'));
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  window.dispatchEvent(new Event('focus'));
  expect(read).toHaveBeenCalledTimes(2);
});
test('does not poll hidden tabs; visibility restores synchronization', async () => {
  const visibility = jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  await tick();
  expect(read).not.toHaveBeenCalled();
  visibility.mockReturnValue('visible');
  document.dispatchEvent(new Event('visibilitychange'));
  expect(read).toHaveBeenCalledTimes(1);
  visibility.mockRestore();
});
test('cleanup ignores in-flight reads and removes recovery listeners', async () => {
  let resolve: (value: any) => void = () => {};
  read.mockImplementation(() => new Promise(done => { resolve = done; }));
  jest.advanceTimersByTime(10000);
  stop();
  resolve(snapshot('IN_PROGRESS'));
  await Promise.resolve();
  window.dispatchEvent(new Event('focus'));
  jest.advanceTimersByTime(20000);
  expect(next).not.toHaveBeenCalled();
  expect(read).toHaveBeenCalledTimes(1);
  expect(unsubscribe).toHaveBeenCalled();
});
