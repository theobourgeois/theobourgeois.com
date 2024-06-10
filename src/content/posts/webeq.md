---
title: 'WebEQ'
description: 'Multi-band audio equalizer for the web made in React'
createdAt: 'Sep 07 2023'
image: '/webeq.png'
priority: 6
---

## What is EQ?

In music production I often use a tool known as an equalizer (EQ for short). EQ is used to tweak sound frequencies. Wether you want to increase the bass, lower the high-end frequencies, or slightly tweak a bothersome frequency, EQ allows music producers to have complete autonomy over their sound.

Take a look at this FabFilter EQ. The horizontal axis represents the frequency of sound. This ranges from 0-20,000hz. As you may notice, the values in the horizontal axis don't increase linearly. This is because of the way humans perceive frequency. Humans perceive pitch in a logarithmic manner. For example, the interval between 100 Hz and 200 Hz (a ratio of 2:1) sounds similar in pitch difference to the interval between 1000 Hz and 2000 Hz (also a ratio of 2:1), even though the actual frequency difference in the second interval is much larger.

The vertical axis represents the decibals (db). Decibals represent the loudness of a sound. For similar reasons to frequency, decibals are also shown logarithmically.

In this specific EQ configuration, I'm cutting the low end frequencies (0-200hz). This will lead to more a more tinney and less full sound. Hear the different below. 

!["FabFilter Pro-Q3"](/proq.png)

With EQ
<figure style="margin:0">
  <audio
      controls
      src="/eqed.mp3">
          Your browser does not support the audio element.
  </audio>
</figure>

Without EQ
<figure style="margin:0">
  <audio
      controls
      src="/noqed.mp3">
          Your browser does not support the audio element.
  </audio>
</figure>

## Why I created WebEQ
Many of the projects I've created are purely because of curiousity and interest. I thought an EQ would be a fun and challenging project to complete. More specifically, I love how an EQ looks visually, and because many of my projects are visual, I thought an EQ would be cool to make. 

## How I made WebEq
WebEq is a Typescript, React application. I've become highly proficient in React and Javascript has nice Equalizer API, so choosing them made sense to me. 

I started by experimenting with ways to display the EQ graph. I wanted to be able to add nodes to control the loudness of a certain frequency. I also wanted to be able to widen and narrow the area I'm controlling. (It's useful to narrow the area when trying to control a specific frequency.) 

### Bezier Curves
I first started by experimenting with bezier curves. I knew it was possible to make all sorts of shapes with svgs and bezier curves. I soon noticed that bezier curves are challenging to deal with. Dynamically tracking and updating points on bezier curves wasn't really simple to do and didn't really fit my use case. 

### HTML Canvas
My next option was HTML canvas. Canvas has a very simple to use API for drawing lines and points. It's also more performant than svgs because it's a rasterized image, rather than a scalar graphic. This means, I can draw my graph as a rendered image, rather than html elements. Canvas proved to be much simpler to implement. HTML Canvas provides an easy to use API for drawing points, lines and text on the screen. 


```
export type EqualizerPoint = {
    frequency: number;
    gain: number;
    curve: number;
    id: number;
    type: EqualizerType;
};
```


## Conclusion
To conclude, WebEq was challenging enough project that taught a lot about 