---
name: hoteles-hexagonal
description: Diseñar o modificar casos de uso, puertos, adaptadores y dependencias del buscador de hoteles, tanto en frontend como backend. Usar al cambiar fronteras o integrar Payload, HTTP o almacenamiento.
---
# Hexagonal en este laboratorio

Consulta [arquitectura](../../../docs/architecture.md) y las decisiones del área. Si el código contradice el diseño, identifica la diferencia antes de extenderla; no asumas que un directorio demuestra independencia.

Para el cambio concreto, identifica el caso de uso, la regla que protege y los efectos externos. Coloca las reglas puras en dominio, la coordinación en aplicación y las llamadas a Payload/HTTP/SQL en adaptadores. La composición inyecta las implementaciones; el caso de uso no localiza dependencias mediante un contenedor global.

Los puertos se definen desde la necesidad del caso de uso y pertenecen al consumidor interno. Usa funciones o interfaces pequeñas y tipos inferidos, sin `BaseRepository`, entidades genéricas ni clases obligatorias. El acceso al catálogo es una frontera real; no crear un puerto por cada función ni copiar los DTO o tipos del SDK dentro del contrato del core.

Hexagonal decide cómo se conecta la aplicación con el exterior; DDD ayuda a modelar sus conceptos y reglas. Se complementan, pero uno no exige el catálogo de patrones del otro. Conserva la estructura útil del proyecto y modifica las fronteras afectadas; no aproveches una tarea pequeña para extraer todas las dependencias de archivos ajenos o crear capas vacías.

En frontend, modela intención de búsqueda, cambios de filtros y estado del caso de uso fuera de React. React presenta el estado e inicia acciones; el adaptador HTTP traduce el contrato compartido. No repetir reglas hoteleras autoritativas del servidor ni convertir cada componente visual en un agregado.

Payload gestiona registros, usuarios y formularios. Sus hooks, endpoints y jobs delegan en casos de uso cuando hay reglas del producto. Los documentos generados por Payload no son el modelo del dominio. El adaptador hace el mapeo y valida con Zod las fronteras externas.

Si se modifica una frontera, expresa qué imports deben permitirse/prohibirse y por qué. Compruébalo con el test arquitectónico cuando exista, siguiendo la [referencia de integridad](../hoteles-testing/references/arquitectura.md). Hasta entonces registra la comprobación pendiente; no simules un check verde. Estos tests verifican dependencias, no permisos de edición del agente.

Verifica el comportamiento por la interfaz pública afectada y una integración representativa cuando cambie un adaptador. No hagas un ADR para una reorganización reversible: úsalo cuando haya un tradeoff que otro desarrollador necesite entender.
