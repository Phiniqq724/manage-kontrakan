@AGENTS.md

# Project Overview

This project is an Expo Android application. Its used to maintain and manage "kontrakan" that has 5 people in it. Its got admin and member. Member can see their own overview like their bill on this month, input guest form if they wanna invite someone on kontrakan, piket schedule, piket assign if they can't do piket that day, read all rules, assign new rules, report member, and even seeing everybody's contact if he ever lost it.

- Target Audience: Internal kontrakan member.
- Goal: Make everything more transparant also make the data more centralize

# Tech Stack

- Frontend Framework: Expo with SDK56
- Language: TypeScript
- Styling: Stylesheet
- Database: Supabase / PostgreSQL
- Do Not Use: Redux (use Context API instead), jQuery, or heavy third-party charting libraries.

# Project Architecture

- `app/`: Contains the Expo routes and page layouts.
- `components/`: Reusable UI elements (e.g., buttons, modals).
- `utils/`: Utility functions and database client setup.
- `assets/`: Static assets and images.
- `constants/`: Global TypeScript interfaces.
- `services/`: api that connect to supabase

# Coding Style & Guidelines

- Always use functional components with arrow functions.
- Write clean react native code.
- Always add JSDoc comments for complex utility functions.
- For naming conventions: Use camelCase for variables/functions and PascalCase for React components.

# Testing & Quality

Before completing any task, you must run the following sequence:

1. `npx expo-doctor` (Scans for outdated, deprecated, or incorrectly installed packages. Validates package compatibility against the React Native Directory. Checks for sync issues between your app.json configuration and native ios/ or android/ directories. Ensures your project meets the requirements for submitting to app stores and supporting React Native's New Architecture.)
2. `npx tsc --noEmit` (Ensure no type errors)

- Do not add heavy test scaffolding for simple presentational components, but do add unit tests for custom hooks and data utilities.

# Communication & PR Conventions

- Keep explanations high-level. Avoid line-by-line descriptions of code changes.
- Summarize the _why_ and the _what_

1. `npx expo-doctor` (Scans for outdated, deprecated, or incorrectly installed packages. Validates package compatibility against the React Native Directory. Checks for sync issues between your app.json configuration and native ios/ or android/ directories. Ensures your project meets the requirements for submitting to app stores and supporting React Native's New Architecture.)
2. `npx tsc --noEmit` (Ensure no type errors)

- Do not add heavy test scaffolding for simple presentational components, but do add unit tests for custom hooks and data utilities.

# Communication & PR Conventions

- Keep explanations high-level. Avoid line-by-line descriptions of code changes.
- Summarize the _why_ and the _what_ clearly.
- If you encounter a problem or are uncertain about the implementation, stop and ask before proceeding. Surface tradeoffs if multiple solutions exist.
