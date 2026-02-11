Pod::Spec.new do |s|
  s.name         = 'ExpoCredentialManager'
  s.version      = '0.1.1'
  s.summary      = 'Expo module exposing Android Credential Manager.'
  s.description  = 'Expo module exposing Android Credential Manager (passkeys, passwords, and Google Sign-In).'
  s.license      = { :type => 'MIT' }
  s.author       = { 'Expo' => 'support@expo.dev' }
  s.platforms    = { :ios => '13.0' }
  s.source       = { :path => '.' }
  s.source_files = '**/*.{h,m,mm,swift}'
  s.dependency 'ExpoModulesCore'
end
