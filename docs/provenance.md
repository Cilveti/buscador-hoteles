# Procedencia de los datos

## Demo rápida: captura adaptada

Por petición de Iñigo del 24 de septiembre de 2026, `bun dev` carga 180 hoteles de una captura del catálogo público de Barceló realizada el 10 de septiembre de 2026 en el proyecto histórico. No se ha consultado ni se garantiza el catálogo actual completo.

- `data/demo/hotels.json`: catálogo independiente en memoria, con nombres y cinco marcas ficticias, descripciones nuevas y los destinos, valoraciones, características y políticas observados en la captura. Los atributos desconocidos siguen siendo desconocidos.
- Una URL de fotografía por hotel, solicitada al proveedor a 960 × 640. No hay copias locales: las fotos requieren conexión y pueden dejar de estar disponibles; la interfaz muestra su alternativa si fallan.
- `data/demo/provenance.json`: correspondencia con la identidad original, URLs de las fotografías y fecha de captura. Cambiar los nombres no convierte las fotos o los datos observados en contenido propio. Los derechos de las fotografías siguen perteneciendo a sus titulares; este snapshot se prepara para la demostración local, no como autorización de publicación o redistribución.
- `scripts/dev/import-demo-catalog.ts`: importación explícita y reproducible desde una carpeta de captura con `catalog-details.json`, `catalog-images.json`, `catalog-attributes.json` y `normalized/hotels.jsonl`. Se ejecuta únicamente al preparar los datos, nunca al arrancar la demo. No descarga imágenes ni realiza peticiones de red.

El JSON está incluido: el arranque no necesita acceso al repositorio histórico ni a una base de datos. Esta demo no alimenta Payload ni modifica los fixtures de QA. No representa disponibilidad, precios ni valoraciones actuales.

## Catálogo sintético de Payload y pruebas

Los 60 hoteles, sus cinco marcas (Aurora, Brisa, Mirador, Natura y Urbana), descripciones, servicios, condiciones y valoraciones se han inventado para formación. No representan establecimientos ni opiniones reales. Las ciudades sí son reales y permiten practicar los filtros geográficos.

- `data/hotels/normalized/hotels.jsonl`: identidades y descripciones iniciales que importa Payload.
- `data/hotels/catalog-details.json`: destinos, puntuaciones y etiquetas simuladas.
- `data/hotels/catalog-attributes.json`: atributos estructurados y marcas ficticias.
- `data/hotels/catalog-images.json`: ilustraciones locales; los seis SVG de `apps/web/public/images` son originales.

Los identificadores `hotel-001` a `hotel-060` enlazan estos archivos. Las URLs bajo `hoteles.example` identifican ejemplos: no son webs de establecimientos. Las fichas iniciales no ofrecen enlaces externos.

Este catálogo sintético no incluye capturas de sitios hoteleros ni fotografías de terceros. La aplicación no cotiza, reserva ni consulta disponibilidad real. Las estancias de `synthetic-stays` y los fixtures de navegador también son inventados.
