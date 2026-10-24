# Calidad del aire Noruega

## Qué hace la integración

Esta integración trae a Gladys la **previsión de calidad del aire de MET Norway**, el Instituto Meteorológico de Noruega: el índice noruego de calidad del aire y los contaminantes que lo componen, para la hora actual y las próximas 24 horas. El modelo es el oficial noruego (el mismo que el mapa luftkvalitet.info), a escala de barrio.

- **Un dispositivo por lugar**: cada casa de Gladys ubicada en Noruega, y las estaciones de medición que usted añada.
- **Disparadores de escena**: calidad del aire degradada ahora, degradación prevista en las próximas 24 horas, vuelta a la normalidad.
- **Una acción de escena** que da la calidad del aire de un lugar, con una frase lista para una notificación.
- **Un widget** de panel: los contaminantes, el nivel ahora y en las próximas 24 horas.

Solo lectura, mediante la API abierta de MET Norway (`api.met.no`): sin cuenta ni clave. Sin afiliación con MET Norway.

## Requisitos

- Gladys Assistant **5.2.0** o posterior.
- Una casa ubicada **en Noruega** (Configuración → Viviendas → ubicación), o el código de una estación de medición noruega. MET Norway no tiene previsión de calidad del aire en otros lugares.
- Acceso a Internet a `api.met.no`.

## Configuración

| Campo                      | Qué escribir                                                                                                                                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zona alrededor de una casa | La zona cuya previsión recibe una casa: su **barrio** (grunnkrets, por defecto, el más fino), su **distrito** (delområde) o su **municipio** (kommune).                                                                                      |
| Estaciones                 | Opcional. Los códigos de las estaciones de medición que también desea seguir, separados por comas (10 como máximo), por ejemplo `NO0057A`. El botón **Buscar una estación** se los da, por nombre o alrededor de una casa, con su distancia. |
| Idioma                     | Idioma de los nombres de las funciones (fijados al añadir un dispositivo) y de los textos de escena. Francés por defecto.                                                                                                                    |

Cada casa con ubicación se convierte en un dispositivo de la pestaña **Descubrir**, si está en Noruega. Una casa fuera de Noruega se descarta, y el estado de la pantalla de configuración lo indica cuando no queda ningún lugar.

El botón **Comprobar los lugares** vuelve a leer cada lugar e indica lo que prevé MET Norway: el nivel, y el peor nivel de las próximas 24 horas.

## Dispositivos

Cada lugar (casa o estación) da un dispositivo, llamado `MET Norway <casa o estación>`, con:

| Función                         | Significado                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Índice de calidad del aire      | El índice noruego de la hora actual: **menos de 2 bajo, de 2 a 3 moderado, de 3 a 4 alto, 4 o más muy alto**. |
| Calidad del aire                | Su nivel en palabras: Bajo, Moderado, Alto, Muy alto.                                                         |
| PM2.5, PM10, NO₂, O₃            | Las concentraciones previstas, en µg/m³.                                                                      |
| Índice máximo, próximas 24 h    | La peor hora de aquí a 24 horas.                                                                              |
| Calidad del aire, próximas 24 h | Su nivel en palabras.                                                                                         |

El índice se muestra con un decimal, nunca redondeado por encima de un umbral de nivel (1,96 es «Bajo» y se muestra 1.9). El índice global es el más alto de los de los contaminantes.

MET Norway actualiza la previsión varias veces al día. La integración lee cada lugar **una vez por hora**, con una petición condicional (no se descarga nada si la previsión no cambió), y pasa por sí sola a la hora siguiente.

## Widget

**Calidad del aire Noruega**: con un lugar elegido en sus ajustes, cuatro mosaicos (PM2.5, PM10, NO₂, O₃) que siguen al dispositivo, el nivel actual y el peor nivel de las próximas 24 horas con su hora, en verde (bajo), naranja (moderado) o rojo (alto, muy alto). Sin lugar: una fila por lugar añadido, con su nivel actual.

## Escenas

### Disparadores

- **Aire Noruega: calidad del aire degradada**: el nivel de un lugar sube ahora a «Moderado» o peor, o empeora de nuevo. Filtros: el lugar, los nuevos niveles (marque a partir de su umbral). Variables: nombre del lugar, nivel, índice, nivel anterior, contaminante que fija el índice, resumen.
- **Aire Noruega: degradación prevista**: el peor nivel de las próximas 24 horas sube a «Moderado» o peor, o empeora de nuevo. Filtros: el lugar, los niveles previstos. Variables: las mismas, más la hora del pico y las horas que faltan.
- **Aire Noruega: vuelta a la normalidad**: el nivel vuelve a «Bajo» tras una degradación. Filtros: el lugar, el peor nivel alcanzado. Variables: nombre del lugar, nivel, índice, peor nivel, resumen.

La primera evaluación tras la instalación solo fija los niveles de partida: no se dispara nada. Un reinicio no vuelve a disparar nada.

### Acción

**Aire Noruega: obtener la calidad del aire**: de un lugar, o del lugar con el peor índice. Salidas: resumen (por ejemplo `MET Norway Hjemme: Bajo (1.6) · PM2.5 2.8 µg/m³ · … · Próximas 24 h: Moderado a las 17:00`), nombre del lugar, nivel, índice, contaminante, las cuatro concentraciones, el peor nivel, el índice y la hora de las próximas 24 horas.

## Ejemplos de escenas

- **Avisar antes de que empeore**: disparador «degradación prevista», niveles Alto y Muy alto → enviar un mensaje «Calidad del aire {{trigger.level_label}} prevista a las {{trigger.time}} cerca de {{trigger.place_name}}».
- **Cerrar las ventanas**: disparador «calidad del aire degradada», nivel Moderado y peor → notificar, o bajar la ventilación; disparador «vuelta a la normalidad» → volver a subirla.
- **Resumen de la mañana**: a las 7:00, acción «obtener la calidad del aire» → enviar `{{summary}}` con el tiempo.

## Solución de problemas

- **Ningún dispositivo en Descubrir**: la casa no tiene ubicación, o está fuera de Noruega (consulte el estado de la pantalla de configuración y el botón **Comprobar los lugares**). Defina la ubicación en Configuración → Viviendas.
- **«no es una estación de MET Norway»**: el código no está en la lista de estaciones. Use **Buscar una estación**; algunas estaciones locales tienen un código que distingue mayúsculas y minúsculas (`Loallme`).
- **«MET Norway no responde»**: la API no está accesible; los valores de la previsión ya leída se siguen publicando mientras cubra la hora.
- Más detalles: la pestaña **Registros** de la integración (`LOG_LEVEL=debug` para cada petición).

## Límites

- Una **previsión**, no una medición, de un modelo a escala de barrio: un dispositivo de estación da la previsión en la estación, no lo que mide.
- Solo Noruega. El índice es el noruego, no el europeo.
- Condiciones de MET Norway: un User-Agent que identifica la integración, una petición por lugar y por hora como máximo, y una pausa ante un HTTP 429. Datos © MET Norway, bajo la licencia CC BY 4.0 ([condiciones](https://api.met.no/doc/TermsOfService)).
