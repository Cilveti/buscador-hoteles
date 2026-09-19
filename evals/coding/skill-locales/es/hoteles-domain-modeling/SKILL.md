---
name: hoteles-domain-modeling
description: Precisar lenguaje, invariantes y límites de dominio del buscador, catálogo y experimentos del buscador de hoteles. Usar al modelar necesidades hoteleras o cambiar conceptos y reglas, no para CRUD administrativo sin reglas nuevas.
---
# DDD práctico

Lee [docs/architecture.md](../../../docs/architecture.md) antes de cambiar conceptos. Mantén allí definiciones breves; las decisiones técnicas van a [arquitectura](../../../docs/architecture.md), los requisitos a la especificación de la tarea.

Parte de un ejemplo observable: una búsqueda concreta, una corrección editorial o una evaluación. Identifica identidad, ciclo de vida, invariantes y quién puede cambiar cada dato. Una relación entre tablas no basta para justificar un agregado o bounded context.

Distinciones que no se pueden perder:

- Hotel, habitación y oferta de estancia no son intercambiables. Afinidad hotelera no prueba disponibilidad de una oferta.
- Restricción obligatoria, preferencia y dato desconocido tienen comportamientos diferentes. No inventar fechas/ocupación ni relajar restricciones silenciosamente.
- Texto importado, edición editorial y aspecto semántico derivado conservan procedencia distinta. Una reseña positiva no acredita una política ni representa a todos los huéspedes.
- Definición editable de experimento y ejecución histórica son conceptos diferentes. La ejecución conserva la configuración efectiva y sus versiones.
- Usuario administrador del laboratorio y viajero que busca no son el mismo concepto de identidad.

Modela únicamente las invariantes necesarias para el caso. Prefiere uniones discriminadas para alternativas y estados excluyentes. Usa value objects cuando protejan una regla real; evita wrappers de strings o casts como falsa seguridad.

Formula casos límite con resultado esperado independiente de la implementación: valoración desconocida, evidencia contradictoria, política de mascotas condicionada y edición de prompt después de lanzar una evaluación. La búsqueda vigente no promete disponibilidad ni reservas: no amplíes el producto para completar el modelo histórico de estancias. Si cambia la promesa del producto, pregunta una cuestión concreta; si es una convención de código, resuélvela con el contexto disponible.

Un bounded context no implica un microservicio y una entidad no obliga a crear repositorio, eventos o jerarquías. El límite de un agregado nace de invariantes que deban mantenerse juntas; si el problema es CRUD sin reglas nuevas, usa el mecanismo existente. Comprueba las reglas con la [estrategia de testing](../hoteles-testing/SKILL.md), sin reescribir aquí su procedimiento.

En frontend, el dominio propio es la intención y evolución de la interacción. El backend decide elegibilidad y resultados. Compartir contratos no obliga a compartir un único agregado entre cliente, proveedor y base de datos.
