Pod::Spec.new do |s|
  s.name           = 'VoiceCapture'
  s.version        = '1.0.0'
  s.summary        = 'Streams the microphone as 16 kHz mono PCM for on-device speech recognition.'
  s.description    = 'Local Expo module of the app: AVAudioEngine, converted to 16 kHz mono 16-bit samples, sent to JavaScript. Nothing is written to disk.'
  s.license        = 'UNLICENSED'
  s.author         = 'The app'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation'

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
