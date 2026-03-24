#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(TikTokTracking, NSObject)

RCT_EXTERN_METHOD(trackEvent:(NSString *)eventName)
RCT_EXTERN_METHOD(identify:(NSString *)externalId
                  externalUserName:(NSString *)externalUserName
                  phoneNumber:(NSString *)phoneNumber
                  email:(NSString *)email)

@end
