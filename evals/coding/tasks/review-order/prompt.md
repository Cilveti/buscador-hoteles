# Ordenar por número de opiniones

En el buscador convencional, añade la opción «Más opiniones» al control de ordenación existente. No cambies `/explore`, administración, datos del catálogo ni dependencias.

El contrato debe admitir `sort=review-count` tanto en código como por HTTP. Ordena por número de opiniones conocido, de mayor a menor. Cero es un recuento confirmado; `null` es desconocido y siempre queda después de cualquier recuento conocido. Una valoración ausente no convierte un recuento conocido en desconocido. Los empates se resuelven por nombre con el criterio existente y luego por ID. Conserva el comportamiento actual de `sort=name`, `sort=rating` y de la consulta sin ordenación explícita.

Aplica texto y filtros antes de ordenar, y pagina después. Mantén totales y facetas coherentes con la búsqueda; no cambies datos para conseguir el orden. Cambiar de orden reinicia la página. La opción debe reflejarse en la URL, conservarse al recargar y al navegar a ficha y volver, y funcionar en móvil. Un valor de ordenación inválido mantiene el error HTTP existente y no carga el catálogo.

Añade comprobaciones de comportamiento con expectativas independientes y datos sintéticos que distingan recuentos conocidos, cero, desconocidos y empates. Utiliza las herramientas disponibles indicadas en `.agents/ENVIRONMENT.md`.
