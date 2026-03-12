# Project Structure

## Directory Organization

```
├── public/              # Static assets served directly
├── src/                 # Application source code
│   ├── assets/         # Images, fonts, and other static resources
│   ├── pages/          # Route components (lazy loaded)
│   ├── redux/          # State management
│   │   ├── slices/    # Redux Toolkit slices
│   │   ├── store.js   # Store configuration
│   │   └── rootReducer.js  # Combined reducers
│   ├── App.jsx        # Main app component with routing
│   ├── main.jsx       # Application entry point
│   ├── App.css        # App-specific styles
│   └── index.css      # Global styles
├── workflows/          # CI/CD workflows
└── [config files]      # vite.config.js, eslint.config.js, etc.
```

## Architecture Patterns

### Routing
- Routes defined in `App.jsx` using React Router
- Page components in `src/pages/` are lazy loaded
- HashRouter used for GitHub Pages compatibility

### State Management
- Redux Toolkit for state management
- Slices organized in `src/redux/slices/`
- Root reducer combines all slices in `rootReducer.js`
- Store configured with thunk middleware in `store.js`

### Component Organization
- Page-level components in `src/pages/`
- Lazy loading pattern: `const Component = lazy(() => import("./pages/Component"))`
- Suspense wrapper with fallback UI

### Entry Point Flow
1. `main.jsx` - Wraps app with Provider (Redux) and HashRouter
2. `App.jsx` - Defines routes and lazy loads page components
3. Page components render based on route

## Conventions

- Use `.jsx` extension for React components
- Use `.js` extension for non-component JavaScript files
- CSS modules or component-specific CSS files co-located with components
- Redux slices follow naming pattern: `[feature]Slice.js`
