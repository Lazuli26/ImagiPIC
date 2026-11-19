import { IonButton, IonIcon } from '@ionic/react';
import { arrowForwardOutline, addOutline, enterOutline, sparklesOutline, colorPaletteOutline } from 'ionicons/icons';
import React, { useContext, useMemo, useState } from 'react';
import { Link, useHistory } from 'react-router-dom';
import BasicPage from '../components/BasicPage';
import JoinRoomModal from '../components/JoinRoomModal';
import { UserAuthContext } from '../App';
import { createRoom, joinRoom } from '../game/roomOperations';
import { useDeck } from '../game/useDeck';
import ShapeShowcase from '../components/showcase/ShapeShowcase';
import ShowcaseSettingsModal from '../components/showcase/ShowcaseSettingsModal';
import { resolveCollection, useShowcaseSettings } from '../components/showcase/collection';
import './Home.css';

const Home: React.FC = () => {
  const history = useHistory();
  const userAuth = useContext(UserAuthContext);
  const user = userAuth?.user;
  const { images } = useDeck(user?.uid || '');
  const { settings, save, storageError } = useShowcaseSettings(user?.uid || '');
  const collection = useMemo(() => resolveCollection(settings, images), [settings, images]);
  const [showJoin, setShowJoin] = useState(false);
  const [showCollection, setShowCollection] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const create = async () => {
    if (!user || creating) return;
    setCreating(true); setError('');
    try { const code = await createRoom({ uid: user.uid, displayName: user.displayName || 'Jugador', photoURL: user.photoURL || '' }); history.push(`/room/${code}`); }
    catch { setError('No se pudo crear la sala. Comprueba tu conexión e inténtalo de nuevo.'); }
    finally { setCreating(false); }
  };
  const join = async (code: string) => {
    if (!user) throw new Error('Inicia sesión para entrar a la sala.');
    await joinRoom(code, { uid: user.uid, displayName: user.displayName || 'Jugador', photoURL: user.photoURL || '' });
  };
  return <BasicPage title="Inicio" className="home-page"><div className="home-shell">
    <section className="home-hero">
      <div className="home-copy">
        <span className="hello-chip"><span className="hello-avatar">{user?.photoURL ? <img src={user.photoURL} alt="" /> : (user?.displayName || 'T')[0].toUpperCase()}</span>Hola, {user?.displayName?.split(' ')[0] || 'mente curiosa'}<span aria-hidden="true">✦</span></span>
        <span className="page-eyebrow">UN JUEGO DE PERSPECTIVAS</span>
        <h1>Todo empieza<br />con <span>una forma<svg viewBox="0 0 300 16" aria-hidden="true"><path d="M3 11Q150-5 297 9" /></svg></span>.</h1>
        <p>Un círculo, un triángulo… y de pronto, una idea. Adivina lo que aparece antes que nadie y deja volar tu imaginación.</p>
        <div className="home-actions"><IonButton size="large" onClick={create} disabled={creating || !user}><IonIcon slot="start" icon={addOutline} />{creating ? 'Preparando la diversión…' : 'Crear una sala'}<IonIcon slot="end" icon={arrowForwardOutline} /></IonButton><IonButton size="large" fill="outline" onClick={() => setShowJoin(true)} disabled={creating || !user}><IonIcon slot="start" icon={enterOutline} />Tengo un código</IonButton></div>
        {error && <p role="alert" className="home-error">{error}</p>}
        <div className="home-footnote"><span className="friends-symbol" aria-hidden="true">○ △ □</span><span>Entre amigos, cada perspectiva cuenta.<br /><strong>De 2 a 12 personas · A tu ritmo</strong></span></div>
      </div>
      <div className="home-art-pane"><ShapeShowcase images={collection} durationSecs={settings.durationSecs} suspended={showCollection || showJoin} /></div>
    </section>
    <section className="home-playbook" aria-label="Cómo se juega">{[
      { number: '01', title: 'Reúne a tu gente', text: 'Crea una sala y comparte el código. La próxima partida empieza con ustedes.', shape: 'circle' },
      { number: '02', title: 'Mira más allá', text: 'La imagen se revela forma a forma. ¿Serás el primero en descubrirla?', shape: 'triangle' },
      { number: '03', title: 'Una más y ya', text: 'Suma puntos, celebra los aciertos y prepara la revancha con el mismo grupo.', shape: 'square' },
    ].map(step => <article key={step.number}><div className={`playbook-symbol ${step.shape}`} aria-hidden="true" /><span>{step.number}</span><h2>{step.title}</h2><p>{step.text}</p></article>)}</section>
    <section className="home-personalize"><div className="personalize-icon"><IonIcon icon={colorPaletteOutline} /></div><div><h2>Tu inicio, con tu estilo.</h2><p>Elige qué imágenes se convierten en formas mientras decides tu próxima jugada.</p></div><button type="button" onClick={() => setShowCollection(true)}>Personalizar muestra<IonIcon icon={sparklesOutline} /></button></section>
    {storageError && <p className="home-storage-notice" role="status">{storageError}</p>}
    <footer className="home-footer"><span>Hecho de formas. Lleno de posibilidades.</span><Link to="/deck">Crear mi próxima imagen <IonIcon icon={arrowForwardOutline} /></Link></footer>
  </div><JoinRoomModal isOpen={showJoin} onDismiss={() => setShowJoin(false)} onJoin={join} onJoined={code => history.push(`/room/${code}`)} /><ShowcaseSettingsModal isOpen={showCollection} onDismiss={() => setShowCollection(false)} settings={settings} images={images} onSave={save} /></BasicPage>;
};
export { Home };
export default Home;
