import Foundation
import React
import TikTokBusinessSDK

@objc(TikTokTracking)
class TikTokTracking: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc func trackEvent(_ eventName: String) {
    let event = TikTokBaseEvent(eventName: eventName)
    TikTokBusiness.trackTTEvent(event)
  }

  @objc func identify(_ externalId: String?, externalUserName: String?, phoneNumber: String?, email: String?) {
    TikTokBusiness.identify(
      withExternalID: externalId ?? "",
      externalUserName: externalUserName ?? "",
      phoneNumber: phoneNumber ?? "",
      email: email ?? ""
    )
  }
}
