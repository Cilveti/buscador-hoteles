# Especificación: Afinar la búsqueda según las características del hotel

## Contexto y problema

El listado ya busca por nombre o destino y filtra por país, marca y valoración de huéspedes. El catálogo ya puede filtrar por destino, estrellas exactas, servicios disponibles, temáticas y mascotas, pero la pantalla no deja elegirlos: para saber si un hotel encaja hay que abrir su ficha. La ficha arrastra la consulta al volver, y el listado no lee destino, estrellas, servicios, temáticas ni mascotas en la dirección, así que un enlace compartido los pierde.

La [issue 19](https://github.com/Cilveti/buscador-hoteles/issues/19) pide combinar esas preferencias, ver lo elegido, quitar una si hay pocas opciones y recuperar la búsqueda, en ordenador y en móvil, sin rediseñar el buscador ni añadir reservas. Consultada el 2026-09-24T11:48:14Z; sin comentarios.

## Objetivo

Poder afinar el listado por destino, categoría exacta de estrellas, servicios, tipo de estancia y admisión de mascotas, y conservar esa búsqueda al compartir la dirección o volver desde una ficha.

## Goals: qué debe conseguir

- Elegir un destino, una categoría exacta de estrellas, varios servicios disponibles, varias temáticas y la admisión de mascotas, combinados con el texto, el país, la marca, la valoración y el orden ya existentes.
- Ver cada valor elegido y quitar uno sin perder los demás.
- Conservar la búsqueda en la dirección del listado, al abrirla de nuevo y al volver desde la ficha.

## Non-goals: qué queda fuera

- Reservas, precios, fechas y disponibilidad.
- Cambios de diseño en la ficha, las tarjetas o la cabecera, y un botón distinto para compartir.
- Cambiar la semántica del catálogo, limpiar etiquetas de la demo o inventar otra taxonomía de estancia u otro estado de mascotas.
- Administración, base de datos, dependencias y configuración del arnés.

## Alcance y comportamiento

- En «Afinar búsqueda», después de país, marca y valoración mínima: Destino, Estrellas, Servicios, Tipo de estancia y Admite mascotas. El mismo bloque se muestra en el panel lateral y en la hoja Filtros.
- Destino es un desplegable con todos los destinos del catálogo, de cualquier nivel, y la opción «Todos los destinos». Estrellas es un desplegable con las categorías presentes y la opción «Todas las categorías». El texto de estrellas se distingue de la valoración de huéspedes.
- Servicios es una casilla por cada servicio disponible. El nombre accesible es la etiqueta de la faceta, sin el recuento. Un servicio condicional no aparece y no cumple el filtro. Varios servicios se exigen todos.
- Tipo de estancia es una casilla por cada temática publicada, con su etiqueta tal cual. Varias temáticas se exigen todas. El nombre accesible es la etiqueta, sin el recuento.
- Admite mascotas es una casilla. Al marcarla entran la admisión publicada y la admisión con condiciones. Junto al control se lee «Incluye las que las admiten con condiciones.»
- Cada valor elegido tiene su ficha «Quitar filtro» seguido de ese valor. El contador del botón Filtros suma cada valor elegido.
- Elegir o quitar un filtro aplica la búsqueda al momento, vuelve a la página 1 y conserva el resto de criterios y el orden.
- Limpiar filtros quita país, marca, valoración, destino, estrellas, servicios, tipo de estancia y mascotas. Deja el texto buscado y el orden. En la pantalla sin resultados, Ver todos los hoteles vacía también el texto y restaura el orden por nombre, como ahora.
- La dirección del listado guarda los criterios. Abrirla muestra los mismos controles, fichas y hoteles. La ficha del hotel lleva esa dirección y Volver a resultados restaura el listado.

## Decisiones acordadas y restricciones

- Destino: todos los niveles que ya publica el catálogo, un solo valor.
- Tipo de estancia: todas las temáticas del catálogo activo, tal cual, sin un subconjunto fijo.
- Mascotas: un solo control, Admite mascotas, equivalente a `pets=allowed-or-conditional`. No se listan el resto de políticas.
- Servicios: una casilla por cada servicio disponible que devuelva el catálogo. Hacen falta todos y solo cuenta la disponibilidad publicada. El aparcamiento condicional de Hotel Demo Sevilla no cumple Aparcamiento.
- Estrellas exactas: 4 estrellas no incluye un hotel de 5. Sigue siendo distinto de la valoración de huéspedes.
- Se reutiliza el contrato ya existente: `destination`, `stars`, `services`, `themes` y `pets`. Los servicios y las temáticas viajan como valores separados por comas en un solo parámetro.
- Compartir es abrir la dirección del listado. No hay otro control.
- El QA recorre AC1–AC9 en ese orden. Cada interacción deja la evidencia en la observación siguiente, sin acciones inspect añadidas. AC10 es abrir la dirección compartida. El veredicto entra en el máximo de 16 acciones.

## Criterios y casos de aceptación

### AC1 — Destino

- **Criterio:** Elegir el destino Málaga deja solo ese hotel, guarda el destino en la dirección y muestra su ficha para quitarlo.
- **Tipo:** normal.
- **Dado:** Abrir `/` y confirmar Hotel Demo Málaga, Hotel Demo Sevilla y Hotel Demo Lisboa.
- **Cuando:** Elegir Málaga en el desplegable Destino.
- **Entonces:** Solo está Hotel Demo Málaga. La dirección contiene `destination=city%2Fmalaga`. Aparece «Quitar filtro Málaga».

### AC2 — Estrellas exactas

- **Criterio:** Tras quitar el destino, elegir 4 estrellas deja solo el hotel de esa categoría. El hotel de 5 estrellas no aparece.
- **Tipo:** normal.
- **Dado:** Tras AC1, activar «Quitar filtro Málaga» y confirmar que vuelven los tres hoteles.
- **Cuando:** Elegir 4 estrellas en el desplegable Estrellas.
- **Entonces:** Solo está Hotel Demo Sevilla. Hotel Demo Málaga no está. La dirección contiene `stars=4`. Aparece «Quitar filtro 4 estrellas».

### AC3 — Servicios

- **Criterio:** Piscina y aparcamiento se exigen a la vez. El aparcamiento condicional no cuenta, así que solo queda el hotel con ambos disponibles.
- **Tipo:** normal.
- **Dado:** Tras AC2, pulsar «Limpiar filtros» y confirmar que vuelven los tres hoteles.
- **Cuando:** Marcar las casillas Piscina y Aparcamiento.
- **Entonces:** Solo está Hotel Demo Málaga. Hotel Demo Sevilla no está.

### AC4 — Sin resultados

- **Criterio:** Añadir un destino que no tiene esos servicios deja el listado vacío y conserva las fichas para poder quitar una.
- **Tipo:** límite.
- **Dado:** El listado dejado por AC3, con Piscina y Aparcamiento activos y solo Hotel Demo Málaga.
- **Cuando:** Elegir Sevilla en Destino.
- **Entonces:** No queda ningún hotel. Se lee «Todavía no hemos encontrado tu hotel». Siguen «Quitar filtro Sevilla», «Quitar filtro Piscina» y «Quitar filtro Aparcamiento».

### AC5 — Quitar un filtro

- **Criterio:** Quitar el aparcamiento conserva la piscina y el destino, y recupera el hotel que sí tiene la piscina disponible.
- **Tipo:** recuperación.
- **Dado:** El listado vacío dejado por AC4.
- **Cuando:** Activar «Quitar filtro Aparcamiento».
- **Entonces:** Aparece Hotel Demo Sevilla. Siguen «Quitar filtro Piscina» y «Quitar filtro Sevilla». Aparcamiento desaparece de la dirección y de las fichas.

### AC6 — Limpiar

- **Criterio:** Limpiar filtros devuelve los tres hoteles y retira de la dirección destino, estrellas, servicios, tipo de estancia y mascotas.
- **Tipo:** recuperación.
- **Dado:** El listado dejado por AC5.
- **Cuando:** Pulsar «Limpiar filtros».
- **Entonces:** Vuelven Hotel Demo Málaga, Hotel Demo Sevilla y Hotel Demo Lisboa. La dirección ya no contiene `destination`, `stars`, `services`, `themes` ni `pets`.

### AC7 — Mascotas

- **Criterio:** Admite mascotas incluye la admisión publicada y la admisión con condiciones, y excluye el hotel sin política conocida.
- **Tipo:** normal.
- **Dado:** El listado dejado por AC6, con los tres hoteles.
- **Cuando:** Marcar la casilla «Admite mascotas».
- **Entonces:** Están Hotel Demo Málaga y Hotel Demo Sevilla. Hotel Demo Lisboa no está. Se lee «Incluye las que las admiten con condiciones.» La dirección contiene `pets=allowed-or-conditional`.

### AC8 — Tipo de estancia

- **Criterio:** Añadir la temática Playa a la admisión de mascotas deja solo el hotel que tiene las dos.
- **Tipo:** normal.
- **Dado:** El listado dejado por AC7.
- **Cuando:** Marcar la casilla Playa.
- **Entonces:** Solo está Hotel Demo Málaga. La dirección conserva `pets=allowed-or-conditional` y contiene `themes=beach`.

### AC9 — Volver de la ficha

- **Criterio:** Abrir la ficha y volver restaura el mismo listado, la temática y la admisión de mascotas.
- **Tipo:** recuperación.
- **Dado:** El listado dejado por AC8, con solo Hotel Demo Málaga.
- **Cuando:** Abrir «Ver hotel Hotel Demo Málaga» y, en la ficha, activar «Volver a resultados».
- **Entonces:** El listado sigue con solo Hotel Demo Málaga, Playa y «Admite mascotas».

### AC10 — Compartir

- **Criterio:** Abrir una dirección con país, orden, destino, estrellas, servicios, temática y mascotas reproduce esos controles, sus fichas y el único hotel que los cumple.
- **Tipo:** normal.
- **Dado:** La dirección `/?country=Spain&sort=rating&destination=city%2Fmalaga&stars=5&services=pool%2Cparking&themes=beach&pets=allowed-or-conditional`.
- **Cuando:** Abrir esa dirección y esperar el listado.
- **Entonces:** Solo está Hotel Demo Málaga. Destino Málaga, 5 estrellas, Piscina, Aparcamiento, Playa y Admite mascotas aparecen elegidos, cada uno con su ficha. La dirección conserva `country=Spain` y `sort=rating`.

## Verificación

- **Entorno y datos:** QA local con React, handlers HTTP y los tres hoteles sintéticos, en una ventana de 1280×900. Hotel Demo Málaga: 5 estrellas, destino Málaga (`city/malaga`), piscina y aparcamiento disponibles, temática Playa (`beach`), mascotas admitidas, valoración 4,5. Hotel Demo Sevilla: 4 estrellas, destino Sevilla (`city/sevilla`), piscina disponible, aparcamiento condicional, temática Ciudad, mascotas con condiciones, valoración 4,8. Hotel Demo Lisboa no tiene estos atributos. La primera observación ya es `/`.
- **Comprobaciones y evidencia:** `bun run verify:app`. QA del workflow con la interacción de cada AC y la captura de su resultado. Recorrer AC1–AC9 en el orden indicado y usar AC10 como navegación directa. El veredicto forma parte de las 16 acciones.
- **Límites:** El agente QA no cambia el ancho. A 1280×900 se ve el panel lateral y el botón Filtros permanece oculto, así que la hoja móvil y su contador no tienen un caso en este QA: los controles nuevos están en el bloque que esa hoja ya muestra. Con tres hoteles solo hay una página, así que la vuelta a la página 1 no se observa aquí. No verifica PostgreSQL, Payload, administración, SSR ni la demo de 180 hoteles.

## Riesgos e impacto

- En la demo de 180 hoteles los destinos, servicios y temáticas son listas largas, con etiquetas repetidas y algunos nombres que contienen Barceló. El QA no ve esa demo.
- En esa demo no hay admisión de mascotas sin condiciones; el control acordado también devuelve las que tienen condiciones.
- Limpiar filtros o la vuelta desde la ficha pueden olvidar un criterio nuevo.
- Serializar mal las listas hace que el enlace compartido pierda servicios o temáticas.
- El presupuesto de 16 acciones no admite repetir cada caso desde cero ni acciones inspect de más.

## Decisiones pendientes

Ninguna.

## Acuerdo y trazabilidad

- **Issue:** https://github.com/Cilveti/buscador-hoteles/issues/19, actualizada el 2026-09-24T11:48:14Z.
- **Confirmación:** El 24 de septiembre de 2026 se confirmó destino con todos los niveles del catálogo, tipo de estancia con todas las temáticas tal cual, un control «Admite mascotas» que incluye admisión publicada y con condiciones, casillas para cada servicio disponible y estrellas exactas. A continuación se confirmó guardar esta especificación, marcar `ready` y lanzar el workflow local en modo normal, con los agentes configurados en el repositorio.
- **Archivos:** `docs/workflows/tasks/refine-hotel-search/spec.md` y `docs/workflows/tasks/refine-hotel-search/spec.json`. Este comentario es el acuerdo. El workflow entrega el JSON completo, con el mismo contenido, a todos los roles.

`ready` significa especificación acordada y comprobable. No indica que esté implementada ni aprobada por QA, y no dispara la fábrica cloud.
