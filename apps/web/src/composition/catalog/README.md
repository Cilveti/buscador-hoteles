# Proyección pública del catálogo

`GET /api/catalog/hotels` sirve búsqueda de hoteles. No acredita disponibilidad, habitaciones ni precios: el catálogo contiene datos ficticios.

`GET /api/catalog/hotels/[hotelId]` consulta un hotel por su identificador externo exacto y devuelve `{ hotel, countryLabel }`, validado con `CatalogHotelDetailResponseSchema`. `hotel` usa la misma proyección pública del catálogo; `countryLabel` contiene el nombre español del país o `null` si se desconoce. La ruta permite letras ASCII, números, guiones y guiones bajos, entre 1 y 100 caracteres: es una regla de nuestra URL local que admite identificadores y fixtures con nombre.

Un identificador mal formado devuelve 400 (`invalid_hotel_id`) antes de cargar datos; uno válido pero ausente devuelve 404 (`hotel_not_found`). La consulta exacta reutiliza la carga actual del catálogo, suficiente para los 60 hoteles del catálogo. Una ficha eliminada en Payload no reaparece desde los datos locales. Los errores de carga o de contrato devuelven 503 (`catalog_unavailable`) sin detalles internos. Esta ruta también responde `Cache-Control: no-store` y conserva el acceso administrativo cerrado.

El contrato compartido vive en `@hoteles/contracts/catalog`; las reglas puras en `@hoteles/core/catalog`. La ruta valida parámetros antes de cargar datos y siempre responde `Cache-Control: no-store`. El adaptador consulta Payload en cada petición para que los cambios editoriales aparezcan en la siguiente búsqueda.

`GET /api/catalog/capabilities` publica las facetas completas, su cobertura y un JSON Schema de filtros con los valores disponibles. La búsqueda admite además destino jerárquico, estrellas, servicios y temáticas (arrays en el contrato, CSV en URL) y estado de admisión de mascotas. Los atributos se incorporan desde `catalog-attributes.json`, validado con Zod. [Arquitectura y alcance](../../../../../docs/architecture.md).

Payload determina los hoteles existentes, su nombre visible y su descripción: se prioriza `editorialDescription` no vacía y después `sourceDescription`. Su `externalHotelId` enlaza los datos ficticios de `catalog-details.json` y las imágenes de `catalog-images.json`, usadas cuando falta una imagen válida en el primero. No se crean hoteles implícitos desde los archivos locales. Faltantes escalares y listas desconocidas son `null`; las listas vacías siguen siendo `[]`.

La marca procede exclusivamente del campo estructurado del catálogo ficticio. Editar el nombre visible no cambia la marca; cuando no hay un valor estructurado se devuelve `null`. El país se toma del último segmento de `locationText` separado por coma. Los valores de consulta conservan el texto original (`Spain`); las etiquetas usan un mapa explícito de países a ISO e `Intl.DisplayNames` en español (`España`). Una nueva denominación sin mapa conserva su texto original. La búsqueda textual combina nombre, localización, destinos y ambas denominaciones del país, ignora acentos y mayúsculas, y requiere todas las palabras.

`minRating` representa puntuación de huéspedes sobre 5, extraída únicamente de valores con formato `n/5`; no estrellas. Los hoteles sin puntuación no satisfacen ningún mínimo, incluido cero. La ordenación `rating` es descendente, con desconocidos al final, y desempata por nombre e identificador. `name` ordena por nombre e identificador. No se modifica el orden original de la fuente.

Cada faceta conserva los otros filtros, el texto y el mínimo de puntuación, omitiendo su propio filtro. La página solicitada no se corrige silenciosamente: fuera de rango devuelve lista vacía y el total real. `pageSize` está limitado a 24; el valor por defecto es 12.

La colección de Payload conserva su acceso administrativo. Únicamente este adaptador usa Local API con `overrideAccess: true`, selección explícita de campos y una proyección final validada por Zod. No publica evidencias completas, reseñas originales ni identificadores internos de Payload. Parámetros inválidos, desconocidos o repetidos producen 400; errores de carga o datos incompatibles producen 503 genérico sin exponer errores internos.

## Arranque local

La aplicación usa el puerto `3101` y una base de datos propia: `hoteles` en `localhost:55433`. El importador `scripts/seed-local.ts` rechaza cualquier otro destino. Lee `DATABASE_URL`, `PAYLOAD_SECRET`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` desde el entorno local del proyecto. Solo crea el usuario administrador e importa los 60 hoteles del corpus; repetirlo conserva las correcciones editoriales.

La navegación pública conserva el listado, sus filtros y las fichas de hotel. Payload administra únicamente hoteles y usuarios.
