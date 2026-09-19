# Filtros avanzados del buscador de hoteles

## Objetivo y contexto

El usuario ya puede buscar hoteles por texto, país, marca y valoración de huéspedes. Queremos que también pueda afinar su búsqueda por destino, categoría de estrellas, servicios, temáticas y política de mascotas, sin perder sus selecciones al compartir un enlace o navegar entre resultados y fichas.

El catálogo y su API ya soportan estos filtros y sus facetas. Aprovecha ese comportamiento y mantén la experiencia actual del buscador en escritorio y móvil.

## Requisitos

### Seleccionar y combinar filtros

- Permite seleccionar un destino, una categoría exacta de estrellas entre 1 y 5, varios servicios, varias temáticas y una política de mascotas. Cada grupo debe permitir volver a buscar sin esa restricción.
- Los nuevos criterios se combinan con el texto y los filtros existentes. Las estrellas del hotel y la valoración de huéspedes son criterios independientes.
- Los servicios seleccionados se exigen todos y deben estar disponibles sin condiciones. Las temáticas también se combinan con AND; «Solo adultos» requiere que el catálogo confirme esa condición.
- Mascotas ofrece los estados disponibles en las facetas y, además, la opción «Admisión publicada o con condiciones» (`allowed-or-conditional`). Esta última incluye ambos estados de admisión, excluye política desconocida y no admisión, y se muestra siempre, sin cantidad.

### Mostrar opciones y selecciones

- Usa las opciones, etiquetas y cantidades que devuelve el catálogo. Los recuentos de una faceta omiten los filtros de su propio grupo: no los presentes como una predicción de cuántos resultados dejaría añadir esa opción.
- Una selección debe seguir visible y poder quitarse aunque desaparezca de las facetas al cambiar otros criterios, o no llegue su faceta opcional. Si no tienes su etiqueta, muestra el valor como respaldo; no elimines la selección silenciosamente.
- Los filtros deben poder utilizarse tanto desde el lateral de escritorio como desde el panel móvil. Elige controles adecuados para selección simple y múltiple, coherentes con la interfaz existente.
- Cambiar un filtro aplica la búsqueda inmediatamente, vuelve a la primera página y conserva el resto de criterios y la ordenación. En móvil, «Ver resultados» cierra el panel; no hace falta una segunda aplicación de filtros.

### Entender y limpiar la búsqueda

- Muestra los filtros activos y permite eliminar una selección concreta sin perder las demás. Cada servicio y temática seleccionados debe poder retirarse individualmente.
- El contador móvil cuenta grupos de filtros activos: dos servicios cuentan como un grupo, y una temática como otro. Incluye los filtros anteriores, también la valoración; el texto de búsqueda no cuenta.
- «Limpiar filtros» elimina todos los filtros, conserva texto y ordenación y vuelve a la primera página. Debe estar desactivado cuando no haya ningún filtro activo.
- Desde una búsqueda sin resultados, «Ver todos los hoteles» restablece la búsqueda inicial completa: sin texto ni filtros, con ordenación y paginación iniciales.

### Recuperar una búsqueda

- La URL representa la búsqueda y permite restaurarla al recargar, abrir un enlace válido, navegar atrás o adelante y volver desde una ficha de hotel. Conserva también los criterios anteriores, la página y la ordenación que correspondan.
- Mantén la compatibilidad con el contrato de URL existente, incluidas las listas separadas por comas y `pets=allowed-or-conditional`. Un valor válido seleccionado que no aparezca en las facetas también debe restaurarse.

## Ejemplos de aceptación

1. **Estrellas y valoración:** selecciono cuatro estrellas y valoración mínima de 4,5. Los hoteles cumplen ambos criterios; cambiar las estrellas no borra la valoración.
2. **Multiselección:** selecciono dos servicios y una temática. Los hoteles cumplen los tres criterios. Al quitar uno de los servicios permanece el otro y la temática; el contador móvil sigue mostrando dos grupos.
3. **Selección ausente:** tengo un destino seleccionado y cambio de país; ese destino desaparece de las opciones recibidas. Sigue visible y puedo quitarlo para ampliar la búsqueda.
4. **Navegación:** abro un enlace con dos servicios, una temática y admisión de mascotas publicada o condicionada. Recargar y abrir una ficha y volver conserva la búsqueda. Los hoteles con política desconocida no cumplen el filtro de mascotas.
5. **Limpieza:** desde la página 3, con texto, ordenación y filtros antiguos y nuevos, cambiar un filtro vuelve a la página 1. «Limpiar filtros» conserva texto y ordenación; si no hay resultados, «Ver todos los hoteles» recupera los valores iniciales de toda la búsqueda.

## Fuera de alcance

No amplíes el buscador agéntico, la administración, los datos hoteleros ni las reglas de negocio del catálogo. No se pide rediseñar la aplicación ni añadir un nuevo sistema de estado. Mantén funcionando los filtros, la ordenación, la paginación y la navegación existentes.
