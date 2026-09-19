---
name: hoteles-domain-modeling
description: Clarify language, invariants and domain boundaries of hotel search, catalog and experiments. Use when modeling hotel needs or changing concepts and rules, not for administrative CRUD without new rules.
---
# Practical DDD

Read [architecture](../../../docs/architecture.md) before changing concepts. Keep brief definitions there; technical decisions go to [architecture](../../../docs/architecture.md), requirements to the task specification.

Start from an observable example: a concrete search, an editorial correction or an evaluation. Identify identity, lifecycle, invariants and who can change each piece of data. A relationship between tables is not enough to justify an aggregate or bounded context.

Distinctions that must not be lost:

- Hotel, room and stay offer are not interchangeable. Hotel affinity does not prove offer availability.
- Mandatory restriction, preference and unknown data have different behaviors. Do not invent dates/occupancy or silently relax restrictions.
- Imported text, editorial changes and derived semantic aspects have distinct provenance. A positive review does not establish a policy or represent all guests.
- An editable experiment definition and a historical execution are different concepts. The execution preserves the effective configuration and its versions.
- A laboratory administrator and a traveler searching are not the same identity concept.

Model only invariants necessary for the case. Prefer discriminated unions for alternatives and mutually exclusive states. Use value objects when they protect a real rule; avoid string wrappers or casts as false safety.

Formulate edge cases with expected results independent of implementation: unknown rating, contradictory evidence, conditional pet policy and editing a prompt after launching an evaluation. Current search promises neither availability nor bookings: do not expand the product to complete the historical stay model. If the product promise changes, ask a specific question; if it is a code convention, resolve it using available context.

A bounded context does not imply a microservice and an entity does not require a repository, events or hierarchies. An aggregate boundary comes from invariants that must hold together; if the problem is CRUD without new rules, use the existing mechanism. Check rules using the [testing strategy](../hoteles-testing/SKILL.md), without rewriting its procedure here.

In frontend, the domain is interaction intent and evolution. The backend decides eligibility and results. Sharing contracts does not require sharing a single aggregate between client, provider and database.
