import Expo
// @generated begin Intercom header - expo prebuild (DO NOT MODIFY) sync-f6fd06e08d30c2c66260b72f45072d393b20a2dc
import intercom_react_native
// @generated end Intercom header
import FirebaseCore
import React
import ReactAppDependencyProvider
import TikTokBusinessSDK

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
// @generated begin @react-native-firebase/app-didFinishLaunchingWithOptions - expo prebuild (DO NOT MODIFY) sync-10e8520570672fd76b2403b7e1e27f5198a6349a
FirebaseApp.configure()
// @generated end @react-native-firebase/app-didFinishLaunchingWithOptions
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    IntercomModule.initialize("ios_sdk-0defee459efb13cd27f68001a4f66ca6b468d9f4", withAppId: "tf4dp3qt")

    // TikTok Business SDK: initialize with debug in development
    let tiktokAppId = Bundle.main.object(forInfoDictionaryKey: "TIKTOK_APP_ID") as? String ?? "616288647079362578"
    let appId = Bundle.main.bundleIdentifier ?? "app.planmoni"
    let config = TikTokConfig(appId: appId, tiktokAppId: tiktokAppId)
    #if DEBUG
    config.isDebugMode = true
    #endif
    TikTokBusiness.initializeSdk(config) { success, error in
      if success {
        print("[TikTok] SDK initialized successfully")
        // Set test event code so events appear in TikTok Events Manager > Test events tab.
        // Get your code from: TikTok Ads Manager > Assets > Events > [your pixel] > Test events tab.
        // Remove or clear TIKTOK_TEST_EVENT_CODE in Info.plist before production.
        if let testCode = Bundle.main.object(forInfoDictionaryKey: "TIKTOK_TEST_EVENT_CODE") as? String, !testCode.isEmpty {
          TikTokBusiness.testEventCode = testCode
          print("[TikTok] Test event code set:", testCode)
        }
      } else {
        print("[TikTok] Init failed:", error?.localizedDescription ?? "unknown")
      }
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
