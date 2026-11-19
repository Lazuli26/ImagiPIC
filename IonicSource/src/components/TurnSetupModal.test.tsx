import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import TurnSetupModal from './TurnSetupModal';
import { getDeckImages } from '../game/deckOperations';
import type { DeckImageDoc } from '../types/database';

jest.mock('../game/deckOperations', () => ({ getDeckImages: jest.fn() }));
jest.mock('./DeckBuilderModal', () => () => null);
jest.mock('@ionic/react', () => {
  const React = require('react');
  const part = ({ children }: any) => <div>{children}</div>;
  return {
    IonModal: ({ isOpen, children }: any) => isOpen ? <div>{children}</div> : null,
    IonButton: ({ onClick, disabled, children }: any) => <button onClick={onClick} disabled={disabled}>{children}</button>,
    IonCard: ({ onClick, children }: any) => <button onClick={onClick}>{children}</button>,
    IonHeader: part, IonToolbar: part, IonTitle: part, IonContent: part, IonButtons: part, IonIcon: part,
    IonText: part, IonCardSubtitle: part, IonBadge: part, IonGrid: part, IonRow: part, IonCol: part, IonSpinner: part,
  };
});
const image = (id: string): DeckImageDoc => ({
  id, label: id, ownerUid: 'judge', width: 100, height: 100, shapeCount: 10,
  shapesCompact: Array.from({ length: 10 }, (_, x) => [6, 255, 4, x, 0, 10, 10]).flat(),
  options: { shapeTypes: [6] },
} as DeckImageDoc);
const props = { isOpen: true, judgeUid: 'judge', currentUserUid: 'judge', ownerUid: 'judge',
  selectionLocked: false, onSelectImage: jest.fn().mockResolvedValue(undefined), onDismiss: jest.fn() };
beforeEach(() => {
  jest.useFakeTimers();
  (getDeckImages as jest.Mock).mockResolvedValue([image('Sol'), image('Luna')]);
  props.onSelectImage.mockReset();
  props.onSelectImage.mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); jest.clearAllTimers(); jest.useRealTimers(); });

test('selecting and previewing modifiers stays private until explicit confirmation', async () => {
  const view = render(<TurnSetupModal {...props} />);
  await act(async () => {});
  fireEvent.click(view.getByText('Sol'));
  expect(view.container.querySelectorAll('svg rect')).toHaveLength(10);
  fireEvent.click(view.getByLabelText('Hue shift'));
  fireEvent.change(view.getByLabelText(/Cambio de tono/), { target: { value: '-120' } });
  expect(view.container.querySelector('svg')!.style.filter).toBe('hue-rotate(-120deg)');
  fireEvent.click(view.getByLabelText('Blanco y negro'));
  expect(view.container.querySelector('svg')!.style.filter).toBe('grayscale(1)');
  expect(props.onSelectImage).not.toHaveBeenCalled();
  fireEvent.click(view.getByText('Escoger otra imagen'));
  expect(props.onSelectImage).not.toHaveBeenCalled();
  fireEvent.click(view.getByText('Luna'));
  expect(view.container.querySelector('svg')!.style.filter).toBe('');
  fireEvent.click(view.getByLabelText('Blanco y negro'));
  await act(async () => { fireEvent.click(view.getByText('Confirmar imagen y modificador')); });
  expect(props.onSelectImage).toHaveBeenCalledTimes(1);
  expect(props.onSelectImage).toHaveBeenCalledWith(image('Luna'), { type: 'black-and-white' });
});

test('shuffle preview keeps its seed through a failed confirmation and retry', async () => {
  props.onSelectImage.mockRejectedValueOnce(new Error('offline'));
  const view = render(<TurnSetupModal {...props} />);
  await act(async () => {});
  fireEvent.click(view.getByText('Sol'));
  fireEvent.click(view.getByLabelText('Shuffle'));
  fireEvent.change(view.getByLabelText('Semilla de Shuffle'), { target: { value: 'sol-123' } });
  fireEvent.change(view.getByLabelText(/Figuras visibles/), { target: { value: '50' } });
  expect(view.container.querySelectorAll('svg rect')).toHaveLength(5);
  await act(async () => { fireEvent.click(view.getByText('Confirmar imagen y modificador')); });
  expect(view.getByRole('alert').textContent).toContain('Inténtalo de nuevo');
  expect((view.getByLabelText('Semilla de Shuffle') as HTMLInputElement).value).toBe('sol-123');
  await act(async () => { fireEvent.click(view.getByText('Confirmar imagen y modificador')); });
  expect(props.onSelectImage).toHaveBeenLastCalledWith(image('Sol'), { type: 'shuffle', seed: 'sol-123' });
});

test('guessers cannot see the private image picker', () => {
  const view = render(<TurnSetupModal {...props} currentUserUid="guesser" />);
  expect(view.queryByText('Elige tu imagen')).toBeNull();
  expect(props.onSelectImage).not.toHaveBeenCalled();
});
