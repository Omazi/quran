Pod::Spec.new do |s|
  s.name           = 'ProgressBackup'
  s.version        = '1.0.0'
  s.summary        = 'Keeps a copy of the reading progress in the iCloud key-value store.'
  s.description    = 'Local Expo module of the app: reads and writes one text in NSUbiquitousKeyValueStore.'
  s.license        = 'UNLICENSED'
  s.author         = 'The app'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
