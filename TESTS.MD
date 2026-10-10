
# Togather Testing Suite
- includes unit tests for:
    - Login Page (Component, Input-Validation)
    - Signup Page (Component, Input-Validation)
    - Invitation Builder: Hero Photo, Our Story editor, Layout/Gallery removal (storyBuilder.test.jsx)
    - Our Story helpers, photo validation, photo Save pipeline + mediaBytesUsed (storyBlocks / imageProcessing / storySave)

- includes integration tests for:
    - Firebase Authentication Service
    - Firebse Firestore Service (incl. Our Story storyEntries rules)
    - Cloud Storage rules for Hero/Story photos

- All tests can be run through 'npm' now:
    - "npm run test:all"
    - "npm run test:watch"

## Unit Tests:
- unit tests test base functionality of functions/components
    - "npm run test:unit" : unit test suite

## Integration Tests:
- integration tests test how two functionalities act between each other
    - "npm run test:integration:firestore": firestore test suite
    - "npm run test:integration:auth": authentication test suite
    - "npm run test:integration:storage": storage rules suite (needs the firestore AND storage emulators)

## Using Emulators:
- running emulators is required for testing firestore database, Auth and firebase functions
- emulators are started with:
    - "firebase emulators:start --only <your-list-of-services (comma seperated no spaces)>"
        - usually I start "auth,firestore,functions" (add "storage" for photo uploads / storage rules)
    - you also probably want to load and save emulator data so use:
        - "--import=./emulator-data --export-on-exit=./emulator-data"
- this is now a command "npm run start:emulators"

- additionally you can run the whole project using emulators:
    - go to .env: file and set "VITE_RUN_EMULATOR_MODE" to true
    - run emulators: npm run start emulators
    - then: npm run dev
    - this will run mocked local services for testing purposes
    
    
- firebase firestore rules are set in "./firestore.rules"
- cloud storage rules are set in "./storage.rules" (see docs/STORY_AND_MEDIA.md)