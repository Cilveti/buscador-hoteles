# Estado vacío del catálogo · v1

Referencia mínima preparada con el MCP oficial de Penpot en el archivo enlazado en el manifiesto. Es una propuesta para la demo; no es un rediseño aprobado del producto.

## Cuándo aparece

Solo tras una respuesta correcta con `total === 0`. Loading, error de red, página fuera de rango y resultados conservan sus tratamientos actuales.

## Texto y acción

- Título: «Todavía no hemos encontrado tu hotel».
- Ayuda: «Prueba otro destino o amplía los filtros para descubrir más opciones.»
- Botón: «Ver todos los hoteles». Conserva la función `reset` existente.
- Región de estado accesible. Usar un icono de búsqueda de la biblioteca existente; decorativo y oculto a lectores de pantalla. El glifo del diseño solo representa ese icono.

## Presentación

Consultar `desktop.svg` (800 × 340), `mobile.svg` (360 × 340), `tokens.json` y `structure.json`, extraídos del archivo. Tarjeta blanca, borde sólido 1 px, radio 12 px, texto oscuro y acción verde azulado. Botón 208 × 44 px, icono sobre círculo 56 px. Adaptar al ancho disponible sin scroll horizontal; no fijar el ancho del contenedor a 800 px. El título pasa de 24 px a 20 px en móvil. Los PNG sirven para inspección visual; los valores están también en JSON y SVG para agentes sin visión.

## Verificación externa

Buscar un nombre inexistente; comprobar título y botón; activar el botón y comprobar recuperación de resultados. Revisar escritorio y móvil, y que el control de error de red sigue permitiendo reintentar. La coincidencia visual requiere inspección del resultado; una suite funcional verde no demuestra fidelidad de píxeles.
