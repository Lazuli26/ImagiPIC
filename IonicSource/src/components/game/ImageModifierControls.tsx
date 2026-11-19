import React from 'react';
import type { ImageModifier } from '../../types/database';

interface Props {
  value: ImageModifier;
  disabled: boolean;
  onChange: (modifier: ImageModifier) => void;
}

const newSeed = () => Math.floor(Math.random() * 4294967296).toString(36);
const choices: { type: ImageModifier['type']; label: string }[] = [
  { type: 'none', label: 'Sin modificador' },
  { type: 'shuffle', label: 'Shuffle' },
  { type: 'hue-shift', label: 'Hue shift' },
  { type: 'black-and-white', label: 'Blanco y negro' },
];

const ImageModifierControls: React.FC<Props> = ({ value, disabled, onChange }) => (
  <fieldset className="image-modifiers" disabled={disabled}>
    <legend>Modificador de imagen</legend>
    <div className="image-modifier-options">
      {choices.map(({ type, label }) => <label key={type} className={value.type === type ? 'is-selected' : ''}>
        <input type="radio" name="image-modifier" value={type} checked={value.type === type} onChange={() => {
          if (type === 'shuffle') onChange({ type, seed: newSeed() });
          else if (type === 'hue-shift') onChange({ type, degrees: 90 });
          else onChange({ type });
        }} />
        {label}
      </label>)}
    </div>
    {value.type === 'shuffle' && <div className="image-modifier-setting">
      <label>Semilla de Shuffle<input type="text" maxLength={64} value={value.seed} onChange={event => onChange({ type: 'shuffle', seed: event.target.value })} /></label>
      <button type="button" onClick={() => onChange({ type: 'shuffle', seed: newSeed() })}>Nueva semilla</button>
      <p>La misma semilla revela las figuras en el mismo orden para todos.</p>
    </div>}
    {value.type === 'hue-shift' && <div className="image-modifier-setting">
      <label>Cambio de tono: {value.degrees}°<input type="range" min={-180} max={180} step={1} value={value.degrees} onChange={event => onChange({ type: 'hue-shift', degrees: Number(event.target.value) })} /></label>
    </div>}
    <p className="image-modifier-hint">Solo uno a la vez. Se fija al confirmar la imagen.</p>
  </fieldset>
);

export default ImageModifierControls;
