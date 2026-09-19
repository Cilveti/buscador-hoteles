# Filtrar valoraciones con suficiente evidencia

Al ordenar por valoración, un hotel con dos opiniones puede aparecer por delante de otro con cientos. Quiero mantener la ordenación actual, pero ofrecer un filtro opcional «Mínimo de opiniones» en el buscador convencional. No desarrolles nada para `/explore` ni para el buscador agéntico.

El contrato público debe aceptar `minReviewCount`, un entero entre 0 y 1.000.000, tanto como número en código como representado en un único parámetro HTTP. Sin parámetro no cambia la búsqueda actual. Con parámetro, un hotel solo pasa si su número de opiniones es conocido y mayor o igual al mínimo. `null` es desconocido, no cero; con mínimo 0 se admiten cero opiniones confirmadas, pero se excluyen los desconocidos. No deduzcas que un hotel sin valoración tiene cero opiniones ni cambies sus datos.

El filtro se combina con texto y los demás filtros antes de ordenar, paginar y calcular facetas. Valores negativos, fraccionarios, vacíos, no numéricos, repetidos o superiores al máximo deben producir 400 en HTTP, conservando el contrato de error existente; la carga del catálogo no debe ejecutarse con una consulta inválida.

En escritorio y móvil ofrece «Sin mínimo», 10, 50, 100 y 500, conservando además un valor válido recibido por URL aunque no esté en esas opciones. Seleccionar o quitar el filtro reinicia la página; limpiar filtros y ver todos los hoteles también lo elimina. Muestra el filtro activo y permite quitarlo por separado. Enlaces compartidos, recarga, atrás/adelante y ficha → resultados conservan la selección.

Los tests deben cubrir con datos sintéticos los casos desconocido, cero, justo en el límite y por debajo, la combinación con valoración, el total antes de paginar y la validación HTTP. Mantén las convenciones de arquitectura y tipos del proyecto y evita añadir dependencias o infraestructura para una operación local del catálogo.

Esta tarea se revisa con los checks generales y el juez; no tiene una batería de aceptación específica preescrita. Un verde general por sí solo no acredita estos nuevos comportamientos.
