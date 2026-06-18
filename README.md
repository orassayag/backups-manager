# Backups Manager

Backups Manager is a cross-platform (Windows, macOS, Ubuntu) TypeScript utility designed to automate reliable file backups using full and differential strategies. It intelligently compares file states using size and modification timestamps, enabling efficient synchronization across multiple destinations. The tool provides real-time progress feedback, structured logging, and detailed reporting to a desktop-generated report file.

Built in April 2026, it emphasizes automation, scalability, and robust data protection for developers managing complex backup workflows.

## Features

- 📦 Multi-Mode Backups (Full and Differential)
- 🔄 Intelligent Synchronization with size/timestamp comparison
- 🚫 Advanced Exclusions with glob patterns
- 🗂️ Multi-Session Processing for batch backups
- 📊 Real-Time Monitoring with spinners and progress
- 📝 Automated Reporting with desktop report files
- 🎯 Type Safety with strict TypeScript
- 🧪 Comprehensive Unit Testing with Vitest
- 🔒 Zod Validation for configuration integrity
- 🏗️ Clean Code Architecture with separation of concerns
- 🖥️ Cross-Platform Compatibility (Windows, macOS, Linux)
- ⌨️ Interactive CLI with Inquirer
- 🤖 Automation Ready with CLI flags
- 👀 Watch Mode for rapid development
- 📈 Visual Testing with Vitest UI

### Core Capabilities

- **Multi-Mode Backups**: Support for both Full (complete copy) and Differential (changes only) backup strategies.
- **Intelligent Synchronization**: Uses size and modification time comparison via `dir-compare` for efficient diffing.
- **Advanced Exclusions**: Flexible filtering using exact names and glob patterns (e.g., `node_modules`, `*.log`, `.git`).
- **Multi-Session Processing**: Batch process multiple source-to-target backup tasks in a single run.
- **Real-Time Monitoring**: Live console progress with spinners, percentage indicators, and time elapsed tracking.
- **Automated Reporting**: Generates comprehensive `BACKUP_REPORT.txt` on the Desktop with session summaries and error details.

### Technical Excellence

- **Type Safety**: Built with strict TypeScript for robust development and maintenance.
- **Unit Testing**: Comprehensive test suite using Vitest for all core modules (diff, full, utils, validators).
- **Zod Validation**: Robust settings and session validation to ensure configuration integrity.
- **Clean Code Architecture**: Domain-driven organization with clear separation of concerns.
- **Cross-Platform Compatibility**: Tested and verified on Windows, macOS, and Linux environments.

### Developer Experience

- **Interactive CLI**: User-friendly menu system built with Inquirer for manual operations.
- **Automation Ready**: CLI flags (`--auto`, `--operation`) for easy integration with Task Scheduler or Cron jobs.
- **Watch Mode**: Live development environment with `tsx watch` for rapid iteration.
- **Visual Testing**: Support for Vitest UI to visually inspect test results and coverage.
- **Pre-configured Environment**: Comprehensive `.vscode` settings and Prettier/ESLint configurations included.

## Getting Started

### Prerequisites

- **Node.js**: Version 18 or higher.
- **npm** or **pnpm**: For dependency management.

### Installation

1. Clone the repository:

```bash
git clone https://github.com/orassayag/backups-manager.git
cd backups-manager
```

2. Install dependencies:

```bash
npm install
```

3. Configure your sessions:
   Edit `src/sessions/sessions.json` to define your backup sources and targets.

4. Adjust settings:
   Edit `src/settings/settings.ts` to configure exclusions and automation.

## Usage

### Interactive Menu (Recommended)

To run the tool interactively and select your backup mode:

```bash
npm start
```

This will display the main menu where you can choose between Full Backup, Differential Backup, or Clearing the Cache.

### Automatic Execution

For scheduled tasks or batch scripts, use the automatic mode:

```bash
# Run with default settings from settings.ts
npm run sync

# Force a specific operation via CLI
npm start -- --auto --operation=full
npm start -- --auto --operation=diff
```

### Development Commands

```bash
npm run dev          # Watch mode for development
npm test             # Run all tests
npm run test:ui      # Open Vitest UI
npm run lint         # Check for linting issues
```

## Best Practices

- **Initial Baseline**: Always perform a **Full Backup** for the first run to establish a complete baseline.
- **Exclusion Management**: Regularly review `excludePatterns` in `settings.ts` to skip unnecessary folders like `node_modules` or `.cache`.
- **Report Monitoring**: Check the `BACKUP_REPORT.txt` on your Desktop after automated runs to verify success.
- **Cache Maintenance**: Use the "Clear Cache" option if you encounter unexpected synchronization behavior.
- **Path Lengths**: On Windows, keep target paths relatively short or enable "Long Paths" in the OS settings.

## Architecture Principles

- **Separation of Concerns**: Business logic (backup engines) is decoupled from the UI (menu/progress) and reporting.
- **Immutability**: Configuration and settings are treated as immutable during the execution flow.
- **Defensive Programming**: Extensive validation of user input and environment state before execution.
- **Stateless Execution**: Each backup session is independent, ensuring failures in one don't corrupt others.
- **Observability**: Every action is logged and tracked for both real-time display and post-run analysis.

## Directory Structure

```
src/
├── diff-backup/      # Differential backup engine (changes only)
├── full-backup/      # Full backup engine (complete copy)
├── menu/             # Interactive CLI menu (Inquirer)
├── progress/         # Progress bars and spinners (Ora)
├── reporter/         # Report generation logic (Desktop output)
├── sessions/         # Backup task configurations (JSON)
├── settings/         # Global application settings
├── types/            # Centralized TypeScript definitions
├── utils/            # File system and path helpers
└── validators/       # Configuration and path validation
```

## Design Patterns

- **Strategy Pattern**: Different backup engines (Full vs. Diff) implemented as interchangeable strategies.
- **Singleton Pattern**: Settings and configurations managed as application-wide singletons.
- **Observer Pattern**: Progress tracking system observing the backup engines for real-time updates.
- **Command Pattern**: CLI arguments mapped to specific internal operations.

## Available Scripts

### Main Application

```bash
npm start              # Start interactive menu
npm run sync           # Run automatic differential backup
npm run build          # Compile TypeScript to JavaScript
```

### Development & Testing

```bash
npm run dev            # Watch mode for development
npm test               # Run all tests using Vitest
npm run test:watch     # Run tests in watch mode
npm run test:ui        # Open Vitest UI for visual testing
npm run lint           # Check for linting issues
npm run format         # Format code with Prettier
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines on:

- Reporting issues
- Submitting pull requests
- Code style standards
- Testing requirements
- Documentation expectations

## Support

For questions, issues, or contributions:

- **GitHub Issues**: [https://github.com/orassayag/backups-manager/issues](https://github.com/orassayag/backups-manager/issues)
- **Author**: Or Assayag <orassayag@gmail.com>
- **LinkedIn**: [orassayag](https://linkedin.com/in/orassayag)

## License

This application has an MIT license - see the [LICENSE](LICENSE) file for details.

## Author

- **Or Assayag** - _Initial work_ - [orassayag](https://github.com/orassayag)
- Or Assayag <orassayag@gmail.com>
- GitHub: https://github.com/orassayag
- StackOverflow: https://stackoverflow.com/users/4442606/or-assayag?tab=profile
- LinkedIn: https://linkedin.com/in/orassayag

## Acknowledgments

- Built for educational and research purposes
- Respects robots.txt and implements rate limiting
- Uses user-agent rotation to avoid detection
- Implements polite crawling practices
