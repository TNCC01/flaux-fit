/*
  © 2026 Wayne Cavanagh / Flaux. All rights reserved.

  APPLE HEALTH: FIT adds each workout you finish to the Health app.

  It asks for one thing only, permission to write workouts. It reads
  nothing from Health and writes nothing else: no heart rate, no
  calories (FIT doesn't measure them, so it doesn't make them up), just
  the workout itself, what kind it was, when it started and when it
  ended. Nothing goes anywhere but the Health app on this device.

  The workout is made with HKWorkoutBuilder, Apple's current way to save
  one (HKWorkout's own initialisers are deprecated from iOS 17). A builder
  with no samples added and no pause events gives a workout whose
  duration is its end less its start, so the bridge (app/native-bridge.js)
  sends a start that is the end less the minutes FIT's clock actually
  ran.

  The bridge reaches this as Capacitor.Plugins.FitHealth. Every method
  resolves; the only rejections are a save that can't happen, which the
  bridge reports on the finish screen.

    isAvailable()          { available }  false where there's no Health
                                           app (an iPad before iPadOS 17)
    authorizationStatus()  { status }     'authorized', 'denied',
                                           'notDetermined' or 'unavailable'
    requestAuthorization() { status }     the same, after Apple's sheet
                                           (shown once; after that it's
                                           Settings or the Health app)
    saveWorkout({ activity, start, end }) { uuid }
                           activity is one of the names in ACTIVITIES,
                           start and end are milliseconds since 1970

  Written against the HealthKit and Capacitor 8 APIs without a Mac to
  compile on: the first Xcode build is its first compile (see
  app/README.md).
*/
import Foundation
import Capacitor
import HealthKit

@objc(FitHealthPlugin)
public class FitHealthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FitHealthPlugin"
    public let jsName = "FitHealth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authorizationStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveWorkout", returnType: CAPPluginReturnPromise)
    ]

    // The kinds of workout FIT saves, by the names the bridge sends. See
    // HEALTH in app/native-bridge.js for which FIT style is which.
    private static let activities: [String: HKWorkoutActivityType] = [
        "highIntensityIntervalTraining": .highIntensityIntervalTraining,
        "functionalStrengthTraining": .functionalStrengthTraining,
        "crossTraining": .crossTraining,
        "mixedCardio": .mixedCardio,
        "flexibility": .flexibility
    ]

    // One store for the app's life, as Apple asks, and only made once
    // something needs it (never on a device without Health).
    private lazy var store = HKHealthStore()

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    @objc func authorizationStatus(_ call: CAPPluginCall) {
        call.resolve(["status": statusName()])
    }

    // Write permission for workouts and nothing to read, so Apple's sheet
    // has one switch on it. Its completion says the sheet was dealt with,
    // not what was chosen, so the answer is read back afterwards. Once
    // asked, iOS never shows the sheet again: the status comes straight
    // back, and a change of mind happens in the Health app.
    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["status": "unavailable"])
            return
        }
        store.requestAuthorization(toShare: [HKObjectType.workoutType()], read: nil) { _, error in
            if let error = error {
                call.reject(error.localizedDescription, "AUTH_FAILED", error)
                return
            }
            call.resolve(["status": self.statusName()])
        }
    }

    @objc func saveWorkout(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("Apple Health isn't available on this device", "UNAVAILABLE")
            return
        }
        guard let activity = FitHealthPlugin.activities[call.getString("activity") ?? ""],
              let startMs = call.getDouble("start"),
              let endMs = call.getDouble("end"),
              endMs > startMs else {
            call.reject("A workout needs a kind, a start and an end after it", "BAD_WORKOUT")
            return
        }
        guard store.authorizationStatus(for: HKObjectType.workoutType()) == .sharingAuthorized else {
            call.reject("FIT isn't allowed to save workouts to Apple Health", "NOT_AUTHORIZED")
            return
        }
        let start = Date(timeIntervalSince1970: startMs / 1000)
        let end = Date(timeIntervalSince1970: endMs / 1000)

        let configuration = HKWorkoutConfiguration()
        configuration.activityType = activity
        let builder = HKWorkoutBuilder(healthStore: store, configuration: configuration, device: HKDevice.local())
        let fail: (Error?, String) -> Void = { error, said in
            call.reject(error?.localizedDescription ?? said, "SAVE_FAILED", error)
        }
        builder.beginCollection(withStart: start) { began, error in
            guard began else { return fail(error, "The workout couldn't be started in Health") }
            builder.endCollection(withEnd: end) { ended, error in
                guard ended else { return fail(error, "The workout couldn't be ended in Health") }
                builder.finishWorkout { workout, error in
                    guard let workout = workout else { return fail(error, "Health didn't save the workout") }
                    call.resolve(["uuid": workout.uuid.uuidString])
                }
            }
        }
    }

    private func statusName() -> String {
        guard HKHealthStore.isHealthDataAvailable() else { return "unavailable" }
        switch store.authorizationStatus(for: HKObjectType.workoutType()) {
        case .sharingAuthorized: return "authorized"
        case .sharingDenied: return "denied"
        case .notDetermined: return "notDetermined"
        @unknown default: return "notDetermined"
        }
    }
}
