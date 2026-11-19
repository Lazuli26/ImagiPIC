import { IonContent, IonHeader, IonPage, IonToolbar } from '@ionic/react';
import React, { ReactNode } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { IonIcon } from '@ionic/react';
import { homeOutline, imagesOutline, personOutline } from 'ionicons/icons';
import Logo from '../brand/Logo';
import GeometryBackdrop from '../brand/GeometryBackdrop';
import { ThemeToggle } from '../../theme/ThemeControls';
import './index.scss';

interface BasicPageProps { title: ReactNode; fullscreen?: boolean; className?: string; }
const BasicPage: React.FC<BasicPageProps> = ({ children, title, fullscreen = false, className = '' }) => <IonPage className={`app-page ${className}`} aria-label={typeof title === 'string' ? title : undefined}>
  <IonHeader className="app-header"><IonToolbar><div className="app-header-inner">
    <Link to="/home" className="brand-link" aria-label="ImagiPIC, ir al inicio"><Logo /></Link>
    <nav className="app-navigation" aria-label="Navegación principal">
      <NavLink to="/home" activeClassName="is-active"><IonIcon icon={homeOutline} /><span>Inicio</span></NavLink>
      <NavLink to="/deck" activeClassName="is-active"><IonIcon icon={imagesOutline} /><span>Mi mazo</span></NavLink>
      <NavLink to="/profile" activeClassName="is-active"><IonIcon icon={personOutline} /><span>Mi perfil</span></NavLink>
    </nav>
    <ThemeToggle />
  </div></IonToolbar></IonHeader>
  <IonContent fullscreen={fullscreen} className="app-content"><GeometryBackdrop /><div className="app-route-content">{children}</div></IonContent>
</IonPage>;
export default BasicPage;
