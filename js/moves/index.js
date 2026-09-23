/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.

  3D MOVEMENT DATA, one file per family, keyed by animation name (the
  `img` of an exercise in js/exercises.js). The format is documented in
  js/move/body.js (poses) and js/move/motion.js (timing and equipment);
  js/moves/README.md is the authoring guide.
*/
import legs from './legs.js';
import lunge from './lunge.js';
import hinge from './hinge.js';
import push from './push.js';
import press from './press.js';
import pull from './pull.js';
import core from './core.js';
import abs from './abs.js';
import cardio from './cardio.js';

export const MOVES = { ...legs, ...lunge, ...hinge, ...push, ...press, ...pull, ...core, ...abs, ...cardio };
