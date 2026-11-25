import AVFoundation
import ExpoModulesCore
import UIKit

/// The microphone, for the app's speech engine (docs/DECISIONS.md, D42).
///
/// Records with AVAudioEngine, converts to 16 kHz mono, and sends 16-bit little-endian samples to
/// JavaScript as base64, one event per chunk. Nothing is written to disk and nothing leaves the
/// phone: Whisper reads the samples in memory (`src/data/speech`).
///
/// It stops by itself, and says why in an `onEnd` event, when the system takes the microphone
/// away (a call, Siri, another app), when the audio route changes under it, and when the app goes
/// to the background: the app does not record in the background.
///
/// Lessons taken from expo-pcm-recorder (MIT, Tilawi) and the issues it cites: the tap is
/// installed with the input's own format, queried right before installing it, and the sample
/// rate is converted with AVAudioConverter rather than asked of the session.
///
/// NOT COMPILED OR RUN HERE: written against the Expo Modules API of SDK 58 and AVFoundation,
/// verified by the iOS build on GitHub's Macs and on the iPhone (docs/BUILD.md).
public class VoiceCaptureModule: Module {
  private let lock = NSLock()
  private var engine: AVAudioEngine?
  private var converter: AVAudioConverter?
  private var targetFormat: AVAudioFormat?
  private var pending: [Int16] = []
  private var chunkSamples = 1600
  private var isRecording = false
  private var observers: [NSObjectProtocol] = []

  public func definition() -> ModuleDefinition {
    Name("VoiceCapture")

    Events("onAudio", "onEnd")

    // `undetermined`, `granted` or `denied`, without asking.
    AsyncFunction("getPermission") { () -> String in
      return VoiceCaptureModule.currentPermission()
    }

    // Shows the system's alert when nobody asked yet; otherwise answers at once.
    AsyncFunction("requestPermission") { (promise: Promise) in
      let answer: (Bool) -> Void = { granted in
        promise.resolve(granted ? "granted" : "denied")
      }
      if #available(iOS 17.0, *) {
        AVAudioApplication.requestRecordPermission(completionHandler: answer)
      } else {
        AVAudioSession.sharedInstance().requestRecordPermission(answer)
      }
    }

    AsyncFunction("start") { (sampleRate: Double, chunkMs: Int) in
      try self.start(sampleRate: sampleRate, chunkMs: chunkMs)
    }

    AsyncFunction("stop") {
      self.stop(reason: nil)
    }

    OnDestroy {
      self.stop(reason: nil)
    }
  }

  private static func currentPermission() -> String {
    if #available(iOS 17.0, *) {
      switch AVAudioApplication.shared.recordPermission {
      case .granted: return "granted"
      case .denied: return "denied"
      default: return "undetermined"
      }
    }
    switch AVAudioSession.sharedInstance().recordPermission {
    case .granted: return "granted"
    case .denied: return "denied"
    default: return "undetermined"
    }
  }

  private func start(sampleRate: Double, chunkMs: Int) throws {
    guard VoiceCaptureModule.currentPermission() == "granted" else {
      throw MicrophoneNotGrantedException()
    }
    stop(reason: nil)

    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.record, mode: .default, options: [])
    try session.setActive(true, options: [])

    let engine = AVAudioEngine()
    let input = engine.inputNode
    let inputFormat = input.inputFormat(forBus: 0)
    guard inputFormat.sampleRate > 0, inputFormat.channelCount > 0 else {
      try? session.setActive(false, options: .notifyOthersOnDeactivation)
      throw NoMicrophoneInputException()
    }
    guard
      let target = AVAudioFormat(
        commonFormat: .pcmFormatFloat32, sampleRate: sampleRate, channels: 1, interleaved: false),
      let converter = AVAudioConverter(from: inputFormat, to: target)
    else {
      try? session.setActive(false, options: .notifyOthersOnDeactivation)
      throw AudioFormatException()
    }

    lock.lock()
    self.engine = engine
    self.converter = converter
    self.targetFormat = target
    self.pending = []
    self.chunkSamples = max(1, Int(sampleRate) * chunkMs / 1000)
    self.isRecording = true
    lock.unlock()

    input.installTap(onBus: 0, bufferSize: 4096, format: inputFormat) { [weak self] buffer, _ in
      self?.process(buffer)
    }
    observe(engine: engine)
    engine.prepare()
    do {
      try engine.start()
    } catch {
      stop(reason: nil)
      throw error
    }
  }

  private func observe(engine: AVAudioEngine) {
    let center = NotificationCenter.default
    let session = AVAudioSession.sharedInstance()
    observers = [
      center.addObserver(
        forName: AVAudioSession.interruptionNotification, object: session, queue: nil
      ) { [weak self] notification in
        let raw = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
        if raw.flatMap(AVAudioSession.InterruptionType.init(rawValue:)) == .began {
          self?.stop(reason: "interrupted")
        }
      },
      center.addObserver(
        forName: AVAudioSession.mediaServicesWereResetNotification, object: session, queue: nil
      ) { [weak self] _ in
        self?.stop(reason: "failed")
      },
      // AirPods connected, a cable pulled: the engine stops and its format may change.
      center.addObserver(
        forName: .AVAudioEngineConfigurationChange, object: engine, queue: nil
      ) { [weak self] _ in
        self?.stop(reason: "interrupted")
      },
      center.addObserver(
        forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: nil
      ) { [weak self] _ in
        self?.stop(reason: "interrupted")
      },
    ]
  }

  private func process(_ buffer: AVAudioPCMBuffer) {
    // Short work under the lock: one conversion. `stop` takes the same lock, so a callback
    // either finishes sending its audio before `stop` or sees that recording is over.
    lock.lock()
    defer { lock.unlock() }
    guard isRecording, let converter = converter, let target = targetFormat else { return }

    let ratio = target.sampleRate / buffer.format.sampleRate
    let capacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 32
    guard let output = AVAudioPCMBuffer(pcmFormat: target, frameCapacity: capacity) else { return }

    var supplied = false
    var conversionError: NSError?
    // `.noDataNow` rather than `.endOfStream` keeps the resampler's state between taps.
    let status = converter.convert(to: output, error: &conversionError) { _, inputStatus in
      if supplied {
        inputStatus.pointee = .noDataNow
        return nil
      }
      supplied = true
      inputStatus.pointee = .haveData
      return buffer
    }
    guard status != .error, let channel = output.floatChannelData else { return }
    let count = Int(output.frameLength)
    if count == 0 { return }

    let samples = UnsafeBufferPointer(start: channel[0], count: count)
    pending.reserveCapacity(pending.count + count)
    for sample in samples {
      let clamped = max(-1, min(1, sample))
      pending.append(Int16(clamped * 32767))
    }
    while pending.count >= chunkSamples {
      let chunk = Array(pending[0..<chunkSamples])
      pending.removeFirst(chunkSamples)
      // iPhones are little-endian: the bytes of the array are the samples the app expects.
      let data = chunk.withUnsafeBufferPointer { Data(buffer: $0) }
      sendEvent("onAudio", ["pcm": data.base64EncodedString()])
    }
  }

  /// Stops recording; `reason` is sent as `onEnd` when the module stopped by itself.
  private func stop(reason: String?) {
    lock.lock()
    guard isRecording, let engine = engine else {
      lock.unlock()
      return
    }
    isRecording = false
    self.engine = nil
    self.converter = nil
    self.targetFormat = nil
    pending = []
    let toRemove = observers
    observers = []
    lock.unlock()

    for observer in toRemove {
      NotificationCenter.default.removeObserver(observer)
    }
    // Outside the lock: removing the tap may wait for a running callback, which needs it.
    engine.inputNode.removeTap(onBus: 0)
    engine.stop()
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)

    if let reason = reason {
      sendEvent("onEnd", ["reason": reason])
    }
  }
}

final class MicrophoneNotGrantedException: Exception {
  override var reason: String { "The microphone is not granted" }
}

final class NoMicrophoneInputException: Exception {
  override var reason: String { "No microphone input is available" }
}

final class AudioFormatException: Exception {
  override var reason: String { "Could not convert the microphone to 16 kHz mono" }
}
