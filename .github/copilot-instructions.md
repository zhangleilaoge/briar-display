# GitHub Copilot Instructions

## Skills

This project uses GitHub Copilot Skills to automate common development tasks.

### Available Skills

#### fix

Use when you have lint errors, formatting issues, or before committing code to ensure it passes CI.

**Usage**: Ask Copilot to "fix" or "run fix skill"

**What it does**:

- Runs `yarn prettier` to fix formatting
- Runs `yarn linc` to check for lint issues
- Reports any remaining manual fixes needed
