# Apariencia y galería de inicio

Los colores compartidos están en `src/theme/variables.css`. `ThemeProvider` aplica el modo claro, oscuro o del sistema antes y después del inicio de React. La preferencia se guarda en `imagipic.theme` y se sincroniza entre pestañas.

El inicio permite elegir entre la galería incluida y hasta 12 imágenes del mazo. La selección y el tiempo de rotación se guardan en `imagipic.showcase.<uid>` para esa cuenta en ese navegador. Si se eliminan todas las imágenes seleccionadas, vuelve a la galería incluida. Las imágenes privadas no se publican como parte de la galería predeterminada.

`ShapeShowcase` reproduce las formas con el mismo decodificador SVG que las partidas. Se pausa con la pestaña oculta, al salir del área visible o al abrir la configuración; respeta la preferencia de reducir movimiento. En móvil aparece detrás del menú y en horizontal ocupa el lado derecho.

La colección incluida se genera a partir de las ilustraciones SVG originales en `scripts/showcase-sources/`, usando Geometrize y el códec de las cartas:

```sh
node IonicSource/scripts/generate-showcase.cjs
```

Necesita ImageMagick y las dependencias instaladas. El resultado se guarda en `src/data/showcase/collection.json`; no se vuelve a generar en cada visita.

## Portapapeles

El editor abre con el buscador enfocado. Adjuntar un archivo y pegar una imagen
con Ctrl/Cmd+V o con «Pegar imagen» son alternativas secundarias. Todas las
entradas usan `loadImageFile`, seguido del mismo recorte y procesamiento. El
pegado de texto en campos editables no se intercepta.

La creación tiene dos vistas: escoger la imagen y crear la carta. Las formas y
el nombre están junto a la vista previa, los ajustes están plegados y la acción
principal permanece en el pie. El botón «?» abre ayuda contextual. Cambiar los
parámetros invalida las formas anteriores para evitar guardarlas con opciones
que no corresponden al resultado.

## Identidad de la app instalable

`public/manifest.json` identifica la PWA como ImagiPIC y referencia PNG de
192 y 512 px, un icono adaptable de 512 px y el logotipo SVG. El HTML incluye
también un icono de 180 px para iOS. Para regenerar los PNG desde el SVG:

```sh
bash IonicSource/scripts/generate-app-icons.sh
```

Requiere ImageMagick. El icono adaptable conserva el dibujo dentro de la zona
segura. La caché del manifest debe revalidarse para recibir los cambios de
identidad. Una instalación existente puede tardar en actualizar su nombre o
icono según el navegador; quitar el acceso antiguo y volver a instalar permite
comprobar la nueva identidad después de publicar.

## Verificación

```sh
npm --prefix IonicSource run typecheck
CI=true npm --prefix IonicSource test -- --watchAll=false --runInBand
npm --prefix IonicSource run build
```

Revisar inicio, mazo, perfil, editor y partida en ambos temas; comprobar móvil vertical y horizontal. Probar la selección de la galería, recargar y confirmar que se conserva. Pegar una captura, avanzar a la creación de formas y comprobar que el resultado puede guardarse.
