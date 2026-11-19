# Puntuación de ImagiPIC

Reglas revisadas el 19 de noviembre de 2026. Implementación:
`IonicSource/src/game/scoring.ts`. Las puntuaciones ya guardadas no se recalculan.

## Referencias e inspiración

| Juego y fuente primaria | Lo que documenta | Aplicación a ImagiPIC |
| --- | --- | --- |
| [Sketchful: ayuda oficial](https://sketchful.io/help) | Presentación por turnos, adivinar lo antes posible y ganar por puntos acumulados. No publica una fórmula numérica completa. | Mantener reconocimiento y rapidez, sin atribuirle coeficientes que no están documentados. |
| [Pinturillo: desarrollador Chachiware](https://chachiware.com/app/pinturillo-2/) | El primer acertante recibe 60 puntos; los demás dependen de cuánto tardan. | La rapidez debe marcar una diferencia perceptible. |
| [Pinturillo: instrucciones oficiales](https://www.pinturillo2.com/es/como-jugar-a-pinturillo) | El artista también puntúa cuando los demás reconocen su dibujo. | Premiar una imagen reconocible por una proporción del grupo, no por su tamaño absoluto. |

Los coeficientes siguientes son un diseño propio para ImagiPIC. Aquí hay
reconocimiento gradual de imágenes elegidas por el presentador y valoración
humana de respuestas; no existe una única palabra exacta que el sistema valide.

## Regla para quien adivina

`puntos = base de estrellas + redondear(20 × fracción de tiempo restante)`

| Valoración | Criterio | Base | Rango final |
| --- | --- | ---: | ---: |
| 1 estrella | Idea general reconocida | 40 | 40–60 |
| 2 estrellas | Respuesta reconocible con detalles pendientes | 60 | 60–80 |
| 3 estrellas | Respuesta precisa o sinónimo equivalente | 80 | 80–100 |
| Incorrecta o pendiente al cerrar | Sin acierto confirmado | 0 | 0 |

El máximo descompone 80 puntos por precisión y 20 por rapidez. Antes se usaban
30/60/90 y solo 10 por rapidez: la valoración subjetiva dominaba demasiado.
Ahora una estrella de diferencia vale lo mismo que todo el bonus temporal:
una respuesta con menos estrellas puede empatar la categoría siguiente, pero
nunca superarla únicamente por velocidad.

Ejemplo de un turno de 60 segundos:

| Momento del envío | 1 estrella | 2 estrellas | 3 estrellas |
| --- | ---: | ---: | ---: |
| Al empezar | 60 | 80 | 100 |
| A los 30 segundos | 50 | 70 | 90 |
| Al cumplirse los 60 segundos | 40 | 60 | 80 |

Se usa la marca de envío del servidor, no la hora de validación. Cambiar las
estrellas en revisión modifica la base, pero no el tiempo original. No hay un
premio fijo de 100 para el primero: reconocer tarde una imagen difícil sigue
siendo válido y no se vuelve artificialmente un acierto instantáneo.

## Regla para quien presenta

`puntos del juez = redondear(suma de bases obtenidas por los adivinadores / número de adivinadores al iniciar el turno)`

Cada persona sin acierto aporta 0. No se promedian solo los aciertos: así, una
única persona que reconoce la imagen no puede darle el máximo al presentador
si otras cuatro no la reconocen. El premio máximo es 80, con todos a 3 estrellas.

Ejemplos:

| Resultado | Premio del juez |
| --- | ---: |
| Nadie acierta | 0 |
| 2 de 4 aciertan a 3 estrellas | 40 |
| 5 de 10 aciertan a 3 estrellas | 40 |
| Entre 4 personas: 3, 2, 1 y ningún acierto | 45 |
| Todas las personas aciertan a 3 estrellas | 80 |

El juez comparte la precisión media del grupo. El bonus temporal se reserva a
quien adivina, porque el juez decide el ritmo y las pausas de la imagen. Esto
elimina el anterior premio de 100 para el juez frente a 90 para un acierto exacto
al final. También evita copiar el promedio completo de los premios: con solo
dos jugadores, dar al juez exactamente los puntos del otro produciría empate
en cada turno y haría imposible desempatar una partida por habilidad.

## Límites y casos especiales

- Una sola aportación por jugador: la mejor respuesta válida, sin sumar intentos.
- Como en el flujo anterior, cualquier acierto aceptado cierra los envíos de ese
  jugador. Las estrellas todavía se pueden revisar. Si el intento aún contiene
  un error de significado que debe corregirse, no debe validarse como acierto.
- El grupo se congela al iniciar el reloj. Salir después no cambia el denominador
  del juez; quien salió antes de ese turno no cuenta. Los clientes antiguos sin
  esta lista usan el grupo de la sala como compatibilidad.
- Las respuestas del propio juez, de usuarios ajenos al turno, fuera de plazo o
  con estrellas inválidas no puntúan. Los aciertos antiguos sin estrellas se
  conservan como 3 estrellas.
- Cerrar antes la fase de respuestas impide contar envíos posteriores. La rapidez
  sigue usando la duración original, de modo que cerrar o saltar no cambia los
  puntos ya ganados. Saltar es una decisión del juez, no una obligación.
- La transacción de puntuación del anfitrión conserva el guardado único: dos
  pestañas no deben sumar el mismo turno dos veces. Se guarda un desglose
  base/rapidez y una versión de reglas junto con los resultados nuevos.
- Los empates de puntos en la clasificación son compartidos. El orden visual
  estable de los nombres no concede puntos adicionales.

## Equidad de la partida completa

La comparación más justa requiere las mismas oportunidades: cada participante
presenta el mismo número de veces, con el mismo reloj y el mismo criterio de
estrellas. «Solo adivinar», entradas/salidas durante la partida y presentadores
con distinta severidad hacen que las oportunidades sean asimétricas; la tabla
actual suma puntos y no aplica una normalización por rol.

El presentador debe dar el mismo grado a respuestas equivalentes y no castigar
sinónimos ni faltas que no cambien el significado. La fórmula reduce diferencias
entre roles y tamaños de sala, pero no puede eliminar favoritismo ni acuerdos
externos mientras una persona decide los aciertos. El cálculo se ejecuta en el
cliente del anfitrión: esto sigue siendo un juego casual, no un sistema de
competición resistente a un anfitrión que manipule su cliente.

La ponderación es una regla inicial razonada, no un equilibrio demostrado con
datos de partidas. Conviene observar partidas con grupos y habilidades distintas
antes de modificar estos pesos de nuevo.
