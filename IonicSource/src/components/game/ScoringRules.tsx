import React from 'react';
import { MAX_SPEED_BONUS, STAR_BASE_POINTS, STAR_DESCRIPTIONS } from '../../game/scoring';
import type { CorrectStars } from '../../types/database';

const ScoringRules: React.FC = () => <details className="scoring-rules">
  <summary>Cómo se reparten los puntos</summary>
  <ul>{([1, 2, 3] as CorrectStars[]).map(stars => <li key={stars}><strong>{'★'.repeat(stars)} · {STAR_BASE_POINTS[stars]}–{STAR_BASE_POINTS[stars] + MAX_SPEED_BONUS} puntos:</strong> {STAR_DESCRIPTIONS[stars]}.</li>)}</ul>
  <p>Acertar antes añade hasta {MAX_SPEED_BONUS} puntos. Cuenta cuándo enviaste la respuesta, aunque el juez la revise después. Una respuesta incorrecta o pendiente vale 0.</p>
  <p>El juez recibe el promedio de los puntos base del grupo, contando 0 por cada persona que no acierta: hasta {STAR_BASE_POINTS[3]} puntos. Su premio no depende de la rapidez.</p>
  <p>Cada jugador puntúa una sola vez por imagen. Un acierto aceptado cierra tus envíos de ese turno. Las respuestas equivalentes merecen las mismas estrellas y el juez puede corregirlas hasta cerrar la revisión.</p>
</details>;
export default ScoringRules;
