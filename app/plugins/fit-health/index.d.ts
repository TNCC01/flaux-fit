/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.

  FitHealth: FIT's Apple Health plugin, as JavaScript sees it. The native
  side is ios/Sources/FitHealthPlugin/FitHealthPlugin.swift. The app's
  bridge (app/native-bridge.js) has no build step, so it reaches this as
  Capacitor.Plugins.FitHealth rather than importing index.js; this file
  is the contract between the two.

  iOS only. On Android there is no native side, so Capacitor.Plugins has
  no FitHealth and the bridge treats Health as unavailable (Health
  Connect is planned for v1.1). In a browser, index.js answers
  unavailable too.
*/

/** The kinds of workout FIT saves (HKWorkoutActivityType names). */
export type FitHealthActivity =
  | 'highIntensityIntervalTraining'
  | 'functionalStrengthTraining'
  | 'crossTraining'
  | 'mixedCardio'
  | 'flexibility';

/** Whether FIT may write workouts to Health. */
export type FitHealthStatus = 'authorized' | 'denied' | 'notDetermined' | 'unavailable';

export interface FitHealthWorkout {
  activity: FitHealthActivity;
  /** When it started, in milliseconds since 1970 (Date.now()). */
  start: number;
  /** When it ended, in milliseconds since 1970; after start. */
  end: number;
}

export interface FitHealthPlugin {
  /** False where the device has no Health app (an iPad before iPadOS 17, Android, a browser). */
  isAvailable(): Promise<{ available: boolean }>;
  /** Write permission for workouts, without asking. */
  authorizationStatus(): Promise<{ status: FitHealthStatus }>;
  /** Apple's permission sheet, once ever; after that it answers straight away. */
  requestAuthorization(): Promise<{ status: FitHealthStatus }>;
  /** Saves one finished workout. Rejects if it can't (not allowed, no Health, bad dates). */
  saveWorkout(workout: FitHealthWorkout): Promise<{ uuid: string }>;
}

export declare const FitHealth: FitHealthPlugin;
