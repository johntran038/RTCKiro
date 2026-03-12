# Technology Stack

## Build System

- **Vite** - Fast build tool and dev server with HMR
- **Base Path**: `/vite-react-template/` (configured for GitHub Pages deployment)

## Core Technologies

- **React 18.3** - UI library with JSX runtime
- **React Router DOM 6.28** - Client-side routing with HashRouter
- **Redux Toolkit 2.3** - State management
- **React Redux 9.1** - React bindings for Redux
- **Redux Thunk** - Async middleware for Redux

## Additional Libraries

- **React Icons 5.4** - Icon library
- **React Dev Utils 12.0** - Development utilities

## Code Quality

- **ESLint 9.11** - Linting with React-specific rules
- Plugins: react, react-hooks, react-refresh
- ECMAScript 2020 standard

## Common Commands

```bash
# Development server with HMR
npm run dev

# Production build
npm run build

# Preview production build locally
npm run preview

# Run linter
npm run lint
```

## Development Notes

- Uses ES modules (`"type": "module"`)
- HashRouter is used for GitHub Pages compatibility
- Lazy loading implemented for route components
- StrictMode enabled during development
