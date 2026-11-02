/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.

  FitHealth for a bundled build (import { FitHealth } from 'fit-health').
  FIT's app has no build step, so its bridge uses Capacitor.Plugins.FitHealth
  instead and never loads this; see index.d.ts for the API. Off iOS (a
  browser) every method answers that Health isn't here.
*/
import { registerPlugin } from '@capacitor/core';

const unavailable = {
  isAvailable: async () => ({ available: false }),
  authorizationStatus: async () => ({ status: 'unavailable' }),
  requestAuthorization: async () => ({ status: 'unavailable' }),
  saveWorkout: async () => { throw new Error("Apple Health isn't available here"); }
};

export const FitHealth = registerPlugin('FitHealth', { web: () => unavailable });
