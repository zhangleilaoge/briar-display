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

### Creating New Skills

To add a new skill:

1. Create a folder in `.agents/skills/<skill-name>/`
2. Add a `SKILL.md` file with frontmatter and instructions
3. Copilot will automatically detect and use the skill
