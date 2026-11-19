# Comprobar el ciclo de partida

Desde la raíz del repositorio:

```sh
npm --prefix IonicSource run typecheck
CI=true npm --prefix IonicSource test -- --watchAll=false --runInBand
npm --prefix IonicSource run build
npm run test:gameplay
```

La última orden necesita Java y usa exclusivamente el emulador local de Firestore en el puerto 8086 con un proyecto `demo-`. No accede a datos de producción. La configuración está en `firebase.gameplay-test.json`.

Las pruebas de integración verifican ajustes válidos, rotación sin repetir a quienes solo adivinan, bloqueo de cambios y entradas durante la partida, revisión anticipada, permisos de revisión, puntuación de las respuestas definitivas, solicitudes simultáneas sin duplicar puntos ni turnos, final automático y revancha con contadores e historial separados.

Para probar manualmente con dos cuentas: crear sala, elegir rondas y tiempos, unirse con el código, seleccionar imagen, iniciar, enviar y validar respuestas, cerrar la revisión, comprobar la tabla y completar los turnos. Desde el final, preparar una revancha y comprobar que el grupo permanece y los puntos vuelven a cero al comenzar.

Las transiciones de revisión usan `adjudicationStartedAt`; al desplegar esta versión hay que actualizar tanto el frontend como `firestore.rules`. El cambio local no publica automáticamente ninguno de los dos.

Antes de compartir la imagen, el juez abre una **vista previa privada** desde su mazo o al guardar una imagen nueva. Puede recorrer el porcentaje de figuras, escoger **Sin modificador**, **Shuffle** (con semilla editable), **Hue shift** (de −180° a 180°) o **Blanco y negro**, y regresar para escoger otra imagen. Solo se permite un modificador. Nada se escribe en el turno hasta pulsar **Confirmar imagen y modificador**: la imagen y `imageModifier` se guardan en la misma transacción. La primera vista parcial de los demás jugadores ya tiene el efecto aplicado, sin mostrar antes los colores originales. Si la confirmación falla, el juez conserva su selección y puede reintentar.

El modificador queda fijo desde la confirmación. Después se espera a que el grupo cargue sus primeras figuras y el juez inicia el reloj. Shuffle selecciona figuras sin repetir y conserva sus capas originales. Los filtros se mantienen durante la revisión y los resultados.

El juez puede marcar una respuesta como incorrecta o asignarle **1, 2 o 3 estrellas**. Cualquier número de estrellas cuenta como acierto y detiene nuevos intentos de ese jugador. Puede cambiar el grado durante el juego y la revisión, hasta cerrarla. Las respuestas idénticas heredan la valoración y las estrellas existentes; **Deshacer** las devuelve a pendientes. Las reglas solo permiten al juez valorar, validan los niveles enteros de 1 a 3 y bloquean los cambios tras cerrar la revisión.

| Estrellas | Puntos base | Con rapidez |
| --- | ---: | ---: |
| ★ | 30 | 30–40 |
| ★★ | 60 | 60–70 |
| ★★★ | 90 | 90–100 |

El bono de rapidez es `round(10 × tiempo restante / duración del turno)`, calculado con la hora del envío, no la hora de valoración. Se toma la mejor respuesta final de cada jugador una sola vez; una respuesta de más estrellas siempre supera una de menos estrellas. Ser el primero al final del tiempo ya no garantiza 100 puntos. Las respuestas de clientes antiguos sin `stars` conservan el nivel de 3 estrellas.

El juez recibe `round(100 × suma de estrellas de las mejores respuestas / (3 × jugadores que adivinan))`, con quienes no acertaron aportando cero y sin contarse a sí mismo. Así puede ganar de 0 a 100 puntos independientemente del tamaño del grupo. Si uno de dos jugadores acierta con tres estrellas, el juez gana 50 puntos. Si todos aciertan con tres estrellas, gana 100. Los resultados y el historial muestran también sus puntos.

Al ingresar con un código, primero se completa la entrada, después se cierra el diálogo y solo tras `onDidDismiss` se navega a la sala. Los errores conservan el diálogo para reintentar y las pulsaciones repetidas no duplican la solicitud. Los estados de carga de la sala usan indicadores dentro de la página para evitar dejar overlays abiertos al cambiar de vista.

Las pruebas de integración comprueban confirmación atómica, parámetros inválidos, bloqueo posterior de modificadores, cambios de estrellas durante la revisión, bloqueo al cerrarla y puntuación del juez sin duplicados. Estos cambios requieren desplegar el frontend y `firestore.rules` juntos. El trabajo local no publica automáticamente ninguno de los dos.

Para publicar todos los recursos configurados, usar desde la raíz:

```sh
npm run deploy
```

`npm run deploy:hosting` publica únicamente Hosting y `npm run deploy:rules` actualiza únicamente las reglas de Firestore. Si un cambio de la aplicación necesita nuevos permisos, publicar también las reglas o usar el deploy general. Publicar solo Hosting deja las reglas anteriores activas: si no admiten `stars`, tanto las estrellas como marcar incorrecta o deshacer fallan con `permission-denied`.
