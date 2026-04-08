# MDRG Mods IDE

Electron-based IDE for creating and managing mods for My Dystopian Robot Girlfriend.

## Project Structure

- **IDE/** - Mod Tool
- **TRANSLATOR/** - Translator

## Development Setup

### Prerequisites
- Node.js (v18+)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Juns-Mod-Tool
```

2. Install dependencies for the IDE:
```bash
cd IDE
npm install
```

3. Install dependencies for Translator:
```bash
cd TRANSLATOR
npm install
```

### Running in Development

#### IDE (Mod Tool)
```bash
cd IDE
npm start
```

#### Translator
```bash
cd TRANSLATOR
npm start
```

### Building for Release

Build Mod Tool:
```bash
cd IDE
npm run build
```

Build Translator:
```bash
cd TRANSLATOR
npm run build
```