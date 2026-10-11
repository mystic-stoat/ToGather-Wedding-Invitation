# Contributions: list the major features, modules, or documents they contributed to.

Colten Mikulastik:

- Created test cases for Login, and Signup
- Created unit test cases for Login, and Signup
- Created integration test cases for firebase auth, and firestore
- Configured Hosting
- Created form-error component, statefunction, and validation utility (consistent input-validation)
- Wrote Cloud Function for Email Sending
- consolidated emulator env, allowing for test suit
- created SMTP2GO MOCK emailer
- emailer testing suite created
- Chore: conformed wedding details to new prototype
- Code Quailty: moved our Sidebar into component, to be called centrally
- Wedding details: moved database entries and worked with formalizing google maps embed
- AI-Chat Interface: integrated more into project, and worked with the position and layout of components
- Full emulator Runtime for Testing configured: added configuration to allow running full app on local emulators
- ENV configuration: adding google maps API key

Keiran Indraanei:

- Created the Forgot Password page and password reset
  interface
- Integrated the existing Firebase password reset functionality into the Forgot Password workflow
- Created the initial AI Wedding Assistant chat interface
- Added the Wedding Assistant as a protected application route
- Implemented section selection and a guided Wedding Details conversation flow
- Added message input, conversation history, and completion response functionality

Christopher Nguyen:

- Added Spotify music integration to the invitation builder
- Added CSV guest list import and validation
- Created wireframes and prototypes for the Spotify music, CSV guest import, and AI Wedding Planner features
- Updated the application UI to match the approved Figma color palette, standardized input backgrounds, updated sidebar styling, and improved Invitation Builder UI consistency.
- Added meal selection options to the Invitation Builder and RSVP flow
- Added dietary restrictions for guests and plus-ones
- Added Kids Allowed / Adults Only wedding settings with individual guest overrides
- Updated RSVP to save guest name and email changes
- Updated guest attendance totals to include submitted plus-ones
- Added and updated RSVP and Firestore security tests
- Edit dashboard "Your Invitation to My Invitation"
- Remove add guest on dashboard and change it to a shortcut to guestlist.
- Created and edited wireframe/Phorotype to dashboard, RSVP, guestlist add, and guestlist.
- Added Travel \& Stay to the Invitation Builder
- Added support for hotel, restaurant, airport, and other recommendations
- Added Google Maps links and descriptions for recommended places
- Added Travel \& Stay invitation preview
- Added unit tests for Travel \& Stay
- Color and UI: Updated the application's colors and styling to better match the sponsor's requested design.
- Our Story: Worked on the Our Story section of the Invitation Builder.
- Venue: Implemented venue information and visibility settings with live preview.
- RSVP: Moved the RSVP deadline into the RSVP tab and synchronized it with Wedding Details.
- Guest RSVP: Updated the guest-facing page to respect venue visibility settings.
- Privacy: Removed the Privacy tab while preserving existing security functionality.
- Testing: Added automated tests and isolated test emulators to prevent development data from being erased.
- Wedding Party: Added the Wedding Party feature to the Invitation Builder.
- Registry: Integrated Registry into the Invitation Builder, including visibility controls.
- Q\&A: Added customizable questions and answers, including starter questions, editing, reordering, and guest-facing display.
- Invitation Builder: Improved the tab order, phone preview, and sidebar styling.
- Hero Photo: Doubled the hero photo height and updated its editing frame.
- Header Cleanup: Removed the unused Preview, Share, and Settings links.

Kris Pritchett:

- Setup links for social media
- Updated icon package for the socials because of deprecation
- Changed how the placeholders work to better accomodate future links
- Now using react-icons/si to handle the icon display and deprecation of the instagram library.
- 9/23/2026
- Reduced the database tables from 4 to 3
- Moved elements from RSVP table into Invitee table
- Updated Firestore local rules for potential use as production rules
- Updated firestore.js to reflect updated rules and tables
- Updated the Betrothed document name for readability
- Fixed the infinite loop for the signup button after entering duplicate information

Jesus Zambrano:

- Change Color Palette
* Worked on updating the application's color palette and overall UI consistency.
* Developed the Wedding Gift Registry page (`Registry.jsx`), including the protected `/gift-registry` route and navigation through the application sidebar.
* Implemented functionality to add, edit, delete, and manage the visibility of wedding gift registries.
* Integrated the Gift Registry with Firebase Firestore, including persistent storage, unique registry IDs, and transactional updates.
* Connected the Gift Registry to the guest RSVP page, allowing guests to view available registries and access external registry links.
* Added URL validation, error handling, loading states, confirmation messages, and empty-state handling to the Registry feature.
* Created automated unit tests for the Gift Registry and verified Firebase data persistence and functionality (PR #41).
* Integrated Google Maps and Google Places Autocomplete into the Wedding Details page for wedding ceremony and reception locations.
* Developed reusable `PlaceAutocompleteInput.jsx` and `GoogleMapEmbed.jsx` components for address suggestions and interactive map previews.
* Implemented automatic address selection, Google Maps URL generation, and storage of venue addresses, coordinates, and Google Place IDs in Firebase Firestore.
* Added support for keyboard navigation, mobile responsiveness, debounced address suggestions, and manual address entry when Google Places is unavailable.
* Updated the Invitation Builder to display saved Google Maps directions links for wedding and reception locations.
* Created automated tests for Google Places Autocomplete and Google Maps embeds, verified Firestore persistence, and tested mobile compatibility (PR #44).
* Updated the Invitation Builder's phone preview to use a generic smartphone frame instead of an iPhone-style notch while maintaining responsive behavior (PR #42).
* Performed functional testing, verified production builds, and addressed integration issues during development of assigned features.
* Created and submitted feature branches and pull requests for code review and integration into the shared development branch.

