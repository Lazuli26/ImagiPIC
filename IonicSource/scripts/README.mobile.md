# Regresiones de Android y Safari

`test-mobile.cjs` compila una página de prueba con los componentes Ionic reales
de la partida. Sustituye únicamente el acceso a Firestore por memoria local;
no usa cuentas, salas ni datos de producción.

Necesita las dependencias del proyecto y Playwright con Chromium y WebKit
instalados en el entorno de pruebas. Desde `IonicSource`:

```sh
NODE_OPTIONS=--openssl-legacy-provider node scripts/test-mobile.cjs
```

`PLAYWRIGHT_MODULE` permite indicar una instalación externa del módulo y
`CHROME_PATH` un ejecutable local de Chrome y `WEBKIT_PATH` el lanzador de WebKit (`pw_run.sh`). `BROWSER_ENGINES=webkit` o `BROWSER_ENGINES=chromium` permite ejecutar solo un motor. El script imprime la carpeta temporal
con las capturas. Los archivos `mobile-fixture*` solo pertenecen a estas pruebas.

Comprueba los motores disponibles con anchos de 320, 390, 430 y 1280 px:

- Texto y cursor conservados mientras el teclado compone y el reloj actualiza React.
- Enter durante composición no envía; el mensaje final conserva acentos, emoji y orden.
- Campo y botón visibles al simular un teclado que reduce el área visible y desplaza Safari.
- Sin doble espacio de teclado de Ionic ni imagen recortada.
- Giro entre disposición vertical y horizontal sin reemplazar el campo ni perder el borrador.
- Nueve figuras ordenadas, tipos SVG correctos, colores y transparencia comprobados por píxel.
- Colores del dibujo iguales en temas claro y oscuro.
- Vista previa privada antes de confirmar, regreso para escoger otra imagen, selección exclusiva de modificadores, slider de tono y blanco y negro verificados por píxel, semilla compartida desde la confirmación.
- Ingreso con el diálogo Ionic real: cierre completo antes de mostrar la sala y controles utilizables sin recargar.
- Selector del juez con el modal Ionic real: la ronda cambia antes de resolverse
  la confirmación y aun así desaparecen el diálogo y su bloqueo de foco.
- Aviso de todos los aciertos, progreso por jugador y salto a puntos únicamente
  cuando el juez lo pulsa.
- Editor con búsqueda enfocada al abrir, importación de un resultado, creación y
  guardado; controles iniciales y resultado final sin scroll en los tamaños probados.

El editor usa su normalización de imágenes real. El buscador externo y el motor
de formas se sustituyen por datos deterministas en `editor-fixture-*`, además
de la frontera local de Firestore. No se realizan despliegues ni escrituras remotas.

La simulación de viewport no abre un teclado de Android/iOS real. Antes de publicar
conviene repetir en teléfonos físicos: escribir con Gboard y con el teclado de iOS
(autocorrección, tildes, emoji y dictado), enviar con el botón y con Enter, abrir/cerrar
el teclado, girar el dispositivo y cambiar el tema. Verificar Safari tanto en pestaña
como al añadir la app a la pantalla de inicio.

El ajuste sigue `visualViewport` para Safari y usa además
`interactive-widget=resizes-content` para navegadores compatibles:
[WebKit: Visual Viewport](https://webkit.org/blog/9674/new-webkit-features-in-safari-13/),
[Ionic: cambios del teclado en Chrome Android](https://ionic.io/blog/preparing-your-ionic-app-for-changes-coming-to-chrome-for-android).
