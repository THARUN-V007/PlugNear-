# lib/rules

## Ownership Notice
This folder is strictly owned and maintained by **Developer D (Driver side & Core Rules Engine)**.

### Policy:
- All business rules (bookable slot validation, overlap calculation, booking state transitions, cost computation, and proximity search ranking) live here as pure, deterministic, testable functions.
- **Developer H calls these rules and must never edit this folder directly.**
- If any rule needs adjustment, consult and coordinate with Developer D.
