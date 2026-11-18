# OURCAMPUS — scene artwork (Computer Lab + Library)

Everything here is generated from the same code the app uses (`src/scene/`), so
the files always match what students see. Regenerate after any art change:

```
npm run design:export
```

## What's inside `rive-assets/`

| Folder | Contents |
|---|---|
| `character/student-rig-front.svg`, `student-rig-back.svg` | The OURCAMPUS student, front and back views, every body part a separate named group |
| `character/poses/` | 7 lab poses + 8 library poses (same rig, different joint angles) |
| `lab/components/{light,dark}/` | Seat component in every state (available, in use, requested, unavailable, yours, selected) and the empty room for desktop and mobile |
| `lab/screens/{desktop,mobile}-{light,dark}/` | 5 interaction frames: entrance → seat selection → walking → sitting at the computer → booking success with the lab pass |
| `library/components/{light,dark}/` | Bookshelf with 24 individual books, a single book in each state, the selected book held in the hand |
| `library/screens/{desktop,mobile}-{light,dark}/` | 6 interaction frames: entrance → browsing → book selected → reaching and taking → carrying → issue counter |

Desktop frames are drawn for a ~1000 px wide scene (fits the 1440 px app layout), and mobile frames for ~430 px (fits a 390 px phone).

## Layer names (character)

`student` › `rig-front` / `rig-back` › `shadow`, `bob` › `legs` (`upper-leg-l/r` › `lower-leg-l/r` › `foot-l/r`),
`body` › `torso`, `upper-arm-l/r` › `forearm-l/r` › `hand-l/r`, `head` › `face` (front only).

Each part rotates around its joint. The pivot points (in character coordinates, feet at 0,0) are listed in
`PIVOTS` in `src/scene/rig.js`. When you import into Rive, set each bone/group origin to those points.

Scene layers: `room-background`, `entrance-door`, `whiteboard`, `window-*`, `seats` › `seat-N` › `desk-N`, `computer-N`, `chair-N`, `seat-number-N`;
`bookshelves` › `bookshelf-N` + `books-A/B/C` › `book-B-001`…; `issue-counter` › `librarian`, `counter-props`; `walking-path`; `walker` (the student); `fx`.

## Importing

- **Figma:** drag the SVG files onto the canvas. Each file becomes a frame with the groups above as layers. Use the `lab/components` and `library/components` files as the base for reusable components.
- **Rive:** File → Import → SVG. Groups become nodes. Bind bones to the limb groups using the pivots above, and drive the poses from `character/poses/` as keyframes.

There is no `.fig` or `.riv` file here. Those are made inside Figma and Rive from these SVGs.
