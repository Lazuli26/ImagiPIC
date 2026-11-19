# Buscador de imágenes

El editor usa Google Programmable Search como primera fuente, con el motor `000cddcc20f024e3c`. Wikimedia Commons permanece disponible como alternativa.

Para crear otro motor o cambiar los sitios incluidos:

1. Crea o abre un motor en [Google Programmable Search Engine](https://programmablesearchengine.google.com/).
2. Activa **Image search** en la configuración del motor.
3. Añade los dominios que quieres buscar. Para empezar: `imgflip.com`, `knowyourmeme.com`, `9gag.com`, `fandom.com`, `wikipedia.org` y `wikimedia.org`. Google limita los motores nuevos a 50 dominios distintos.
4. Si quieres usar otro motor, configura su **Search engine ID** (`cx`) mediante `REACT_APP_GOOGLE_PSE_ID` en `IonicSource/.env.local` o en el entorno de compilación. Reinicia el servidor de desarrollo o recompila la app.

Ejemplo de `.env.local`:

```text
REACT_APP_GOOGLE_PSE_ID=tu-id-de-motor
```

El ID del motor es público. El componente usa el Search Element oficial de Google y presenta sus resultados en una cuadrícula con vista previa grande y enlace a la fuente. Para crear la carta se descarga la **miniatura proporcionada por Google**, sin solicitar la imagen original al sitio de origen. Una miniatura no disponible se puede sustituir por otro resultado.

Google también entrega `thumbnailImage.url`, normalmente una miniatura servida desde `gstatic.com`. Puede mostrarse en los resultados, pero no debe utilizarse como archivo de respaldo para crear cartas: las condiciones de Programmable Search prohíben almacenar resultados o derivados de forma no transitoria, y las cartas guardan una vista previa y las formas generadas. El respaldo debe obtenerse del sitio original o mediante el servidor indicado arriba.
