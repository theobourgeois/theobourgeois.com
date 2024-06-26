---
title: 'TSynth'
description: 'Highly customizable web-based synthesizer.'
createdAt: 'Jun 10 2024'
image: '/tsynth.png'
priority: 3
---
## Links
#### Website: [https://tsynth.netlify.app/](https://tsynth.netlify.app/)
#### GitHub: [https://github.com/theobourgeois/TSynth](https://github.com/theobourgeois/TSynth)

## What is TSynth?
**TSynth** is a digital synthesizer I developed for the web. It offers all the features you'd expect from a modern synth, including two oscillators, a fully controllable LFO, an envelope, and a filter. You can connect it to MIDI devices, record and download your sessions, and choose from multiple themes. Give it a try [here](https://tsynth.netlify.app/?screen=OSC%201).

![TSynth Demo](/tsynthgif.gif)

## How was it built?
**TSynth** was built using React, with [Zustand](https://github.com/pmndrs/zustand) handling state management. For the synthesizer, I utilized JavaScript Audio Worklets, providing complete control over the oscillator. 



