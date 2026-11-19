import { IonButton, IonIcon } from '@ionic/react';
import { play, pause, add } from 'ionicons/icons';
import React from 'react';

interface JudgeRhythmBarProps {
  playing: boolean;
  disabled?: boolean;
  starting?: boolean;
  complete?: boolean;
  onTogglePlay: () => void;
  onAdvance: (steps: number) => void;
}
const JudgeRhythmBar: React.FC<JudgeRhythmBarProps> = ({ playing, disabled = false, starting = false, complete = false, onTogglePlay, onAdvance }) => (
  <div style={{ padding: '8px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px' }}>
    <IonButton size="small" disabled={disabled || complete} onClick={onTogglePlay}>
      <IonIcon slot="start" icon={playing ? pause : play} />{complete ? 'Imagen completa' : starting ? 'Iniciar turno' : playing ? 'Pausar imagen' : 'Continuar imagen'}
    </IonButton>
    {!starting && <IonButton size="small" fill="outline" disabled={disabled || complete} onClick={() => onAdvance(5)}><IonIcon slot="start" icon={add} />Revelar 5 formas</IonButton>}
  </div>
);
export default JudgeRhythmBar;
export { JudgeRhythmBar };
