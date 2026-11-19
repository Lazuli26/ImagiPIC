import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { isValidRoomCode } from '../utils/roomCode';
import React, { useEffect, useRef, useState } from 'react';

interface JoinRoomModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  onJoin: (code: string) => Promise<void>;
  onJoined: (code: string) => void;
}

const JoinRoomModal: React.FC<JoinRoomModalProps> = ({ isOpen, onDismiss, onJoin, onJoined }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState(false);
  const pending = useRef(false);
  const joinedCode = useRef<string | null>(null);

  useEffect(() => {
    if (isOpen) { setClosing(false); setError(null); }
  }, [isOpen]);

  const handleDidDismiss = () => {
    const destination = joinedCode.current;
    joinedCode.current = null;
    onDismiss();
    // Ionic removes the overlay and restores focus before changing routes.
    if (destination) onJoined(destination);
  };

  const handleCodeChange = (e: CustomEvent) => {
    const value = (e.detail.value as string) || '';
    const filtered = value
      .toUpperCase()
      .split('')
      .filter((c) => /[A-Z0-9]/.test(c))
      .join('');
    setCode(filtered.slice(0, 6));
    setError(null);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const filtered = pasted
      .toUpperCase()
      .split('')
      .filter((c) => /[A-Z0-9]/.test(c))
      .join('');
    setCode(filtered.slice(0, 6));
    setError(null);
  };

  const handleSubmit = async () => {
    if (pending.current || closing) return;
    pending.current = true;
    const codeTrimmed = code.trim();
    setSubmitting(true);
    setError(null);

    if (!isValidRoomCode(codeTrimmed) || codeTrimmed.length !== 6) {
      setError('Introduce un código de sala válido de 6 caracteres.');
      pending.current = false;
      setSubmitting(false);
      return;
    }

    try {
      await onJoin(codeTrimmed);
      joinedCode.current = codeTrimmed;
      setCode('');
      // Unlock dismissal before changing isOpen: Ionic can reject the close
      // if the previous render still marks the request as submitting.
      setSubmitting(false);
      setClosing(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo entrar a la sala. Inténtalo de nuevo.');
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  };

  return (
    <IonModal isOpen={isOpen && !closing} canDismiss={!submitting} backdropDismiss={!submitting} onDidDismiss={handleDidDismiss}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Entrar a una sala</IonTitle>
          <IonButtons slot="end">
            <IonButton disabled={submitting} onClick={onDismiss}>Cancelar</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonItem className="ion-margin-top">
          <IonLabel position="floating">Código de sala</IonLabel>
          <IonInput
            aria-label="Código de sala"
            onKeyDown={e => { if (e.key === 'Enter' && code.length === 6) handleSubmit(); }}
            disabled={submitting || closing}
            value={code}
            onIonChange={handleCodeChange}
            onPaste={handlePaste}
            maxlength={6}
            inputmode="text"
            autocapitalize="characters"
            autocomplete="off"
            autocorrect="off"
            spellcheck={false}
            placeholder="ABC123"
          />
        </IonItem>

        {error && (
          <IonItem lines="none" className="ion-margin-top">
            <IonLabel role="alert" color="danger" className="ion-text-wrap">
              {error}
            </IonLabel>
          </IonItem>
        )}

        <div className="ion-margin-top" style={{ padding: '0 16px' }}>
          <IonButton
            expand="block"
            onClick={handleSubmit}
            disabled={submitting || code.length !== 6}
          >
            {submitting ? 'Entrando…' : 'Entrar a la sala'}
          </IonButton>
        </div>
      </IonContent>
    </IonModal>
  );
};

export default JoinRoomModal;
