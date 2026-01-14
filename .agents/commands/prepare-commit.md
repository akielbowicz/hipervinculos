---
description: Create deliberate, reviewed git commits
---

# Deliberate Commit Workflow

Follow this workflow to commit changes.

## CRITICAL RULES
1. **NEVER commit without describing what will be committed first**
2. **NEVER use `git add -A` or `git add .`**
3. **ALWAYS make multiple logical commits instead of one large commit**

## Process

### Step 1: Review
- Run `git status`
- Run `git diff` for relevant files
- Run `just validate` to ensure integrity

### Step 2: Plan
- Propose logical groups of changes.
- Write draft commit messages for each group.
- Format: `<type>(<scope>): <description>`

### Step 3: Execute (After Confirmation)
- Use `git add <file>` for specific files.
- Use `git commit -m "..."`.
- Verify with `git log -1`.

## Commit Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Build/tools
