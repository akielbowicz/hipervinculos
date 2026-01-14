---
description: Review work using the Universal Rule of 5 (Draft, Correctness, Clarity, Edge Cases, Excellence)
---

# Universal Rule of 5 Review

Please review the current code/changes using Steve Yegge's Rule of 5 methodology.

## The 5 Stages

1. **Stage 1: DRAFT (Shape)** - Is the overall approach sound?
   - Check `specs/` alignment.
   - Check directory structure conventions.

2. **Stage 2: CORRECTNESS (Logic)** - Are there errors or bugs?
   - Run `just validate` if applicable.
   - Check for off-by-one errors, null checks, data integrity.

3. **Stage 3: CLARITY (Understanding)** - Can someone else understand this?
   - Check naming conventions.
   - Ensure comments explain "why", not "what".

4. **Stage 4: EDGE CASES (What if)** - What could go wrong?
   - Check boundary conditions.
   - Check error handling (timeouts, network failures).

5. **Stage 5: EXCELLENCE (Polish)** - Ready to ship?
   - Performance checks.
   - "Would I be proud to ship this?"

## Output Format

For each stage, provide:
- **Assessment**: [EXCELLENT|GOOD|FAIR|POOR]
- **Issues**: List specific issues with file paths and line numbers.
- **Recommendations**: Actionable fixes.

If critical issues are found in early stages, stop and report.
