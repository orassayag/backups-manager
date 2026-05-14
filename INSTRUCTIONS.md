# Setup and Usage Instructions

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Configuration Guide](#configuration-guide)
4. [Available Commands](#available-commands)
5. [Backup Operations](#backup-operations)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)
8. [Documentation](#documentation)
9. [External Resources](#external-resources)
10. [Author](#author)

## Prerequisites

### System Requirements

- **Node.js**: Version 18 or higher
- **Package Manager**: npm or pnpm
- **Operating System**: Windows, macOS, or Linux
- **Disk Space**: Sufficient space on target drives for backups
- **Permissions**: Read access to source paths and write access to target paths and Desktop

## Initial Setup

### 1. Install Dependencies

Clone the repository and install the required packages:

```bash
git clone https://github.com/orassayag/backups-manager.git
cd backups-manager
npm install
```

### 2. Verify Installation

Run the build script to ensure everything is compiled correctly:

```bash
npm run build
```

## Configuration Guide

### Session Configuration

Backup tasks are defined in `src/sessions/sessions.json`. Each session requires a `sourcePath` and a `targetPath`:

```json
[
  {
    "sourcePath": "C:\\Users\\User\\Documents",
    "targetPath": "D:\\Backups\\Documents"
  }
]
```

### Global Settings

Open `src/settings/settings.ts` to configure global behavior:

- **Exclusions**: Define `excludeNames` and `excludePatterns` to skip files/folders.
- **Automation**: Set `automaticMode` and `automaticOperation` for hands-off execution.
- **Paths**: Ensure `reportPath` (defaulting to Desktop) is correct for your OS.

## Available Commands

### Development Commands

```bash
# Linting and Formatting
npm run lint         # Check code style
npm run format       # Fix formatting issues

# Building and Development
npm run build        # Compile TypeScript
npm run dev          # Start with auto-reload

# Testing
npm test             # Run all tests
npm run test:watch   # Watch mode for tests
npm run test:ui      # Visual test runner
```

### Running Scripts

```bash
# Interactive Menu
npm start

# Automatic Differential Backup
npm run sync

# CLI Argument Overrides
npm start -- --auto --operation=full
npm start -- --auto --operation=diff
```

## Backup Operations

### Full Backup

Copies every file from the source to the target, regardless of whether it exists or has changed. Recommended for the first run of any new session.

### Differential Backup

Uses `dir-compare` to identify changed, new, or deleted files. Only synchronizes the differences, making it significantly faster for daily use.

### Cache Management

The tool maintains a `.cache` directory to optimize comparison speed. If you encounter sync issues, use the "Clear Cache" option in the interactive menu.

## Extending the Application

To add new features or modify existing ones:

1. **New Validators**: Add logic to `src/validators/validators.ts`.
2. **Custom Utilities**: Place helper functions in `src/utils/utils.ts`.
3. **New Backup Logic**: Create a new module in `src/` and integrate it into `src/index.ts`.
4. **Types**: Update `src/types/types.ts` when modifying data structures.

## Best Practices

- **Test Runs**: Before backing up large datasets, run a test with a small directory to verify your configuration.
- **Regular Backups**: Use Windows Task Scheduler or Cron to run `npm run sync` daily.
- **Log Review**: Periodically check the generated reports to ensure no files are failing to copy.
- **Security**: Be cautious when backing up sensitive data to external or network drives.

## Documentation

- **README.md**: Overview and high-level architecture.
- **CONTRIBUTING.md**: Guidelines for contributing to the project.
- **CHANGELOG.md**: History of changes and versions.

## External Resources

- [Node.js Documentation](https://nodejs.org/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [Vitest Documentation](https://vitest.dev/guide/)
- [dir-compare GitHub](https://github.com/glenn-murray/dir-compare)

## Author

- **Or Assayag** - _Initial work_ - [orassayag](https://github.com/orassayag)
- Or Assayag <orassayag@gmail.com>
- GitHub: https://github.com/orassayag
- StackOverflow: https://stackoverflow.com/users/4442606/or-assayag?tab=profile
- LinkedIn: https://linkedin.com/in/orassayag

## Last Updated

2026-05-13
