---
name: grill-me
description: Refina una tarea del buscador antes de convertirla en especificación, resolviendo ambigüedades con preguntas concretas.
---

# Grill-me

Explora primero el código si puede responder una duda. Pregunta al usuario por las decisiones que cambian el resultado: propósito, alcance, casos límite, no objetivos y autoridad. Sé conciso: formula preguntas cortas en tandas de tres como máximo, sin rellenar la tanda si solo queda una duda. Acompaña cada una de una recomendación breve cuando ayude. Espera sus respuestas; no conviertas el silencio en acuerdo.

Usa la [plantilla de especificación](../../../docs/workflows/spec-template.md) como guía de los huecos, no como cuestionario obligatorio. Separa objetivos y no objetivos, criterio de aceptación (regla) y caso (Dado/Cuando/Entonces). Aclara los límites o fallos que cambian el resultado. Comprueba en el código qué entorno y datos hacen reproducibles los casos; si el QA disponible no puede comprobarlos, resuelve ese límite antes de declarar la tarea preparada. Los tests existentes no delimitan todas las preguntas que merece la tarea.

Profundiza solo en las ramas relevantes. No preguntes otra vez decisiones explícitas ni detalles técnicos reversibles que puedas resolver con los patrones del repo. Cuando no queden decisiones bloqueantes, resume lo acordado en un máximo de tres puntos y propone pasar a [to-spec](../to-spec/SKILL.md). En el proceso de abordar-tarea, usa su confirmación explícita, distinguiendo guardar/etiquetar de ejecutar. Si quedan dudas, decláralas sin inventar respuestas.
