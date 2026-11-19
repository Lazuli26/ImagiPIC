import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import JoinRoomModal from './JoinRoomModal';

let mockModalProps: any;
let mockCloseAllowed: boolean | null;
beforeEach(() => { mockModalProps = null; mockCloseAllowed = null; });
jest.mock('@ionic/react', () => {
  const React = require('react');
  const part = ({ children }: any) => <div>{children}</div>;
  return {
    IonModal: (props: any) => { if (mockModalProps?.isOpen && !props.isOpen) mockCloseAllowed = props.canDismiss; mockModalProps = props; return props.isOpen ? <div>{props.children}</div> : null; },
    IonButton: ({ children, onClick, disabled }: any) => <button disabled={disabled} onClick={onClick}>{children}</button>,
    IonInput: ({ value, onIonChange, onKeyDown, disabled }: any) => <input aria-label="Código de sala" value={value} disabled={disabled}
      onKeyDown={onKeyDown} onChange={event => onIonChange({ detail: { value: event.target.value } })} />,
    IonButtons: part, IonContent: part, IonHeader: part, IonItem: part, IonLabel: ({ children, role }: any) => <div role={role}>{children}</div>, IonTitle: part, IonToolbar: part,
  };
});
afterEach(cleanup);
const props = () => ({ isOpen: true, onJoin: jest.fn().mockResolvedValue(undefined), onJoined: jest.fn(), onDismiss: jest.fn() });

test('navigation waits until Ionic finishes dismissing the join overlay', async () => {
  const callbacks = props();
  const view = render(<JoinRoomModal {...callbacks} />);
  fireEvent.change(view.getByLabelText('Código de sala'), { target: { value: 'abc234' } });
  await act(async () => { fireEvent.click(view.getByText('Entrar a la sala')); });
  expect(callbacks.onJoin).toHaveBeenCalledWith('ABC234');
  expect(mockModalProps.isOpen).toBe(false);
  expect(mockCloseAllowed).toBe(true);
  expect(callbacks.onJoined).not.toHaveBeenCalled();
  act(() => mockModalProps.onDidDismiss());
  expect(callbacks.onDismiss).toHaveBeenCalledTimes(1);
  expect(callbacks.onJoined).toHaveBeenCalledWith('ABC234');
  act(() => mockModalProps.onDidDismiss());
  expect(callbacks.onJoined).toHaveBeenCalledTimes(1);
});

test('a failed join keeps the dialog usable for retry', async () => {
  const callbacks = props();
  callbacks.onJoin.mockRejectedValueOnce(new Error('Sala no encontrada'));
  const view = render(<JoinRoomModal {...callbacks} />);
  fireEvent.change(view.getByLabelText('Código de sala'), { target: { value: 'ABC234' } });
  await act(async () => { fireEvent.click(view.getByText('Entrar a la sala')); });
  expect(view.getByRole('alert').textContent).toBe('Sala no encontrada');
  expect(mockModalProps.isOpen).toBe(true);
  expect(callbacks.onJoined).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(view.getByText('Entrar a la sala')); });
  act(() => mockModalProps.onDidDismiss());
  expect(callbacks.onJoined).toHaveBeenCalledWith('ABC234');
});

test('repeated Enter cannot submit twice while joining and cancellation stays blocked', async () => {
  const callbacks = props();
  let resolve: () => void = () => {};
  callbacks.onJoin.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
  const view = render(<JoinRoomModal {...callbacks} />);
  const input = view.getByLabelText('Código de sala');
  fireEvent.change(input, { target: { value: 'ABC234' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(callbacks.onJoin).toHaveBeenCalledTimes(1);
  expect(mockModalProps.canDismiss).toBe(false);
  expect((view.getByText('Cancelar') as HTMLButtonElement).disabled).toBe(true);
  await act(async () => { resolve(); });
  expect(mockModalProps.canDismiss).toBe(true);
});
