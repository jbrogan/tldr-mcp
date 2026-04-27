# Rename `frequency` to `recurrence` on Habits

For consistency with the recurring tasks implementation, rename the `frequency` field on habits to `recurrence`.

---

## Changes Required

- **Database:** rename `frequency` column to `recurrence` on the habits table
- **API:** update habit response payload to return `recurrence` instead of `frequency`
- **MCP tools:** update `create_habit` and `update_habit` parameter names from `frequency` to `recurrence`
- **MCP tool descriptions:** update any references to `frequency` in tool descriptions

---

## Migration

Simple column rename — no data transformation needed. Existing values are free-form strings and remain valid as `recurrence` values.

---

## Note

`next_due_at` is not being added to habits at this time. Habit gap detection continues to use logged actions and the recurrence string for LLM-based reasoning.
