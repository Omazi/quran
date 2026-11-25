import AVFoundation
import ExpoModulesCore
import UIKit

/// The microphone, for the app's speech engine (docs/DECISIONS.md, D42).
///
/// Records with AVAudioEngine, converts to 16 kHz mono, and sends 16-bit little-endian samples to
/// JavaScript as base64, one event per chunk, and the level of the microphone (RMS and peak, as a
/// share of full scale) about 25 times a second, so the screen moves with the voice. Nothing is
/// written to disk and nothing leaves the phone: Whisper reads the samples in memory
/// (`src/data/speech`).
///
/// Nothing fails in silence: a conversion that keeps failing ends the recording with `onEnd`
/// `failed` and a message; `getDiagnostics` says whether the model file is in the app and what the
/// microphone looks like, for the hidden diagnostics of the settings.
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

  // The level, measured on the converted samples: one value every `levelSamples`.
  private var levelSamples = 640
  private var levelSum: Double = 0
  private var levelPeak: Float = 0
  private var levelCount = 0

  // For the diagnostics, and to stop instead of failing in silence.
  private var buffersReceived = 0
  private var chunksSent = 0
  private var conversionErrors = 0
  private var consecutiveConversionErrors = 0
  private var restarts = 0
  private var inputDescription = "none"
  private var lastNativeError = ""
  /// Restarts after a change of audio route run here, one at a time, never on the audio thread.
  private let controlQueue = DispatchQueue(label: "voice-capture.control")

  /// A conversion failing this many times in a row ends the recording.
  private static let maxConsecutiveConversionErrors = 5
  /// The engine is restarted at most this many times per recording after a change of route.
  private static let maxRestarts = 3
  /// Level events per second.
  private static let levelsPerSecond = 25.0

  public func definition() -> ModuleDefinition {
    Name("VoiceCapture")

    Events("onAudio", "onLevel", "onEnd")

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

    // Whether the model file is in the app and its size, the audio session and the microphone,
    // and the counters of the last recording. For the diagnostics only.
    AsyncFunction("getDiagnostics") { (modelFile: String) -> [String: Any] in
      return self.diagnostics(modelFile: modelFile)
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

  private func diagnostics(modelFile: String) -> [String: Any] {
    var info: [String: Any] = [:]
    if let path = Bundle.main.path(forResource: modelFile, ofType: nil) {
      let attributes = try? FileManager.default.attributesOfItem(atPath: path)
      info["modelPresent"] = true
      info["modelBytes"] = (attributes?[.size] as? NSNumber)?.intValue ?? -1
    } else {
      info["modelPresent"] = false
      info["modelBytes"] = 0
    }
    info["appBuild"] = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? ""
    let session = AVAudioSession.sharedInstance()
    info["permission"] = VoiceCaptureModule.currentPermission()
    info["sessionCategory"] = session.category.rawValue
    info["sessionMode"] = session.mode.rawValue
    info["inputAvailable"] = session.isInputAvailable
    info["inputRoute"] = session.currentRoute.inputs.first?.portType.rawValue ?? "none"
    info["hardwareSampleRate"] = session.sampleRate
    lock.lock()
    info["recording"] = isRecording
    info["inputFormat"] = inputDescription
    info["buffersReceived"] = buffersReceived
    info["chunksSent"] = chunksSent
    info["conversionErrors"] = conversionErrors
    info["restarts"] = restarts
    info["lastNativeError"] = lastNativeError
    lock.unlock()
    return info
  }

  private func start(sampleRate: Double, chunkMs: Int) throws {
    guard VoiceCaptureModule.currentPermission() == "granted" else {
      throw MicrophoneNotGrantedException()
    }
    stop(reason: nil)

    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(.record, mode: .default, options: [])
      try session.setActive(true, options: [])
    } catch {
      remember(error: "audio session: \(error.localizedDescription)")
      throw error
    }

    let engine = AVAudioEngine()
    let input = engine.inputNode
    let inputFormat = input.inputFormat(forBus: 0)
    guard inputFormat.sampleRate > 0, inputFormat.channelCount > 0 else {
      try? session.setActive(false, options: .notifyOthersOnDeactivation)
      remember(error: "no microphone input")
      throw NoMicrophoneInputException()
    }
    guard
      let target = AVAudioFormat(
        commonFormat: .pcmFormatFloat32, sampleRate: sampleRate, channels: 1, interleaved: false),
      let converter = AVAudioConverter(from: inputFormat, to: target)
    else {
      try? session.setActive(false, options: .notifyOthersOnDeactivation)
      remember(error: "no converter from \(inputFormat)")
      throw AudioFormatException()
    }

    lock.lock()
    self.engine = engine
    self.converter = converter
    self.targetFormat = target
    self.pending = []
    self.chunkSamples = max(1, Int(sampleRate) * chunkMs / 1000)
    self.levelSamples = max(1, Int(sampleRate / VoiceCaptureModule.levelsPerSecond))
    self.levelSum = 0
    self.levelPeak = 0
    self.levelCount = 0
    self.buffersReceived = 0
    self.chunksSent = 0
    self.conversionErrors = 0
    self.consecutiveConversionErrors = 0
    self.restarts = 0
    self.inputDescription =
      "\(Int(inputFormat.sampleRate)) Hz, \(inputFormat.channelCount) ch"
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
      remember(error: "engine start: \(error.localizedDescription)")
      stop(reason: nil)
      throw error
    }
  }

  private func remember(error: String) {
    lock.lock()
    lastNativeError = error
    lock.unlock()
  }

  /// AirPods connected, a cable pulled: the engine stopped and the input's format may have
  /// changed. It is set up again with the new format, a few times at most, rather than ending a
  /// recitation that has only changed microphone.
  private func restartAfterConfigurationChange() {
    lock.lock()
    guard isRecording, let engine = engine, let target = targetFormat else {
      lock.unlock()
      return
    }
    guard restarts < VoiceCaptureModule.maxRestarts else {
      lock.unlock()
      stop(reason: "interrupted", message: "the audio route changed too often")
      return
    }
    restarts += 1
    lock.unlock()

    let input = engine.inputNode
    input.removeTap(onBus: 0)
    let inputFormat = input.inputFormat(forBus: 0)
    guard
      inputFormat.sampleRate > 0, inputFormat.channelCount > 0,
      let converter = AVAudioConverter(from: inputFormat, to: target)
    else {
      stop(reason: "failed", message: "no microphone input after the audio route changed")
      return
    }
    // Under the lock, so a `stop` cannot slip in between and leave a tap on a stopped recording.
    // Nothing here waits for a tap callback: one that comes meanwhile waits for the lock.
    lock.lock()
    guard isRecording, self.engine === engine else {
      lock.unlock()
      return
    }
    self.converter = converter
    self.pending = []
    self.inputDescription =
      "\(Int(inputFormat.sampleRate)) Hz, \(inputFormat.channelCount) ch"
    input.installTap(onBus: 0, bufferSize: 4096, format: inputFormat) { [weak self] buffer, _ in
      self?.process(buffer)
    }
    engine.prepare()
    var startError: Error?
    do {
      try engine.start()
    } catch {
      startError = error
    }
    lock.unlock()
    if let error = startError {
      stop(reason: "interrupted", message: "engine restart: \(error.localizedDescription)")
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
          self?.stop(reason: "interrupted", message: "interrupted by the system (a call, Siri…)")
        }
      },
      center.addObserver(
        forName: AVAudioSession.mediaServicesWereResetNotification, object: session, queue: nil
      ) { [weak self] _ in
        self?.stop(reason: "failed", message: "the media services were reset")
      },
      // AirPods connected, a cable pulled: the engine stops and its format may change.
      center.addObserver(
        forName: .AVAudioEngineConfigurationChange, object: engine, queue: nil
      ) { [weak self] _ in
        self?.controlQueue.async { self?.restartAfterConfigurationChange() }
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
    buffersReceived += 1

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
    guard status != .error, let channel = output.floatChannelData else {
      conversionErrors += 1
      consecutiveConversionErrors += 1
      lastNativeError = "conversion: \(conversionError?.localizedDescription ?? "no output")"
      if consecutiveConversionErrors == VoiceCaptureModule.maxConsecutiveConversionErrors {
        let message = "the microphone could not be converted to 16 kHz (\(lastNativeError))"
        // Not here: `stop` takes the lock this callback holds, and removes this very tap.
        controlQueue.async { [weak self] in self?.stop(reason: "failed", message: message) }
      }
      return
    }
    consecutiveConversionErrors = 0
    let count = Int(output.frameLength)
    if count == 0 { return }

    let samples = UnsafeBufferPointer(start: channel[0], count: count)
    pending.reserveCapacity(pending.count + count)
    for sample in samples {
      let clamped = max(-1, min(1, sample))
      pending.append(Int16(clamped * 32767))
      // The level: RMS and peak of each `levelSamples`, sent as soon as they are complete.
      levelSum += Double(clamped * clamped)
      levelPeak = max(levelPeak, abs(clamped))
      levelCount += 1
      if levelCount >= levelSamples {
        let rms = (levelSum / Double(levelCount)).squareRoot()
        sendEvent("onLevel", ["rms": rms, "peak": Double(levelPeak)])
        levelSum = 0
        levelPeak = 0
        levelCount = 0
      }
    }
    while pending.count >= chunkSamples {
      let chunk = Array(pending[0..<chunkSamples])
      pending.removeFirst(chunkSamples)
      // iPhones are little-endian: the bytes of the array are the samples the app expects.
      let data = chunk.withUnsafeBufferPointer { Data(buffer: $0) }
      sendEvent("onAudio", ["pcm": data.base64EncodedString()])
      chunksSent += 1
    }
  }

  /// Stops recording; `reason` (and `message`, what happened) is sent as `onEnd` when the module
  /// stopped by itself.
  private func stop(reason: String?, message: String? = nil) {
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
      if let message = message { remember(error: message) }
      sendEvent("onEnd", ["reason": reason, "message": message ?? reason])
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
