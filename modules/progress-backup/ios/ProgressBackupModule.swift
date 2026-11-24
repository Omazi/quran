import ExpoModulesCore
import Foundation

/// Keeps one text per key in the person's iCloud key-value store.
///
/// The store belongs to the person's iCloud account: nothing goes to a server of the app. It
/// works without an account too, keeping the values on the device until an account is there.
/// NOT COMPILED OR RUN YET: written against the Expo Modules API of SDK 58 and Apple's
/// `NSUbiquitousKeyValueStore`, to be verified on the first build.
public class ProgressBackupModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ProgressBackup")

    // Whether the person is signed in to iCloud. Informative: reading and writing are safe
    // either way.
    Function("isAvailable") { () -> Bool in
      FileManager.default.ubiquityIdentityToken != nil
    }

    // The text kept under the key, or nil. `synchronize` first asks for what other devices,
    // or an earlier installation, have written.
    AsyncFunction("read") { (key: String) -> String? in
      let store = NSUbiquitousKeyValueStore.default
      store.synchronize()
      return store.string(forKey: key)
    }

    // Keeps the text under the key. Returns false when the store refused it.
    AsyncFunction("write") { (key: String, value: String) -> Bool in
      let store = NSUbiquitousKeyValueStore.default
      store.set(value, forKey: key)
      return store.synchronize()
    }
  }
}
