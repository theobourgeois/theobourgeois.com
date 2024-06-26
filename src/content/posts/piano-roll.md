---
title: 'PianoRoll'
description: 'Multi-feature piano roll application with 50+ instruments.'
createdAt: 'June 13 2023'
image: '/pianoroll.png'
priority: 4
---
## Links
#### Website: [https://pianoroll.netlify.app/](https://pianoroll.netlify.app/)
#### GitHub: [https://github.com/theobourgeois/PianoRoll](https://github.com/theobourgeois/PianoRoll)

## What is PianoRoll?

PianoRoll is a web application I developed that emulates the classic piano roll interface found in many Digital Audio Workstations (DAWs). The piano roll is an essential tool for composing melodies, chord progressions, drum patterns, and more. It presents piano notes on a grid where the y-axis corresponds to the pitch (higher notes are higher on the grid) and the x-axis represents time. The length of a note on the grid determines how long it plays.

## How PianoRoll was Built

PianoRoll was built using ReactJs with TypeScript, aiming to create a dynamic and feature-rich music composition tool that performs smoothly in real-time. Initially, each note on the grid was represented by an individual HTML element. This worked well for a small number of notes, but as the complexity and number of notes increased, the app's performance began to suffer.

To address this, I transitioned to using the HTML Canvas API for rendering notes. Drawing each note on a canvas rather than creating individual HTML elements significantly improved the app's performance, making interactions like creating, moving, and deleting notes much smoother.

## Features of PianoRoll

PianoRoll is designed to be a fully functional tool akin to those found in popular DAWs. Here are some of its key features:

1. **Keyboard Shortcuts**:
   - Cut, copy, and paste notes
   - Move notes up/down by octaves or semitones
   - Undo and redo actions
2. **Diverse Instrumentation**:
   - Access to over 50 soundfont instruments
3. **Layer Support**:
   - Create and manage multiple layers of notes
4. **Grid Snap**:
   - Magnet tool to snap notes to the grid for precise placement
5. **Adjustable BPM**:
   - Change the beats per minute to control the tempo
6. **Multi-Note Selection**:
   - Select and manipulate multiple notes simultaneously
7. **Composition Export**:
   - Download your compositions for future use
8. **MIDI Import**:
   - Import MIDI files to work with existing compositions

## Conclusion
Overall, PianoRoll has a fun and challenging project to complete, which helped me deepen my understanding of creating performant React code. 










