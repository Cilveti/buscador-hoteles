---
name: grill-me
description: Refina una tarea del buscador antes de convertirla en especificación, resolviendo ambigüedades con preguntas concretas.
---

# Grill-me

Explora primero el código si puede responder una duda. Pregunta al usuario por las decisiones que cambian el resultado: propósito, alcance, casos límite, no objetivos y autoridad. Sé conciso: formula preguntas cortas en tandas de tres como máximo, sin rellenar la tanda si solo queda una duda. Acompaña cada una de una recomendación breve cuando ayude. Espera sus respuestas; no conviertas el silencio en acuerdo.

Profundiza solo en las ramas relevantes. No preguntes otra vez decisiones explícitas ni detalles técnicos reversibles que puedas resolver con los patrones del repo. Cuando no queden decisiones bloqueantes, resume lo acordado en un máximo de tres puntos y propone pasar a [to-spec](../to-spec/SKILL.md). En el proceso de abordar-tarea, pregunta «¿Lo paso a spec y lanzo el workflow?» y espera confirmación explícita antes de continuar. Si quedan dudas, decláralas sin inventar respuestas.
